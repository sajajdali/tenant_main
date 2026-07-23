<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentSetting extends Model
{
    protected $fillable = [
        'enabled',
        'provider',
        'credentials',
        'meta',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'credentials' => 'array',
        'meta' => 'array',
    ];
}
