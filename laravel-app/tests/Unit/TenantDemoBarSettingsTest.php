<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Domain\Tenant\Models\Tenant;
use Tests\TestCase;

class TenantDemoBarSettingsTest extends TestCase
{
    public function test_demo_bar_settings_are_read_from_tenant_data(): void
    {
        $tenant = new Tenant();
        $tenant->setAttribute('data', [
            'demo_bar' => [
                'enabled' => true,
                'landing_site_id' => 12,
                'target_path' => '/plans',
            ],
        ]);

        $this->assertSame([
            'enabled' => true,
            'landing_site_id' => 12,
            'target_path' => '/plans',
        ], $tenant->demoBarSettings());
    }

    public function test_demo_bar_settings_are_read_from_top_level_attribute(): void
    {
        $tenant = new Tenant();
        $tenant->setAttribute('demo_bar', [
            'enabled' => true,
            'landing_site_id' => 12,
        ]);

        $this->assertSame([
            'enabled' => true,
            'landing_site_id' => 12,
        ], $tenant->demoBarSettings());
    }

    public function test_demo_bar_settings_can_be_mass_assigned_by_tenant_management(): void
    {
        $tenant = new Tenant();
        $tenant->fill([
            'demo_bar' => [
                'enabled' => true,
                'landing_site_id' => 12,
            ],
        ]);

        $this->assertSame([
            'enabled' => true,
            'landing_site_id' => 12,
        ], $tenant->demoBarSettings());
    }
}
