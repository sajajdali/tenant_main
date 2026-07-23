<?php

declare(strict_types=1);

namespace App\Domain\Store\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StoreCategory extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'image_path',
        'sort_order',
        'is_active',
        'show_on_home',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'is_active' => 'boolean',
        'show_on_home' => 'boolean',
    ];

    public function products(): HasMany
    {
        return $this->hasMany(StoreProduct::class);
    }
}
