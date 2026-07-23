<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\SmsSetting;
use App\Services\Sms\SmsDispatchService;
use App\Support\SmsQueue;

class SmsCampaignSenderService
{
    public function __construct(
        private readonly SmsDispatchService $dispatch,
    ) {
    }

    public function send(SmsSetting $setting, string $mobile, string $message, array $context = []): array
    {
        return $this->dispatch->dispatchNow($setting, [
            'type' => $context['type'] ?? 'manual',
            'template_key' => $context['template_key'] ?? null,
            'campaign_id' => $context['campaign_id'] ?? null,
            'recipient_mobile' => $mobile,
            'recipient_name' => $context['recipient_name'] ?? null,
            'message' => $message,
        ]);
    }

    public function queue(SmsSetting $setting, string $mobile, string $message, array $context = []): void
    {
        $this->dispatch->dispatchQueued($setting, [
            'type' => $context['type'] ?? 'manual',
            'template_key' => $context['template_key'] ?? null,
            'campaign_id' => $context['campaign_id'] ?? null,
            'recipient_mobile' => $mobile,
            'recipient_name' => $context['recipient_name'] ?? null,
            'message' => $message,
            'provider' => $context['provider'] ?? null,
            'sender' => $context['sender'] ?? null,
            'allow_negative_balance' => (bool) ($context['allow_negative_balance'] ?? false),
            'queue' => $context['queue'] ?? (($context['campaign_id'] ?? null) ? SmsQueue::CAMPAIGN : SmsQueue::TRANSACTIONAL),
        ]);
    }
}
