<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NutritionDietPrescription extends Model
{
    protected $fillable = [
        'nutrition_diet_request_id',
        'user_id',
        'nutrition_profile_snapshot_id',
        'nutrition_diet_template_id',
        'issued_by_user_id',
        'approved_by_user_id',
        'supersedes_prescription_id',
        'delivery_channel',
        'prescription_mode',
        'status',
        'allow_food_replacement',
        'suggest_daily_replacements',
        'current_weight_kg',
        'target_weight_kg',
        'weekly_weight_change_kg',
        'started_at',
        'ends_at',
        'version',
        'is_current',
        'summary_text',
        'notes',
        'template_snapshot',
        'profile_snapshot',
        'content_snapshot',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'allow_food_replacement' => 'boolean',
            'suggest_daily_replacements' => 'boolean',
            'current_weight_kg' => 'decimal:2',
            'target_weight_kg' => 'decimal:2',
            'weekly_weight_change_kg' => 'decimal:2',
            'started_at' => 'date',
            'ends_at' => 'date',
            'version' => 'integer',
            'is_current' => 'boolean',
            'template_snapshot' => 'array',
            'profile_snapshot' => 'array',
            'content_snapshot' => 'array',
            'published_at' => 'datetime',
        ];
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(NutritionDietRequest::class, 'nutrition_diet_request_id');
    }
}
