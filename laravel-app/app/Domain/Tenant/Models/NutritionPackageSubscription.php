<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NutritionPackageSubscription extends Model
{
    protected $fillable = [
        'user_id',
        'nutrition_package_id',
        'nutrition_package_order_id',
        'status',
        'starts_at',
        'ends_at',
        'online_diet_total',
        'online_diet_used',
        'offline_diet_total',
        'offline_diet_used',
        'price_amount',
        'payable_amount',
        'meta_json',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'date',
            'ends_at' => 'date',
            'online_diet_total' => 'integer',
            'online_diet_used' => 'integer',
            'offline_diet_total' => 'integer',
            'offline_diet_used' => 'integer',
            'price_amount' => 'integer',
            'payable_amount' => 'integer',
            'meta_json' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'user_id');
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(NutritionPackage::class, 'nutrition_package_id');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(NutritionPackageOrder::class, 'nutrition_package_order_id');
    }
}
