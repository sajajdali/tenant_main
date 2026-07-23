<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\SmsGatewaySettings;
use App\Support\SmsPricing;
use App\Support\SmsSenderRegistry;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SmsSettingsController extends Controller
{
    public function edit(): View
    {
        return view('admin.sms-settings.edit', [
            'smsGatewaySettings' => SmsGatewaySettings::get(),
            'smsPricingSettings' => SmsPricing::get(),
            'smsSenderSettings' => SmsSenderRegistry::get(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'kavenegar_api_key' => ['nullable', 'string', 'max:255'],
            'sandbox_enabled' => ['nullable', 'boolean'],
            'persian_price' => ['nullable', 'integer', 'min:0'],
            'english_price' => ['nullable', 'integer', 'min:0'],
            'credit_alert_templates' => ['nullable', 'array'],
            'credit_alert_templates.threshold_50000' => ['nullable', 'string', 'max:2000'],
            'credit_alert_templates.threshold_10000' => ['nullable', 'string', 'max:2000'],
            'credit_alert_templates.threshold_zero' => ['nullable', 'string', 'max:2000'],
            'support_reminder_templates' => ['nullable', 'array'],
            'support_reminder_templates.day_5' => ['nullable', 'string', 'max:2000'],
            'support_reminder_templates.day_1' => ['nullable', 'string', 'max:2000'],
            'support_reminder_templates.day_0' => ['nullable', 'string', 'max:2000'],
            'domain_reminder_templates' => ['nullable', 'array'],
            'domain_reminder_templates.day_30' => ['nullable', 'string', 'max:2000'],
            'domain_reminder_templates.day_15' => ['nullable', 'string', 'max:2000'],
            'domain_reminder_templates.day_1' => ['nullable', 'string', 'max:2000'],
            'nutrition_token_alert_templates' => ['nullable', 'array'],
            'nutrition_token_alert_templates.low_5000' => ['nullable', 'string', 'max:2000'],
            'nutrition_token_alert_templates.critical_500' => ['nullable', 'string', 'max:2000'],
            'notification_templates' => ['nullable', 'array'],
            'notification_templates.support_ticket_reply.title' => ['nullable', 'string', 'max:255'],
            'notification_templates.support_ticket_reply.message' => ['nullable', 'string', 'max:2000'],
            'notification_templates.sms_template_approved.title' => ['nullable', 'string', 'max:255'],
            'notification_templates.sms_template_approved.message' => ['nullable', 'string', 'max:2000'],
            'notification_templates.sms_template_rejected.title' => ['nullable', 'string', 'max:255'],
            'notification_templates.sms_template_rejected.message' => ['nullable', 'string', 'max:2000'],
            'notification_templates.sms_campaign_approved.title' => ['nullable', 'string', 'max:255'],
            'notification_templates.sms_campaign_approved.message' => ['nullable', 'string', 'max:2000'],
            'notification_templates.sms_campaign_rejected.title' => ['nullable', 'string', 'max:255'],
            'notification_templates.sms_campaign_rejected.message' => ['nullable', 'string', 'max:2000'],
            'notification_sms_templates' => ['nullable', 'array'],
            'notification_sms_templates.sms_template_rejected' => ['nullable', 'string', 'max:2000'],
            'notification_sms_templates.sms_campaign_rejected' => ['nullable', 'string', 'max:2000'],
            'default_sender' => ['nullable', 'string', 'max:50'],
            'senders' => ['nullable', 'array'],
            'senders.*.number' => ['nullable', 'string', 'max:50'],
            'senders.*.label' => ['nullable', 'string', 'max:255'],
        ]);

        SmsGatewaySettings::put([
            'kavenegar_api_key' => $validated['kavenegar_api_key'] ?? '',
            'sandbox_enabled' => (bool) ($validated['sandbox_enabled'] ?? false),
            'credit_alert_templates' => $validated['credit_alert_templates'] ?? [],
            'support_reminder_templates' => $validated['support_reminder_templates'] ?? [],
            'domain_reminder_templates' => $validated['domain_reminder_templates'] ?? [],
            'nutrition_token_alert_templates' => $validated['nutrition_token_alert_templates'] ?? [],
            'notification_templates' => $validated['notification_templates'] ?? [],
            'notification_sms_templates' => $validated['notification_sms_templates'] ?? [],
        ]);

        SmsPricing::put([
            'persian_price' => (int) ($validated['persian_price'] ?? 0),
            'english_price' => (int) ($validated['english_price'] ?? 0),
        ]);

        SmsSenderRegistry::put([
            'default_sender' => $validated['default_sender'] ?? null,
            'senders' => $validated['senders'] ?? [],
        ]);

        return redirect()
            ->route('admin.sms-settings.edit')
            ->with('success', 'تنظیمات پیامک ذخیره شد.');
    }
}
