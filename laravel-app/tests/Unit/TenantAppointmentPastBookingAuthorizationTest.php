<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Domain\Booking\Models\Barber;
use App\Domain\Tenant\Models\TenantUser;
use App\Services\TenantAppointmentBookingService;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use ReflectionClass;
use ReflectionMethod;
use Tests\TestCase;

class TenantAppointmentPastBookingAuthorizationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->app->setLocale('fa');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_admin_can_register_a_past_appointment(): void
    {
        Carbon::setTestNow('2026-07-02 12:00:00');

        $this->invokeGuard($this->actor('admin'), Carbon::parse('2026-07-01 10:00:00'));

        $this->assertTrue(true);
    }

    public function test_barber_cannot_register_a_past_appointment(): void
    {
        Carbon::setTestNow('2026-07-02 12:00:00');

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage(__('tenant.booking.past_admin_only'));

        $this->invokeGuard($this->actor('barber'), Carbon::parse('2026-07-01 10:00:00'));
    }

    public function test_customer_cannot_register_a_past_appointment(): void
    {
        Carbon::setTestNow('2026-07-02 12:00:00');

        $this->expectException(ValidationException::class);

        $this->invokeGuard($this->actor('customer'), Carbon::parse('2026-07-01 10:00:00'));
    }

    public function test_customer_booking_horizon_blocks_only_customers(): void
    {
        Carbon::setTestNow('2026-07-02 12:00:00');

        $barber = $this->barber([
            'booking_horizon_mode' => 'days',
            'booking_max_days' => 3,
        ]);

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage(__('tenant.booking.outside_booking_horizon'));

        $this->invokeHorizonGuard($this->actor('customer'), $barber, '2026-07-06');
    }

    public function test_staff_booking_horizon_is_not_limited(): void
    {
        Carbon::setTestNow('2026-07-02 12:00:00');

        $barber = $this->barber([
            'booking_horizon_mode' => 'date',
            'booking_max_date' => '2026-07-05',
        ]);

        $this->invokeHorizonGuard($this->actor('admin'), $barber, '2026-08-01');
        $this->invokeHorizonGuard($this->actor('barber'), $barber, '2026-08-01');

        $this->assertTrue(true);
    }

    private function actor(string $role): TenantUser
    {
        return (new TenantUser())->forceFill([
            'id' => 1,
            'mobile' => '09120000000',
            'name' => 'کاربر تست',
            'role' => $role,
        ]);
    }

    private function invokeGuard(TenantUser $actor, Carbon $startsAt): void
    {
        $service = (new ReflectionClass(TenantAppointmentBookingService::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(TenantAppointmentBookingService::class, 'ensurePastBookingActorAllowed');
        $method->invoke($service, $actor, $startsAt);
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    private function barber(array $settings): Barber
    {
        return (new Barber())->forceFill([
            'id' => 1,
            'name' => 'آرایشگر تست',
            'settings' => $settings,
        ]);
    }

    private function invokeHorizonGuard(TenantUser $actor, Barber $barber, string $date): void
    {
        $service = (new ReflectionClass(TenantAppointmentBookingService::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(TenantAppointmentBookingService::class, 'ensureCustomerBookingHorizonAllowed');
        $method->invoke($service, $actor, $barber, $date);
    }
}
