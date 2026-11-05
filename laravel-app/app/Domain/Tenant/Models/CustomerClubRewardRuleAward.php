<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class CustomerClubRewardRuleAward extends Model
{
    protected $fillable = ['rule_id', 'user_id', 'ledger_entry_id', 'status', 'source_type', 'source_id', 'reward_amount', 'context_json', 'awarded_at'];

    protected $casts = ['reward_amount' => 'integer', 'context_json' => 'array', 'awarded_at' => 'datetime'];

    public function rule(): BelongsTo
    {
        return $this->belongsTo(CustomerClubRewardRule::class, 'rule_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'user_id');
    }

    public function ledgerEntry(): BelongsTo
    {
        return $this->belongsTo(CustomerClubLedgerEntry::class, 'ledger_entry_id');
    }

    public function review(): HasOne
    {
        return $this->hasOne(CustomerClubRewardRuleReview::class, 'award_id');
    }
}
