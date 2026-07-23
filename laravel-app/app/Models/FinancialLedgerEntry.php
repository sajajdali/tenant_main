<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinancialLedgerEntry extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'entry_type',
        'direction',
        'source_type',
        'source_id',
        'tenant_id',
        'title',
        'amount',
        'occurred_at',
        'meta_json',
    ];

    protected $casts = [
        'amount' => 'integer',
        'occurred_at' => 'datetime',
        'meta_json' => 'array',
    ];
}
