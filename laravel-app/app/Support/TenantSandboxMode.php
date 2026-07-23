<?php

declare(strict_types=1);

namespace App\Support;

use App\Domain\Tenant\Models\Tenant;

class TenantSandboxMode
{
    public static function paymentEnabled(?Tenant $tenant = null, bool $fallback = false): bool
    {
        $resolvedTenant = static::resolveTenant($tenant);

        return $resolvedTenant?->paymentSandboxOverride() ?? $fallback;
    }

    public static function smsEnabled(?Tenant $tenant = null, bool $fallback = false): bool
    {
        $resolvedTenant = static::resolveTenant($tenant);

        return $resolvedTenant?->smsSandboxOverride() ?? $fallback;
    }

    public static function resolveTenant(?Tenant $tenant = null): ?Tenant
    {
        if ($tenant instanceof Tenant) {
            return $tenant;
        }

        if (! function_exists('tenant')) {
            return null;
        }

        $current = tenant();

        return $current instanceof Tenant ? $current : null;
    }
}
