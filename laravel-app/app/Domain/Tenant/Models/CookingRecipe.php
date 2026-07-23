<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;

class CookingRecipe extends Model
{
    public const FLAGS = [
        'important',
        'popular',
        'frequent',
        'low_calorie',
        'vegan',
        'affordable',
    ];

    protected $fillable = [
        'title',
        'slug',
        'description',
        'servings',
        'ingredients',
        'ingredients_json',
        'instructions',
        'instructions_json',
        'nutrition',
        'micronutrients',
        'is_published',
        'is_active',
        'sort_order',
        'flags',
        'metadata',
    ];

    protected $casts = [
        'servings' => 'integer',
        'ingredients_json' => 'array',
        'instructions_json' => 'array',
        'nutrition' => 'array',
        'micronutrients' => 'array',
        'is_published' => 'boolean',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
        'flags' => 'array',
        'metadata' => 'array',
    ];
}
