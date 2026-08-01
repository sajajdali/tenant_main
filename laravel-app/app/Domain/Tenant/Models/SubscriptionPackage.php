<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use App\Domain\Landing\Models\LandingOrder;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SubscriptionPackage extends Model
{
    public const CUSTOMER_MIN_DURATION_DAYS = 30;
    public const CUSTOMER_MAX_RENEWAL_DURATION_DAYS = 365;

    protected $connection = 'central';

    protected $fillable = [
        'name',
        'slug',
        'duration_days',
        'user_limit',
        'price_amount',
        'discounted_price_amount',
        'sms_credit_gift_amount',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'duration_days' => 'integer',
        'user_limit' => 'integer',
        'price_amount' => 'integer',
        'discounted_price_amount' => 'integer',
        'sms_credit_gift_amount' => 'integer',
        'sort_order' => 'integer',
        'is_active' => 'boolean',
    ];

    public function tenants(): HasMany
    {
        return $this->hasMany(Tenant::class, 'subscription_package_id');
    }

    public function audiencePrices(): HasMany
    {
        return $this->hasMany(SubscriptionPackageAudiencePrice::class, 'subscription_package_id');
    }

    public function landingOrders(): HasMany
    {
        return $this->hasMany(LandingOrder::class, 'subscription_package_id');
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

        $priceAmount = (int) ($override?->price_amount ?? $this->price_amount ?? 0);
        $discountedPriceAmount = $override?->discounted_price_amount ?? $this->discounted_price_amount;
        $discountedPriceAmount = $discountedPriceAmount !== null ? (int) $discountedPriceAmount : null;
        $payableAmount = $discountedPriceAmount && $discountedPriceAmount > 0 ? $discountedPriceAmount : $priceAmount;

        return [
            'priceAmount' => $priceAmount,
            'discountedPriceAmount' => $discountedPriceAmount,
            'payableAmount' => $payableAmount,
            'discountAmount' => max(0, $priceAmount - $payableAmount),
            'audienceOverrideApplied' => $override !== null,
            'audienceTypeId' => $override?->audience_type_id,
            'audienceName' => $override?->relationLoaded('audienceType')
                ? $override?->audienceType?->name
                : $override?->audienceType()->value('name'),
            'showOnLandingHome' => (bool) ($override?->show_on_landing_home ?? false),
            'isLandingRecommended' => (bool) ($override?->is_landing_recommended ?? false),
            'landingSortOrder' => (int) ($override?->landing_sort_order ?? 0),
        ];
    }

    public function scopeCustomerPurchasable(Builder $query): Builder
    {
        return $query->where('duration_days', '>=', self::CUSTOMER_MIN_DURATION_DAYS);
    }

    public function scopeCustomerRenewable(Builder $query): Builder
    {
        return $query
            ->customerPurchasable()
            ->where('duration_days', '<=', self::CUSTOMER_MAX_RENEWAL_DURATION_DAYS);
    }

    public function getPayableAmountAttribute(): int
    {
        $discounted = (int) ($this->discounted_price_amount ?? 0);

        return $discounted > 0 ? $discounted : (int) $this->price_amount;
    }

    public function getDiscountAmountAttribute(): int
    {
        return max(0, (int) $this->price_amount - (int) $this->payable_amount);
    }

    public function userLimitLabel(): string
    {
        $limit = $this->user_limit;

        return $limit === null ? 'نامحدود' : number_format((int) $limit);
    }

    public function isUnlimitedUsers(): bool
    {
        return $this->user_limit === null;
    }
}
