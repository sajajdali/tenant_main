<?php

declare(strict_types=1);

namespace App\Support;

final class TenantFeatureModuleRegistry
{
    public static function get(string $slug): ?array
    {
        $definition = config("tenant_modules.modules.{$slug}");

        return is_array($definition) ? [
            'slug' => $slug,
            'label' => (string) ($definition['label'] ?? $slug),
            'meta_key' => (string) ($definition['meta_key'] ?? str($slug)->camel()),
            'route_prefix' => (string) ($definition['route_prefix'] ?? $slug),
            'migration_path' => $definition['migration_path'] ?? null,
            'seeder' => $definition['seeder'] ?? null,
        ] : null;
    }

    public static function all(): array
    {
        return collect(config('tenant_modules.modules', []))
            ->map(fn (array $definition, string $slug): array => self::get($slug) ?? [])
            ->filter()
            ->values()
            ->all();
    }

    public static function slugs(): array
    {
        return array_keys(config('tenant_modules.modules', []));
    }
}
