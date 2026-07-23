<?php

declare(strict_types=1);

namespace App\Domain\Landing\Models;

use App\Domain\Tenant\Models\AudienceType;
use App\Domain\Tenant\Models\SubscriptionPackage;
use App\Domain\Tenant\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class LandingOrder extends Model
{
    public const STATUS_DRAFT = 'draft';
    public const STATUS_PENDING_PAYMENT = 'pending_payment';
    public const STATUS_PAID = 'paid';
    public const STATUS_AWAITING_APPROVAL = 'awaiting_admin_approval';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_PROVISIONING = 'provisioning';
    public const STATUS_PROVISIONED = 'provisioned';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_CANCELLED = 'cancelled';

    protected $connection = 'central';

    protected $fillable = [
        'order_number',
        'landing_customer_id',
        'landing_site_id',
        'audience_type_id',
        'subscription_package_id',
        'approved_by_user_id',
        'tenant_id',
        'requested_domain',
        'requested_domain_tld',
        'requested_domain_whois_status',
        'requested_domain_checked_at',
        'requested_domain_whois_payload',
        'duration_days',
        'requested_user_limit',
        'package_price_amount',
        'setup_fee_amount',
        'domain_price_amount',
        'discount_amount',
        'subtotal_amount',
        'total_amount',
        'currency',
        'status',
        'customer_full_name',
        'customer_mobile',
        'customer_email',
        'customer_gender',
        'customer_national_code',
        'customer_birth_date',
        'customer_province_name',
        'customer_city_name',
        'customer_address_line',
        'notes',
        'approved_at',
        'provision_requested_at',
        'provisioned_at',
        'meta_json',
    ];

    protected $casts = [
        'requested_domain_checked_at' => 'datetime',
        'requested_domain_whois_payload' => 'array',
        'duration_days' => 'integer',
        'requested_user_limit' => 'integer',
        'package_price_amount' => 'integer',
        'setup_fee_amount' => 'integer',
        'domain_price_amount' => 'integer',
        'discount_amount' => 'integer',
        'subtotal_amount' => 'integer',
        'total_amount' => 'integer',
        'customer_birth_date' => 'date',
        'approved_at' => 'datetime',
        'provision_requested_at' => 'datetime',
        'provisioned_at' => 'datetime',
        'meta_json' => 'array',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(LandingCustomer::class, 'landing_customer_id');
    }

    public function landingSite(): BelongsTo
    {
        return $this->belongsTo(LandingSite::class, 'landing_site_id');
    }

    public function audienceType(): BelongsTo
    {
        return $this->belongsTo(AudienceType::class, 'audience_type_id');
    }

    public function subscriptionPackage(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPackage::class, 'subscription_package_id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by_user_id');
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(LandingOrderItem::class, 'landing_order_id')->orderBy('sort_order');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(LandingOrderPayment::class, 'landing_order_id')->latest('id');
    }

    public function provisionRequest(): HasOne
    {
        return $this->hasOne(SiteProvisionRequest::class, 'landing_order_id');
    }
}
