<?php

declare(strict_types=1);

namespace App\Domain\Landing\Models;

use Illuminate\Database\Eloquent\Model;

class DomainTldPrice extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'tld',
        'register_price_amount',
        'renew_price_amount',
        'transfer_price_amount',
        'currency',
        'is_active',
        'meta_json',
    ];

    protected $casts = [
        'register_price_amount' => 'integer',
        'renew_price_amount' => 'integer',
        'transfer_price_amount' => 'integer',
        'is_active' => 'boolean',
        'meta_json' => 'array',
    ];
}
