<?php

declare(strict_types=1);

namespace App\Support;

use App\Domain\Tenant\Models\Tenant;

class TenantIrDomain
{
    public static function summary(?Tenant $tenant = null): array
    {
        return TenantManagedDomain::summary($tenant);
    }
}
