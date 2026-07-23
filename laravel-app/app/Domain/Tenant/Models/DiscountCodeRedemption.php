<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use App\Domain\Landing\Models\LandingCustomer;
use App\Domain\Landing\Models\LandingOrder;
use App\Domain\Landing\Models\LandingOrderPayment;
use App\Domain\Landing\Models\LandingSite;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DiscountCodeRedemption extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'discount_code_id',
        'audience_type_id',
        'sales_user_id',
        'context_type',
        'tenant_id',
        'landing_site_id',
        'landing_customer_id',
        'landing_order_id',
        'landing_order_payment_id',
        'tenant_subscription_payment_id',
        'customer_mobile',
        'base_amount',
        'discount_amount',
        'payable_amount',
        'meta_json',
        'redeemed_at',
    ];

    protected $casts = [
        'audience_type_id' => 'integer',
        'sales_user_id' => 'integer',
        'landing_site_id' => 'integer',
        'landing_customer_id' => 'integer',
        'landing_order_id' => 'integer',
        'landing_order_payment_id' => 'integer',
        'tenant_subscription_payment_id' => 'integer',
        'base_amount' => 'integer',
        'discount_amount' => 'integer',
        'payable_amount' => 'integer',
        'meta_json' => 'array',
        'redeemed_at' => 'datetime',
    ];

    public function discountCode(): BelongsTo
    {
        return $this->belongsTo(DiscountCode::class, 'discount_code_id');
    }

    public function audienceType(): BelongsTo
    {
        return $this->belongsTo(AudienceType::class, 'audience_type_id');
    }

    public function salesUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sales_user_id');
    }

    public function landingSite(): BelongsTo
    {
        return $this->belongsTo(LandingSite::class, 'landing_site_id');
    }

    public function landingCustomer(): BelongsTo
    {
        return $this->belongsTo(LandingCustomer::class, 'landing_customer_id');
    }

    public function landingOrder(): BelongsTo
    {
        return $this->belongsTo(LandingOrder::class, 'landing_order_id');
    }

    public function landingOrderPayment(): BelongsTo
    {
        return $this->belongsTo(LandingOrderPayment::class, 'landing_order_payment_id');
    }

    public function tenantSubscriptionPayment(): BelongsTo
    {
        return $this->belongsTo(TenantSubscriptionPayment::class, 'tenant_subscription_payment_id');
    }
}
