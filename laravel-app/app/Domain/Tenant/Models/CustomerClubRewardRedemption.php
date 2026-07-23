<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerClubRewardRedemption extends Model
{
    protected $fillable = [
        'member_account_id',
        'user_id',
        'reward_id',
        'status',
        'cost_points',
        'wallet_amount',
        'issued_code',
        'redeemed_at',
        'expires_at',
        'redeemed_by_user_id',
        'meta_json',
    ];

    protected $casts = [
        'member_account_id' => 'integer',
        'user_id' => 'integer',
        'reward_id' => 'integer',
        'cost_points' => 'integer',
        'wallet_amount' => 'integer',
        'redeemed_at' => 'datetime',
        'expires_at' => 'datetime',
        'redeemed_by_user_id' => 'integer',
        'meta_json' => 'array',
    ];

    public function memberAccount(): BelongsTo
    {
        return $this->belongsTo(CustomerClubMemberAccount::class, 'member_account_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'user_id');
    }

    public function reward(): BelongsTo
    {
        return $this->belongsTo(CustomerClubReward::class, 'reward_id');
    }
}
