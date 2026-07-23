<?php

declare(strict_types=1);

namespace App\Domain\CustomerFeedback\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerFeedbackQuestion extends Model
{
    protected $fillable = [
        'title',
        'display_type',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'is_active' => 'boolean',
    ];
}
