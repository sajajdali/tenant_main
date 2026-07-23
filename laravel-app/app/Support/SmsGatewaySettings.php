<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\SystemSetting;

class SmsGatewaySettings
{
    public const SYSTEM_KEY = 'sms_gateway_settings';

    public static function defaults(): array
    {
        return [
            'kavenegar_api_key' => '',
            'sandbox_enabled' => false,
            'credit_alert_templates' => [
                'threshold_50000' => __('tenant.sms_gateway_defaults.credit_alert_templates.threshold_50000'),
                'threshold_10000' => __('tenant.sms_gateway_defaults.credit_alert_templates.threshold_10000'),
                'threshold_zero' => __('tenant.sms_gateway_defaults.credit_alert_templates.threshold_zero'),
            ],
            'support_reminder_templates' => [
                'day_5' => __('tenant.sms_gateway_defaults.support_reminder_templates.day_5'),
                'day_1' => __('tenant.sms_gateway_defaults.support_reminder_templates.day_1'),
                'day_0' => __('tenant.sms_gateway_defaults.support_reminder_templates.day_0'),
            ],
            'domain_reminder_templates' => [
                'day_30' => __('tenant.sms_gateway_defaults.domain_reminder_templates.day_30'),
                'day_15' => __('tenant.sms_gateway_defaults.domain_reminder_templates.day_15'),
                'day_1' => __('tenant.sms_gateway_defaults.domain_reminder_templates.day_1'),
            ],
            'nutrition_token_alert_templates' => [
                'low_5000' => __('tenant.sms_gateway_defaults.nutrition_token_alert_templates.low_5000'),
                'critical_500' => __('tenant.sms_gateway_defaults.nutrition_token_alert_templates.critical_500'),
            ],
            'notification_templates' => [
                'support_ticket_reply' => [
                    'title' => __('tenant.sms_gateway_defaults.notification_templates.support_ticket_reply.title'),
                    'message' => __('tenant.sms_gateway_defaults.notification_templates.support_ticket_reply.message'),
                ],
                'sms_template_approved' => [
                    'title' => __('tenant.sms_gateway_defaults.notification_templates.sms_template_approved.title'),
                    'message' => __('tenant.sms_gateway_defaults.notification_templates.sms_template_approved.message'),
                ],
                'sms_template_rejected' => [
                    'title' => __('tenant.sms_gateway_defaults.notification_templates.sms_template_rejected.title'),
                    'message' => __('tenant.sms_gateway_defaults.notification_templates.sms_template_rejected.message'),
                ],
                'sms_campaign_approved' => [
                    'title' => __('tenant.sms_gateway_defaults.notification_templates.sms_campaign_approved.title'),
                    'message' => __('tenant.sms_gateway_defaults.notification_templates.sms_campaign_approved.message'),
                ],
                'sms_campaign_rejected' => [
                    'title' => __('tenant.sms_gateway_defaults.notification_templates.sms_campaign_rejected.title'),
                    'message' => __('tenant.sms_gateway_defaults.notification_templates.sms_campaign_rejected.message'),
                ],
            ],
            'notification_sms_templates' => [
                'sms_template_rejected' => __('tenant.sms_gateway_defaults.notification_sms_templates.sms_template_rejected'),
                'sms_campaign_rejected' => __('tenant.sms_gateway_defaults.notification_sms_templates.sms_campaign_rejected'),
            ],
        ];
    }

    public static function get(): array
    {
        return static::normalize(SystemSetting::getValue(static::SYSTEM_KEY, static::defaults()));
    }

    public static function put(array $value): void
    {
        SystemSetting::putValue(static::SYSTEM_KEY, static::normalize($value));
    }

    public static function kavenegarApiKey(): string
    {
        return (string) (static::get()['kavenegar_api_key'] ?? '');
    }

    public static function sandboxEnabled(): bool
    {
        return (bool) (static::get()['sandbox_enabled'] ?? false);
    }

