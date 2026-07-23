<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantSubscriptionPaymentItem extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'tenant_subscription_payment_id',
        'item_type',
        'subscription_package_id',
        'feature_module_id',
        'title',
        'description',
        'quantity',
        'unit_amount',
        'amount',
        'discount_amount',
        'payable_amount',
        'metadata',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'unit_amount' => 'integer',
        'amount' => 'integer',
        'discount_amount' => 'integer',
        'payable_amount' => 'integer',
        'metadata' => 'array',
    ];

    public function payment(): BelongsTo
    {
        return $this->belongsTo(TenantSubscriptionPayment::class, 'tenant_subscription_payment_id');
    }

    public function subscriptionPackage(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPackage::class, 'subscription_package_id');
    }

    public function featureModule(): BelongsTo
    {
        return $this->belongsTo(FeatureModule::class, 'feature_module_id');
    }
}
