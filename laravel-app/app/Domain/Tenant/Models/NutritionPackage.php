<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NutritionPackage extends Model
{
    use HasFactory;

    protected $table = 'nutrition_packages';

    protected $fillable = [
        'parent_id',
        'depth',
        'name',
        'short_title',
        'subtitle',
        'slug',
        'description',
        'features',
        'image_path',
        'online_diet_count',
        'offline_diet_count',
        'duration_days',
        'price_amount',
        'discounted_price_amount',
        'badge_title',
        'is_recommended',
        'visual_style',
        'action_label',
        'first_diet_template_mode',
        'first_diet_template_id',
        'first_diet_template_ids',
        'applicable_goals',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'depth' => 'integer',
            'online_diet_count' => 'integer',
            'offline_diet_count' => 'integer',
            'duration_days' => 'integer',
            'price_amount' => 'integer',
            'discounted_price_amount' => 'integer',
            'features' => 'array',
            'is_recommended' => 'boolean',
            'first_diet_template_id' => 'integer',
            'first_diet_template_ids' => 'array',
            'applicable_goals' => 'array',
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

    public function firstDietTemplate(): BelongsTo
    {
        return $this->belongsTo(NutritionDietTemplate::class, 'first_diet_template_id');
    }
}
