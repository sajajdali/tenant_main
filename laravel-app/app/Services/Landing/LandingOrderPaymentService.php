<?php

declare(strict_types=1);

namespace App\Services\Landing;

use App\Domain\Landing\Models\LandingCustomer;
use App\Domain\Landing\Models\LandingOrder;
use App\Domain\Landing\Models\LandingOrderPayment;
use App\Domain\Landing\Models\LandingSite;
use App\Domain\Tenant\Models\SubscriptionPackage;
use App\Models\SystemSetting;
use App\Services\Payments\MaliartPaymentClient;
use App\Support\TenantPaymentGateways;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Shetabit\Multipay\Exceptions\InvalidPaymentException;
use Shetabit\Multipay\Invoice;
use Shetabit\Payment\Facade\Payment;

class LandingOrderPaymentService
{
    public function __construct(
        private readonly LandingOrderService $orders,
        private readonly \App\Services\DiscountCodeService $discountCodes,
        private readonly \App\Services\SalesTrackingService $salesTracking,
        private readonly MaliartPaymentClient $maliart,
    ) {
    }

    public function settings(): array
    {
        $raw = array_merge([
            'enabled' => false,
            'sandbox_enabled' => true,
            'provider' => 'zarinpal',
        ], SystemSetting::getValue('support_payment', []));

        $gateways = TenantPaymentGateways::normalized($raw['gateways'] ?? []);
        $enabledGateways = TenantPaymentGateways::configuredEnabled($gateways);
        $provider = (string) ($raw['provider'] ?? ($enabledGateways[0] ?? 'zarinpal'));

        if (! in_array($provider, TenantPaymentGateways::supportedKeys(), true)) {
            $provider = $enabledGateways[0] ?? 'zarinpal';
        }

        return [
            'enabled' => (bool) ($raw['enabled'] ?? false),
            'sandbox_enabled' => (bool) ($raw['sandbox_enabled'] ?? false),
            'provider' => $provider,
            'gateways' => $gateways,
            'enabled_gateways' => $enabledGateways,
        ];
    }

    public function createPayment(
        LandingSite $landingSite,
        LandingCustomer $customer,
        SubscriptionPackage $subscriptionPackage,
        array $payload,
        string $callbackUrlTemplate,
        ?string $gateway = null,
    ): array {
        $settings = $this->settings();

        $useMaliart = $this->maliart->enabled();
        if (! $useMaliart && ! $settings['enabled'] && ! $settings['sandbox_enabled']) {
            throw new RuntimeException('پرداخت آنلاین برای سفارش لندینگ در حال حاضر فعال نیست.');
        }

        $order = $this->orders->createPendingPaymentOrder(
            $customer,
            $landingSite->audienceType()->firstOrFail(),
            $subscriptionPackage,
            array_merge($payload, [
                'landing_site_id' => $landingSite->id,
            ]),
            $landingSite,
        );

        return $this->createPaymentForOrder($order, $callbackUrlTemplate, $gateway);
    }

