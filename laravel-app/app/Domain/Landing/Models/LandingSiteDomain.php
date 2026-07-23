<?php

declare(strict_types=1);

namespace App\Domain\Landing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LandingSiteDomain extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'landing_site_id',
        'domain',
        'is_primary',
        'status',
        'verified_at',
        'meta_json',
    ];

    protected $casts = [
        'is_primary' => 'boolean',
        'verified_at' => 'datetime',
        'meta_json' => 'array',
    ];

    public function landingSite(): BelongsTo
    {
        return $this->belongsTo(LandingSite::class, 'landing_site_id');
    }
}
