<?php

declare(strict_types=1);

namespace App\Services\Sms;

use App\Domain\Tenant\Models\SmsSetting;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantUser;
use App\Support\JalaliDate;
use App\Support\SmsGatewaySettings;
use App\Support\SmsSenderRegistry;
use App\Support\TenantManagedDomain;
use Carbon\Carbon;

class DomainExpiryReminderService
{
    public function __construct(
        private readonly SmsDispatchService $dispatch,
    ) {
    }

    public function sendDueReminders(Tenant $tenant, Carbon $today): int
    {
        $summary = TenantManagedDomain::summary($tenant);

        if (($summary['enabled'] ?? false) !== true || ($summary['selfManaged'] ?? false) === true) {
            return 0;
        }

        $renewsAt = isset($summary['renewsAt']) && $summary['renewsAt']
            ? Carbon::parse((string) $summary['renewsAt'])->startOfDay()
            : null;

        if (! $renewsAt) {
            return 0;
        }

        $daysRemaining = $today->copy()->startOfDay()->diffInDays($renewsAt, false);
        $reminderKey = match ($daysRemaining) {
            30 => 'day_30',
            15 => 'day_15',
            1 => 'day_1',
            default => null,
        };

        if ($reminderKey === null) {
            return 0;
        }

        $sentDate = $today->toDateString();
        $renewKey = $renewsAt->toDateString();
        $state = is_array($tenant->data['domain_reminder_state'] ?? null) ? $tenant->data['domain_reminder_state'] : [];
        $sentMap = is_array($state['by_domain_renew_date'][$renewKey] ?? null) ? $state['by_domain_renew_date'][$renewKey] : [];

        if (($sentMap[$reminderKey] ?? null) === $sentDate) {
            return 0;
        }

        $sentCount = 0;

        $tenant->run(function () use ($tenant, $summary, $renewsAt, $daysRemaining, $reminderKey, &$sentCount): void {
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
                return;
            }

            $template = SmsGatewaySettings::domainReminderTemplates()[$reminderKey] ?? '';
            $sender = trim((string) (($smsSetting->credentials['sender'] ?? '') ?: (SmsSenderRegistry::defaultSender() ?? '')));
            $domainName = trim((string) ($tenant->domains()->first()?->domain ?? ''));

            foreach ($admins as $admin) {
                $message = strtr($template, [
                    '{{name}}' => trim((string) ($admin->name ?: 'مدیر سامانه')),
                    '{{business_name}}' => $tenant->name ?: 'سامانه نوبت دهی',
                    '{{domain_name}}' => $domainName !== '' ? $domainName : ((string) ($summary['label'] ?? 'دامنه')),
                    '{{domain_tld}}' => (string) ($summary['tld'] ?? ''),
                    '{{domain_end_date}}' => JalaliDate::format($renewsAt),
                    '{{days_remaining}}' => JalaliDate::toPersianDigits((string) max(0, $daysRemaining)),
                ]);

                $result = $this->dispatch->dispatchNow($smsSetting, [
                    'type' => 'domain_expiry_reminder',
                    'template_key' => $reminderKey,
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
        });

        if ($sentCount > 0) {
            $data = $tenant->data ?? [];
            $state = is_array($data['domain_reminder_state'] ?? null) ? $data['domain_reminder_state'] : [];
            $byRenewDate = is_array($state['by_domain_renew_date'] ?? null) ? $state['by_domain_renew_date'] : [];
            $renewKey = $renewsAt->toDateString();
            $renewState = is_array($byRenewDate[$renewKey] ?? null) ? $byRenewDate[$renewKey] : [];
            $renewState[$reminderKey] = $sentDate;
            $byRenewDate[$renewKey] = $renewState;
            $state['by_domain_renew_date'] = $byRenewDate;
            $data['domain_reminder_state'] = $state;

            $tenant->update([
                'data' => $data,
            ]);
        }

        return $sentCount;
    }
}
