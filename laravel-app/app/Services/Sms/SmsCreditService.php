<?php

declare(strict_types=1);

namespace App\Services\Sms;

use App\Domain\Tenant\Models\SmsOutbound;
use App\Domain\Tenant\Models\SmsSetting;
use App\Support\SmsCreditAlertState;

class SmsCreditService
{
    public function addCredit(SmsSetting $setting, int $amount): void
    {
        $amount = max(0, $amount);

        if ($amount === 0) {
            return;
        }

        $stats = is_array($setting->templates['stats'] ?? null) ? $setting->templates['stats'] : [];
        $stats['creditBalance'] = max(0, (int) ($stats['creditBalance'] ?? 0)) + $amount;
        $stats['totalSent'] = (int) ($stats['totalSent'] ?? 0);
        $stats['sentToday'] = (int) ($stats['sentToday'] ?? 0);

        $templates = $setting->templates ?? [];
        $templates['stats'] = $stats;
        $templates['credit_alert_state'] = SmsCreditAlertState::resetForBalance(
            is_array($templates['credit_alert_state'] ?? null) ? $templates['credit_alert_state'] : [],
            (int) $stats['creditBalance'],
        );

        $setting->update([
            'templates' => $templates,
        ]);
    }

    public function balance(?SmsSetting $setting): int
    {
        $stats = is_array($setting?->templates['stats'] ?? null) ? $setting->templates['stats'] : [];

        return (int) ($stats['creditBalance'] ?? 0);
    }

    public function canSend(?SmsSetting $setting, SmsOutbound $outbound, bool $allowNegative = false): bool
    {
        if ($allowNegative) {
            return true;
        }

        return $this->balance($setting) >= (int) $outbound->total_price;
    }

    public function charge(SmsSetting $setting, SmsOutbound $outbound, bool $allowNegative = false): void
    {
        $stats = is_array($setting->templates['stats'] ?? null) ? $setting->templates['stats'] : [];
        $balanceBefore = (int) ($stats['creditBalance'] ?? 0);
        $cost = (int) $outbound->total_price;

        if (! $allowNegative && $balanceBefore < $cost) {
            throw new \RuntimeException('شارژ پیامک کافی نیست.');
        }

        $stats['creditBalance'] = $balanceBefore - $cost;
        $stats['totalSent'] = (int) ($stats['totalSent'] ?? 0) + 1;
        $stats['sentToday'] = (int) ($stats['sentToday'] ?? 0) + 1;

        $templates = $setting->templates ?? [];
        $templates['stats'] = $stats;

        $setting->update([
            'templates' => $templates,
        ]);
    }
}
