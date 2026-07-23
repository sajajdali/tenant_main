<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;

class SmsBlacklist extends Model
{
    protected $fillable = [
        'phone',
        'name',
        'reason',
        'blocked_at',
    ];

    protected $casts = [
        'blocked_at' => 'datetime',
    ];
}
