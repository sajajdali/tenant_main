<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\NutritionTokenWallet;
use App\Domain\Tenant\Models\SmsSetting;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantUser;
use App\Services\Sms\SmsDispatchService;
use App\Support\JalaliDate;
use App\Support\SmsGatewaySettings;
use App\Support\SmsSenderRegistry;
use App\Support\TenantAudienceScope;

class NutritionTokenAlertService
{
    public function __construct(
        private readonly SmsDispatchService $dispatch,
    ) {
    }

    public function sendIfNeeded(int $balance): int
    {
        $balance = max(0, $balance);

        if (! TenantAudienceScope::currentTenantMatches(['nutritionists', 'nutrition-doctors'])) {
            return 0;
        }

        $alertKey = $this->alertKey($balance);
        $wallet = NutritionTokenWallet::query()->firstOrCreate(['id' => 1]);
        $settings = is_array($wallet->settings_json) ? $wallet->settings_json : [];
        $state = is_array($settings['token_balance_alert_state'] ?? null) ? $settings['token_balance_alert_state'] : [];

        if ($alertKey === null) {
            if (($state['last_band'] ?? null) !== 'ok') {
                $this->persistState($wallet, [
                    'last_band' => 'ok',
                    'warning_sent_at' => null,
                    'critical_sent_at' => null,
                ]);
            }

            return 0;
        }

        $sentField = $alertKey === 'critical_500' ? 'critical_sent_at' : 'warning_sent_at';

        if (! empty($state[$sentField])) {
            return 0;
        }

        $sentCount = $this->sendSms($alertKey, $balance);

        if ($sentCount > 0) {
            $state['last_band'] = $alertKey === 'critical_500' ? 'critical' : 'warning';
            $state[$sentField] = now()->toIso8601String();
            $state[$sentField.'_balance'] = $balance;
            $this->persistState($wallet->fresh(), $state);
        }

        return $sentCount;
    }

    private function alertKey(int $balance): ?string
    {
        if ($balance <= 500) {
            return 'critical_500';
        }

        if ($balance < 5000) {
            return 'low_5000';
        }

        return null;
    }

    private function sendSms(string $alertKey, int $balance): int
    {
        $tenant = Tenant::query()->with('domains')->find((string) tenant('id'));

        if (! $tenant) {
            return 0;
        }

        $smsSetting = SmsSetting::query()->firstOrCreate([], [
            'enabled' => true,
            'provider' => 'kavenegar',
            'credentials' => [
                'sender' => SmsSenderRegistry::defaultSender() ?? '',
            ],
            'templates' => [],
        ]);

        $admins = TenantUser::query()
            ->where('role', 'admin')
            ->where('is_active', true)
            ->orderBy('id')
            ->get(['id', 'name', 'mobile']);

        if ($admins->isEmpty()) {
            return 0;
        }

        $template = SmsGatewaySettings::nutritionTokenAlertTemplates()[$alertKey] ?? '';
        $sender = trim((string) (($smsSetting->credentials['sender'] ?? '') ?: (SmsSenderRegistry::defaultSender() ?? '')));
        $sentCount = 0;

        foreach ($admins as $admin) {
            $message = strtr($template, [
                '{{name}}' => trim((string) ($admin->name ?: 'مدیر سامانه')),
                '{{business_name}}' => $tenant->name ?: 'سامانه نوبت دهی',
                '{{token_balance}}' => JalaliDate::toPersianDigits(number_format($balance)),
                '{{top_up_url}}' => $this->topUpUrl($tenant),
            ]);

            $result = $this->dispatch->dispatchNow($smsSetting, [
                'type' => 'nutrition_token_balance_alert',
                'template_key' => $alertKey,
                'recipient_mobile' => $admin->mobile,
                'recipient_name' => $admin->name,
                'message' => $message,
                'provider' => (string) ($smsSetting->provider ?: 'kavenegar'),
                'sender' => $sender,
                'allow_negative_balance' => true,
            ]);

            if (($result['ok'] ?? false) === true) {
                $sentCount++;
            }
        }

        return $sentCount;
    }

    private function topUpUrl(Tenant $tenant): string
    {
        $host = app()->runningInConsole() ? '' : request()->getSchemeAndHttpHost();

        if (trim((string) $host) !== '') {
            return rtrim($host, '/').'/panel/nutrition/tokens/top-up';
        }

        $domain = trim((string) ($tenant->domains->first()?->domain ?? ''));

        return $domain !== ''
            ? 'https://'.trim($domain, '/').'/panel/nutrition/tokens/top-up'
            : '/panel/nutrition/tokens/top-up';
    }

    /**
     * @param  array<string, mixed>  $state
     */
    private function persistState(?NutritionTokenWallet $wallet, array $state): void
    {
        if (! $wallet) {
            return;
        }

        $settings = is_array($wallet->settings_json) ? $wallet->settings_json : [];
        $settings['token_balance_alert_state'] = $state;

        $wallet->forceFill([
            'settings_json' => $settings,
        ])->save();
    }
}
