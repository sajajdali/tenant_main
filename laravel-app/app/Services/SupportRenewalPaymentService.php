<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Booking\Models\Barber;
use App\Domain\Tenant\Models\FeatureModule;
use App\Domain\Tenant\Models\SubscriptionPackage;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantFeatureModule;
use App\Domain\Tenant\Models\TenantStorageAddon;
use App\Domain\Tenant\Models\TenantSubscriptionPayment;
use App\Domain\Tenant\Models\TenantSubscriptionPaymentItem;
use App\Models\SystemSetting;
use App\Services\Payments\MaliartTenantPaymentService;
use App\Support\TenantPaymentGateways;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Illuminate\Validation\ValidationException;
use Shetabit\Multipay\Exceptions\InvalidPaymentException;
use Shetabit\Multipay\Invoice;
use Shetabit\Payment\Facade\Payment;

class SupportRenewalPaymentService
{
    public function __construct(
        private readonly FeatureModuleBillingService $featureModuleBilling,
        private readonly DiscountCodeService $discountCodes,
        private readonly SalesTrackingService $salesTracking,
        private readonly TenantProvisioningService $tenantProvisioningService,
        private readonly VipFeatureService $vipFeatureService,
        private readonly CustomerClubService $customerClubService,
        private readonly TenantStorageService $tenantStorage,
        private readonly TenantFeatureModuleManager $tenantFeatureModules,
        private readonly MaliartTenantPaymentService $maliart,
    )
    {
    }

    public function settings(?Tenant $tenant = null): array
    {
        $raw = array_merge([
            'enabled' => false,
            'sandbox_enabled' => true,
            'provider' => 'zarinpal',
        ], SystemSetting::getValue('support_payment'));

        $gateways = TenantPaymentGateways::normalized($raw['gateways'] ?? []);

        // Backward compatibility for old zarinpal-only storage.
        if (($raw['zarinpal_merchant_id'] ?? '') !== '' && blank($gateways['zarinpal']['merchantId'] ?? '')) {
            $gateways['zarinpal']['merchantId'] = (string) $raw['zarinpal_merchant_id'];
            $gateways['zarinpal']['enabled'] = true;
        }

        $enabledGateways = TenantPaymentGateways::configuredEnabled($gateways);
        $maliartEnabled = $this->maliart->enabled();
        $provider = (string) ($raw['provider'] ?? ($enabledGateways[0] ?? 'zarinpal'));
        if (! in_array($provider, TenantPaymentGateways::supportedKeys(), true)) {
            $provider = $enabledGateways[0] ?? 'zarinpal';
        }

        return [
            'enabled' => $maliartEnabled || (bool) ($raw['enabled'] ?? false),
            // Central renewal/plugin payments must follow the central Laravel gateway setting only.
            'sandbox_enabled' => $maliartEnabled ? false : (bool) ($raw['sandbox_enabled'] ?? false),
            'provider' => $maliartEnabled ? 'maliart' : $provider,
            'gateways' => $gateways,
            'enabled_gateways' => $maliartEnabled ? [] : $enabledGateways,
            'maliart_enabled' => $maliartEnabled,
        ];
    }

