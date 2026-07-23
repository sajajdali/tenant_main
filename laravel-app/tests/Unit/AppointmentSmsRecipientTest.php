<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Domain\Booking\Models\Appointment;
use App\Domain\Tenant\Models\TenantUser;
use App\Services\AppointmentSmsService;
use Illuminate\Support\Carbon;
use ReflectionClass;
use ReflectionMethod;
use Tests\TestCase;

class AppointmentSmsRecipientTest extends TestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_customer_booking_for_someone_else_sends_sms_to_booking_customer(): void
    {
        $actor = $this->customer(26, '09121837408', 'سجاد');
        $appointment = $this->appointment([
            'customer_name_snapshot' => 'علی',
            'customer_phone_snapshot' => '09121590183',
            'booked_by_name_snapshot' => 'سجاد',
            'booked_by_phone_snapshot' => '09121837408',
            'created_by_user_id' => 26,
            'meta' => ['is_for_someone_else' => true],
        ]);

        $recipient = $this->invokeSmsMethod('smsRecipient', [$appointment, $actor]);
        $message = $this->invokeSmsMethod('renderTemplate', [
            "سلام {{customer_name}} عزیز\nنوبت شما ثبت شد.",
            $appointment,
            $recipient,
        ]);

        $this->assertSame('09121837408', $recipient['mobile']);
        $this->assertSame('سجاد', $recipient['name']);
        $this->assertStringStartsWith("نوبت برای علی\nسلام سجاد عزیز", $message);
    }

    public function test_staff_booking_for_someone_else_still_sends_sms_to_target_customer(): void
    {
        $actor = (new TenantUser())->forceFill([
            'id' => 1,
            'mobile' => '09120000000',
            'name' => 'مدیر',
            'role' => 'admin',
        ]);
        $appointment = $this->appointment([
            'customer_name_snapshot' => 'علی',
            'customer_phone_snapshot' => '09121590183',
            'booked_by_name_snapshot' => 'مدیر',
            'booked_by_phone_snapshot' => '09120000000',
            'created_by_user_id' => 1,
            'meta' => ['is_for_someone_else' => true],
        ]);

        $recipient = $this->invokeSmsMethod('smsRecipient', [$appointment, $actor]);
        $message = $this->invokeSmsMethod('renderTemplate', [
            "سلام {{customer_name}} عزیز\nنوبت شما ثبت شد.",
            $appointment,
            $recipient,
        ]);

        $this->assertSame('09121590183', $recipient['mobile']);
        $this->assertSame('علی', $recipient['name']);
        $this->assertSame("سلام علی عزیز\nنوبت شما ثبت شد.", $message);
    }

    public function test_past_appointment_blocks_booking_and_reminder_sms_before_dispatch(): void
    {
        Carbon::setTestNow('2026-07-02 12:00:00');

        $actor = (new TenantUser())->forceFill([
            'id' => 1,
            'mobile' => '09120000000',
            'name' => 'مدیر',
            'role' => 'admin',
        ]);
        $appointment = $this->appointment([
            'appointment_date' => '2026-07-01',
            'start_time' => '10:00:00',
            'starts_at' => '2026-07-01 10:00:00',
            'meta' => ['send_sms' => true, 'suppress_reminders' => true],
        ]);
        $service = (new ReflectionClass(AppointmentSmsService::class))->newInstanceWithoutConstructor();

        $service->sendBookingConfirmation($appointment, $actor);

        $this->assertNull($service->sendReminderNow($appointment, 'reminder'));
    }

    private function customer(int $id, string $mobile, string $name): TenantUser
    {
        return (new TenantUser())->forceFill([
            'id' => $id,
            'mobile' => $mobile,
            'name' => $name,
            'role' => 'customer',
        ]);
    }

    private function appointment(array $attributes): Appointment
    {
        if (array_key_exists('meta', $attributes) && is_array($attributes['meta'])) {
            $attributes['meta'] = json_encode($attributes['meta']);
        }

        $appointment = new Appointment();
        $appointment->setRawAttributes(array_merge([
            'customer_name_snapshot' => 'مشتری',
            'customer_phone_snapshot' => '09000000000',
            'service_name_snapshot' => 'خدمت',
            'professional_name_snapshot' => 'آرایشگر',
            'appointment_date' => '2026-07-02',
            'start_time' => '10:00:00',
            'meta' => json_encode([]),
        ], $attributes), true);

        return $appointment;
    }

    private function invokeSmsMethod(string $name, array $arguments): mixed
    {
        $service = (new ReflectionClass(AppointmentSmsService::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(AppointmentSmsService::class, $name);

        return $method->invokeArgs($service, $arguments);
    }
}
