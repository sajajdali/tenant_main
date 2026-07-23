<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantUser;
use App\Domain\Tenant\Models\UserNotification;
use App\Support\SmsGatewaySettings;

class TenantAdminNotificationService
{
    public function __construct(
        private readonly UserNotificationRealtimeService $notificationRealtime,
    ) {
    }

    public function notify(Tenant $tenant, string $templateKey, array $context = []): void
    {
        $templates = SmsGatewaySettings::notificationTemplates();
        $template = $templates[$templateKey] ?? null;

        if (! is_array($template)) {
            return;
        }

        $tenant->run(function () use ($templateKey, $template, $context): void {
            $admins = TenantUser::query()
                ->where('role', 'admin')
                ->where('is_active', true)
                ->orderBy('id')
                ->get(['id', 'name', 'mobile', 'role']);

            if ($admins->isEmpty()) {
                return;
            }

            $title = $this->render((string) ($template['title'] ?? ''), $context);
            $message = $this->render((string) ($template['message'] ?? ''), $context);
            $now = now();

            $rows = $admins->map(fn (TenantUser $admin): array => [
                'tenant_user_id' => $admin->id,
                'recipient_mobile' => $admin->mobile,
                'recipient_name' => $admin->name,
                'recipient_role' => $admin->role,
                'title' => $title,
                'message' => $message,
                'sender_central_user_id' => $context['sender_central_user_id'] ?? null,
                'sender_name' => $context['sender_name'] ?? __('tenant.notifications.default_sender'),
                'target_type' => 'system_event',
                'meta' => json_encode([
                    'source' => 'central_system',
                    'template_key' => $templateKey,
                    'context' => $context,
                ], JSON_UNESCAPED_UNICODE),
                'is_read' => false,
                'read_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ])->all();

            foreach (array_chunk($rows, 500) as $chunk) {
                UserNotification::query()->insert($chunk);
            }

            $this->notificationRealtime->broadcastInboxUpdated(
                $admins->pluck('id')->all(),
            );
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