    public function preview(Tenant $tenant, SubscriptionPackage $package, ?array $selectedFeatureModuleIds = null, ?string $discountCode = null): array
    {
        $this->ensurePackageMatchesCurrentProfessionals($tenant, $package);
        $settings = $this->settings($tenant);

        $tenant->loadMissing('subscriptionPackage');
        $previousSupportEndsAt = $tenant->support_ends_at;
        $isFutureSupport = $previousSupportEndsAt && $previousSupportEndsAt->isFuture();
        $baseDate = $isFutureSupport
            ? $previousSupportEndsAt->copy()
            : now();
        $pricing = $this->resolvePricingForTenant($tenant, $package);
        $featureModules = ($pricing['isUpgrade'] ?? false)
            ? []
            : $this->featureModuleBilling->renewableModules($tenant, (int) $package->duration_days, $selectedFeatureModuleIds);
        $extraStorageRenewal = ($pricing['isUpgrade'] ?? false)
            ? null
            : $this->tenantStorage->activeExtraStorageRenewalLine($tenant, (int) $package->duration_days);
        $baseLineItems = collect([
            [
                'type' => 'support_package',
                'title' => $package->name,
                'description' => $pricing['lineDescription'],
                'amount' => (int) $pricing['priceAmount'],
                'discountAmount' => (int) $pricing['discountAmount'],
                'payableAmount' => (int) $pricing['payableAmount'],
            ],
            ...collect($featureModules)
                ->filter(fn (array $item) => $item['selected'])
                ->map(fn (array $item): array => [
                    'type' => ($item['billingMode'] ?? 'renewal') === 'activation'
                        ? 'feature_module_activation'
                        : 'feature_module_renewal',
                    'title' => $item['name'],
                    'description' => ($item['billingMode'] ?? 'renewal') === 'activation'
                        ? 'فعال‌سازی ماژول هم‌زمان با تمدید پشتیبانی'
                        : 'تمدید ماژول تا پایان دوره جدید پشتیبانی',
                    'amount' => (int) $item['renewalAmount'],
                    'discountAmount' => 0,
                    'payableAmount' => (int) $item['renewalAmount'],
                ])
                ->values()
                ->all(),
        ]);
        if ($extraStorageRenewal) {
            $baseLineItems->push([
                'type' => 'storage_addon_renewal',
                'title' => 'تمدید فضای اضافه',
                'description' => sprintf(
                    'تمدید %s گیگ فضای اضافه برای %s روز',
                    number_format((int) $extraStorageRenewal['gb']),
                    number_format((int) $extraStorageRenewal['durationDays']),
                ),
                'amount' => (int) $extraStorageRenewal['amount'],
                'discountAmount' => 0,
                'payableAmount' => (int) $extraStorageRenewal['payableAmount'],
                'metadata' => $extraStorageRenewal,
            ]);
        }
        $baseAmount = (int) $baseLineItems->sum('payableAmount');
        $discountQuote = $this->discountCodes->resolveForRenewal(
            $discountCode,
            $tenant->audienceType()->firstOrFail(),
            $baseAmount,
        );
        $lineItems = $baseLineItems->values();

        if (($discountQuote['discountAmount'] ?? 0) > 0 && is_array($discountQuote['code'] ?? null)) {
            $lineItems->push([
                'type' => 'discount_code',
                'title' => 'کد تخفیف '.$discountQuote['code']['code'],
                'description' => 'تخفیف روی پیش‌فاکتور تمدید',
                'amount' => 0,
                'discountAmount' => (int) $discountQuote['discountAmount'],
                'payableAmount' => 0,
            ]);
        }

        return [
            'package' => [
                'id' => (string) $package->id,
                'name' => $package->name,
                'durationDays' => (int) $package->duration_days,
                'userLimit' => $package->user_limit !== null ? (int) $package->user_limit : null,
                'userLimitLabel' => $package->userLimitLabel(),
                'priceAmount' => $pricing['priceAmount'],
                'discountedPriceAmount' => $pricing['discountedPriceAmount'],
                'payableAmount' => $pricing['payableAmount'],
                'discountAmount' => $pricing['discountAmount'],
                'isUpgrade' => (bool) $pricing['isUpgrade'],
                'upgradeFromPackageName' => $pricing['upgradeFromPackageName'],
                'upgradeCreditAmount' => $pricing['upgradeCreditAmount'],
                'basePayableAmount' => $pricing['basePayableAmount'],
            ],
            'featureModules' => $featureModules,
            'lineItems' => $lineItems->values()->all(),
            'extraStorageRenewal' => $extraStorageRenewal,
            'amount' => (int) $lineItems->sum('amount'),
            'discountAmount' => (int) $lineItems->sum('discountAmount'),
            'payableAmount' => (int) ($discountQuote['payableAmount'] ?? $baseAmount),
            'discountCode' => $discountQuote['code'],
            'previousSupportEndsAt' => $previousSupportEndsAt?->toDateString(),
            'newSupportEndsAt' => $pricing['isUpgrade']
                ? $baseDate->toDateString()
                : $baseDate->copy()->addDays((int) $package->duration_days)->toDateString(),
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
        ];
    }

    public function createPayment(Tenant $tenant, SubscriptionPackage $package, array $selectedFeatureModuleIds, array $actor, string $callbackUrl, ?string $gateway = null, ?string $discountCode = null): array
    {
        $this->ensurePackageMatchesCurrentProfessionals($tenant, $package);

        $preview = $this->preview($tenant, $package, $selectedFeatureModuleIds, $discountCode);
        $selectedFeatureModuleIds = (bool) ($preview['package']['isUpgrade'] ?? false)
            ? []
            : $selectedFeatureModuleIds;
        $settings = $this->settings($tenant);

        if (! $settings['enabled'] && ! $settings['sandbox_enabled']) {
            throw new RuntimeException('پرداخت تمدید پشتیبانی در حال حاضر فعال نیست.');
        }

        $payment = TenantSubscriptionPayment::query()->create([
            'tenant_id' => $tenant->id,
            'payment_type' => 'support_renewal',
            'subscription_package_id' => $package->id,
            'status' => 'pending',
            'gateway' => $settings['sandbox_enabled'] ? 'sandbox' : ($this->resolveGatewaySelection($settings, $gateway)),
            'invoice_number' => $this->makeInvoiceNumber(),
            'amount' => (int) $preview['amount'],
            'discount_amount' => (int) $preview['discountAmount'],
            'payable_amount' => (int) $preview['payableAmount'],
            'sandbox_mode' => (bool) $settings['sandbox_enabled'],
            'initiated_by_tenant_user_id' => (string) ($actor['id'] ?? ''),
            'initiated_by_name' => $actor['name'] ?? null,
            'initiated_by_mobile' => $actor['mobile'] ?? null,
            'initiated_by_role' => $actor['role'] ?? null,
            'previous_support_ends_at' => $preview['previousSupportEndsAt'],
            'new_support_ends_at' => $preview['newSupportEndsAt'],
            'expires_at' => now()->addMinutes(30),
            'metadata' => [
                'package_name' => $package->name,
                'selected_feature_module_ids' => array_values(array_map('intval', $selectedFeatureModuleIds)),
                'is_upgrade' => (bool) ($preview['package']['isUpgrade'] ?? false),
                'upgrade_from_package_name' => $preview['package']['upgradeFromPackageName'] ?? null,
                'upgrade_credit_amount' => (int) ($preview['package']['upgradeCreditAmount'] ?? 0),
                'discount_code' => $preview['discountCode'] ?? null,
            ],
        ]);
        $this->createPaymentItems($payment, $preview, $package, $selectedFeatureModuleIds);

        if ($settings['sandbox_enabled']) {
            $this->markPaymentSuccessful($payment, 'sandbox-'.Str::upper(Str::random(10)));

            return [
                'mode' => 'sandbox',
                'payment' => $payment->fresh(['subscriptionPackage']),
            ];
        }

        return array_merge(
            ['payment' => $payment->fresh(['subscriptionPackage'])],
            $this->startGatewayPayment(
                payment: $payment,
                settings: $settings,
                callbackUrlTemplate: $callbackUrl,
                description: 'تمدید پشتیبانی '.$tenant->name.' - '.$package->name,
                mobile: (string) ($actor['mobile'] ?? ''),
            ),
        );
    }

