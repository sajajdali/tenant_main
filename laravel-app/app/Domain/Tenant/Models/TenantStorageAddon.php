<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantStorageAddon extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'tenant_id',
        'gb',
        'price_per_gb_month',
        'amount',
        'payable_amount',
        'starts_at',
        'ends_at',
        'status',
        'tenant_subscription_payment_id',
        'metadata',
    ];

    protected $casts = [
        'gb' => 'integer',
        'price_per_gb_month' => 'integer',
        'amount' => 'integer',
        'payable_amount' => 'integer',
        'starts_at' => 'date',
        'ends_at' => 'date',
        'metadata' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(TenantSubscriptionPayment::class, 'tenant_subscription_payment_id');
    }
}
