<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NutritionDietRequest extends Model
{
    protected $fillable = [
        'user_id',
        'nutrition_profile_id',
        'nutrition_profile_snapshot_id',
        'nutrition_package_subscription_id',
        'nutrition_diet_template_id',
        'request_type',
        'prescription_mode',
        'status',
        'ask_ai_enabled',
        'allow_food_replacement',
        'suggest_daily_replacements',
        'requires_manual_delivery_approval',
        'diet_template_name',
        'diet_goal',
        'gender',
        'athlete_mode',
        'activity_level',
        'birth_date',
        'height_cm',
        'current_weight_kg',
        'target_weight_kg',
        'weekly_weight_change_kg',
        'started_at',
        'ends_at',
        'ai_requested_by_user_id',
        'ai_generation_status',
        'expert_notes',
        'clinical_notes',
        'generation_instructions',
        'must_include',
        'must_avoid',
        'ai_job_dispatched_at',
        'ai_generated_at',
        'manual_delivery_approved_at',
        'manual_delivery_approved_by_user_id',
        'ai_generation_error',
        'profile_snapshot',
        'template_snapshot',
        'request_payload_snapshot',
        'ai_prompt_snapshot',
        'ai_response_snapshot',
        'ai_usage_limits',
    ];

    protected function casts(): array
    {
        return [
            'ask_ai_enabled' => 'boolean',
            'allow_food_replacement' => 'boolean',
            'suggest_daily_replacements' => 'boolean',
            'requires_manual_delivery_approval' => 'boolean',
            'birth_date' => 'date',
            'height_cm' => 'integer',
            'current_weight_kg' => 'decimal:2',
            'target_weight_kg' => 'decimal:2',
            'weekly_weight_change_kg' => 'decimal:2',
            'started_at' => 'date',
            'ends_at' => 'date',
            'ai_job_dispatched_at' => 'datetime',
            'ai_generated_at' => 'datetime',
            'manual_delivery_approved_at' => 'datetime',
            'profile_snapshot' => 'array',
            'template_snapshot' => 'array',
            'request_payload_snapshot' => 'array',
            'ai_prompt_snapshot' => 'array',
            'ai_response_snapshot' => 'array',
            'ai_usage_limits' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'user_id');
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(NutritionProfile::class, 'nutrition_profile_id');
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(NutritionPackageSubscription::class, 'nutrition_package_subscription_id');
    }

    public function dietTemplate(): BelongsTo
    {
        return $this->belongsTo(NutritionDietTemplate::class, 'nutrition_diet_template_id');
    }

    public function prescriptions(): HasMany
    {
        return $this->hasMany(NutritionDietPrescription::class, 'nutrition_diet_request_id');
    }
}
