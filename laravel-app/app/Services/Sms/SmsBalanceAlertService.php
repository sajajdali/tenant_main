<?php

declare(strict_types=1);

namespace App\Services\Sms;

use App\Domain\Tenant\Models\SmsOutbound;
use App\Domain\Tenant\Models\SmsSetting;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantUser;
use App\Support\SmsCreditAlertState;
use App\Support\SmsGatewaySettings;
use App\Support\SmsPricing;
use App\Support\SmsSenderRegistry;
use Throwable;

class SmsBalanceAlertService
{
    public function __construct(
        private readonly SmsProviderManager $providers,
        private readonly SmsCreditService $credits,
    ) {
    }

    public function afterSuccessfulCharge(SmsSetting $setting): void
    {
        if (! $setting->provider) {
            return;
        }

        $balance = $this->credits->balance($setting);
        $thresholdKey = SmsCreditAlertState::applicableThresholdKey($balance);

        if ($thresholdKey === null) {
            return;
        }

        $templates = $setting->templates ?? [];
        $alertState = SmsCreditAlertState::normalize(is_array($templates['credit_alert_state'] ?? null) ? $templates['credit_alert_state'] : []);

        if (SmsCreditAlertState::alreadySent($alertState, $thresholdKey)) {
            return;
        }

        $tenantId = (string) tenant('id');
        $tenant = Tenant::query()->find($tenantId);

        if (! $tenant) {
            return;
        }

        $tenantName = $tenant->name ?: 'سامانه نوبت دهی';

        $tenant->run(function () use ($setting, $balance, $thresholdKey, $tenantName): void {
            $admins = TenantUser::query()
                ->where('role', 'admin')
                ->where('is_active', true)
                ->orderBy('id')
                ->get(['id', 'name', 'mobile']);

            if ($admins->isEmpty()) {
                $this->persistState($setting->fresh(), $balance);

                return;
            }

            $driver = $this->providers->driver((string) $setting->provider);
            $sender = trim((string) (($setting->credentials['sender'] ?? '') ?: (SmsSenderRegistry::defaultSender() ?? '')));
            $templateBody = SmsGatewaySettings::creditAlertTemplates()[$thresholdKey] ?? '';

            foreach ($admins as $admin) {
                $message = $this->renderTemplate($templateBody, [
                    '{{name}}' => trim((string) ($admin->name ?: 'مدیر سامانه')),
                    '{{balance}}' => number_format($balance),
                    '{{tenant_name}}' => $tenantName,
                ]);

                $pricing = SmsPricing::analyze($message);
                $outbound = SmsOutbound::query()->create([
                    'campaign_id' => null,
                    'type' => 'system_credit_alert',
                    'template_key' => $thresholdKey,
                    'provider' => $setting->provider,
                    'sender' => $sender,
                    'recipient_mobile' => $admin->mobile,
                    'recipient_name' => $admin->name,
                    'message' => $message,
                    'message_encoding' => $pricing['encoding'],
                    'parts_count' => $pricing['parts_count'],
                    'unit_price' => $pricing['unit_price'],
                    'total_price' => $pricing['total_price'],
                    'status' => 'pending',
                    'provider_message_id' => null,
                    'error_message' => null,
                    'sent_at' => null,
                ]);

                try {
                    $result = $driver->sendMany($setting, [$admin->mobile], $message, $sender);
                    $entry = $result['entries'][0] ?? null;

                    if (($result['ok'] ?? false) === true) {
                        $this->credits->charge($setting->fresh(), $outbound, true);
                    }

                    $outbound->update([
                        'status' => ($result['ok'] ?? false) ? 'sent' : 'failed',
                        'sender' => $entry['sender'] ?? $sender,
                        'provider_message_id' => $entry['provider_message_id'] ?? null,
                        'error_message' => ($result['ok'] ?? false) ? null : (string) ($result['message'] ?? 'ارسال هشدار شارژ ناموفق بود.'),
                        'sent_at' => ($result['ok'] ?? false) ? now() : null,
                    ]);
                } catch (Throwable $exception) {
                    $outbound->update([
                        'status' => 'failed',
                        'error_message' => $exception->getMessage(),
                    ]);
                }
            }

            $this->persistState($setting->fresh(), $balance);
        });
    }

    private function persistState(SmsSetting $setting, int $balance): void
    {
        $templates = $setting->templates ?? [];
        $templates['credit_alert_state'] = SmsCreditAlertState::markTriggered(
            is_array($templates['credit_alert_state'] ?? null) ? $templates['credit_alert_state'] : [],
            $balance,
        );

        $setting->update([
            'templates' => $templates,
        ]);
    }

    /**
     * @param  array<string, string>  $replacements
     */
    private function renderTemplate(string $body, array $replacements): string
    {
        return strtr(trim($body), $replacements);
    }
}
