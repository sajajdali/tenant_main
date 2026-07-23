<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerClubLedgerEntry extends Model
{
    protected $fillable = [
        'member_account_id',
        'user_id',
        'entry_type',
        'source_type',
        'source_id',
        'points_delta',
        'wallet_delta',
        'points_balance_after',
        'wallet_balance_after',
        'title',
        'description',
        'meta_json',
        'occurred_at',
    ];

    protected $casts = [
        'member_account_id' => 'integer',
        'user_id' => 'integer',
        'points_delta' => 'integer',
        'wallet_delta' => 'integer',
        'points_balance_after' => 'integer',
        'wallet_balance_after' => 'integer',
        'meta_json' => 'array',
        'occurred_at' => 'datetime',
    ];

    public function memberAccount(): BelongsTo
    {
        return $this->belongsTo(CustomerClubMemberAccount::class, 'member_account_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'user_id');
    }
}
