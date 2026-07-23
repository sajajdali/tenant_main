<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NutritionExercise extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'nutrition_exercise_group_id',
        'title',
        'slug',
        'description',
        'icon_key',
        'badge_text',
        'search_terms',
        'supports_intensity',
        'supports_distance',
        'supports_speed',
        'default_intensity',
        'met_light',
        'met_moderate',
        'met_vigorous',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'supports_intensity' => 'boolean',
        'supports_distance' => 'boolean',
        'supports_speed' => 'boolean',
        'met_light' => 'decimal:2',
        'met_moderate' => 'decimal:2',
        'met_vigorous' => 'decimal:2',
        'sort_order' => 'integer',
        'is_active' => 'boolean',
    ];

    public function group(): BelongsTo
    {
        return $this->belongsTo(NutritionExerciseGroup::class, 'nutrition_exercise_group_id');
    }
}
