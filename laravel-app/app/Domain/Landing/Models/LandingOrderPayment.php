<?php

declare(strict_types=1);

namespace App\Domain\Landing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LandingOrderPayment extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_PAID = 'paid';
    public const STATUS_FAILED = 'failed';
    public const STATUS_CANCELLED = 'cancelled';

    protected $connection = 'central';

    protected $fillable = [
        'landing_order_id',
        'invoice_number',
        'gateway',
        'status',
        'sandbox_mode',
        'amount',
        'expires_at',
        'authority',
        'reference_id',
        'failure_reason',
        'paid_at',
        'meta_json',
    ];

    protected $casts = [
        'sandbox_mode' => 'boolean',
        'amount' => 'integer',
        'expires_at' => 'datetime',
        'paid_at' => 'datetime',
        'meta_json' => 'array',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(LandingOrder::class, 'landing_order_id');
    }
}
