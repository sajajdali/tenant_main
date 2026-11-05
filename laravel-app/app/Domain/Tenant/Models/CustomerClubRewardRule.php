<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CustomerClubRewardRule extends Model
{
    public const EVENT_APPOINTMENT_PAID = 'appointment.paid';

    public const EVENT_STORE_ORDER_PAID = 'store_order.paid';

    public const EVENT_NUTRITION_DIET_ACTIVATED = 'nutrition.diet.activated';

    public const EVENT_NUTRITION_MEAL_LOGGED = 'nutrition.meal.logged';

    public const EVENT_NUTRITION_WEIGHT_RECORDED = 'nutrition.weight.recorded';

    public const EVENT_NUTRITION_DIET_COMPLETED = 'nutrition.diet.completed';

    protected $fillable = [
        'title', 'is_active', 'event_type', 'scope_type', 'scope_ids', 'conditions_json',
        'reward_type', 'reward_amount', 'award_timing', 'per_user_limit', 'limit_period',
        'priority', 'starts_at', 'ends_at', 'created_by_user_id',
    ];

    protected $casts = [
        'is_active' => 'boolean', 'scope_ids' => 'array', 'conditions_json' => 'array',
        'reward_amount' => 'integer', 'per_user_limit' => 'integer', 'priority' => 'integer',
        'starts_at' => 'datetime', 'ends_at' => 'datetime',
    ];

    public function awards(): HasMany
    {
        return $this->hasMany(CustomerClubRewardRuleAward::class, 'rule_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'created_by_user_id');
    }
}
