<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NutritionExerciseGroup extends Model
{
    protected $connection = 'central';

    protected $fillable = [
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
        'sort_order' => 'integer',
        'is_active' => 'boolean',
    ];

    public function exercises(): HasMany
    {
        return $this->hasMany(NutritionExercise::class, 'nutrition_exercise_group_id');
    }
}
