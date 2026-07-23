<?php

declare(strict_types=1);

namespace App\Domain\Store\Models;

use App\Domain\Tenant\Models\TenantUser;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StoreOrder extends Model
{
    protected $fillable = [
        'created_by_user_id',
        'order_number',
        'status',
        'payment_method',
        'shipping_method',
        'customer_name',
        'customer_phone',
        'delivery_title',
        'delivery_province_id',
        'delivery_province_name',
        'delivery_city_id',
        'delivery_city_name',
        'delivery_latitude',
        'delivery_longitude',
        'delivery_address',
        'notes',
        'items_count',
        'subtotal_amount',
        'shipping_amount',
        'discount_amount',
        'total_amount',
        'paid_at',
        'metadata',
    ];

    protected $casts = [
        'delivery_latitude' => 'float',
        'delivery_longitude' => 'float',
        'items_count' => 'integer',
        'subtotal_amount' => 'integer',
        'shipping_amount' => 'integer',
        'discount_amount' => 'integer',
        'total_amount' => 'integer',
        'paid_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'created_by_user_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(StoreOrderItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(StoreOrderPayment::class);
    }
}
