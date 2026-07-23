<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionPackageAudiencePrice extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'subscription_package_id',
        'audience_type_id',
        'price_amount',
        'discounted_price_amount',
        'show_on_landing_home',
        'is_landing_recommended',
        'landing_sort_order',
    ];

    protected $casts = [
        'subscription_package_id' => 'integer',
        'audience_type_id' => 'integer',
        'price_amount' => 'integer',
        'discounted_price_amount' => 'integer',
        'show_on_landing_home' => 'boolean',
        'is_landing_recommended' => 'boolean',
        'landing_sort_order' => 'integer',
    ];

    public function subscriptionPackage(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPackage::class, 'subscription_package_id');
    }

    public function audienceType(): BelongsTo
    {
        return $this->belongsTo(AudienceType::class, 'audience_type_id');
    }
}
