<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\SubscriptionPackage;
use App\Domain\Tenant\Models\TenantSubscriptionPayment;
use App\Http\Controllers\Controller;
use App\Services\SupportRenewalPaymentService;
use App\Support\TenantAudienceLabels;
use App\Support\TenantPaymentGateways;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class SupportRenewalController extends Controller
{
    public function __construct(private readonly SupportRenewalPaymentService $service)
    {
    }

    public function packages(Request $request): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);
        $settings = $this->service->settings(tenant());

        return response()->json([
            'success' => true,
            'data' => [
                'settings' => [
                    'enabled' => (bool) $settings['enabled'],
                    'sandboxEnabled' => (bool) $settings['sandbox_enabled'],
                    'provider' => $settings['provider'] ?? 'zarinpal',
                    'enabledGateways' => $settings['enabled_gateways'] ?? [],
                    'maliartEnabled' => (bool) ($settings['maliart_enabled'] ?? false),
                    'gatewayOptions' => collect(TenantPaymentGateways::definitions())
                        ->map(fn (array $item, string $key): array => [
                            'key' => $key,
                            'label' => (string) ($item['label'] ?? $key),
                        ])
                        ->values()
                        ->all(),
                ],
                'packages' => SubscriptionPackage::query()
                    ->with('audiencePrices')
                    ->where('is_active', true)
                    ->customerRenewable()
                    ->orderBy('sort_order')
                    ->orderBy('duration_days')
                    ->orderByRaw('CASE WHEN user_limit IS NULL THEN 999999 ELSE user_limit END')
                    ->get()
                    ->map(function (SubscriptionPackage $package): array {
                        $pricing = $package->pricingFor(tenant()->audience_type_id);

                        return [
                            'id' => (string) $package->id,
                            'name' => $package->name,
                            'durationDays' => (int) $package->duration_days,
                            'userLimit' => $package->user_limit !== null ? (int) $package->user_limit : null,
                            'userLimitLabel' => $package->userLimitLabel(),
                            'priceAmount' => $pricing['priceAmount'],
                            'discountedPriceAmount' => $pricing['discountedPriceAmount'],
                            'payableAmount' => $pricing['payableAmount'],
                            'discountAmount' => $pricing['discountAmount'],
                        ];
                    })
                    ->values(),
            ],
        ]);
    }

    public function publicPackages(Request $request): JsonResponse
    {
        $audienceLabels = TenantAudienceLabels::for(tenant()->audienceType);

        return response()->json([
            'success' => true,
            'data' => [
                'audience' => [
                    'pluralLabel' => $audienceLabels['plural'],
                    'singularLabel' => $audienceLabels['singular'],
                ],
                'packages' => SubscriptionPackage::query()
                    ->with('audiencePrices')
                    ->where('is_active', true)
                    ->customerRenewable()
                    ->orderBy('sort_order')
                    ->orderBy('duration_days')
                    ->orderByRaw('CASE WHEN user_limit IS NULL THEN 999999 ELSE user_limit END')
                    ->get()
                    ->map(function (SubscriptionPackage $package): array {
                        $pricing = $package->pricingFor(tenant()->audience_type_id);

                        return [
                            'id' => (string) $package->id,
                            'name' => $package->name,
                            'durationDays' => (int) $package->duration_days,
                            'userLimit' => $package->user_limit !== null ? (int) $package->user_limit : null,
                            'userLimitLabel' => $package->userLimitLabel(),
                            'priceAmount' => $pricing['priceAmount'],
                            'discountedPriceAmount' => $pricing['discountedPriceAmount'],
                            'payableAmount' => $pricing['payableAmount'],
                            'discountAmount' => $pricing['discountAmount'],
                        ];
                    })
                    ->values(),
            ],
        ]);
    }

    public function preview(Request $request): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);

        $validated = $request->validate([
            'subscription_package_id' => ['required', 'integer', 'exists:central.subscription_packages,id'],
            'feature_module_ids' => ['nullable', 'array'],
            'feature_module_ids.*' => ['integer', 'exists:central.feature_modules,id'],
            'discount_code' => ['nullable', 'string', 'max:80'],
        ]);

        $package = SubscriptionPackage::query()
            ->customerRenewable()
            ->findOrFail($validated['subscription_package_id']);

        return response()->json([
            'success' => true,
            'data' => $this->service->preview(tenant(), $package, $validated['feature_module_ids'] ?? null, $validated['discount_code'] ?? null),
        ]);
    }

    public function storagePreview(Request $request): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);

        $validated = $request->validate([
            'gb' => ['required', 'integer', 'min:1', 'max:200'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->service->previewStorageAddon(tenant(), (int) $validated['gb']),
        ]);
    }

    public function storageStore(Request $request): JsonResponse
    {
        $actor = $this->abortUnlessTenantAdmin($request);

        $validated = $request->validate([
            'gb' => ['required', 'integer', 'min:1', 'max:200'],
            'gateway' => ['nullable', 'in:'.implode(',', TenantPaymentGateways::supportedKeys())],
        ]);

        $callbackUrl = request()->getSchemeAndHttpHost().route('tenant.support-renewal.callback', [], false).'?payment=__PAYMENT__';
        $result = $this->service->createStorageAddonPayment(tenant(), (int) $validated['gb'], [
            'id' => $actor->getAuthIdentifier(),
            'name' => $actor->name,
            'mobile' => $actor->mobile,
            'role' => $actor->role,
        ], $callbackUrl, isset($validated['gateway']) ? (string) $validated['gateway'] : null);

        return response()->json([
            'success' => true,
            'data' => [
                'mode' => $result['mode'],
                'paymentUrl' => $result['paymentUrl'] ?? null,
                'redirectForm' => $result['redirectForm'] ?? null,
                'payment' => $this->serializePayment($result['payment']),
            ],
            'message' => $result['mode'] === 'sandbox'
                ? 'فضای اضافه در حالت سندباکس با موفقیت فعال شد.'
                : 'درخواست پرداخت فضای اضافه ایجاد شد.',
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $actor = $this->abortUnlessTenantAdmin($request);

        $validated = $request->validate([
            'subscription_package_id' => ['required', 'integer', 'exists:central.subscription_packages,id'],
            'feature_module_ids' => ['nullable', 'array'],
            'feature_module_ids.*' => ['integer', 'exists:central.feature_modules,id'],
            'gateway' => ['nullable', 'in:'.implode(',', TenantPaymentGateways::supportedKeys())],
            'discount_code' => ['nullable', 'string', 'max:80'],
        ]);

        $package = SubscriptionPackage::query()
            ->customerRenewable()
            ->findOrFail($validated['subscription_package_id']);
        $callbackUrl = request()->getSchemeAndHttpHost().route('tenant.support-renewal.callback', [], false).'?payment=__PAYMENT__';
        $result = $this->service->createPayment(tenant(), $package, array_values(array_map('intval', $validated['feature_module_ids'] ?? [])), [
            'id' => $actor->getAuthIdentifier(),
            'name' => $actor->name,
            'mobile' => $actor->mobile,
            'role' => $actor->role,
        ], $callbackUrl, isset($validated['gateway']) ? (string) $validated['gateway'] : null, $validated['discount_code'] ?? null);

        return response()->json([
            'success' => true,
            'data' => [
                'mode' => $result['mode'],
                'paymentUrl' => $result['paymentUrl'] ?? null,
                'redirectForm' => $result['redirectForm'] ?? null,
                'payment' => $this->serializePayment($result['payment']),
            ],
            'message' => $result['mode'] === 'sandbox'
                ? 'بسته پشتیبانی در حالت سندباکس با موفقیت فعال شد.'
                : 'درخواست پرداخت ایجاد شد.',
        ]);
    }

    public function callback(Request $request): RedirectResponse
    {
        $authority = (string) $request->query('Authority', '');
        $status = (string) $request->query('Status', '');
        $paymentId = (int) $request->integer('payment');

        $payment = TenantSubscriptionPayment::query()
            ->where('tenant_id', tenant('id'))
            ->when($paymentId > 0, fn ($query) => $query->where('id', $paymentId))
            ->when($paymentId <= 0 && $authority !== '', fn ($query) => $query->where('authority', $authority))
            ->latest('id')
            ->first();

        abort_if(! $payment, 404);

        if ((string) $payment->gateway !== 'maliart' && $status !== '' && strtoupper($status) !== 'OK') {
            $this->service->markPaymentCancelled($payment, 'پرداخت توسط کاربر لغو شد.');

            return $this->redirectForPayment($payment, 'cancelled');
        }

        try {
            $this->service->verifyPayment(tenant(), $payment);

            return $this->redirectForPayment($payment, 'success');
        } catch (\Throwable $exception) {
            return $this->redirectForPayment($payment, 'failed', $exception->getMessage());
        }
    }

    public function history(Request $request): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);

        $perPage = min(20, max(5, (int) $request->integer('per_page', 10)));
        $payments = TenantSubscriptionPayment::query()
            ->with('subscriptionPackage')
            ->where('tenant_id', tenant('id'))
            ->where('payment_type', 'support_renewal')
            ->latest('id')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => collect($payments->items())->map(fn (TenantSubscriptionPayment $payment) => $this->serializePayment($payment))->values(),
                'currentPage' => $payments->currentPage(),
                'lastPage' => $payments->lastPage(),
                'perPage' => $payments->perPage(),
                'total' => $payments->total(),
            ],
        ]);
    }

    private function serializePayment(TenantSubscriptionPayment $payment): array
    {
        return [
            'id' => (string) $payment->id,
            'invoiceNumber' => $payment->invoice_number,
            'paymentType' => $payment->payment_type,
            'status' => $payment->status,
            'gateway' => $payment->gateway,
            'amount' => (int) $payment->amount,
            'discountAmount' => (int) $payment->discount_amount,
            'payableAmount' => (int) $payment->payable_amount,
            'sandboxMode' => (bool) $payment->sandbox_mode,
            'referenceId' => $payment->reference_id,
            'packageName' => $payment->subscriptionPackage?->name,
            'durationDays' => $payment->subscriptionPackage?->duration_days ? (int) $payment->subscriptionPackage->duration_days : null,
            'userLimit' => $payment->subscriptionPackage?->user_limit !== null ? (int) $payment->subscriptionPackage?->user_limit : null,
            'userLimitLabel' => $payment->subscriptionPackage?->userLimitLabel(),
            'previousSupportEndsAt' => $payment->previous_support_ends_at?->toDateString(),
            'newSupportEndsAt' => $payment->new_support_ends_at?->toDateString(),
            'paidAt' => $payment->paid_at?->toIso8601String(),
            'createdAt' => $payment->created_at?->toIso8601String(),
            'initiatedByName' => $payment->initiated_by_name,
            'initiatedByMobile' => $payment->initiated_by_mobile,
            'failureReason' => $payment->failure_reason,
        ];
    }

    private function redirectForPayment(TenantSubscriptionPayment $payment, string $status, ?string $message = null): RedirectResponse
    {
        $payment->loadMissing(['items.featureModule', 'subscriptionPackage']);

        if ($payment->payment_type === 'feature_module_activation') {
            $moduleSlug = $payment->items->first()?->featureModule?->slug
                ?? (string) ($payment->metadata['feature_module_slug'] ?? '');

            $query = http_build_query(array_filter([
                'payment' => $status,
                'module' => $moduleSlug,
                'message' => $message,
            ]));

            return redirect('/panel/special-features'.($query !== '' ? '?'.$query : ''));
        }

        if ($payment->payment_type === 'storage_addon') {
            if ($status === 'success' && blank($message)) {
                $reference = $payment->reference_id ?: '—';
                $gb = (int) data_get($payment->metadata, 'storage_addon.gb', 0);
                $message = "پرداخت شما با شماره پیگیری {$reference} انجام شد و {$gb} گیگ فضای اضافه فعال شد.";
            }

            $query = http_build_query(array_filter([
                'payment' => $status,
                'message' => $message,
                'gb' => (int) data_get($payment->metadata, 'storage_addon.gb', 0),
            ]));

            return redirect('/panel/files/upgrade'.($query !== '' ? '?'.$query : ''));
        }

        if ($status === 'success' && blank($message)) {
            $packageName = $payment->subscriptionPackage?->name ?? 'نامشخص';
            $durationDays = $payment->subscriptionPackage?->duration_days ? (int) $payment->subscriptionPackage->duration_days : null;
            $durationText = $durationDays ? number_format($durationDays).' روز' : 'مدت پلن';
            $reference = $payment->reference_id ?: '—';
            $message = "پرداخت شما با شماره پیگیری {$reference} انجام شد. پشتیبانی شما به مدت {$durationText} اضافه شد. پلن شما: {$packageName}.";
        }

        $query = http_build_query(array_filter([
            'package' => $payment->subscription_package_id,
            'payment' => $status,
            'message' => $message,
        ]));

        return redirect('/panel/support-renewal/invoice'.($query !== '' ? '?'.$query : ''));
    }

    private function abortUnlessTenantAdmin(Request $request)
    {
        $user = $request->user('tenant_web');
        abort_unless($user?->role === 'admin', 403, __('authorization.primary_admin_section'));

        return $user;
    }
}
