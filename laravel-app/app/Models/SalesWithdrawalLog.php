<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalesWithdrawalLog extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'sales_withdrawal_request_id',
        'actor_user_id',
        'action',
        'from_status',
        'to_status',
        'amount',
        'note',
        'meta_json',
        'occurred_at',
    ];

    protected $casts = [
        'amount' => 'integer',
        'meta_json' => 'array',
        'occurred_at' => 'datetime',
    ];

    public function withdrawalRequest(): BelongsTo
    {
        return $this->belongsTo(SalesWithdrawalRequest::class, 'sales_withdrawal_request_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
