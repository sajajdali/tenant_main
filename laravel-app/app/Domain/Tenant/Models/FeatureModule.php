<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FeatureModule extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'name',
        'slug',
        'description',
        'monthly_price_amount',
        'sort_order',
        'is_active',
        'metadata',
    ];

    protected $casts = [
        'monthly_price_amount' => 'integer',
        'sort_order' => 'integer',
        'is_active' => 'boolean',
        'metadata' => 'array',
    ];

    public function audiencePrices(): HasMany
    {
        return $this->hasMany(FeatureModuleAudiencePrice::class, 'feature_module_id');
    }

    public function tenantModules(): HasMany
    {
        return $this->hasMany(TenantFeatureModule::class, 'feature_module_id');
    }

    public function pricingFor(?int $audienceTypeId = null): array
    {
        $override = null;

        if ($audienceTypeId) {
            if ($this->relationLoaded('audiencePrices')) {
                $override = $this->audiencePrices->firstWhere('audience_type_id', $audienceTypeId);
            } else {
                $override = $this->audiencePrices()->where('audience_type_id', $audienceTypeId)->first();
            }
        }

        return [
            'monthlyPriceAmount' => (int) ($override?->monthly_price_amount ?? $this->monthly_price_amount ?? 0),
            'audienceOverrideApplied' => $override !== null,
            'audienceTypeId' => $override?->audience_type_id,
            'audienceName' => $override?->relationLoaded('audienceType')
                ? $override?->audienceType?->name
                : $override?->audienceType()->value('name'),
        ];
    }
}
