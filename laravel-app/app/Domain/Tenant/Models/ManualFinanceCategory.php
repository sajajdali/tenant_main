<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;

class ManualFinanceCategory extends Model
{
    protected $fillable = [
        'name',
        'audience_slug',
        'default_share_percent',
        'default_amount',
        'is_default',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'default_share_percent' => 'integer',
            'default_amount' => 'integer',
            'is_default' => 'boolean',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }
}
