<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Domain\Tenant\Models\Tenant;
use Tests\TestCase;

class TenantMaliartOverrideTest extends TestCase
{
    public function test_maliart_override_can_be_mass_assigned_by_tenant_management(): void
    {
        $tenant = new Tenant();
        $tenant->fill([
            'payment_overrides' => ['maliart_enabled' => true],
        ]);

        $this->assertSame(
            ['maliart_enabled' => true],
            $tenant->getAttribute('payment_overrides'),
        );
        $this->assertTrue($tenant->usesCentralMaliartGateway());
    }

    public function test_maliart_override_is_scoped_to_each_tenant(): void
    {
        $maliartTenant = new Tenant();
        $maliartTenant->setAttribute('payment_overrides', ['maliart_enabled' => true]);

        $regularTenant = new Tenant();
        $regularTenant->setAttribute('payment_overrides', ['maliart_enabled' => false]);

        $this->assertTrue($maliartTenant->usesCentralMaliartGateway());
        $this->assertFalse($regularTenant->usesCentralMaliartGateway());
    }
}
