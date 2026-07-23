<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Tenant\Models\TenantSubscriptionPayment;
use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use App\Services\Payments\MaliartPaymentClient;
use App\Support\TenantPaymentGateways;
use App\Support\TenantStorageSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class SystemSettingsController extends Controller
{
    public function edit(MaliartPaymentClient $maliart): View
    {
        $raw = SystemSetting::getValue('support_payment', []);
        $gateways = TenantPaymentGateways::normalized($raw['gateways'] ?? []);

        // Backward compatibility for old single-field zarinpal config.
        if (($raw['zarinpal_merchant_id'] ?? '') !== '' && blank($gateways['zarinpal']['merchantId'] ?? '')) {
            $gateways['zarinpal']['merchantId'] = (string) $raw['zarinpal_merchant_id'];
            $gateways['zarinpal']['enabled'] = true;
        }

        $enabledGateways = TenantPaymentGateways::configuredEnabled($gateways);
        $provider = (string) ($raw['provider'] ?? ($enabledGateways[0] ?? 'zarinpal'));
        $provider = in_array($provider, TenantPaymentGateways::supportedKeys(), true) ? $provider : ($enabledGateways[0] ?? 'zarinpal');

        return view('admin.system-settings.edit', [
            'supportPaymentSettings' => [
                'enabled' => (bool) ($raw['enabled'] ?? false),
                'sandbox_enabled' => (bool) ($raw['sandbox_enabled'] ?? false),
                'provider' => $provider,
                'gateways' => $gateways,
                'enabled_gateways' => $enabledGateways,
            ],
            'tenantStorageSettings' => [
                'default_quota_gb' => TenantStorageSettings::normalizeQuotaGb(
                    SystemSetting::getValue('tenant_storage', [])['default_quota_gb'] ?? TenantStorageSettings::DEFAULT_QUOTA_GB,
                ),
                'extra_price_per_gb_month' => max(0, (int) (SystemSetting::getValue('tenant_storage', [])['extra_price_per_gb_month'] ?? 0)),
            ],
            'storageQuotaOptions' => TenantStorageSettings::quotaGbOptions(),
            'gatewayDefinitions' => TenantPaymentGateways::definitions(),
            'maliartPaymentSettings' => [
                'enabled' => $maliart->enabled(),
            ],
            'latestSupportPayments' => TenantSubscriptionPayment::query()
                ->with(['tenant:id,name', 'subscriptionPackage:id,name,duration_days,user_limit'])
                ->latest('id')
                ->limit(30)
                ->get(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'enabled' => ['nullable', 'boolean'],
            'sandbox_enabled' => ['nullable', 'boolean'],
            'maliart_enabled' => ['nullable', 'boolean'],
            'provider' => ['nullable', 'in:'.implode(',', TenantPaymentGateways::supportedKeys())],
            'storage_default_quota_gb' => ['required', 'integer', Rule::in(TenantStorageSettings::quotaGbOptions())],
            'storage_extra_price_per_gb_month' => ['required', 'integer', 'min:0'],
        ] + TenantPaymentGateways::validationRules());

        $gateways = TenantPaymentGateways::normalized($validated['gateways'] ?? []);
        $enabledGateways = TenantPaymentGateways::configuredEnabled($gateways);
        $provider = (string) ($validated['provider'] ?? ($enabledGateways[0] ?? ''));

        SystemSetting::putValue('support_payment', [
            'enabled' => (bool) ($validated['enabled'] ?? false),
            'sandbox_enabled' => (bool) ($validated['sandbox_enabled'] ?? false),
            'provider' => in_array($provider, $enabledGateways, true) ? $provider : ($enabledGateways[0] ?? null),
            'gateways' => $gateways,
        ]);

        SystemSetting::putValue('maliart_payment', [
            'enabled' => (bool) ($validated['maliart_enabled'] ?? false),
        ]);

        SystemSetting::putValue('tenant_storage', [
            'default_quota_gb' => TenantStorageSettings::normalizeQuotaGb($validated['storage_default_quota_gb']),
            'extra_price_per_gb_month' => max(0, (int) $validated['storage_extra_price_per_gb_month']),
        ]);

        return redirect()
            ->route('admin.system-settings.edit')
            ->with('success', 'تنظیمات سایت ذخیره شد.');
    }
}
