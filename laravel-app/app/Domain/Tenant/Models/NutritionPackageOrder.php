<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class NutritionPackageOrder extends Model
{
    protected $fillable = [
        'user_id',
        'nutrition_package_id',
        'nutrition_discount_code_id',
        'invoice_number',
        'status',
        'gateway',
        'sandbox_mode',
        'amount',
        'discount_amount',
        'payable_amount',
        'transaction_id',
        'reference_id',
        'discount_code',
        'discount_code_snapshot',
        'meta_json',
        'paid_at',
        'expires_at',
        'failure_reason',
    ];

    protected function casts(): array
    {
        return [
            'sandbox_mode' => 'boolean',
            'amount' => 'integer',
            'discount_amount' => 'integer',
            'payable_amount' => 'integer',
            'discount_code_snapshot' => 'array',
            'meta_json' => 'array',
            'paid_at' => 'datetime',
            'expires_at' => 'datetime',
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

    public function discountCode(): BelongsTo
    {
        return $this->belongsTo(NutritionDiscountCode::class, 'nutrition_discount_code_id');
    }

    public function subscription(): HasOne
    {
        return $this->hasOne(NutritionPackageSubscription::class, 'nutrition_package_order_id');
    }
}