    public function createManualRenewal(Tenant $tenant, SubscriptionPackage $package, array $actor, array $options = []): TenantSubscriptionPayment
    {
        $this->ensurePackageMatchesCurrentProfessionals($tenant, $package);

        $preview = $this->preview($tenant, $package, null, null);
        $selectedFeatureModuleIds = collect($preview['featureModules'] ?? [])
            ->filter(fn (array $item): bool => (bool) ($item['selected'] ?? false))
            ->map(fn (array $item): int => (int) $item['moduleId'])
            ->values()
            ->all();
        $countsAsRevenue = (bool) ($options['counts_as_revenue'] ?? false);
        $applySalesCommission = $countsAsRevenue && (bool) ($options['apply_sales_commission'] ?? false);
        $manualPaymentMethod = $countsAsRevenue ? (string) ($options['payment_method'] ?? '') : '';
        $gateway = $this->manualGateway($manualPaymentMethod, $countsAsRevenue);

        $payment = TenantSubscriptionPayment::query()->create([
            'tenant_id' => $tenant->id,
            'payment_type' => 'support_renewal',
            'subscription_package_id' => $package->id,
            'status' => 'pending',
            'gateway' => $gateway,
            'invoice_number' => $this->makeInvoiceNumber(),
            'amount' => (int) $preview['amount'],
            'discount_amount' => (int) $preview['discountAmount'],
            'payable_amount' => (int) $preview['payableAmount'],
            'sandbox_mode' => false,
            'initiated_by_tenant_user_id' => (string) ($actor['id'] ?? ''),
            'initiated_by_name' => $actor['name'] ?? null,
            'initiated_by_mobile' => $actor['mobile'] ?? null,
            'initiated_by_role' => $actor['role'] ?? null,
            'previous_support_ends_at' => $preview['previousSupportEndsAt'],
            'new_support_ends_at' => $preview['newSupportEndsAt'],
            'paid_at' => now(),
            'expires_at' => now()->addMinutes(30),
            'metadata' => [
                'package_name' => $package->name,
                'selected_feature_module_ids' => $selectedFeatureModuleIds,
                'is_upgrade' => (bool) ($preview['package']['isUpgrade'] ?? false),
                'upgrade_from_package_name' => $preview['package']['upgradeFromPackageName'] ?? null,
                'upgrade_credit_amount' => (int) ($preview['package']['upgradeCreditAmount'] ?? 0),
                'discount_code' => null,
                'counts_as_revenue' => $countsAsRevenue,
                'apply_sales_commission' => $applySalesCommission,
                'manual_payment_method' => $manualPaymentMethod !== '' ? $manualPaymentMethod : null,
                'admin_manual' => true,
                'manual_note' => trim((string) ($options['note'] ?? '')),
                'manual_registered_by_user_id' => $options['registered_by_user_id'] ?? null,
                'manual_registered_by_name' => $options['registered_by_name'] ?? null,
            ],
        ]);

        $this->createPaymentItems($payment, $preview, $package, $selectedFeatureModuleIds);

        return $this->markPaymentSuccessful(
            $payment,
            (string) ($options['reference_id'] ?? ('manual-'.Str::upper(Str::random(10)))),
        );
    }

    public function previewFeatureModuleActivation(Tenant $tenant, FeatureModule $module): array
    {
        return $this->featureModuleBilling->previewActivation($tenant, $module);
    }

