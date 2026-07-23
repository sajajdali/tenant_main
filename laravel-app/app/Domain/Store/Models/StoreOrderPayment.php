<?php

declare(strict_types=1);

namespace App\Domain\Store\Models;

use App\Domain\Tenant\Models\TenantUser;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StoreOrderPayment extends Model
{
    protected $fillable = [
        'store_order_id',
        'created_by_user_id',
        'invoice_number',
        'method',
        'gateway',
        'status',
        'sandbox_mode',
        'amount',
        'transaction_id',
        'reference_id',
        'failure_reason',
        'expires_at',
        'paid_at',
        'metadata',
    ];

    protected $casts = [
        'sandbox_mode' => 'boolean',
        'amount' => 'integer',
        'expires_at' => 'datetime',
        'paid_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(StoreOrder::class, 'store_order_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'created_by_user_id');
    }
}
