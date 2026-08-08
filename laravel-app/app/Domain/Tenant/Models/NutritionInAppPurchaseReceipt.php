<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NutritionInAppPurchaseReceipt extends Model
{
    protected $fillable = [
        'user_id',
        'nutrition_package_id',
        'nutrition_package_order_id',
        'store',
        'product_id',
        'purchase_token',
        'store_order_id',
        'developer_payload',
        'status',
        'raw_payload',
        'purchased_at',
        'verified_at',
        'granted_at',
        'consumed_reported_at',
        'failure_reason',
    ];

    protected function casts(): array
    {
        return [
            'raw_payload' => 'array',
            'purchased_at' => 'datetime',
            'verified_at' => 'datetime',
            'granted_at' => 'datetime',
            'consumed_reported_at' => 'datetime',
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