    public function createFeatureModuleActivationPayment(Tenant $tenant, FeatureModule $module, array $actor, string $callbackUrl, ?string $gateway = null): array
    {
        $preview = $this->previewFeatureModuleActivation($tenant, $module);
        $settings = $this->settings($tenant);

        if (! $settings['enabled'] && ! $settings['sandbox_enabled']) {
            throw new RuntimeException('پرداخت فعال‌سازی ماژول در حال حاضر فعال نیست.');
        }

        $payment = TenantSubscriptionPayment::query()->create([
            'tenant_id' => $tenant->id,
            'payment_type' => 'feature_module_activation',
            'subscription_package_id' => null,
            'status' => 'pending',
            'gateway' => $settings['sandbox_enabled'] ? 'sandbox' : ($this->resolveGatewaySelection($settings, $gateway)),
            'invoice_number' => $this->makeInvoiceNumber(),
            'amount' => (int) $preview['amount'],
            'discount_amount' => 0,
            'payable_amount' => (int) $preview['payableAmount'],
            'sandbox_mode' => (bool) $settings['sandbox_enabled'],
            'initiated_by_tenant_user_id' => (string) ($actor['id'] ?? ''),
            'initiated_by_name' => $actor['name'] ?? null,
            'initiated_by_mobile' => $actor['mobile'] ?? null,
            'initiated_by_role' => $actor['role'] ?? null,
            'previous_support_ends_at' => $preview['currentSupportEndsAt'],
            'new_support_ends_at' => $preview['currentSupportEndsAt'],
            'expires_at' => now()->addMinutes(30),
            'metadata' => [
                'feature_module_id' => (int) $module->id,
                'feature_module_slug' => $module->slug,
                'feature_module_name' => $module->name,
            ],
        ]);

        $payment->items()->create([
            'item_type' => 'feature_module_activation',
            'feature_module_id' => $module->id,
            'title' => $module->name,
            'description' => 'فعال‌سازی ماژول تا پایان پشتیبانی فعلی سامانه',
            'quantity' => 1,
            'unit_amount' => (int) $preview['amount'],
            'amount' => (int) $preview['amount'],
            'discount_amount' => 0,
            'payable_amount' => (int) $preview['payableAmount'],
            'metadata' => [
                'remaining_days' => $preview['remainingDays'],
            ],
        ]);

        if ($settings['sandbox_enabled']) {
            $this->markPaymentSuccessful($payment, 'sandbox-'.Str::upper(Str::random(10)));

            return [
                'mode' => 'sandbox',
                'payment' => $payment->fresh(['items.featureModule']),
            ];
        }

        return array_merge(
            ['payment' => $payment->fresh(['items.featureModule'])],
            $this->startGatewayPayment(
                payment: $payment,
                settings: $settings,
                callbackUrlTemplate: $callbackUrl,
                description: 'فعال‌سازی ماژول '.$module->name.' برای '.$tenant->name,
                mobile: (string) ($actor['mobile'] ?? ''),
            ),
        );
    }

    public function previewStorageAddon(Tenant $tenant, int $gb): array
    {
        return $this->tenantStorage->previewExtraStoragePurchase($tenant, $gb);
    }

    public function createStorageAddonPayment(Tenant $tenant, int $gb, array $actor, string $callbackUrl, ?string $gateway = null): array
    {
        $preview = $this->previewStorageAddon($tenant, $gb);
        $settings = $this->settings($tenant);

        if (! $settings['enabled'] && ! $settings['sandbox_enabled']) {
            throw new RuntimeException('پرداخت خرید فضای اضافه در حال حاضر فعال نیست.');
        }

        if ((int) $preview['pricePerGbMonth'] <= 0) {
            throw ValidationException::withMessages([
                'gb' => 'هزینه هر گیگ اضافه هنوز در مدیریت سیستم تنظیم نشده است.',
            ]);
        }

        $payment = TenantSubscriptionPayment::query()->create([
            'tenant_id' => $tenant->id,
            'payment_type' => 'storage_addon',
            'subscription_package_id' => null,
            'status' => 'pending',
            'gateway' => $settings['sandbox_enabled'] ? 'sandbox' : ($this->resolveGatewaySelection($settings, $gateway)),
            'invoice_number' => $this->makeInvoiceNumber(),
            'amount' => (int) $preview['amount'],
            'discount_amount' => 0,
            'payable_amount' => (int) $preview['payableAmount'],
            'sandbox_mode' => (bool) $settings['sandbox_enabled'],
            'initiated_by_tenant_user_id' => (string) ($actor['id'] ?? ''),
            'initiated_by_name' => $actor['name'] ?? null,
            'initiated_by_mobile' => $actor['mobile'] ?? null,
            'initiated_by_role' => $actor['role'] ?? null,
            'previous_support_ends_at' => $tenant->support_ends_at?->toDateString(),
            'new_support_ends_at' => $tenant->support_ends_at?->toDateString(),
            'expires_at' => now()->addMinutes(30),
            'metadata' => [
                'storage_addon' => $preview,
            ],
        ]);

        $payment->items()->create([
            'item_type' => 'storage_addon',
            'title' => 'خرید فضای اضافه',
            'description' => $preview['gb'].' گیگ فضای اضافه برای '.$preview['remainingDays'].' روز باقی‌مانده',
            'quantity' => (int) $preview['gb'],
            'unit_amount' => (int) $preview['pricePerGbMonth'],
            'amount' => (int) $preview['amount'],
            'discount_amount' => 0,
            'payable_amount' => (int) $preview['payableAmount'],
            'metadata' => $preview,
        ]);

        if ($settings['sandbox_enabled']) {
            $this->markPaymentSuccessful($payment, 'sandbox-'.Str::upper(Str::random(10)));

            return [
                'mode' => 'sandbox',
                'payment' => $payment->fresh(['items']),
            ];
        }

        return array_merge(
            ['payment' => $payment->fresh(['items'])],
            $this->startGatewayPayment(
                payment: $payment,
                settings: $settings,
                callbackUrlTemplate: $callbackUrl,
                description: 'خرید فضای اضافه '.$tenant->name,
                mobile: (string) ($actor['mobile'] ?? ''),
            ),
        );
    }

