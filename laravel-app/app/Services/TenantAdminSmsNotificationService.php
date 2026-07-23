<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\SmsSetting;
use App\Domain\Tenant\Models\Tenant;
use App\Services\Sms\SmsDispatchService;
use App\Support\SmsGatewaySettings;
use App\Support\SmsSenderRegistry;

class TenantAdminSmsNotificationService
{
    public function __construct(private readonly SmsDispatchService $dispatch)
    {
    }

    public function notify(Tenant $tenant, string $templateKey, array $context = []): void
    {
        $tenant->loadMissing('owner');

        $owner = $tenant->owner;

        if (! $owner || trim((string) $owner->mobile) === '') {
            return;
        }

        $template = trim((string) (SmsGatewaySettings::notificationSmsTemplates()[$templateKey] ?? ''));

        if ($template === '') {
            return;
        }

        $message = $this->render($template, [
            'name' => trim((string) ($owner->name ?? __('tenant.notifications.default_user'))),
            ...$context,
        ]);

        if (trim($message) === '') {
            return;
        }

        $tenant->run(function () use ($owner, $templateKey, $message): void {
            $smsSetting = SmsSetting::query()->firstOrCreate([], [
                'enabled' => true,
                'provider' => 'kavenegar',
                'credentials' => [
                    'sender' => SmsSenderRegistry::defaultSender() ?? '',
                ],
                'templates' => [],
            ]);

            $this->dispatch->dispatchQueued($smsSetting, [
                'type' => 'system_notification',
                'template_key' => $templateKey,
                'recipient_mobile' => (string) $owner->mobile,
                'recipient_name' => (string) ($owner->name ?? ''),
                'message' => $message,
                'allow_negative_balance' => true,
            ]);
        });
    }

    private function render(string $text, array $context): string
    {
        $replacements = [];

        foreach ($context as $key => $value) {
            if (is_scalar($value) || $value === null) {
                $replacements['{{'.$key.'}}'] = trim((string) $value);
            }
        }

        return strtr($text, $replacements);
    }
}
