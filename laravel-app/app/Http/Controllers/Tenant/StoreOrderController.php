<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Store\Models\StoreOrder;
use App\Domain\Store\Models\StoreOrderPayment;
use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\SmsSetting;
use App\Http\Controllers\Controller;
use App\Services\SmsCampaignSenderService;
use App\Services\StoreOrderCheckoutService;
use App\Support\InputNormalizer;
use App\Support\StoreSmsTemplateRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StoreOrderController extends Controller
{
    public function __construct(
        private readonly StoreOrderCheckoutService $service,
        private readonly SmsCampaignSenderService $smsSender,
    ) {
    }

    public function checkout(Request $request): JsonResponse
    {
        $actor = $request->user('tenant_web');
        abort_unless($actor, 401, __('authorization.login_required'));

        $request->merge([
            'customerPhone' => InputNormalizer::mobile($request->input('customerPhone')),
        ]);

        $validated = $request->validate([
            'customerName' => ['required', 'string', 'max:255'],
            'customerPhone' => ['required', 'regex:/^09\d{9}$/'],
            'shippingMethod' => ['required', 'in:courier,express,pickup'],
            'paymentMethod' => ['required', 'in:online,card,cod'],
            'gateway' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['nullable', 'string', 'max:255'],
            'items.*.productId' => ['nullable', 'string', 'max:255'],
            'items.*.title' => ['required', 'string', 'max:255'],
            'items.*.subtitle' => ['nullable', 'string', 'max:255'],
            'items.*.imageLabel' => ['nullable', 'string', 'max:255'],
            'items.*.unitAmount' => ['required', 'integer', 'min:1'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'address' => ['nullable', 'array'],
            'address.title' => ['nullable', 'string', 'max:255'],
            'address.provinceId' => ['nullable', 'integer'],
            'address.provinceName' => ['nullable', 'string', 'max:255'],
            'address.cityId' => ['nullable', 'integer'],
            'address.cityName' => ['nullable', 'string', 'max:255'],
            'address.latitude' => ['nullable', 'numeric'],
            'address.longitude' => ['nullable', 'numeric'],
            'address.address' => ['nullable', 'string'],
        ], [
            'customerPhone.regex' => __('store.order.validation.customer_phone_regex'),
            'items.min' => __('store.order.validation.items_min'),
        ]);

        if (($validated['shippingMethod'] ?? '') !== 'pickup') {
            $request->validate([
                'address.title' => ['required', 'string', 'max:255'],
                'address.provinceId' => ['required', 'integer'],
                'address.provinceName' => ['required', 'string', 'max:255'],
                'address.cityId' => ['required', 'integer'],
                'address.cityName' => ['required', 'string', 'max:255'],
                'address.latitude' => ['required', 'numeric'],
                'address.longitude' => ['required', 'numeric'],
                'address.address' => ['required', 'string'],
            ], [
                'address.title.required' => __('store.order.validation.address_required'),
                'address.address.required' => __('store.order.validation.address_required'),
            ]);
        }

        $result = $this->service->checkout(
            $actor,
            $validated,
            request()->getSchemeAndHttpHost().route('tenant.store-payments.callback', ['payment' => '__PAYMENT__'], false)
        );

        $storeSmsInfo = $this->sendStatusSms(
            $result['order'],
            (string) ($result['order']->status ?? 'placed'),
            null,
        );

        return response()->json([
            'success' => true,
            'data' => [
                'mode' => $result['mode'],
                'order' => $this->serializeOrder($result['order']),
                'payment' => $this->serializePayment($result['payment']),
                'cardNote' => $result['cardNote'] ?? null,
                'redirectForm' => $result['redirectForm'] ?? null,
                'paymentUrl' => $result['paymentUrl'] ?? null,
                'sms' => $storeSmsInfo,
            ],
            'message' => match ($result['mode']) {
                'free' => __('store.order.checkout.free'),
                'sandbox' => __('store.order.checkout.sandbox'),
                'gateway' => __('store.order.checkout.gateway'),
                'card' => __('store.order.checkout.card'),
                default => __('store.order.checkout.default'),
            },
        ]);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));

        $perPage = max(1, min(50, (int) $request->integer('perPage', 12)));
        $status = trim((string) $request->query('status', ''));
        $paymentMethod = trim((string) $request->query('paymentMethod', ''));
        $shippingMethod = trim((string) $request->query('shippingMethod', ''));
        $q = trim((string) $request->query('q', ''));
        $onlyNew = (bool) $request->boolean('onlyNew', false);

        $paginator = StoreOrder::query()
            ->with(['items', 'payments' => fn ($query) => $query->latest('id')])
            ->when($status !== '', fn ($query) => $query->where('status', $status))
            ->when($paymentMethod !== '', fn ($query) => $query->where('payment_method', $paymentMethod))
            ->when($shippingMethod !== '', fn ($query) => $query->where('shipping_method', $shippingMethod))
            ->when($onlyNew, fn ($query) => $query->whereIn('status', ['pending_payment', 'awaiting_card_transfer', 'placed', 'processing']))
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($inner) use ($q) {
                    $inner
                        ->where('order_number', 'like', "%{$q}%")
                        ->orWhere('customer_name', 'like', "%{$q}%")
                        ->orWhere('customer_phone', 'like', "%{$q}%");
                });
            })
            ->latest('id')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => collect($paginator->items())
                    ->map(fn (StoreOrder $order) => $this->serializeOrderWithDetails($order))
                    ->values()
                    ->all(),
                'currentPage' => $paginator->currentPage(),
                'lastPage' => $paginator->lastPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function adminShow(Request $request, StoreOrder $storeOrder): JsonResponse
    {
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));

        $storeOrder->load(['items', 'payments' => fn ($query) => $query->latest('id')]);

        return response()->json([
            'success' => true,
            'data' => $this->serializeOrderWithDetails($storeOrder),
        ]);
    }

    public function adminUpdate(Request $request, StoreOrder $storeOrder): JsonResponse
    {
        $actor = $request->user('tenant_web');
        abort_unless($actor?->role === 'admin', 403, __('authorization.admin_section'));

        $validated = $request->validate([
            'status' => ['nullable', Rule::in($this->allowedStatuses())],
            'shippingMethod' => ['nullable', Rule::in(['courier', 'express', 'pickup'])],
            'adminNote' => ['nullable', 'string', 'max:5000'],
            'comment' => ['nullable', 'string', 'max:5000'],
            'shippingTrackingCode' => ['nullable', 'string', 'max:120'],
            'shippingCarrier' => ['nullable', 'string', 'max:120'],
            'items' => ['nullable', 'array', 'min:1'],
            'items.*.id' => ['required_with:items', 'string'],
            'items.*.title' => ['required_with:items', 'string', 'max:255'],
            'items.*.subtitle' => ['nullable', 'string', 'max:255'],
            'items.*.quantity' => ['required_with:items', 'integer', 'min:1'],
            'items.*.unitAmount' => ['required_with:items', 'integer', 'min:0'],
            'sendSms' => ['nullable', 'boolean'],
        ]);

        $storeOrder->load(['items', 'payments' => fn ($query) => $query->latest('id')]);

        $nextStatus = trim((string) ($validated['status'] ?? $storeOrder->status));
        $nextShippingMethod = trim((string) ($validated['shippingMethod'] ?? $storeOrder->shipping_method));
        $adminNote = trim((string) ($validated['adminNote'] ?? ''));
        $comment = trim((string) ($validated['comment'] ?? ''));
        $shippingTrackingCode = trim((string) ($validated['shippingTrackingCode'] ?? ''));
        $shippingCarrier = trim((string) ($validated['shippingCarrier'] ?? ''));
        $sendSms = (bool) ($validated['sendSms'] ?? true);

        $metadata = is_array($storeOrder->metadata) ? $storeOrder->metadata : [];
        $previousStatus = (string) $storeOrder->status;
        $itemsChanged = false;

        if (array_key_exists('items', $validated) && is_array($validated['items'])) {
            $existingItems = $storeOrder->items->keyBy(fn ($item) => (string) $item->id);
            $nextItems = collect($validated['items'])
                ->map(function (array $item) use ($existingItems): ?array {
                    $itemId = (string) ($item['id'] ?? '');
                    if ($itemId === '' || ! $existingItems->has($itemId)) {
                        return null;
                    }

                    return [
                        'id' => $itemId,
                        'title' => trim((string) ($item['title'] ?? '')),
                        'subtitle' => trim((string) ($item['subtitle'] ?? '')),
                        'quantity' => max(1, (int) ($item['quantity'] ?? 1)),
                        'unitAmount' => max(0, (int) ($item['unitAmount'] ?? 0)),
                    ];
                })
                ->filter()
                ->values();

            if ($nextItems->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'message' => __('store.order.valid_item_required'),
                ], 422);
            }

            $nextItemIds = $nextItems->pluck('id')->all();
            $storeOrder->items()->whereNotIn('id', $nextItemIds)->delete();

            foreach ($nextItems as $nextItem) {
                $existingItem = $existingItems->get($nextItem['id']);
                if (! $existingItem) {
                    continue;
                }

                $existingItem->update([
                    'title' => $nextItem['title'],
                    'subtitle' => $nextItem['subtitle'] !== '' ? $nextItem['subtitle'] : null,
                    'quantity' => (int) $nextItem['quantity'],
                    'unit_amount' => (int) $nextItem['unitAmount'],
                    'total_amount' => (int) $nextItem['quantity'] * (int) $nextItem['unitAmount'],
                ]);
            }

            $storeOrder->load(['items', 'payments' => fn ($query) => $query->latest('id')]);
            $storeOrder->items_count = (int) $storeOrder->items->sum('quantity');
            $storeOrder->subtotal_amount = (int) $storeOrder->items->sum('total_amount');
            $storeOrder->total_amount = max(0, (int) $storeOrder->subtotal_amount + (int) $storeOrder->shipping_amount - (int) $storeOrder->discount_amount);
            $itemsChanged = true;
        }

        if ($adminNote !== '') {
            $metadata['admin_note'] = $adminNote;
        }

        if ($shippingTrackingCode !== '') {
            $metadata['shipping_tracking_code'] = $shippingTrackingCode;
            $metadata['shipping_tracking_registered_at'] = now()->toDateTimeString();
        }

        if ($shippingCarrier !== '') {
            $metadata['shipping_carrier'] = $shippingCarrier;
        }

        if ($previousStatus !== $nextStatus) {
            $history = is_array($metadata['status_history'] ?? null) ? $metadata['status_history'] : [];
            $history[] = [
                'at' => now()->toDateTimeString(),
                'from' => $previousStatus,
                'to' => $nextStatus,
                'actorName' => $actor->name ?: $actor->mobile,
                'note' => $adminNote !== '' ? $adminNote : null,
            ];
            $metadata['status_history'] = array_slice($history, -50);
        }

        if ($comment !== '') {
            $comments = is_array($metadata['admin_comments'] ?? null) ? $metadata['admin_comments'] : [];
            $comments[] = [
                'at' => now()->toDateTimeString(),
                'actorName' => $actor->name ?: $actor->mobile,
                'body' => $comment,
            ];
            $metadata['admin_comments'] = array_slice($comments, -100);
        }

        if ($itemsChanged && $comment === '') {
            $comments = is_array($metadata['admin_comments'] ?? null) ? $metadata['admin_comments'] : [];
            $comments[] = [
                'at' => now()->toDateTimeString(),
                'actorName' => $actor->name ?: $actor->mobile,
                'body' => __('store.order.items_edited_comment'),
            ];
            $metadata['admin_comments'] = array_slice($comments, -100);
        }

        if ($nextStatus === 'processing') {
            $metadata['approved_at'] = now()->toDateTimeString();
        }

        if ($nextStatus === 'shipped') {
            $metadata['shipped_at'] = now()->toDateTimeString();
        }

        if ($nextStatus === 'returned') {
            $metadata['returned_at'] = now()->toDateTimeString();
        }

        if ($nextStatus === 'cancelled') {
            $metadata['cancelled_at'] = now()->toDateTimeString();
        }

        if ($nextStatus === 'rejected') {
            $metadata['rejected_at'] = now()->toDateTimeString();
        }

        if (
            $storeOrder->payment_method === 'card'
            && in_array($nextStatus, ['processing', 'paid', 'shipped'], true)
        ) {
            $storeOrder = $this->service->finalizeCardTransfer($storeOrder);
            $storeOrder->load(['items', 'payments' => fn ($query) => $query->latest('id')]);
            $metadata = is_array($storeOrder->metadata) ? $storeOrder->metadata : $metadata;
        }

        $paidAt = $storeOrder->paid_at;
        if (in_array($nextStatus, ['processing', 'paid', 'shipped'], true) && $paidAt === null && $storeOrder->payment_method !== 'cod') {
            $paidAt = now();
        }

        $storeOrder->update([
            'status' => $nextStatus,
            'shipping_method' => $nextShippingMethod,
            'notes' => $adminNote !== '' ? $adminNote : $storeOrder->notes,
            'metadata' => $metadata,
            'paid_at' => $paidAt,
            'items_count' => (int) $storeOrder->items_count,
            'subtotal_amount' => (int) $storeOrder->subtotal_amount,
            'total_amount' => (int) $storeOrder->total_amount,
        ]);

        $latestPayment = $storeOrder->payments->sortByDesc('created_at')->first();
        if ($latestPayment instanceof StoreOrderPayment) {
            $paymentStatus = $latestPayment->status;

            if ($storeOrder->payment_method === 'card' && in_array($nextStatus, ['processing', 'paid', 'shipped'], true)) {
                $paymentStatus = 'paid';
            }

            if (in_array($nextStatus, ['cancelled', 'rejected', 'failed'], true) && in_array($latestPayment->status, ['pending', 'awaiting_transfer'], true)) {
                $paymentStatus = 'failed';
            }

            $latestPayment->update([
                'status' => $paymentStatus,
                'paid_at' => $paymentStatus === 'paid' ? ($latestPayment->paid_at ?: now()) : $latestPayment->paid_at,
                'reference_id' => $paymentStatus === 'paid'
                    ? ($latestPayment->reference_id ?: ('CARD-'.Str::upper(Str::random(10))))
                    : $latestPayment->reference_id,
            ]);
        }

        $storeOrder->refresh();
        $storeOrder->load(['items', 'payments' => fn ($query) => $query->latest('id')]);

        $smsInfo = [
            'attempted' => false,
            'sent' => false,
            'message' => __('store.order.sms_disabled'),
        ];

        if ($sendSms) {
            $smsInfo = $this->sendStatusSms(
                $storeOrder,
                $nextStatus,
                $shippingTrackingCode !== '' ? $shippingTrackingCode : (($metadata['shipping_tracking_code'] ?? null) ?: null)
            );

            $metadata = is_array($storeOrder->metadata) ? $storeOrder->metadata : [];
            $smsLog = is_array($metadata['sms_log'] ?? null) ? $metadata['sms_log'] : [];
            $smsLog[] = [
                'at' => now()->toDateTimeString(),
                'status' => $nextStatus,
                'ok' => (bool) ($smsInfo['sent'] ?? false),
                'message' => (string) ($smsInfo['message'] ?? ''),
            ];
            $metadata['sms_log'] = array_slice($smsLog, -50);
            $storeOrder->update(['metadata' => $metadata]);
            $storeOrder->refresh();
            $storeOrder->load(['items', 'payments' => fn ($query) => $query->latest('id')]);
        }

        return response()->json([
            'success' => true,
            'message' => __('store.order.updated'),
            'data' => [
                'order' => $this->serializeOrderWithDetails($storeOrder),
                'sms' => $smsInfo,
            ],
        ]);
    }

    public function adminSendSms(Request $request, StoreOrder $storeOrder): JsonResponse
    {
        $actor = $request->user('tenant_web');
        abort_unless($actor?->role === 'admin', 403, __('authorization.admin_section'));

        $validated = $request->validate([
            'templateKey' => ['required', Rule::in(['afterOrder', 'afterApproval', 'afterShippingCode', 'afterRejection'])],
        ]);

        $storeOrder->load(['items', 'payments' => fn ($query) => $query->latest('id')]);
        $metadata = is_array($storeOrder->metadata) ? $storeOrder->metadata : [];
        $shippingTrackingCode = (string) ($metadata['shipping_tracking_code'] ?? '');
        $smsInfo = $this->sendSmsByTemplateKey($storeOrder, (string) $validated['templateKey'], $shippingTrackingCode !== '' ? $shippingTrackingCode : null);

        $smsLog = is_array($metadata['sms_log'] ?? null) ? $metadata['sms_log'] : [];
        $smsLog[] = [
            'at' => now()->toDateTimeString(),
            'status' => (string) $storeOrder->status,
            'template' => (string) $validated['templateKey'],
            'ok' => (bool) ($smsInfo['sent'] ?? false),
            'message' => (string) ($smsInfo['message'] ?? ''),
            'actorName' => $actor->name ?: $actor->mobile,
        ];
        $metadata['sms_log'] = array_slice($smsLog, -100);
        $storeOrder->update(['metadata' => $metadata]);
        $storeOrder->refresh();
        $storeOrder->load(['items', 'payments' => fn ($query) => $query->latest('id')]);

        return response()->json([
            'success' => true,
            'message' => (string) ($smsInfo['message'] ?? __('store.order.sms_registered')),
            'data' => [
                'order' => $this->serializeOrderWithDetails($storeOrder),
                'sms' => $smsInfo,
            ],
        ]);
    }

    public function myOrders(Request $request): JsonResponse
    {
        $actor = $request->user('tenant_web');
        abort_unless($actor, 401, __('authorization.login_required'));

        $perPage = max(1, min(30, (int) $request->integer('perPage', 10)));

        $paginator = StoreOrder::query()
            ->where('created_by_user_id', $actor->id)
            ->with(['items', 'payments' => fn ($query) => $query->orderByDesc('created_at')])
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => collect($paginator->items())
                    ->map(fn (StoreOrder $order) => $this->serializeOrderWithDetails($order))
                    ->values()
                    ->all(),
                'currentPage' => $paginator->currentPage(),
                'lastPage' => $paginator->lastPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function showMyOrder(Request $request, StoreOrder $storeOrder): JsonResponse
    {
        $actor = $request->user('tenant_web');
        abort_unless($actor, 401, __('authorization.login_required'));
        abort_unless((string) $storeOrder->created_by_user_id === (string) $actor->id, 404);

        $storeOrder->load(['items', 'payments' => fn ($query) => $query->orderByDesc('created_at')]);

        return response()->json([
            'success' => true,
            'data' => $this->serializeOrderWithDetails($storeOrder),
        ]);
    }

    public function callback(Request $request, StoreOrderPayment $payment): RedirectResponse
    {
        if ((string) $payment->gateway !== 'maliart' && $request->has('Status') && strtoupper((string) $request->query('Status')) !== 'OK') {
            $cancelledMessage = __('store.order.payment_cancelled');
            $this->service->markCancelled($payment, $cancelledMessage);

            return redirect('/store/checkout/result?status=failed&message='.urlencode($cancelledMessage).'&order='.urlencode($payment->order->order_number).'&oid='.urlencode((string) $payment->order->id));
        }

        try {
            $order = $this->service->verify($payment);
            $verifiedPayment = $payment->fresh();
            $tracking = $verifiedPayment?->reference_id ?: $verifiedPayment?->invoice_number;

            return redirect('/store/checkout/result?status=success&method=online&order='.urlencode($order->order_number).'&oid='.urlencode((string) $order->id).'&tracking='.urlencode((string) $tracking));
        } catch (\Throwable $exception) {
            return redirect('/store/checkout/result?status=failed&message='.urlencode($exception->getMessage()).'&order='.urlencode($payment->order->order_number).'&oid='.urlencode((string) $payment->order->id));
        }
    }

    private function allowedStatuses(): array
    {
        return [
            'pending_payment',
            'awaiting_card_transfer',
            'placed',
            'paid',
            'processing',
            'shipped',
            'returned',
            'cancelled',
            'rejected',
            'failed',
        ];
    }

    private function statusLabel(string $status): string
    {
        return match ($status) {
            'pending_payment' => __('store.order.status.pending_payment'),
            'awaiting_card_transfer' => __('store.order.status.awaiting_card_transfer'),
            'placed' => __('store.order.status.placed'),
            'paid' => __('store.order.status.paid'),
            'processing' => __('store.order.status.processing'),
            'shipped' => __('store.order.status.shipped'),
            'returned' => __('store.order.status.returned'),
            'cancelled' => __('store.order.status.cancelled'),
            'rejected' => __('store.order.status.rejected'),
            'failed' => __('store.order.status.failed'),
            default => $status,
        };
    }

    private function sendStatusSms(StoreOrder $order, string $status, ?string $shippingTrackingCode): array
    {
        $templateKey = match ($status) {
            'processing', 'paid' => 'afterApproval',
            'shipped' => 'afterShippingCode',
            'rejected', 'cancelled', 'returned', 'failed' => 'afterRejection',
            default => 'afterOrder',
        };

        return $this->sendSmsByTemplateKey($order, $templateKey, $shippingTrackingCode);
    }

    private function sendSmsByTemplateKey(StoreOrder $order, string $templateKey, ?string $shippingTrackingCode): array
    {
        $general = GeneralSetting::query()->first();
        $rules = $general?->booking_rules ?? [];
        $storePage = $rules['store_page'] ?? [];
        $storeSms = $storePage['sms'] ?? [];
        $storeTemplates = StoreSmsTemplateRegistry::normalizeCollection(
            is_array($storeSms['templates_v2'] ?? null) ? $storeSms['templates_v2'] : [],
        );

        if (! (bool) ($storeSms['enabled'] ?? false)) {
            return [
                'attempted' => false,
                'sent' => false,
                'message' => __('store.order.sms.store_disabled'),
            ];
        }

        $template = StoreSmsTemplateRegistry::approvedTemplate($storeTemplates, $templateKey);

        $smsSetting = SmsSetting::query()->first();
        if (! $smsSetting) {
            return [
                'attempted' => false,
                'sent' => false,
                'message' => __('store.order.sms.main_settings_missing'),
            ];
        }

        if (! $template || ! (bool) ($template['enabled'] ?? false)) {
            return [
                'attempted' => false,
                'sent' => false,
                'message' => __('store.order.sms.template_missing'),
                'template' => $templateKey,
            ];
        }

        $message = $this->renderStoreSmsTemplate((string) ($template['body'] ?? ''), $order, $shippingTrackingCode);

        if (trim($message) === '') {
            return [
                'attempted' => false,
                'sent' => false,
                'message' => __('store.order.sms.rendered_empty'),
                'template' => $templateKey,
            ];
        }

        $this->smsSender->queue($smsSetting, (string) $order->customer_phone, $message, [
            'type' => 'store_order',
            'template_key' => $templateKey,
            'recipient_name' => $order->customer_name,
        ]);

        return [
            'attempted' => true,
            'sent' => true,
            'message' => __('store.order.sms.queued'),
            'template' => $templateKey,
        ];
    }

    private function renderStoreSmsTemplate(string $body, StoreOrder $order, ?string $shippingTrackingCode): string
    {
        $businessName = $this->businessName();
        $businessPhone = $this->businessPhone();
        $orderUrl = url('/store/orders/' . $order->id);

        return strtr($body, [
            '{{customer_name}}' => (string) $order->customer_name,
            '{{order_number}}' => (string) $order->order_number,
            '{{order_total}}' => number_format((int) $order->total_amount).' '.__('store.order.currency_toman'),
            '{{tracking_code}}' => (string) ($shippingTrackingCode ?: ($order->metadata['shipping_tracking_code'] ?? '')),
            '{{order_url}}' => $orderUrl,
            '{{business_name}}' => $businessName,
            '{{business_phone}}' => $businessPhone,
        ]);
    }

    private function businessName(): string
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $appearance = is_array($rules['appearance'] ?? null) ? $rules['appearance'] : [];
        $storeName = trim((string) ($appearance['store_name'] ?? ''));

        return $storeName !== '' ? $storeName : (string) (tenant()?->name ?? __('store.order.default_business_name'));
    }

    private function businessPhone(): string
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $contact = is_array($rules['contact_page'] ?? null) ? $rules['contact_page'] : [];
        $phones = $contact['phones'] ?? [];

        if (! is_array($phones)) {
            return '';
        }

        foreach ($phones as $phone) {
            $number = trim((string) ($phone['number'] ?? ''));

            if ($number !== '') {
                return $number;
            }
        }

        return '';
    }

    private function serializeOrder(StoreOrder $order): array
    {
        return [
            'id' => (string) $order->id,
            'orderNumber' => $order->order_number,
            'status' => $order->status,
            'statusLabel' => $this->statusLabel((string) $order->status),
            'paymentMethod' => $order->payment_method,
            'shippingMethod' => $order->shipping_method,
            'customerName' => $order->customer_name,
            'customerPhone' => $order->customer_phone,
            'itemsCount' => (int) $order->items_count,
            'subtotalAmount' => (int) $order->subtotal_amount,
            'shippingAmount' => (int) $order->shipping_amount,
            'discountAmount' => (int) $order->discount_amount,
            'totalAmount' => (int) $order->total_amount,
            'createdAt' => optional($order->created_at)?->toDateTimeString(),
            'updatedAt' => optional($order->updated_at)?->toDateTimeString(),
        ];
    }

    private function serializePayment(StoreOrderPayment $payment): array
    {
        return [
            'id' => (string) $payment->id,
            'invoiceNumber' => $payment->invoice_number,
            'method' => $payment->method,
            'gateway' => $payment->gateway,
            'status' => $payment->status,
            'amount' => (int) $payment->amount,
            'sandboxMode' => (bool) $payment->sandbox_mode,
            'referenceId' => $payment->reference_id,
            'cardNote' => (string) (($payment->metadata ?? [])['card_note'] ?? ''),
        ];
    }

    private function serializeOrderWithDetails(StoreOrder $order): array
    {
        $latestPayment = $order->payments->sortByDesc('created_at')->first();
        $metadata = is_array($order->metadata) ? $order->metadata : [];

        return [
            ...$this->serializeOrder($order),
            'items' => $order->items->map(fn ($item) => [
                'id' => (string) $item->id,
                'productId' => $item->product_id ? (string) $item->product_id : null,
                'title' => $item->title,
                'subtitle' => $item->subtitle,
                'imageLabel' => $item->image_label,
                'unitAmount' => (int) $item->unit_amount,
                'quantity' => (int) $item->quantity,
                'totalAmount' => (int) $item->total_amount,
            ])->values()->all(),
            'payment' => $latestPayment ? $this->serializePayment($latestPayment) : null,
            'adminNote' => (string) ($metadata['admin_note'] ?? ''),
            'shippingTrackingCode' => (string) ($metadata['shipping_tracking_code'] ?? ''),
            'shippingCarrier' => (string) ($metadata['shipping_carrier'] ?? ''),
            'deliveryTitle' => $order->delivery_title,
            'deliveryProvinceName' => $order->delivery_province_name,
            'deliveryCityName' => $order->delivery_city_name,
            'deliveryLatitude' => $order->delivery_latitude,
            'deliveryLongitude' => $order->delivery_longitude,
            'deliveryAddress' => $order->delivery_address,
            'statusHistory' => is_array($metadata['status_history'] ?? null) ? $metadata['status_history'] : [],
            'adminComments' => is_array($metadata['admin_comments'] ?? null) ? $metadata['admin_comments'] : [],
            'smsLog' => is_array($metadata['sms_log'] ?? null) ? $metadata['sms_log'] : [],
        ];
    }
}
