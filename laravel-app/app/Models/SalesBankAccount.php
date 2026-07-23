<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SalesBankAccount extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'user_id',
        'bank_name',
        'card_number',
        'iban',
        'account_holder_name',
        'is_default',
        'is_active',
        'meta_json',
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'is_active' => 'boolean',
        'meta_json' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function withdrawalRequests(): HasMany
    {
        return $this->hasMany(SalesWithdrawalRequest::class);
    }
}