    /**
     * @return array<string, string>
     */
    public static function creditAlertTemplates(): array
    {
        return static::get()['credit_alert_templates'] ?? static::defaults()['credit_alert_templates'];
    }

    /**
     * @return array<string, string>
     */
    public static function supportReminderTemplates(): array
    {
        return static::get()['support_reminder_templates'] ?? static::defaults()['support_reminder_templates'];
    }

    /**
     * @return array<string, string>
     */
    public static function domainReminderTemplates(): array
    {
        return static::get()['domain_reminder_templates'] ?? static::defaults()['domain_reminder_templates'];
    }

    /**
     * @return array<string, array{title:string, message:string}>
     */
    public static function notificationTemplates(): array
    {
        return static::get()['notification_templates'] ?? static::defaults()['notification_templates'];
    }

    /**
     * @return array<string, string>
     */
    public static function notificationSmsTemplates(): array
    {
        return static::get()['notification_sms_templates'] ?? static::defaults()['notification_sms_templates'];
    }

    public static function normalize(array $value): array
    {
        $defaults = static::defaults();
        $creditAlertDefaults = $defaults['credit_alert_templates'];
        $supportReminderDefaults = $defaults['support_reminder_templates'];
        $domainReminderDefaults = $defaults['domain_reminder_templates'];
        $nutritionTokenAlertDefaults = $defaults['nutrition_token_alert_templates'];
        $notificationDefaults = $defaults['notification_templates'];
        $notificationSmsDefaults = $defaults['notification_sms_templates'];

        $creditAlertTemplates = [];

        foreach ($creditAlertDefaults as $key => $defaultBody) {
            $creditAlertTemplates[$key] = trim((string) ($value['credit_alert_templates'][$key] ?? $defaultBody));
        }

        $supportReminderTemplates = [];

        foreach ($supportReminderDefaults as $key => $defaultBody) {
            $supportReminderTemplates[$key] = trim((string) ($value['support_reminder_templates'][$key] ?? $defaultBody));
        }

        $domainReminderTemplates = [];

        foreach ($domainReminderDefaults as $key => $defaultBody) {
            $domainReminderTemplates[$key] = trim((string) ($value['domain_reminder_templates'][$key] ?? $defaultBody));
        }

        $nutritionTokenAlertTemplates = [];

        foreach ($nutritionTokenAlertDefaults as $key => $defaultBody) {
            $nutritionTokenAlertTemplates[$key] = trim((string) ($value['nutrition_token_alert_templates'][$key] ?? $defaultBody));
        }

        $notificationTemplates = [];

        foreach ($notificationDefaults as $key => $definition) {
            $notificationTemplates[$key] = [
                'title' => trim((string) ($value['notification_templates'][$key]['title'] ?? $definition['title'])),
                'message' => trim((string) ($value['notification_templates'][$key]['message'] ?? $definition['message'])),
            ];
        }

        $notificationSmsTemplates = [];

        foreach ($notificationSmsDefaults as $key => $defaultBody) {
            $notificationSmsTemplates[$key] = trim((string) ($value['notification_sms_templates'][$key] ?? $defaultBody));
        }

        return [
            'kavenegar_api_key' => trim((string) ($value['kavenegar_api_key'] ?? $defaults['kavenegar_api_key'])),
            'sandbox_enabled' => (bool) ($value['sandbox_enabled'] ?? $defaults['sandbox_enabled']),
            'credit_alert_templates' => $creditAlertTemplates,
            'support_reminder_templates' => $supportReminderTemplates,
            'domain_reminder_templates' => $domainReminderTemplates,
            'nutrition_token_alert_templates' => $nutritionTokenAlertTemplates,
            'notification_templates' => $notificationTemplates,
            'notification_sms_templates' => $notificationSmsTemplates,
        ];
    }

    /**
     * @return array<string, string>
     */
    public static function nutritionTokenAlertTemplates(): array
    {
        return static::get()['nutrition_token_alert_templates'] ?? static::defaults()['nutrition_token_alert_templates'];
    }
}
