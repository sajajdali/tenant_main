<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Booking\Models\Appointment;
use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\SmsOutbound;
use App\Domain\Tenant\Models\SmsSetting;
use App\Domain\Tenant\Models\TenantUser;
use App\Services\Sms\SmsDispatchService;
use App\Support\AppointmentPublicLink;
use App\Support\JalaliDate;
use App\Support\SmsTemplateRegistry;
use Illuminate\Support\Carbon;

class AppointmentSmsService
{
    public function __construct(
        private readonly SmsDispatchService $dispatch,
    ) {}

    public function sendBookingConfirmation(Appointment $appointment, TenantUser $actor): void
    {
        if ($this->isPastAppointment($appointment)) {
            return;
        }

        $smsSetting = SmsSetting::query()->first();

        if (! $smsSetting) {
            return;
        }

        $isStaffBooking = in_array($actor->role, ['admin', 'barber'], true);
        $shouldSend = ! $isStaffBooking || (bool) ($appointment->meta['send_sms'] ?? false);

        if (! $shouldSend) {
            return;
        }

        $templateKey = $isStaffBooking ? 'adminBooking' : 'userBooking';
        $templates = is_array($smsSetting->templates['v2'] ?? null) ? $smsSetting->templates['v2'] : [];
        $template = SmsTemplateRegistry::approvedTemplate($templates, $templateKey);

        if (! $template || ! (bool) ($template['enabled'] ?? false)) {
            return;
        }

        $recipient = $this->smsRecipient($appointment, $actor);
        $message = $this->renderTemplate((string) ($template['body'] ?? ''), $appointment, $recipient);

        if (trim($message) === '') {
            return;
        }

        $this->dispatch->dispatchQueued($smsSetting, [
            'type' => 'booking',
            'template_key' => $templateKey,
            'recipient_mobile' => $recipient['mobile'],
            'recipient_name' => $recipient['name'],
            'message' => $message,
        ]);
    }

    public function sendCancellation(Appointment $appointment): void
    {
        $smsSetting = SmsSetting::query()->first();

        if (! $smsSetting || ! $this->isSmsAvailable($smsSetting)) {
            return;
        }

        $templates = is_array($smsSetting->templates['v2'] ?? null) ? $smsSetting->templates['v2'] : [];
        $template = SmsTemplateRegistry::approvedTemplate($templates, 'cancellation');

        if (! $template || ! (bool) ($template['enabled'] ?? false)) {
            return;
        }

        $recipient = $this->smsRecipient($appointment);
        $message = $this->renderTemplate((string) ($template['body'] ?? ''), $appointment, $recipient);

        if (trim($message) === '') {
            return;
        }

        $this->dispatch->dispatchQueued($smsSetting, [
            'type' => 'booking',
            'template_key' => 'cancellation',
            'recipient_mobile' => $recipient['mobile'],
            'recipient_name' => $recipient['name'],
            'message' => $message,
        ]);
    }

    public function sendAppointmentChange(Appointment $appointment): void
    {
        $smsSetting = SmsSetting::query()->first();

        if (! $smsSetting || ! $this->isSmsAvailable($smsSetting)) {
            return;
        }

        $templates = is_array($smsSetting->templates['v2'] ?? null) ? $smsSetting->templates['v2'] : [];
        $template = SmsTemplateRegistry::approvedTemplate($templates, 'appointmentChange');

        if (! $template || ! (bool) ($template['enabled'] ?? false)) {
            return;
        }

        $recipient = $this->smsRecipient($appointment);
        $message = $this->renderTemplate((string) ($template['body'] ?? ''), $appointment, $recipient);

        if (trim($message) === '') {
            return;
        }

        $this->dispatch->dispatchQueued($smsSetting, [
            'type' => 'booking',
            'template_key' => 'appointmentChange',
            'recipient_mobile' => $recipient['mobile'],
            'recipient_name' => $recipient['name'],
            'message' => $message,
        ]);
    }

    public function sendReminderNow(Appointment $appointment, string $templateKey): ?SmsOutbound
    {
        if ($this->isPastAppointment($appointment) || (bool) ($appointment->meta['suppress_reminders'] ?? false)) {
            return null;
        }

        $smsSetting = SmsSetting::query()->first();

        if (! $this->isReminderEnabled($templateKey, $smsSetting)) {
            return null;
        }

        $templates = is_array($smsSetting->templates['v2'] ?? null) ? $smsSetting->templates['v2'] : [];
        $template = SmsTemplateRegistry::approvedTemplate($templates, $templateKey);
        $recipient = $this->smsRecipient($appointment);
        $message = $this->renderTemplate((string) ($template['body'] ?? ''), $appointment, $recipient);

        if (trim($message) === '') {
            return null;
        }

        $result = $this->dispatch->dispatchNow($smsSetting, [
            'type' => $templateKey === 'reminderThreeHours'
                ? 'appointment_reminder_3h'
                : 'appointment_reminder_24h',
            'template_key' => $templateKey,
            'recipient_mobile' => $recipient['mobile'],
            'recipient_name' => $recipient['name'],
            'message' => $message,
        ]);

        $outbound = $result['outbound'] ?? null;

        return $outbound instanceof SmsOutbound ? $outbound : null;
    }

