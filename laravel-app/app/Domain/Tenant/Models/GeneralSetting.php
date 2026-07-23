<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;

class GeneralSetting extends Model
{
    protected $fillable = [
        'timezone',
        'currency',
        'booking_rules',
    ];

    protected $casts = [
        'booking_rules' => 'array',
    ];
}