    public function verifyPayment(Tenant $tenant, TenantSubscriptionPayment $payment): TenantSubscriptionPayment
    {
        abort_if((string) $payment->tenant_id !== (string) $tenant->id, 404);

        if ($payment->status === 'paid') {
            return $payment;
        }

        if ((string) $payment->gateway === 'maliart') {
            return $this->markPaymentSuccessful($payment, $this->maliart->verifiedReference($payment));
        }

        $settings = $this->settings($tenant);
        $gateway = (string) ($payment->gateway ?: $settings['provider']);
        $gatewaySettings = $settings['gateways'][$gateway] ?? null;
        $transactionId = (string) ($payment->authority ?? '');

        if (! $gatewaySettings || blank($transactionId)) {
            throw new RuntimeException('اطلاعات پرداخت برای تایید کافی نیست.');
        }

        try {
            $receipt = Payment::via($gateway)
                ->config(TenantPaymentGateways::driverConfig($gateway, $gatewaySettings, ''))
                ->amount((int) $payment->payable_amount)
                ->transactionId($transactionId)
                ->verify();
        } catch (InvalidPaymentException $exception) {
            $payment->update([
                'status' => 'failed',
                'failure_reason' => $exception->getMessage(),
            ]);

            throw $exception;
        }

        return $this->markPaymentSuccessful($payment, (string) $receipt->getReferenceId());
    }

    public function markPaymentCancelled(TenantSubscriptionPayment $payment, ?string $reason = null): void
    {
        if ($payment->status === 'paid') {
            return;
        }

        $payment->update([
            'status' => 'cancelled',
            'failure_reason' => $reason,
        ]);
    }

    private function markPaymentSuccessful(TenantSubscriptionPayment $payment, string $referenceId): TenantSubscriptionPayment
    {
        return DB::connection('central')->transaction(function () use ($payment, $referenceId): TenantSubscriptionPayment {
            $lockedPayment = TenantSubscriptionPayment::query()->with(['items.featureModule'])->lockForUpdate()->findOrFail($payment->id);

            if ($lockedPayment->status === 'paid') {
                return $lockedPayment;
            }

            $tenant = Tenant::query()->findOrFail($lockedPayment->tenant_id);
            if ($lockedPayment->payment_type === 'support_renewal') {
                $tenant->update([
                    'subscription_package_id' => $lockedPayment->subscription_package_id,
                    'support_ends_at' => $lockedPayment->new_support_ends_at,
                    'data' => array_merge($tenant->data ?? [], [
                        'support_ends_at' => $lockedPayment->new_support_ends_at,
                    ]),
                ]);
            } elseif ($lockedPayment->payment_type === 'storage_addon') {
                $storageAddon = $lockedPayment->metadata['storage_addon'] ?? [];
                if (is_array($storageAddon)) {
                    $this->tenantStorage->activateAddonFromPayment(
                        $tenant,
                        (int) ($storageAddon['gb'] ?? 0),
                        (int) ($storageAddon['pricePerGbMonth'] ?? 0),
                        (int) ($storageAddon['payableAmount'] ?? $lockedPayment->payable_amount),
                        (int) $lockedPayment->id,
                    );
                }
            }

            $lockedPayment->update([
                'status' => 'paid',
                'reference_id' => $referenceId,
                'paid_at' => now(),
            ]);

            $discountCodeMeta = $lockedPayment->metadata['discount_code'] ?? null;
            if (is_array($discountCodeMeta) && ! empty($discountCodeMeta['id']) && (int) ($discountCodeMeta['discountAmount'] ?? 0) > 0) {
                $code = \App\Domain\Tenant\Models\DiscountCode::query()->find((int) $discountCodeMeta['id']);
                if ($code) {
                    $this->discountCodes->recordRenewalRedemption($code, $tenant, $lockedPayment, [
                        'baseAmount' => (int) $lockedPayment->amount,
                        'discountAmount' => (int) ($discountCodeMeta['discountAmount'] ?? 0),
                        'payableAmount' => (int) $lockedPayment->payable_amount,
                    ]);
                }
            } elseif ($lockedPayment->payment_type === 'support_renewal' && $this->shouldApplySalesCommission($lockedPayment)) {
                $this->salesTracking->trackRenewalSaleFromAssignment($tenant, $lockedPayment->fresh());
            } elseif ($lockedPayment->payment_type === 'feature_module_activation' && $this->shouldApplySalesCommission($lockedPayment)) {
                $this->salesTracking->trackFeatureModuleSaleFromAssignment($tenant, $lockedPayment->fresh(['items.featureModule']));
            }

            $this->syncPaidFeatureModules($tenant, $lockedPayment);
            $this->syncPaidStorageAddons($tenant, $lockedPayment);
            $this->syncFeatureModuleSmsDefaults($tenant, $lockedPayment);
            $this->vipFeatureService->syncTenantState($tenant);
            $this->customerClubService->syncTenantState($tenant);

            return $lockedPayment->fresh(['subscriptionPackage', 'items.featureModule']);
        });
    }

