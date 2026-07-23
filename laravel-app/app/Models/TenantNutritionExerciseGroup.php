<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TenantNutritionExerciseGroup extends Model
{
    protected $fillable = [
        'central_group_id',
        'title',
        'slug',
        'description',
        'icon_key',
        'accent_color',
        'soft_color',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'central_group_id' => 'integer',
        'sort_order' => 'integer',
        'is_active' => 'boolean',
    ];

    public function exercises(): HasMany
    {
        return $this->hasMany(TenantNutritionExercise::class, 'tenant_nutrition_exercise_group_id');
    }
}
