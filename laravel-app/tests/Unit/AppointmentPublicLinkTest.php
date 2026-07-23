<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Domain\Booking\Models\Appointment;
use App\Domain\Tenant\Models\Tenant;
use App\Support\AppointmentPublicLink;
use Mockery;
use Stancl\Tenancy\Contracts\Tenant as TenantContract;
use Tests\TestCase;

class AppointmentPublicLinkTest extends TestCase
{
    protected function tearDown(): void
    {
        app()->forgetInstance(TenantContract::class);
        Mockery::close();

        parent::tearDown();
    }

    public function test_it_prefers_the_active_tenant_domain_over_the_queue_localhost_request(): void
    {
        $domains = Mockery::mock();
        $domains->shouldReceive('value')->once()->with('domain')->andReturn('2bstyle.ir');

        $tenant = Mockery::mock(Tenant::class)->makePartial();
        $tenant->shouldReceive('domains')->once()->andReturn($domains);
        app()->instance(TenantContract::class, $tenant);

        $appointment = new Appointment;
        $appointment->forceFill(['public_code' => '2F6J']);

        $this->assertSame(
            'https://2bstyle.ir/s/2F6J',
            AppointmentPublicLink::publicUrl($appointment),
        );
    }
}