    private function syncFeatureModuleSmsDefaults(Tenant $tenant, TenantSubscriptionPayment $payment): void
    {
        $featureItems = $payment->items
            ->filter(fn (TenantSubscriptionPaymentItem $item) => in_array($item->item_type, ['feature_module_renewal', 'feature_module_activation'], true));

        $hasOnlineStore = $featureItems->contains(function (TenantSubscriptionPaymentItem $item): bool {
            return (string) ($item->featureModule?->slug ?? '') === 'online-store';
        });

        if ($hasOnlineStore) {
            $this->tenantProvisioningService->provisionDefaultStoreSmsSettings($tenant, true);
        }
    }

    private function createPaymentItems(TenantSubscriptionPayment $payment, array $preview, SubscriptionPackage $package, array $selectedFeatureModuleIds): void
    {
        $payment->items()->create([
            'item_type' => 'support_package',
            'subscription_package_id' => $package->id,
            'title' => $package->name,
            'description' => 'تمدید پشتیبانی سامانه',
            'quantity' => 1,
            'unit_amount' => (int) $preview['package']['priceAmount'],
            'amount' => (int) $preview['package']['priceAmount'],
            'discount_amount' => (int) $preview['package']['discountAmount'],
            'payable_amount' => (int) $preview['package']['payableAmount'],
            'metadata' => [
                'is_upgrade' => (bool) ($preview['package']['isUpgrade'] ?? false),
                'upgrade_from_package_name' => $preview['package']['upgradeFromPackageName'] ?? null,
                'upgrade_credit_amount' => (int) ($preview['package']['upgradeCreditAmount'] ?? 0),
                'base_payable_amount' => (int) ($preview['package']['basePayableAmount'] ?? $preview['package']['payableAmount']),
            ],
        ]);

        $selectedLookup = array_map('intval', $selectedFeatureModuleIds);

        collect($preview['featureModules'] ?? [])
            ->filter(fn (array $item) => in_array((int) $item['moduleId'], $selectedLookup, true))
            ->each(function (array $item) use ($payment): void {
                $payment->items()->create([
                    'item_type' => ($item['billingMode'] ?? 'renewal') === 'activation'
                        ? 'feature_module_activation'
                        : 'feature_module_renewal',
                    'feature_module_id' => (int) $item['moduleId'],
                    'title' => $item['name'],
                    'description' => ($item['billingMode'] ?? 'renewal') === 'activation'
                        ? 'فعال‌سازی ماژول هم‌زمان با تمدید پشتیبانی'
                        : 'تمدید ماژول تا پایان دوره جدید پشتیبانی',
                    'quantity' => 1,
                    'unit_amount' => (int) $item['renewalAmount'],
                    'amount' => (int) $item['renewalAmount'],
                    'discount_amount' => 0,
                    'payable_amount' => (int) $item['renewalAmount'],
                    'metadata' => [
                        'billing_mode' => $item['billingMode'] ?? 'renewal',
                        'is_active' => (bool) ($item['isActive'] ?? false),
                        'current_ends_at' => $item['currentEndsAt'] ?? null,
                    ],
                ]);
            });

        if (is_array($preview['extraStorageRenewal'] ?? null)) {
            $extraStorage = $preview['extraStorageRenewal'];
            $payment->items()->create([
                'item_type' => 'storage_addon_renewal',
                'title' => 'تمدید فضای اضافه',
                'description' => sprintf(
                    'تمدید %s گیگ فضای اضافه برای %s روز',
                    number_format((int) ($extraStorage['gb'] ?? 0)),
                    number_format((int) ($extraStorage['durationDays'] ?? 0)),
                ),
                'quantity' => (int) ($extraStorage['gb'] ?? 1),
                'unit_amount' => (int) ($extraStorage['pricePerGbMonth'] ?? 0),
                'amount' => (int) ($extraStorage['amount'] ?? 0),
                'discount_amount' => 0,
                'payable_amount' => (int) ($extraStorage['payableAmount'] ?? 0),
                'metadata' => $extraStorage,
            ]);
        }

        $discountCode = $preview['discountCode'] ?? null;
        if (is_array($discountCode) && (int) ($discountCode['discountAmount'] ?? 0) > 0) {
            $payment->items()->create([
                'item_type' => 'discount_code',
                'title' => 'کد تخفیف '.$discountCode['code'],
                'description' => 'اعمال روی تمدید پشتیبانی',
                'quantity' => 1,
                'unit_amount' => 0,
                'amount' => 0,
                'discount_amount' => (int) $discountCode['discountAmount'],
                'payable_amount' => 0,
                'metadata' => [
                    'discount_code_id' => $discountCode['id'],
                    'sales_user_id' => $discountCode['salesUserId'] ?? null,
                ],
            ]);
        }
    }

