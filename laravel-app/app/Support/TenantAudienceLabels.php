<?php

declare(strict_types=1);

namespace App\Support;

use App\Domain\Tenant\Models\AudienceType;

class TenantAudienceLabels
{
    private const KNOWN_SLUGS = [
        'barbers',
        'doctors',
        'lawyers',
        'consultants',
        'experts',
        'nutritionists',
        'nutrition-doctors',
    ];

    public static function for(?AudienceType $audience): array
    {
        $slug = trim((string) $audience?->slug);
        $translationSlug = in_array($slug, self::KNOWN_SLUGS, true) ? $slug : 'default';

        if (app()->isLocale('fa') && $audience !== null) {
            return [
                'name' => trim((string) $audience->name),
                'singular' => trim((string) $audience->singular_label),
                'plural' => trim((string) $audience->plural_label),
                'business' => trim((string) $audience->business_label),
            ];
        }

        $prefix = "tenant.audience_labels.{$translationSlug}";

        return [
            'name' => __("$prefix.plural"),
            'singular' => __("$prefix.singular"),
            'plural' => __("$prefix.plural"),
            'business' => __("$prefix.business"),
        ];
    }
}
