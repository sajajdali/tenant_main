<?php

declare(strict_types=1);

namespace App\Services\Sms;

use App\Domain\Tenant\Models\SmsSetting;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantUser;
use App\Support\JalaliDate;
use App\Support\SmsGatewaySettings;
use App\Support\SmsSenderRegistry;
use Carbon\Carbon;

class SupportExpiryReminderService
{
    public function __construct(
        private readonly SmsDispatchService $dispatch,
    ) {
    }

    public function sendDueReminders(Tenant $tenant, Carbon $today): int
    {
        $supportEndsAt = $tenant->support_ends_at?->copy()?->startOfDay();

        if (! $supportEndsAt) {
            return 0;
        }

        $daysRemaining = $today->copy()->startOfDay()->diffInDays($supportEndsAt, false);
        $reminderKey = match ($daysRemaining) {
            5 => 'day_5',
            1 => 'day_1',
            0 => 'day_0',
            default => null,
        };

        if ($reminderKey === null) {
            return 0;
        }

        $sentDate = $today->toDateString();
        $supportEndKey = $supportEndsAt->toDateString();
        $state = is_array($tenant->data['support_reminder_state'] ?? null) ? $tenant->data['support_reminder_state'] : [];
        $sentMap = is_array($state['by_support_end_date'][$supportEndKey] ?? null) ? $state['by_support_end_date'][$supportEndKey] : [];

        if (($sentMap[$reminderKey] ?? null) === $sentDate) {
            return 0;
        }

        $sentCount = 0;

        $tenant->run(function () use ($tenant, $supportEndsAt, $daysRemaining, $reminderKey, &$sentCount): void {
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

            $template = SmsGatewaySettings::supportReminderTemplates()[$reminderKey] ?? '';
            $sender = trim((string) (($smsSetting->credentials['sender'] ?? '') ?: (SmsSenderRegistry::defaultSender() ?? '')));

            foreach ($admins as $admin) {
                $message = strtr($template, [
                    '{{name}}' => trim((string) ($admin->name ?: 'مدیر سامانه')),
                    '{{business_name}}' => $tenant->name ?: 'سامانه نوبت دهی',
                    '{{support_end_date}}' => JalaliDate::format($supportEndsAt),
                    '{{days_remaining}}' => JalaliDate::toPersianDigits((string) max(0, $daysRemaining)),
                ]);

                $result = $this->dispatch->dispatchNow($smsSetting, [
                    'type' => 'support_expiry_reminder',
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
            $state = is_array($data['support_reminder_state'] ?? null) ? $data['support_reminder_state'] : [];
            $bySupportEndDate = is_array($state['by_support_end_date'] ?? null) ? $state['by_support_end_date'] : [];
            $supportEndKey = $supportEndsAt->toDateString();
            $supportState = is_array($bySupportEndDate[$supportEndKey] ?? null) ? $bySupportEndDate[$supportEndKey] : [];
            $supportState[$reminderKey] = $sentDate;
            $bySupportEndDate[$supportEndKey] = $supportState;
            $state['by_support_end_date'] = $bySupportEndDate;
            $data['support_reminder_state'] = $state;

            $tenant->update([
                'data' => $data,
            ]);
        }

        return $sentCount;
    }
}
