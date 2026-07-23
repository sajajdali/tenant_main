<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NutritionDietTemplate extends Model
{
    use HasFactory;

    protected $table = 'nutrition_diet_templates';

    protected $fillable = [
        'parent_id',
        'depth',
        'name',
        'slug',
        'image_path',
        'diet_basis',
        'prescription_mode',
        'allow_food_replacement',
        'suggest_daily_replacements',
        'show_diet_explanations',
        'diet_explanation_prompt',
        'structure_version',
        'applicable_goals',
        'meal_slots',
        'description',
        'template_notes',
        'conditions_text',
        'duration_days',
        'supplements_enabled',
        'supplement_notes',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'applicable_goals' => 'array',
            'meal_slots' => 'array',
            'depth' => 'integer',
            'allow_food_replacement' => 'boolean',
            'suggest_daily_replacements' => 'boolean',
            'show_diet_explanations' => 'boolean',
            'structure_version' => 'integer',
            'duration_days' => 'integer',
            'supplements_enabled' => 'boolean',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('sort_order')->orderBy('name');
    }
}
