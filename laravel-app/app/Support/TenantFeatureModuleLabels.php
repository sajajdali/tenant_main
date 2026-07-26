<?php

declare(strict_types=1);

namespace App\Support;

use App\Domain\Tenant\Models\FeatureModule;

class TenantFeatureModuleLabels
{
    private const KNOWN_SLUGS = [
        'online-store',
        'vip-customers',
        'customer-club',
        'customer-feedback',
        'online-chat',
        'cooking-recipes',
    ];

    public static function for(FeatureModule $module): array
    {
        if (app()->isLocale('fa')) {
            return [
                'name' => trim((string) $module->name),
                'description' => trim((string) $module->description),
                'ctaNote' => trim((string) ($module->metadata['cta_note'] ?? __('tenant.feature_modules.default_cta'))),
            ];
        }

        $slug = in_array((string) $module->slug, self::KNOWN_SLUGS, true)
            ? (string) $module->slug
            : 'default';
        $prefix = "tenant.feature_modules.catalog.{$slug}";

        return [
            'name' => __("$prefix.name"),
            'description' => __("$prefix.description"),
            'ctaNote' => __("$prefix.cta_note"),
        ];
    }
}