    private function syncPaidFeatureModules(Tenant $tenant, TenantSubscriptionPayment $payment): void
    {
        /** @var Collection<int, TenantSubscriptionPaymentItem> $featureItems */
        $featureItems = $payment->items
            ->filter(fn (TenantSubscriptionPaymentItem $item) => in_array($item->item_type, ['feature_module_renewal', 'feature_module_activation'], true));
        $selectedFeatureModuleIds = [];

        foreach ($featureItems as $item) {
            if (! $item->feature_module_id) {
                continue;
            }
            $selectedFeatureModuleIds[] = (int) $item->feature_module_id;

            $featureModule = $item->featureModule
                ?? FeatureModule::query()->find($item->feature_module_id);

            if (! $featureModule) {
                continue;
            }

            $record = $this->tenantFeatureModules->activate($tenant, $featureModule, [
                'source' => 'support_payment',
                'expires_at' => $payment->new_support_ends_at,
            ]);

            $metadata = $record->metadata ?? [];
            $metadata['last_payment_id'] = $payment->id;
            $metadata['last_payment_type'] = $payment->payment_type;

            $record->forceFill([
                'last_paid_at' => now(),
                'metadata' => $metadata,
            ]);
            $record->save();
        }

        if ($payment->payment_type === 'support_renewal') {
            $this->deactivateUnselectedFeatureModules($tenant, $payment, $selectedFeatureModuleIds);
        }
    }

    private function syncPaidStorageAddons(Tenant $tenant, TenantSubscriptionPayment $payment): void
    {
        if ($payment->payment_type !== 'support_renewal') {
            return;
        }

        $hasStorageRenewal = $payment->items
            ->contains(fn (TenantSubscriptionPaymentItem $item): bool => $item->item_type === 'storage_addon_renewal');

        if ($hasStorageRenewal) {
            $this->tenantStorage->renewActiveAddons($tenant, (int) $payment->id, $payment->new_support_ends_at);
        }
    }

    /**
     * @param array<int, int> $selectedFeatureModuleIds
     */
    private function deactivateUnselectedFeatureModules(Tenant $tenant, TenantSubscriptionPayment $payment, array $selectedFeatureModuleIds): void
    {
        $previousSupportEndsAt = $payment->previous_support_ends_at;
        if (! $previousSupportEndsAt) {
            return;
        }

        $query = TenantFeatureModule::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active');

        if (! empty($selectedFeatureModuleIds)) {
            $query->whereNotIn('feature_module_id', array_values(array_unique($selectedFeatureModuleIds)));
        }

        $today = now()->startOfDay();

        $query->get()->each(function (TenantFeatureModule $record) use ($payment, $previousSupportEndsAt, $today): void {
            if ($record->expires_at === null || $record->expires_at->greaterThan($previousSupportEndsAt)) {
                $record->expires_at = $previousSupportEndsAt;
            }

            if ($record->expires_at !== null && $record->expires_at->lt($today)) {
                $record->status = 'inactive';
            }

            $record->metadata = array_merge($record->metadata ?? [], [
                'last_non_renewal_payment_id' => $payment->id,
            ]);
            $record->save();
        });
    }

    private function makeInvoiceNumber(): string
    {
        return 'SUP-'.now()->format('YmdHis').'-'.Str::upper(Str::random(6));
    }

    private function shouldApplySalesCommission(TenantSubscriptionPayment $payment): bool
    {
        return (bool) ($payment->metadata['apply_sales_commission'] ?? true);
    }

    private function manualGateway(string $paymentMethod, bool $countsAsRevenue): string
    {
        if (! $countsAsRevenue) {
            return 'manual_no_charge';
        }

        return match ($paymentMethod) {
            'card_to_card' => 'manual_card_to_card',
            default => 'manual_online',
        };
    }

    private function resolveGatewaySelection(array $settings, ?string $gateway): string
    {
        if (($settings['maliart_enabled'] ?? false) === true) {
            return 'maliart';
        }

        $requested = trim((string) ($gateway ?? ''));
        $enabledGateways = $settings['enabled_gateways'] ?? [];
        $defaultProvider = (string) ($settings['provider'] ?? '');
        $selected = $requested !== '' ? $requested : $defaultProvider;

        if (! in_array($selected, $enabledGateways, true)) {
            throw new RuntimeException('درگاه انتخاب‌شده برای تمدید پشتیبانی فعال یا کامل نیست.');
        }

        return $selected;
    }

