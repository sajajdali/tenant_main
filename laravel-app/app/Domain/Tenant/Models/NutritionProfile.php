<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NutritionProfile extends Model
{
    use HasFactory;

    protected $table = 'nutrition_profiles';

    protected $fillable = [
        'user_id',
        'diet_goal',
        'gender',
        'athlete_mode',
        'activity_level',
        'birth_date',
        'height_cm',
        'weight_kg',
        'ideal_weight_kg',
        'recommended_target_weight_kg',
        'target_weight_kg',
        'weekly_weight_change_kg',
        'medical_conditions',
        'medications_and_supplements',
        'disliked_foods',
        'food_allergies',
        'mindset_answers',
        'mindset_completed_at',
        'selected_nutrition_package_id',
        'preferences_completed_at',
        'package_selected_at',
        'onboarding_completed_at',
    ];

    protected function casts(): array
    {
        return [
            'birth_date' => 'date',
            'weight_kg' => 'decimal:2',
            'ideal_weight_kg' => 'decimal:2',
            'recommended_target_weight_kg' => 'decimal:2',
            'target_weight_kg' => 'decimal:2',
            'weekly_weight_change_kg' => 'decimal:2',
            'mindset_answers' => 'array',
            'mindset_completed_at' => 'datetime',
            'preferences_completed_at' => 'datetime',
            'package_selected_at' => 'datetime',
            'onboarding_completed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'user_id');
    }

    public function selectedPackage(): BelongsTo
    {
        return $this->belongsTo(NutritionPackage::class, 'selected_nutrition_package_id');
    }
}
