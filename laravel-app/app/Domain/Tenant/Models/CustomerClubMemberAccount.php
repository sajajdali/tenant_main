<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CustomerClubMemberAccount extends Model
{
    protected $fillable = [
        'user_id',
        'current_tier_id',
        'points_balance',
        'lifetime_points_earned',
        'lifetime_points_spent',
        'wallet_balance',
        'lifetime_wallet_earned',
        'lifetime_wallet_spent',
        'joined_at',
        'last_activity_at',
        'metadata',
    ];

    protected $casts = [
        'current_tier_id' => 'integer',
        'points_balance' => 'integer',
        'lifetime_points_earned' => 'integer',
        'lifetime_points_spent' => 'integer',
        'wallet_balance' => 'integer',
        'lifetime_wallet_earned' => 'integer',
        'lifetime_wallet_spent' => 'integer',
        'joined_at' => 'datetime',
        'last_activity_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'user_id');
    }

    public function currentTier(): BelongsTo
    {
        return $this->belongsTo(CustomerClubTier::class, 'current_tier_id');
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(CustomerClubLedgerEntry::class, 'member_account_id');
    }

    public function redemptions(): HasMany
    {
        return $this->hasMany(CustomerClubRewardRedemption::class, 'member_account_id');
    }
}