    public function createPaymentForOrder(
        LandingOrder $order,
        string $callbackUrlTemplate,
        ?string $gateway = null,
    ): array {
        $order->loadMissing(['customer', 'landingSite', 'subscriptionPackage']);
        $customer = $order->customer()->firstOrFail();
        $landingSite = $order->landingSite()->firstOrFail();
        $subscriptionPackage = $order->subscriptionPackage()->firstOrFail();
        $settings = $this->settings();

        $useMaliart = $this->maliart->enabled();
        if (! $useMaliart && ! $settings['enabled'] && ! $settings['sandbox_enabled']) {
            throw new RuntimeException('پرداخت آنلاین برای سفارش لندینگ در حال حاضر فعال نیست.');
        }

        $selectedGateway = $useMaliart
            ? 'maliart'
            : ($settings['sandbox_enabled'] ? 'sandbox' : $this->resolveGatewaySelection($settings, $gateway));

        $payment = $order->payments()->create([
            'invoice_number' => $this->makeInvoiceNumber(),
            'gateway' => $selectedGateway,
            'status' => LandingOrderPayment::STATUS_PENDING,
            'sandbox_mode' => $useMaliart ? false : (bool) $settings['sandbox_enabled'],
            'amount' => (int) $order->total_amount,
            'expires_at' => now()->addMinutes(30),
            'meta_json' => [
                'landingSiteId' => $landingSite->id,
                'customerId' => $customer->id,
                'subscriptionPackageId' => $subscriptionPackage->id,
                'requestedPayload' => data_get($order->meta_json, 'requested_payload', []),
                'discount' => data_get($order->meta_json, 'discount'),
            ],
        ]);

        if ($useMaliart) {
            $callbackUrl = str_replace(['{payment}', '__PAYMENT__'], (string) $payment->id, $callbackUrlTemplate);

            try {
                $remote = $this->maliart->create([
                    'order_id' => (string) $payment->invoice_number,
                    'amount' => MaliartPaymentClient::amountAsRial((int) $payment->amount),
                    'currency' => 'IRR',
                    'type' => 'landing_order',
                    'description' => 'پرداخت سفارش لندینگ',
                    'return_url' => $callbackUrl,
                    'customer' => [
                        'name' => trim($customer->first_name.' '.$customer->last_name),
                        'mobile' => (string) $customer->mobile,
                    ],
                    'metadata' => [
                        'landing_site_id' => (string) $landingSite->id,
                        'landing_order_id' => (string) $order->id,
                        'local_payment_id' => (string) $payment->id,
                        'invoice_number' => (string) $payment->invoice_number,
                    ],
                ]);
            } catch (\Throwable $exception) {
                $payment->update(['status' => LandingOrderPayment::STATUS_FAILED, 'failure_reason' => $exception->getMessage()]);
                throw $exception;
            }

            $remotePaymentId = trim((string) ($remote['payment_id'] ?? ''));
            $paymentUrl = trim((string) ($remote['payment_url'] ?? ''));
            if ($remotePaymentId === '' || $paymentUrl === '') {
                $payment->update(['status' => LandingOrderPayment::STATUS_FAILED, 'failure_reason' => 'پاسخ درگاه پرداخت معتبر نیست.']);
                throw new RuntimeException('پاسخ درگاه پرداخت معتبر نیست.');
            }

            $payment->update([
                'authority' => $remotePaymentId,
                'meta_json' => array_merge($payment->meta_json ?? [], [
                    'maliart_payment_id' => $remotePaymentId,
                    'maliart_status' => (string) ($remote['status'] ?? 'pending'),
                ]),
            ]);

            return [
                'mode' => 'gateway',
                'order' => $order,
                'payment' => $payment->fresh(),
                'paymentUrl' => $paymentUrl,
                'redirectForm' => null,
            ];
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
        $gatewayAmount = $this->gatewayAmountRial($payment);
        $invoice = (new Invoice())
            ->amount($gatewayAmount)
            ->detail('description', 'پرداخت سفارش لندینگ')
            ->detail('mobile', $customer->mobile);

        $payment->update([
            'meta_json' => array_merge($payment->meta_json ?? [], [
                'display_currency' => 'IRT',
                'display_amount_toman' => (int) $payment->amount,
                'gateway_currency' => 'IRR',
                'gateway_amount_rial' => $gatewayAmount,
            ]),
        ]);

        $paymentManager = Payment::via($selectedGateway)
            ->config($this->landingGatewayConfig($selectedGateway, $settings['gateways'][$selectedGateway], $callbackUrl))
            ->callbackUrl($callbackUrl);

        $paymentManager->purchase($invoice, function ($driver, $transactionId) use ($payment): void {
            $payment->update([
                'authority' => (string) $transactionId,
            ]);
        });

        return [
            'mode' => 'gateway',
            'order' => $order,
            'payment' => $payment->fresh(),
            'redirectForm' => $paymentManager->pay()->jsonSerialize(),
        ];
    }

    public function verify(LandingOrderPayment $payment): LandingOrder
    {
        if ($payment->status === LandingOrderPayment::STATUS_PAID) {
            return $payment->order()->with(['items', 'payments', 'subscriptionPackage', 'provisionRequest'])->firstOrFail();
        }

        if ((string) $payment->gateway === 'maliart') {
            return $this->verifyMaliartPayment($payment);
        }

        $settings = $this->settings();
        $gateway = (string) $payment->gateway;
        $gatewaySettings = $settings['gateways'][$gateway] ?? null;

        if (! $gatewaySettings) {
            throw new RuntimeException('تنظیمات درگاه پرداخت پیدا نشد.');
        }

        try {
            $receipt = Payment::via($gateway)
                ->config($this->landingGatewayConfig($gateway, $gatewaySettings, ''))
                ->amount($this->gatewayAmountRial($payment))
                ->transactionId((string) $payment->authority)
                ->verify();
        } catch (InvalidPaymentException $exception) {
            $payment->update([
                'status' => LandingOrderPayment::STATUS_FAILED,
                'failure_reason' => $exception->getMessage(),
            ]);

            $payment->order()->update([
                'status' => LandingOrder::STATUS_CANCELLED,
            ]);

            throw $exception;
        }

        return $this->markPaymentSuccessful($payment, (string) $receipt->getReferenceId());
    }

    public function markCancelled(LandingOrderPayment $payment, string $reason): void
    {
        if ($payment->status === LandingOrderPayment::STATUS_PAID) {
            return;
        }

        $payment->update([
            'status' => LandingOrderPayment::STATUS_CANCELLED,
            'failure_reason' => $reason,
        ]);

        $payment->order()->update([
            'status' => LandingOrder::STATUS_CANCELLED,
        ]);
    }

    public function serializePayment(LandingOrderPayment $payment): array
    {
        return [
            'id' => (string) $payment->id,
            'invoiceNumber' => $payment->invoice_number,
            'gateway' => $payment->gateway,
            'status' => $payment->status,
            'amount' => (int) $payment->amount,
            'sandboxMode' => (bool) $payment->sandbox_mode,
            'referenceId' => $payment->reference_id,
            'authority' => $payment->authority,
            'failureReason' => $payment->failure_reason,
            'paidAt' => $payment->paid_at?->toIso8601String(),
            'createdAt' => $payment->created_at?->toIso8601String(),
        ];
    }

    private function markPaymentSuccessful(LandingOrderPayment $payment, string $referenceId): LandingOrder
    {
        return DB::connection('central')->transaction(function () use ($payment, $referenceId): LandingOrder {
        $payment = LandingOrderPayment::query()->lockForUpdate()->findOrFail($payment->id);
        if ($payment->status === LandingOrderPayment::STATUS_PAID) {
            return $payment->order()->with(['items', 'payments', 'subscriptionPackage', 'provisionRequest'])->firstOrFail();
        }

        $payment->update([
            'status' => LandingOrderPayment::STATUS_PAID,
            'reference_id' => $referenceId,
            'paid_at' => now(),
        ]);

        $order = $this->orders->markPaid($payment->order()->firstOrFail(), [
            'paymentId' => $payment->id,
            'invoiceNumber' => $payment->invoice_number,
            'gateway' => $payment->gateway,
            'referenceId' => $referenceId,
            'paidAt' => now()->toIso8601String(),
        ]);

        $discountMeta = is_array($payment->meta_json['discount'] ?? null)
            ? $payment->meta_json['discount']
            : (is_array($order->meta_json['discount'] ?? null) ? $order->meta_json['discount'] : null);
        if ($discountMeta && ! empty($discountMeta['id']) && (int) ($discountMeta['discountAmount'] ?? 0) > 0) {
            $code = \App\Domain\Tenant\Models\DiscountCode::query()->find((int) $discountMeta['id']);
            if ($code) {
                $this->discountCodes->recordLandingRedemption(
                    $code,
                    $order->landingSite()->firstOrFail(),
                    $order->customer()->firstOrFail(),
                    $order,
                    $payment->fresh(),
                    [
                        'baseAmount' => (int) ($discountMeta['baseAmount'] ?? $order->subtotal_amount),
                        'discountAmount' => (int) ($discountMeta['discountAmount'] ?? 0),
                        'payableAmount' => (int) $order->total_amount,
                    ],
                );
            }
        } else {
            $this->salesTracking->trackLandingSaleFromAssignment(
                $order->customer()->firstOrFail(),
                $order,
                $payment->fresh(),
            );
        }

        return $order;
        });
    }

    private function verifyMaliartPayment(LandingOrderPayment $payment): LandingOrder
    {
        $remotePaymentId = trim((string) data_get($payment->meta_json, 'maliart_payment_id', $payment->authority));
        if ($remotePaymentId === '') {
            throw new RuntimeException('شناسه پرداخت پیدا نشد.');
        }

        $remote = $this->maliart->status($remotePaymentId);
        if (
            (string) ($remote['order_id'] ?? '') !== (string) $payment->invoice_number
            || MaliartPaymentClient::amountAsToman(
                (int) ($remote['amount'] ?? 0),
                (string) ($remote['currency'] ?? ''),
            ) !== (int) $payment->amount
        ) {
            $payment->update(['status' => LandingOrderPayment::STATUS_FAILED, 'failure_reason' => 'اطلاعات پرداخت با سفارش مطابقت ندارد.']);
            throw new RuntimeException('اطلاعات پرداخت با سفارش مطابقت ندارد.');
        }

        if ((string) ($remote['status'] ?? '') !== 'paid') {
            throw new RuntimeException('پرداخت سفارش هنوز تأیید نشده است.');
        }

        $referenceId = trim((string) ($remote['reference_id'] ?? ''));
        if ($referenceId === '') {
            throw new RuntimeException('کد پیگیری پرداخت دریافت نشد.');
        }

        return $this->markPaymentSuccessful($payment, $referenceId);
    }

    private function resolveGatewaySelection(array $settings, ?string $gateway = null): string
    {
        $selected = $gateway && in_array($gateway, $settings['enabled_gateways'], true)
            ? $gateway
            : (string) ($settings['provider'] ?? '');

        if (! in_array($selected, $settings['enabled_gateways'], true)) {
            throw new RuntimeException('هیچ درگاه پرداخت فعالی برای این بخش تنظیم نشده است.');
        }

        return $selected;
    }

    private function makeInvoiceNumber(): string
    {
        do {
            $number = 'LDP-'.now()->format('Ymd').'-'.Str::upper(Str::random(6));
        } while (LandingOrderPayment::query()->where('invoice_number', $number)->exists());

        return $number;
    }

    private function gatewayAmountRial(LandingOrderPayment $payment): int
    {
        $storedGatewayAmount = (int) data_get($payment->meta_json, 'gateway_amount_rial', 0);
        if ($storedGatewayAmount > 0) {
            return $storedGatewayAmount;
        }

        return (int) $payment->amount * 10;
    }

    private function landingGatewayConfig(string $gateway, array $settings, string $callbackUrl): array
    {
        return array_merge(
            TenantPaymentGateways::driverConfig($gateway, $settings, $callbackUrl),
            ['currency' => 'R'],
        );
    }
}
