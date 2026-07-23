<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;

class SmsSetting extends Model
{
    protected $fillable = [
        'enabled',
        'provider',
        'credentials',
        'templates',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'credentials' => 'array',
        'templates' => 'array',
    ];
}
