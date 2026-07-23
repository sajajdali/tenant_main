<?php

declare(strict_types=1);

namespace App\Domain\Landing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LandingOrderItem extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'landing_order_id',
        'type',
        'code',
        'title',
        'description',
        'quantity',
        'unit_amount',
        'total_amount',
        'sort_order',
        'meta_json',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'unit_amount' => 'integer',
        'total_amount' => 'integer',
        'sort_order' => 'integer',
        'meta_json' => 'array',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(LandingOrder::class, 'landing_order_id');
    }
}
