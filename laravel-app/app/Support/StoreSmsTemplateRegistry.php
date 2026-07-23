<?php

declare(strict_types=1);

namespace App\Support;

class StoreSmsTemplateRegistry
{
    /**
     * @return array<string, array{title:string, default_enabled:bool, default_body:string}>
     */
    public static function definitions(): array
    {
        return [
            'afterOrder' => [
                'title' => 'بعد از ثبت سفارش',
                'default_enabled' => true,
                'default_body' => "{{customer_name}} عزیز\nسفارش شما ثبت شد.\nشماره پیگیری : {{order_number}}\n{{business_name}}\nلغو ۱۱",
            ],
            'afterApproval' => [
                'title' => 'بعد از تایید سفارش',
                'default_enabled' => true,
                'default_body' => "{{customer_name}} عزیز\nسفارش شما به شماره {{order_number}} تایید شد\nبا تشکر از شما",
            ],
            'afterShippingCode' => [
                'title' => 'بعد از ثبت کد مرسوله',
                'default_enabled' => true,
                'default_body' => "{{customer_name}} عزیز\nکد مرسوله شما : {{tracking_code}}\nبرای پیگیری میتوانید از سایت پست اقدام کنید\n{{business_name}}\nلغو۱۱",
            ],
            'afterRejection' => [
                'title' => 'بعد از رد سفارش',
                'default_enabled' => false,
                'default_body' => '',
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $templates
     * @return array<string, array<string, mixed>>
     */
    public static function normalizeCollection(array $templates): array
    {
        $normalized = [];

        foreach (static::definitions() as $key => $definition) {
            $normalized[$key] = static::normalizeTemplate($key, is_array($templates[$key] ?? null) ? $templates[$key] : []);
        }

        return $normalized;
    }

    /**
     * @param  array<string, mixed>  $incoming
     * @param  array<string, mixed>  $existing
     * @return array<string, array<string, mixed>>
     */
    public static function buildForPersistence(array $incoming, array $existing): array
    {
        $existing = static::normalizeCollection($existing);
        $result = [];

        foreach (static::definitions() as $key => $definition) {
            $current = $existing[$key];
            $nextEnabled = (bool) data_get($incoming, "{$key}.enabled", $current['enabled']);
            $nextBody = trim((string) data_get($incoming, "{$key}.body", $current['body']));
            $hasChanged = $nextEnabled !== (bool) $current['enabled'] || $nextBody !== (string) $current['body'];

            if (! $hasChanged) {
                $result[$key] = $current;
                continue;
            }

            $result[$key] = [
                ...$current,
                'enabled' => $nextEnabled,
                'body' => $nextBody,
                'approval_status' => $nextBody === '' ? 'draft' : 'pending_review',
                'rejection_reason' => null,
                'submitted_at' => $nextBody === '' ? null : now()->toISOString(),
                'reviewed_at' => null,
            ];
        }

        return $result;
    }

    /**
     * @param  array<string, mixed>  $templates
     * @return array<string, mixed>|null
     */
    public static function approvedTemplate(array $templates, string $key): ?array
    {
        $template = static::normalizeCollection($templates)[$key] ?? null;

        if (! $template) {
            return null;
        }

        $approvedBody = trim((string) ($template['approved_body'] ?? ''));
        $approvedEnabled = (bool) ($template['approved_enabled'] ?? false);

        if ($approvedBody === '' || ! $approvedEnabled) {
            return null;
        }

        return [
            ...$template,
            'body' => $approvedBody,
            'enabled' => $approvedEnabled,
        ];
    }

    /**
     * @param  array<string, mixed>  $template
     * @return array<string, mixed>
     */
    public static function normalizeTemplate(string $key, array $template): array
    {
        $definition = static::definitions()[$key] ?? [
            'title' => $key,
            'default_enabled' => false,
            'default_body' => '',
        ];

        $body = trim((string) ($template['body'] ?? $definition['default_body']));
        $enabled = (bool) ($template['enabled'] ?? $definition['default_enabled']);
        $hasApprovalMetadata = array_key_exists('approval_status', $template)
            || array_key_exists('approved_body', $template)
            || array_key_exists('approved_enabled', $template)
            || array_key_exists('submitted_at', $template)
            || array_key_exists('reviewed_at', $template);
        $isPristineDefaultTemplate = $body !== ''
            && $body === (string) $definition['default_body']
            && ! $hasApprovalMetadata;
        $approvalStatus = (string) ($template['approval_status'] ?? ($isPristineDefaultTemplate
            ? 'approved'
            : ($body !== '' ? 'pending_review' : 'draft')));
        $approvedBody = trim((string) ($template['approved_body'] ?? ($isPristineDefaultTemplate ? $body : '')));
        $approvedEnabled = (bool) ($template['approved_enabled'] ?? ($isPristineDefaultTemplate ? $enabled : false));

        return [
            'key' => $key,
            'title' => (string) $definition['title'],
            'enabled' => $enabled,
            'body' => $body,
            'approval_status' => in_array($approvalStatus, ['draft', 'pending_review', 'approved', 'rejected'], true) ? $approvalStatus : 'draft',
            'approved_body' => $approvedBody,
            'approved_enabled' => $approvedEnabled,
            'rejection_reason' => trim((string) ($template['rejection_reason'] ?? '')) ?: null,
            'submitted_at' => $template['submitted_at'] ?? ($isPristineDefaultTemplate ? now()->toISOString() : null),
            'reviewed_at' => $template['reviewed_at'] ?? ($isPristineDefaultTemplate ? now()->toISOString() : null),
        ];
    }
}