    public function isReminderEnabled(string $templateKey, ?SmsSetting $smsSetting = null): bool
    {
        $smsSetting ??= SmsSetting::query()->first();

        if (! $smsSetting || ! $this->isSmsAvailable($smsSetting)) {
            return false;
        }

        $templates = is_array($smsSetting->templates['v2'] ?? null) ? $smsSetting->templates['v2'] : [];
        $normalizedTemplate = SmsTemplateRegistry::normalizeCollection($templates)[$templateKey] ?? null;

        // The tenant's current switch is an immediate operational kill switch.
        // Body edits still use the approved body until central review finishes.
        if (! $normalizedTemplate || ! (bool) ($normalizedTemplate['enabled'] ?? false)) {
            return false;
        }

        $template = SmsTemplateRegistry::approvedTemplate($templates, $templateKey);

        return $template !== null && (bool) ($template['enabled'] ?? false);
    }

    private function isSmsAvailable(SmsSetting $setting): bool
    {
        return (bool) $setting->enabled && trim((string) $setting->provider) !== '';
    }

    private function isPastAppointment(Appointment $appointment): bool
    {
        if ($appointment->starts_at) {
            return Carbon::parse($appointment->starts_at)->lte(now());
        }

        $date = $appointment->appointment_date?->toDateString()
            ?? (string) $appointment->getRawOriginal('appointment_date');
        $time = substr((string) $appointment->start_time, 0, 5);

        if ($date === '' || $time === '') {
            return false;
        }

        return Carbon::createFromFormat('Y-m-d H:i', "{$date} {$time}")->lte(now());
    }

    /**
     * @param  array{mobile:string,name:string,is_booking_owner_for_someone_else:bool,target_name:string}  $recipient
     */
    private function renderTemplate(string $body, Appointment $appointment, array $recipient): string
    {
        $appointmentDate = JalaliDate::format(
            $appointment->appointment_date?->toDateString() ?? (string) $appointment->getRawOriginal('appointment_date')
        );
        $appointmentTime = substr((string) $appointment->start_time, 0, 5);
        $targetName = (string) $appointment->customer_name_snapshot;
        $recipientName = $recipient['name'] !== '' ? $recipient['name'] : $targetName;

        $replacements = [
            '{{customer_name}}' => $recipientName,
            '{{appointment_customer_name}}' => $targetName,
            '{{booked_for_name}}' => $targetName,
            '{{recipient_name}}' => $recipientName,
            '{{service_name}}' => (string) ($appointment->service_name_snapshot ?: 'نوبت شما'),
            '{{appointment_date}}' => $appointmentDate,
            '{{appointment_time}}' => $appointmentTime,
            '{{professional_name}}' => (string) ($appointment->professional_name_snapshot ?: $appointment->barber?->name),
        ];

        if (str_contains($body, '{{appointment_url}}')) {
            $replacements['{{appointment_url}}'] = AppointmentPublicLink::publicUrl($appointment);
        }

        if (str_contains($body, '{{business_name}}')) {
            $replacements['{{business_name}}'] = $this->businessName();
        }

        if (str_contains($body, '{{business_phone}}')) {
            $replacements['{{business_phone}}'] = $this->businessPhone();
        }

        $message = strtr($body, $replacements);

        if ($recipient['is_booking_owner_for_someone_else'] && $targetName !== '') {
            $message = "نوبت برای {$targetName}\n".$message;
        }

        return $message;
    }

    /**
     * @return array{mobile:string,name:string,is_booking_owner_for_someone_else:bool,target_name:string}
     */
    private function smsRecipient(Appointment $appointment, ?TenantUser $actor = null): array
    {
        $creator = $actor;

        if (! $creator && $appointment->created_by_user_id) {
            $creator = $appointment->relationLoaded('creator')
                ? $appointment->creator
                : $appointment->creator()->first();
        }

        $targetName = trim((string) $appointment->customer_name_snapshot);
        $targetMobile = trim((string) $appointment->customer_phone_snapshot);
        $bookedByName = trim((string) ($appointment->booked_by_name_snapshot ?: $creator?->name ?: ''));
        $bookedByMobile = trim((string) ($appointment->booked_by_phone_snapshot ?: $creator?->mobile ?: ''));
        $isForSomeoneElse = (bool) ($appointment->meta['is_for_someone_else'] ?? false);
        $isCustomerBookingForSomeoneElse =
            $isForSomeoneElse &&
            $creator?->role === 'customer' &&
            $bookedByMobile !== '';

        if ($isCustomerBookingForSomeoneElse) {
            return [
                'mobile' => $bookedByMobile,
                'name' => $bookedByName !== '' ? $bookedByName : 'کاربر سایت',
                'is_booking_owner_for_someone_else' => true,
                'target_name' => $targetName,
            ];
        }

        return [
            'mobile' => $targetMobile,
            'name' => $targetName,
            'is_booking_owner_for_someone_else' => false,
            'target_name' => $targetName,
        ];
    }

    private function businessName(): string
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $appearance = is_array($rules['appearance'] ?? null) ? $rules['appearance'] : [];
        $storeName = trim((string) ($appearance['store_name'] ?? ''));

        return $storeName !== '' ? $storeName : (string) (tenant()?->name ?? 'مجموعه');
    }

    private function businessPhone(): string
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $contact = is_array($rules['contact_page'] ?? null) ? $rules['contact_page'] : [];
        $phones = $contact['phones'] ?? [];

        if (! is_array($phones)) {
            return '';
        }

        foreach ($phones as $phone) {
            $number = trim((string) ($phone['number'] ?? ''));

            if ($number !== '') {
                return $number;
            }
        }

        return '';
    }
}
