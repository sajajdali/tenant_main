<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Store\Models\StoreProduct;
use App\Domain\Store\Models\StoreOrder;
use App\Domain\Store\Models\StoreOrderPayment;
use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\PaymentSetting;
use App\Domain\Tenant\Models\TenantUser;
use App\Services\Payments\TenantMaliartGateway;
use App\Support\TenantSandboxMode;
use App\Support\TenantPaymentGateways;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Shetabit\Multipay\Exceptions\InvalidPaymentException;
use Shetabit\Multipay\Invoice;
use Shetabit\Payment\Facade\Payment;

class StoreOrderCheckoutService
{
    public function __construct(
        private readonly CustomerClubService $customerClubService,
        private readonly TenantMaliartGateway $maliart,
    ) {
    }

    public function settings(): array
    {
        $payment = PaymentSetting::query()->first();
        $general = GeneralSetting::query()->first();
        $credentials = $payment?->credentials ?? [];
        $meta = $payment?->meta ?? [];
        $bookingRules = $general?->booking_rules ?? [];
        $gateways = TenantPaymentGateways::normalized($credentials['gateways'] ?? []);
        $enabledGateways = TenantPaymentGateways::configuredEnabled($gateways);

        if ($this->maliart->enabled()) {
            return [
                'enabled' => true, 'provider' => 'maliart', 'sandbox_enabled' => false,
                'gateways' => [], 'enabled_gateways' => ['maliart'], 'card_note' => '', 'maliart_enabled' => true,
            ];
        }

        return [
            'enabled' => (bool) ($payment?->enabled ?? false),
            'provider' => $payment?->provider ?: ($enabledGateways[0] ?? null),
            'sandbox_enabled' => TenantSandboxMode::paymentEnabled(null, (bool) ($meta['sandbox_enabled'] ?? false)),
            'gateways' => $gateways,
            'enabled_gateways' => $enabledGateways,
            'card_note' => (string) ($bookingRules['management_panel_note'] ?? ''),
            'maliart_enabled' => false,
        ];
    }

