<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SalesWithdrawalRequest extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'user_id',
        'sales_bank_account_id',
        'processed_by_user_id',
        'requested_amount',
        'paid_amount',
        'balance_before',
        'balance_after',
        'status',
        'request_note',
        'admin_note',
        'payment_reference',
        'requested_at',
        'processed_at',
        'paid_at',
        'meta_json',
    ];

    protected $casts = [
        'requested_amount' => 'integer',
        'paid_amount' => 'integer',
        'balance_before' => 'integer',
        'balance_after' => 'integer',
        'requested_at' => 'datetime',
        'processed_at' => 'datetime',
        'paid_at' => 'datetime',
        'meta_json' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(SalesBankAccount::class, 'sales_bank_account_id');
    }

    public function processedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by_user_id');
    }

    public function walletTransactions(): HasMany
    {
        return $this->hasMany(SalesWalletTransaction::class, 'sales_withdrawal_request_id');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(SalesWithdrawalLog::class, 'sales_withdrawal_request_id');
    }
}
