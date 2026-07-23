<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use App\Domain\Landing\Models\AudienceCheckoutSetting;
use App\Domain\Landing\Models\LandingOrder;
use App\Domain\Landing\Models\LandingSite;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class AudienceType extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'name',
        'slug',
        'singular_label',
        'plural_label',
        'business_label',
        'enabled_features',
        'future_features',
        'nutrition_features',
        'specialized_course_settings',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'enabled_features' => 'array',
        'future_features' => 'array',
        'nutrition_features' => 'array',
        'specialized_course_settings' => 'array',
        'sort_order' => 'integer',
        'is_active' => 'boolean',
    ];

    public function tenants(): HasMany
    {
        return $this->hasMany(Tenant::class, 'audience_type_id');
    }

    public function subscriptionPackagePrices(): HasMany
    {
        return $this->hasMany(SubscriptionPackageAudiencePrice::class, 'audience_type_id');
    }

    public function featureModulePrices(): HasMany
    {
        return $this->hasMany(FeatureModuleAudiencePrice::class, 'audience_type_id');
    }

    public function landingSite(): HasOne
    {
        return $this->hasOne(LandingSite::class, 'audience_type_id');
    }

    public function checkoutSetting(): HasOne
    {
        return $this->hasOne(AudienceCheckoutSetting::class, 'audience_type_id');
    }

    public function landingOrders(): HasMany
    {
        return $this->hasMany(LandingOrder::class, 'audience_type_id');
    }
}
