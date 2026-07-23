<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CustomerClubReward extends Model
{
    protected $fillable = [
        'title',
        'slug',
        'reward_type',
        'cost_points',
        'wallet_amount',
        'bonus_points',
        'vip_days',
        'discount_percent',
        'discount_amount',
        'maximum_discount_amount',
        'per_user_limit',
        'total_limit',
        'sort_order',
        'is_active',
        'starts_at',
        'ends_at',
        'description',
        'metadata',
    ];

    protected $casts = [
        'cost_points' => 'integer',
        'wallet_amount' => 'integer',
        'bonus_points' => 'integer',
        'vip_days' => 'integer',
        'discount_percent' => 'integer',
        'discount_amount' => 'integer',
        'maximum_discount_amount' => 'integer',
        'per_user_limit' => 'integer',
        'total_limit' => 'integer',
        'sort_order' => 'integer',
        'is_active' => 'boolean',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function redemptions(): HasMany
    {
        return $this->hasMany(CustomerClubRewardRedemption::class, 'reward_id');
    }
}