    public function checkout(TenantUser $actor, array $validated, string $callbackUrlTemplate): array
    {
        $settings = $this->settings();
        if (($settings['maliart_enabled'] ?? false) === true) {
            $validated['paymentMethod'] = 'online';
            $validated['gateway'] = 'maliart';
        }
        $resolvedItems = $this->resolveItems($validated['items']);
        $pricing = $this->calculateAmounts($validated, $resolvedItems);
        $isFreeCheckout = (int) $pricing['total'] <= 0;

        /** @var array{order: StoreOrder, payment: StoreOrderPayment} $created */
        $created = DB::transaction(function () use ($actor, $validated, $pricing, $settings, $resolvedItems, $isFreeCheckout): array {
            $orderStatus = $isFreeCheckout ? 'pending_payment' : match ($validated['paymentMethod']) {
                'cod' => 'placed',
                'card' => 'awaiting_card_transfer',
                default => 'pending_payment',
            };

            $paymentStatus = $isFreeCheckout ? 'pending' : match ($validated['paymentMethod']) {
                'cod' => 'pending_cash',
                'card' => 'awaiting_transfer',
                default => 'pending',
            };

            $order = StoreOrder::query()->create([
                'created_by_user_id' => $actor->id,
                'order_number' => $this->makeOrderNumber(),
                'status' => $orderStatus,
                'payment_method' => $validated['paymentMethod'],
                'shipping_method' => $validated['shippingMethod'],
                'customer_name' => $validated['customerName'],
                'customer_phone' => $validated['customerPhone'],
                'delivery_title' => $validated['address']['title'] ?? null,
                'delivery_province_id' => $validated['address']['provinceId'] ?? null,
                'delivery_province_name' => $validated['address']['provinceName'] ?? null,
                'delivery_city_id' => $validated['address']['cityId'] ?? null,
                'delivery_city_name' => $validated['address']['cityName'] ?? null,
                'delivery_latitude' => $validated['address']['latitude'] ?? null,
                'delivery_longitude' => $validated['address']['longitude'] ?? null,
                'delivery_address' => $validated['address']['address'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'items_count' => $pricing['itemsCount'],
                'subtotal_amount' => $pricing['subtotal'],
                'shipping_amount' => $pricing['shipping'],
                'discount_amount' => $pricing['discount'],
                'total_amount' => $pricing['total'],
                'paid_at' => $validated['paymentMethod'] === 'cod' ? now() : null,
                'metadata' => [
                    'payment_gateway' => $validated['gateway'] ?? null,
                    'stock_deducted_at' => $validated['paymentMethod'] === 'cod' ? now()->toDateTimeString() : null,
                ],
            ]);

            foreach ($resolvedItems as $item) {
                $unitAmount = (int) $item['unitAmount'];
                $quantity = (int) $item['quantity'];

                $order->items()->create([
                    'product_id' => (string) $item['productId'],
                    'title' => $item['title'],
                    'subtitle' => $item['subtitle'] ?? null,
                    'image_label' => $item['imageLabel'] ?? null,
                    'unit_amount' => $unitAmount,
                    'quantity' => $quantity,
                    'total_amount' => $unitAmount * $quantity,
                    'metadata' => [
                        'client_item_id' => $item['clientItemId'] ?? null,
                    ],
                ]);
            }

            $payment = $order->payments()->create([
                'created_by_user_id' => $actor->id,
                'invoice_number' => $this->makeInvoiceNumber(),
                'method' => $validated['paymentMethod'],
                'gateway' => $isFreeCheckout ? 'free' : ($validated['paymentMethod'] === 'online' ? ($validated['gateway'] ?? null) : null),
                'status' => $paymentStatus,
                'sandbox_mode' => (bool) ($validated['paymentMethod'] === 'online' && $settings['sandbox_enabled']),
                'amount' => $pricing['total'],
                'expires_at' => now()->addMinutes(30),
                'paid_at' => $validated['paymentMethod'] === 'cod' ? now() : null,
                'metadata' => [
                    'card_note' => $settings['card_note'],
                ],
            ]);

            if ($validated['paymentMethod'] === 'cod') {
                $this->deductStockForOrder($order->fresh(['items']));
            }

            return ['order' => $order->fresh(['items', 'payments']), 'payment' => $payment->fresh()];
        });

        $order = $created['order'];
        $payment = $created['payment'];

        if ($isFreeCheckout) {
            $paidOrder = $this->markPaymentSuccessful($payment, 'FREE-'.$payment->invoice_number);

            return [
                'mode' => 'free',
                'order' => $paidOrder,
                'payment' => $payment->fresh(),
            ];
        }

        if ($validated['paymentMethod'] === 'cod') {
            return [
                'mode' => 'cod',
                'order' => $order,
                'payment' => $payment,
            ];
        }

        if ($validated['paymentMethod'] === 'card') {
            return [
                'mode' => 'card',
                'order' => $order,
                'payment' => $payment,
                'cardNote' => $settings['card_note'] !== '' ? $settings['card_note'] : 'بعد از واریز، اطلاعات پرداخت خود را برای پشتیبانی مجموعه ارسال کنید.',
            ];
        }

        if (! $settings['enabled']) {
            throw ValidationException::withMessages([
                'paymentMethod' => 'پرداخت آنلاین برای این سامانه فعال نیست.',
            ]);
        }

        $gateway = (string) ($validated['gateway'] ?? '');

        if ($gateway !== 'maliart' && ! in_array($gateway, $settings['enabled_gateways'], true)) {
            throw ValidationException::withMessages([
                'gateway' => 'درگاه انتخاب‌شده فعال یا کامل نیست.',
            ]);
        }

        if ($settings['sandbox_enabled']) {
            $paidOrder = $this->markPaymentSuccessful($payment, 'sandbox-'.Str::upper(Str::random(10)));

            return [
                'mode' => 'sandbox',
                'order' => $paidOrder,
                'payment' => $payment->fresh(),
            ];
        }

        $callbackUrl = str_replace(['{payment}', '__PAYMENT__'], (string) $payment->id, $callbackUrlTemplate);

        if ($gateway === 'maliart') {
            $remote = $this->maliart->start(
                (string) $payment->invoice_number,
                (int) $payment->amount,
                'store_order',
                __('store.order.payment_description'),
                $callbackUrl,
                (string) $order->customer_name,
                (string) $order->customer_phone,
            );
            $payment->update(['gateway' => 'maliart', 'transaction_id' => $remote['paymentId']]);

            return [
                'mode' => 'gateway', 'order' => $order, 'payment' => $payment->fresh(),
                'paymentUrl' => $remote['paymentUrl'], 'redirectForm' => null,
            ];
        }

        $invoice = (new Invoice())
            ->amount((int) $payment->amount)
            ->detail('description', 'پرداخت سفارش فروشگاه')
            ->detail('mobile', $order->customer_phone);

        $paymentManager = Payment::via($gateway)
            ->config(TenantPaymentGateways::driverConfig($gateway, $settings['gateways'][$gateway], $callbackUrl))
            ->callbackUrl($callbackUrl);

        $paymentManager->purchase($invoice, function ($driver, $transactionId) use ($payment): void {
            $payment->update([
                'transaction_id' => (string) $transactionId,
            ]);
        });

        $redirectForm = $paymentManager->pay()->jsonSerialize();

        return [
            'mode' => 'gateway',
            'order' => $order,
            'payment' => $payment->fresh(),
            'redirectForm' => $redirectForm,
        ];
    }

    public function verify(StoreOrderPayment $payment): StoreOrder
    {
        if ($payment->status === 'paid') {
            return $payment->order;
        }

        if ((string) $payment->gateway === 'maliart') {
            $reference = $this->maliart->verify((string) $payment->transaction_id, (string) $payment->invoice_number, (int) $payment->amount);

            return $this->markPaymentSuccessful($payment, $reference);
        }

        $settings = $this->settings();
        $gateway = (string) $payment->gateway;
        $gatewaySettings = $settings['gateways'][$gateway] ?? null;

        if (! $gatewaySettings) {
            throw ValidationException::withMessages([
                'payment' => 'تنظیمات درگاه پرداخت یافت نشد.',
            ]);
        }

        try {
            $receipt = Payment::via($gateway)
                ->config(TenantPaymentGateways::driverConfig($gateway, $gatewaySettings, ''))
                ->amount((int) $payment->amount)
                ->transactionId((string) $payment->transaction_id)
                ->verify();
        } catch (InvalidPaymentException $exception) {
            $payment->update([
                'status' => 'failed',
                'failure_reason' => $exception->getMessage(),
            ]);

            $payment->order()->update([
                'status' => 'failed',
            ]);

            throw $exception;
        }

        return $this->markPaymentSuccessful($payment, (string) $receipt->getReferenceId());
    }

    public function finalizeCardTransfer(StoreOrder $order): StoreOrder
    {
        return DB::transaction(function () use ($order): StoreOrder {
            /** @var StoreOrder $lockedOrder */
            $lockedOrder = StoreOrder::query()->lockForUpdate()->findOrFail($order->id);
            $lockedOrder->load(['items']);
            $this->deductStockForOrder($lockedOrder);
            $freshOrder = $lockedOrder->fresh(['items', 'payments']);
            $this->customerClubService->awardStoreOrder($freshOrder);

            return $freshOrder;
        });
    }

    public function markCancelled(StoreOrderPayment $payment, string $message): void
    {
        if ($payment->status === 'paid') {
            return;
        }

        $payment->update([
            'status' => 'cancelled',
            'failure_reason' => $message,
        ]);

        $payment->order()->update([
            'status' => 'cancelled',
        ]);
    }

    private function markPaymentSuccessful(StoreOrderPayment $payment, string $referenceId): StoreOrder
    {
        return DB::transaction(function () use ($payment, $referenceId): StoreOrder {
            /** @var StoreOrderPayment $lockedPayment */
            $lockedPayment = StoreOrderPayment::query()->lockForUpdate()->findOrFail($payment->id);
            /** @var StoreOrder $order */
            $order = StoreOrder::query()->lockForUpdate()->findOrFail($lockedPayment->store_order_id);

            if ($lockedPayment->status === 'paid') {
                return $order;
            }

            $lockedPayment->update([
                'status' => 'paid',
                'reference_id' => $referenceId,
                'paid_at' => now(),
                'failure_reason' => null,
            ]);

            $order->update([
                'status' => 'paid',
                'paid_at' => now(),
            ]);

            $this->deductStockForOrder($order->fresh(['items']));

            $freshOrder = $order->fresh(['items', 'payments']);
            $this->customerClubService->awardStoreOrder($freshOrder);

            return $freshOrder;
        });
    }

    private function calculateAmounts(array $validated, array $resolvedItems): array
    {
        $itemsCount = 0;
        $subtotal = 0;

        foreach ($resolvedItems as $item) {
            $quantity = (int) $item['quantity'];
            $unitAmount = (int) $item['unitAmount'];
            $itemsCount += $quantity;
            $subtotal += $quantity * $unitAmount;
        }

        $shippingSettings = $this->shippingSettings();
        $shippingMethod = (string) $validated['shippingMethod'];
        $shipping = 0;

        if ($shippingMethod === 'courier') {
            if (! $shippingSettings['postal_enabled']) {
                throw ValidationException::withMessages([
                    'shippingMethod' => 'روش ارسال پیک معمولی فعال نیست.',
                ]);
            }

            $shipping = (int) $shippingSettings['postal_base_amount'];
            $provinceId = (int) ($validated['address']['provinceId'] ?? 0);
            $cityId = (int) ($validated['address']['cityId'] ?? 0);

            foreach ($shippingSettings['postal_city_overrides'] as $item) {
                if ((int) ($item['province_id'] ?? 0) === $provinceId && (int) ($item['city_id'] ?? 0) === $cityId) {
                    $shipping = (int) ($item['amount'] ?? $shipping);
                    break;
                }
            }
        } elseif ($shippingMethod === 'express') {
            if (! $shippingSettings['express_enabled']) {
                throw ValidationException::withMessages([
                    'shippingMethod' => 'روش ارسال سریع فعال نیست.',
                ]);
            }

            $provinceId = (int) ($validated['address']['provinceId'] ?? 0);
            $cityId = (int) ($validated['address']['cityId'] ?? 0);
            $allowed = false;

            foreach ($shippingSettings['express_cities'] as $item) {
                if ((int) ($item['province_id'] ?? 0) === $provinceId && (int) ($item['city_id'] ?? 0) === $cityId) {
                    $allowed = true;
                    break;
                }
            }

            if (! $allowed) {
                throw ValidationException::withMessages([
                    'shippingMethod' => 'ارسال سریع برای شهر انتخابی فعال نیست.',
                ]);
            }

            $shipping = (int) $shippingSettings['express_amount'];
        } elseif ($shippingMethod === 'pickup') {
            if (! $shippingSettings['pickup_enabled']) {
                throw ValidationException::withMessages([
                    'shippingMethod' => 'روش تحویل حضوری فعال نیست.',
                ]);
            }

            $shipping = 0;
        }

        $discount = $itemsCount >= 2 ? 30000 : 0;
        $total = max(0, $subtotal + $shipping - $discount);

        return compact('itemsCount', 'subtotal', 'shipping', 'discount', 'total');
    }

    private function resolveItems(array $items): array
    {
        $productIds = collect($items)
            ->map(fn ($item) => (int) ($item['productId'] ?? 0))
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values();

        if ($productIds->count() !== count($items)) {
            throw ValidationException::withMessages([
                'items' => 'شناسه برخی از محصولات معتبر نیست.',
            ]);
        }

        /** @var \Illuminate\Support\Collection<int, StoreProduct> $products */
        $products = StoreProduct::query()
            ->whereIn('id', $productIds->all())
            ->where('is_active', true)
            ->get()
            ->keyBy('id');

        return collect($items)
            ->map(function (array $item) use ($products): array {
                $productId = (int) ($item['productId'] ?? 0);
                /** @var StoreProduct|null $product */
                $product = $products->get($productId);

                if (! $product) {
                    throw ValidationException::withMessages([
                        'items' => 'بعضی محصولات موجود نیستند یا غیرفعال شده‌اند.',
                    ]);
                }

                $quantity = max(1, (int) ($item['quantity'] ?? 1));
                $currentStock = max(0, (int) $product->stock_quantity);
                if ($quantity > $currentStock) {
                    throw ValidationException::withMessages([
                        'items' => "موجودی محصول {$product->title} کافی نیست.",
                    ]);
                }

                $unitAmount = $product->discounted_price_amount !== null
                    ? (int) $product->discounted_price_amount
                    : (int) $product->price_amount;

                return [
                    'clientItemId' => $item['id'] ?? null,
                    'productId' => (string) $product->id,
                    'title' => (string) $product->title,
                    'subtitle' => $product->subtitle ?: $product->description,
                    'imageLabel' => (string) ($item['imageLabel'] ?? ''),
                    'quantity' => $quantity,
                    'unitAmount' => $unitAmount,
                ];
            })
            ->values()
            ->all();
    }

    private function deductStockForOrder(StoreOrder $order): void
    {
        $metadata = is_array($order->metadata) ? $order->metadata : [];
        if (! empty($metadata['stock_deducted_at'])) {
            return;
        }

        foreach ($order->items as $item) {
            $productId = (int) ($item->product_id ?? 0);
            $quantity = max(1, (int) $item->quantity);

            if ($productId <= 0) {
                continue;
            }

            /** @var StoreProduct $product */
            $product = StoreProduct::query()->lockForUpdate()->findOrFail($productId);
            $stock = max(0, (int) $product->stock_quantity);

            if ($stock < $quantity) {
                throw ValidationException::withMessages([
                    'items' => "موجودی محصول {$product->title} کافی نیست.",
                ]);
            }

            $product->update([
                'stock_quantity' => $stock - $quantity,
            ]);
        }

        $metadata['stock_deducted_at'] = now()->toDateTimeString();
        $order->update(['metadata' => $metadata]);
    }

    private function shippingSettings(): array
    {
        $general = GeneralSetting::query()->first();
        $rules = $general?->booking_rules ?? [];
        $storePage = $rules['store_page'] ?? [];
        $shipping = $storePage['shipping'] ?? [];

        return [
            'postal_enabled' => (bool) ($shipping['postal_enabled'] ?? true),
            'postal_base_amount' => (int) ($shipping['postal_base_amount'] ?? 0),
            'postal_city_overrides' => is_array($shipping['postal_city_overrides'] ?? null) ? $shipping['postal_city_overrides'] : [],
            'express_enabled' => (bool) ($shipping['express_enabled'] ?? false),
            'express_amount' => (int) ($shipping['express_amount'] ?? 0),
            'express_cities' => is_array($shipping['express_cities'] ?? null) ? $shipping['express_cities'] : [],
            'pickup_enabled' => (bool) ($shipping['pickup_enabled'] ?? false),
        ];
    }

    private function makeOrderNumber(): string
    {
        return 'ORD-'.now()->format('YmdHis').'-'.Str::upper(Str::random(5));
    }

    private function makeInvoiceNumber(): string
    {
        return 'SOP-'.now()->format('YmdHis').'-'.Str::upper(Str::random(6));
    }
}
