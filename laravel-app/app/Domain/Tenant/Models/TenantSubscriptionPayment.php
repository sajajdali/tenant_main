<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TenantSubscriptionPayment extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'tenant_id',
        'payment_type',
        'subscription_package_id',
        'status',
        'gateway',
        'invoice_number',
        'amount',
        'discount_amount',
        'payable_amount',
        'sandbox_mode',
        'authority',
        'reference_id',
        'initiated_by_tenant_user_id',
        'initiated_by_name',
        'initiated_by_mobile',
        'initiated_by_role',
        'previous_support_ends_at',
        'new_support_ends_at',
        'paid_at',
        'expires_at',
        'failure_reason',
        'metadata',
    ];

    protected $casts = [
        'amount' => 'integer',
        'discount_amount' => 'integer',
        'payable_amount' => 'integer',
        'sandbox_mode' => 'boolean',
        'previous_support_ends_at' => 'date',
        'new_support_ends_at' => 'date',
        'paid_at' => 'datetime',
        'expires_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function subscriptionPackage(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPackage::class, 'subscription_package_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(TenantSubscriptionPaymentItem::class, 'tenant_subscription_payment_id');
    }
}
