<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NutritionDiscountCode extends Model
{
    protected $fillable = [
        'code',
        'title',
        'discount_type',
        'discount_value',
        'max_uses',
        'is_active',
    ];

    protected $casts = [
        'discount_value' => 'integer',
        'max_uses' => 'integer',
        'is_active' => 'boolean',
    ];

    public function orders(): HasMany
    {
        return $this->hasMany(NutritionPackageOrder::class, 'nutrition_discount_code_id');
    }
}
