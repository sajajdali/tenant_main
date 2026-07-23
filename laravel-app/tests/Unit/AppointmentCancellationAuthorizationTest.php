<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Domain\Booking\Models\Appointment;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Tenant\AppointmentController;
use Illuminate\Support\Carbon;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionMethod;

class AppointmentCancellationAuthorizationTest extends TestCase
{
    public function test_customer_id_collision_does_not_grant_cancellation_access(): void
    {
        $actor = $this->customer(26, '09121837408');
        $appointment = $this->appointment([
            'customer_id' => 26,
            'created_by_user_id' => 1,
            'customer_phone_snapshot' => '09121590183',
            'meta' => ['tenant_customer_user_id' => 34, 'is_for_someone_else' => true],
        ]);

        $this->assertFalse($this->canCancel($appointment, $actor));
    }

    public function test_booking_for_someone_else_belongs_to_booking_customer(): void
    {
        $actor = $this->customer(26, '09121837408');
        $appointment = $this->appointment([
            'customer_id' => 34,
            'created_by_user_id' => 26,
            'customer_phone_snapshot' => '09186089660',
            'booked_by_phone_snapshot' => '09121837408',
            'meta' => ['tenant_customer_user_id' => 40, 'is_for_someone_else' => true],
        ]);

        $this->assertTrue($this->canCancel($appointment, $actor));
        $this->assertFalse($this->canCancel($appointment, $this->customer(27, '09120000000')));
    }

    public function test_actual_appointment_customer_can_cancel_by_tenant_user_id_or_mobile(): void
    {
        $actor = $this->customer(26, '09121837408');
        $appointmentWithUserId = $this->appointment([
            'customer_phone_snapshot' => '09000000000',
            'meta' => ['tenant_customer_user_id' => 26],
        ]);
        $legacyAppointment = $this->appointment([
            'customer_phone_snapshot' => '09121837408',
            'meta' => [],
        ]);

        $this->assertTrue($this->canCancel($appointmentWithUserId, $actor));
        $this->assertTrue($this->canCancel($legacyAppointment, $actor));
    }

    public function test_customer_cancellation_locks_after_configured_cutoff(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-02 10:00:00'));

        $actor = $this->customer(26, '09121837408');
        $appointment = $this->appointment([
            'customer_phone_snapshot' => '09121837408',
            'status' => 'booked',
            'starts_at' => Carbon::parse('2026-07-02 11:30:00'),
            'meta' => ['tenant_customer_user_id' => 26],
        ]);

        $this->assertTrue($this->isCustomerCancellationLocked($appointment, $actor, 2));
        $this->assertFalse($this->isCustomerCancellationLocked($appointment, $actor, 1));

        Carbon::setTestNow();
    }

    public function test_staff_cancellation_is_not_limited_by_customer_cutoff(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-02 10:00:00'));

        $admin = (new TenantUser())->forceFill([
            'id' => 1,
            'mobile' => '09120000000',
            'role' => 'admin',
        ]);
        $appointment = $this->appointment([
            'customer_phone_snapshot' => '09121837408',
            'status' => 'booked',
            'starts_at' => Carbon::parse('2026-07-02 10:30:00'),
            'meta' => ['tenant_customer_user_id' => 26],
        ]);

        $this->assertFalse($this->isCustomerCancellationLocked($appointment, $admin, 2));

        Carbon::setTestNow();
    }

    public function test_day_list_keeps_booking_owner_data_for_booking_customer(): void
    {
        $actor = $this->customer(26, '09121837408');
        $item = [
            'id' => '55',
            'userId' => '26',
            'userPhone' => '09121590183',
            'userName' => 'مهدی شریف',
            'bookedByUserId' => '26',
            'bookedByPhone' => '09121837408',
            'bookedByName' => 'علی زهره‌وندی',
            'bookedByRole' => 'customer',
            'barberId' => '1',
            'notes' => 'private',
            'publicCode' => 'AB12',
            'publicUrl' => '/appointments/AB12',
            'isForSomeoneElse' => true,
        ];

        $sanitized = $this->invokeControllerMethod('sanitizeDayListItem', [$item, $actor, null]);

        $this->assertSame('26', $sanitized['bookedByUserId']);
        $this->assertSame('09121837408', $sanitized['bookedByPhone']);
        $this->assertSame('09121590183', $sanitized['userPhone']);
        $this->assertTrue($sanitized['isForSomeoneElse']);

        $hidden = $this->invokeControllerMethod('sanitizeDayListItem', [$item, $this->customer(27, '09120000000'), null]);

        $this->assertSame('', $hidden['userId']);
        $this->assertSame('', $hidden['userPhone']);
        $this->assertSame('', $hidden['userName']);
        $this->assertNull($hidden['bookedByUserId']);
        $this->assertNull($hidden['bookedByPhone']);
        $this->assertNull($hidden['notes']);
        $this->assertNull($hidden['publicCode']);
        $this->assertFalse($hidden['isForSomeoneElse']);
    }

    private function customer(int $id, string $mobile): TenantUser
    {
        return (new TenantUser())->forceFill([
            'id' => $id,
            'mobile' => $mobile,
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
            'professional_id' => 1,
            'customer_phone_snapshot' => '09000000000',
            'meta' => json_encode([]),
        ], $attributes), true);

        return $appointment;
    }

    private function canCancel(Appointment $appointment, TenantUser $actor): bool
    {
        return (bool) $this->invokeControllerMethod('canActorCancel', [$appointment, $actor]);
    }

    private function isCustomerCancellationLocked(Appointment $appointment, TenantUser $actor, int $cutoffHours): bool
    {
        $controller = (new ReflectionClass(AppointmentController::class))->newInstanceWithoutConstructor();
        $property = new \ReflectionProperty(AppointmentController::class, 'customerCancellationCutoffHoursCache');
        $property->setValue($controller, $cutoffHours);

        $method = new ReflectionMethod(AppointmentController::class, 'isCustomerCancellationLocked');

        return (bool) $method->invokeArgs($controller, [$appointment, $actor]);
    }

    private function invokeControllerMethod(string $name, array $arguments): mixed
    {
        $controller = (new ReflectionClass(AppointmentController::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(AppointmentController::class, $name);

        return $method->invokeArgs($controller, $arguments);
    }
}
