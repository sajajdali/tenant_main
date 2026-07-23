<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NutritionMealReplacementSuggestion extends Model
{
    protected $fillable = [
        'user_id',
        'requested_by_user_id',
        'nutrition_diet_prescription_id',
        'nutrition_diet_request_id',
        'nutrition_prescription_meal_slot_id',
        'nutrition_prescription_day_meal_id',
        'source_type',
        'source_signature',
        'meal_slot_key',
        'slot_title',
        'day_number',
        'meal_index',
        'suggestion_count',
        'status',
        'error_message',
        'context_snapshot',
        'options',
        'ai_prompt_snapshot',
        'ai_response_snapshot',
        'requested_at',
        'generated_at',
        'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'day_number' => 'integer',
            'meal_index' => 'integer',
            'suggestion_count' => 'integer',
            'context_snapshot' => 'array',
            'options' => 'array',
            'ai_prompt_snapshot' => 'array',
            'ai_response_snapshot' => 'array',
            'requested_at' => 'datetime',
            'generated_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function prescription(): BelongsTo
    {
        return $this->belongsTo(NutritionDietPrescription::class, 'nutrition_diet_prescription_id');
    }
}