    private function startGatewayPayment(
        TenantSubscriptionPayment $payment,
        array $settings,
        string $callbackUrlTemplate,
        string $description,
        string $mobile,
    ): array {
        $gateway = (string) ($payment->gateway ?? '');

        if ($gateway === 'maliart') {
            return $this->maliart->start($payment, tenant(), $callbackUrlTemplate, $description, $mobile);
        }

        $gatewaySettings = $settings['gateways'][$gateway] ?? null;

        if (! $gatewaySettings) {
            throw new RuntimeException('تنظیمات درگاه پرداخت پشتیبانی کامل نیست.');
        }

        $callbackUrl = str_replace(['{payment}', '__PAYMENT__'], (string) $payment->id, $callbackUrlTemplate);
        $invoice = (new Invoice())
            ->amount((int) $payment->payable_amount)
            ->detail('description', $description)
            ->detail('mobile', $mobile);

        $paymentManager = Payment::via($gateway)
            ->config(TenantPaymentGateways::driverConfig($gateway, $gatewaySettings, $callbackUrl))
            ->callbackUrl($callbackUrl);

        $paymentManager->purchase($invoice, function ($driver, $transactionId) use ($payment): void {
            $payment->update([
                'authority' => (string) $transactionId,
            ]);
        });

        $redirectForm = $paymentManager->pay()->jsonSerialize();
        $paymentUrl = is_array($redirectForm) ? (string) ($redirectForm['action'] ?? '') : '';

        return [
            'mode' => 'gateway',
            'paymentUrl' => $paymentUrl !== '' ? $paymentUrl : null,
            'redirectForm' => $redirectForm,
        ];
    }

    private function resolvePricingForTenant(Tenant $tenant, SubscriptionPackage $targetPackage): array
    {
        $targetPricing = $targetPackage->pricingFor($tenant->audience_type_id);
        $targetPriceAmount = (int) $targetPricing['priceAmount'];
        $targetDiscounted = $targetPricing['discountedPriceAmount'] !== null ? (int) $targetPricing['discountedPriceAmount'] : null;
        $targetPayable = (int) $targetPricing['payableAmount'];
        $targetDiscount = (int) $targetPricing['discountAmount'];

        $currentPackage = $tenant->subscriptionPackage;
        $canApplyUpgradeDiff = $currentPackage
            && (int) $currentPackage->id !== (int) $targetPackage->id
            && (int) $currentPackage->duration_days === (int) $targetPackage->duration_days
            && $tenant->support_ends_at?->isFuture()
            && $this->isHigherUserLimit($currentPackage, $targetPackage);

        if (! $canApplyUpgradeDiff) {
            return [
                'priceAmount' => $targetPriceAmount,
                'discountedPriceAmount' => $targetDiscounted,
                'payableAmount' => $targetPayable,
                'discountAmount' => $targetDiscount,
                'isUpgrade' => false,
                'upgradeFromPackageName' => null,
                'upgradeCreditAmount' => 0,
                'basePayableAmount' => $targetPayable,
                'lineDescription' => 'تمدید پشتیبانی سامانه برای '.(int) $targetPackage->duration_days.' روز',
            ];
        }

        $currentPricing = $currentPackage->pricingFor($tenant->audience_type_id);
        $currentPayable = (int) $currentPricing['payableAmount'];
        $currentPriceAmount = (int) $currentPricing['priceAmount'];
        $payableDiff = max(0, $targetPayable - $currentPayable);
        $priceDiff = max(0, $targetPriceAmount - $currentPriceAmount);
        $discountDiff = max(0, $priceDiff - $payableDiff);

        return [
            'priceAmount' => $priceDiff,
            'discountedPriceAmount' => $payableDiff,
            'payableAmount' => $payableDiff,
            'discountAmount' => $discountDiff,
            'isUpgrade' => true,
            'upgradeFromPackageName' => $currentPackage->name,
            'upgradeCreditAmount' => min($targetPayable, $currentPayable),
            'basePayableAmount' => $targetPayable,
            'lineDescription' => 'ارتقای بسته (مابه‌التفاوت) از '.$currentPackage->name.' به '.$targetPackage->name,
        ];
    }

    private function isHigherUserLimit(SubscriptionPackage $currentPackage, SubscriptionPackage $targetPackage): bool
    {
        if ($targetPackage->user_limit === null) {
            return true;
        }

        if ($currentPackage->user_limit === null) {
            return false;
        }

        return (int) $targetPackage->user_limit > (int) $currentPackage->user_limit;
    }

    private function ensurePackageMatchesCurrentProfessionals(Tenant $tenant, SubscriptionPackage $package): void
    {
        $tenant->loadMissing(['subscriptionPackage', 'audienceType']);

        $selectedLimit = $package->user_limit;
        if ($selectedLimit === null) {
            return;
        }

        $currentProfessionalCount = $this->professionalCount($tenant);
        if ($currentProfessionalCount <= (int) $selectedLimit) {
            return;
        }

        $pluralLabel = trim((string) ($tenant->audienceType?->plural_label ?? 'کاربران'));
        $currentPackageName = trim((string) ($tenant->subscriptionPackage?->name ?? 'بسته فعلی شما'));
        $currentCountFa = number_format($currentProfessionalCount);
        $selectedLimitFa = number_format((int) $selectedLimit);

        throw ValidationException::withMessages([
            'subscription_package_id' => "اکنون {$currentCountFa} {$pluralLabel} فعال دارید. برای خرید این بسته باید تعداد {$pluralLabel} را به {$selectedLimitFa} برسانید و موارد اضافی را حذف کنید. برای جلوگیری از اختلال، لطفاً بسته {$currentPackageName} یا بسته‌ای هم‌سطح با تعداد فعلی {$pluralLabel} را انتخاب کنید.",
        ]);
    }

    private function professionalCount(Tenant $tenant): int
    {
        return (int) $tenant->run(function (): int {
            return DB::table((new Barber())->getTable())->count();
        });
    }
}
