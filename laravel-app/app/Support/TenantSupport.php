<?php

declare(strict_types=1);

namespace App\Support;

use App\Domain\Tenant\Models\Tenant;
use Illuminate\Support\Carbon;

class TenantSupport
{
    public static function summary(?Tenant $tenant = null): array
    {
        /** @var Tenant|null $tenant */
        $tenant ??= tenant();

        $configuredEndsAt = $tenant?->support_ends_at?->toDateString()
            ?? ($tenant?->data['support_ends_at'] ?? null);
        $endsAt = $configuredEndsAt
            ? Carbon::parse($configuredEndsAt)->endOfDay()
            : (
                $tenant?->subscriptionPackage?->duration_days
                    ? $tenant?->created_at?->copy()->addDays((int) $tenant->subscriptionPackage->duration_days)->endOfDay()
                    : $tenant?->created_at?->copy()->addDays(30)->endOfDay()
            );

        if (! $endsAt) {
            return [
                'supportEndsAt' => null,
                'supportExpired' => false,
                'supportDaysRemaining' => null,
            ];
        }

        $now = now();
        $daysRemaining = $now->greaterThan($endsAt)
            ? 0
            : $now->startOfDay()->diffInDays($endsAt->copy()->startOfDay()) + 1;

        return [
            'supportEndsAt' => $endsAt->toDateString(),
            'supportExpired' => $now->greaterThan($endsAt),
            'supportDaysRemaining' => $daysRemaining,
        ];
    }
}
