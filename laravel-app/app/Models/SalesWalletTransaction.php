<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalesWalletTransaction extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'user_id',
        'sales_commission_ledger_id',
        'sales_withdrawal_request_id',
        'type',
        'reference_type',
        'reference_id',
        'amount',
        'balance_after',
        'description',
        'meta_json',
        'occurred_at',
    ];

    protected $casts = [
        'amount' => 'integer',
        'balance_after' => 'integer',
        'meta_json' => 'array',
        'occurred_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function commissionLedger(): BelongsTo
    {
        return $this->belongsTo(SalesCommissionLedger::class, 'sales_commission_ledger_id');
    }

    public function withdrawalRequest(): BelongsTo
    {
        return $this->belongsTo(SalesWithdrawalRequest::class, 'sales_withdrawal_request_id');
    }
}
