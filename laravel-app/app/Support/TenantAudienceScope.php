<?php

declare(strict_types=1);

namespace App\Support;

use App\Domain\Tenant\Models\Tenant;

class TenantAudienceScope
{
    /**
     * @param  array<int, string>  $scopes
     */
    public static function currentTenantMatches(array $scopes): bool
    {
        $tenantId = tenant('id');

        if (! $tenantId || $scopes === []) {
            return false;
        }

        /** @var Tenant|null $tenant */
        $tenant = Tenant::query()
            ->with('audienceType:id,slug')
            ->find($tenantId);

        return in_array($tenant?->audienceType?->slug, $scopes, true);
    }

    public static function currentTenantUsesNutrition(): bool
    {
        $configuredScopes = config('audience-features.nutrition.migration_scopes');

        if (is_array($configuredScopes) && $configuredScopes !== []) {
            /** @var array<int, string> $scopes */
            $scopes = array_values(array_unique(array_filter($configuredScopes, 'is_string')));

            return self::currentTenantMatches($scopes);
        }

        $featureScopes = collect(config('audience-features.nutrition', []))
            ->filter(fn (mixed $feature, string|int $key): bool => $key !== 'migration_scopes' && is_array($feature))
            ->flatMap(function (mixed $feature): array {
                if (! is_array($feature)) {
                    return [];
                }

                $scopes = $feature['scopes'] ?? [];

                return is_array($scopes)
                    ? array_values(array_filter($scopes, 'is_string'))
                    : [];
            })
            ->unique()
            ->values()
            ->all();

        return self::currentTenantMatches($featureScopes);
    }
}
