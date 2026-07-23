<?php

declare(strict_types=1);

namespace App\Domain\Landing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class LandingPage extends Model
{
    use SoftDeletes;

    protected $connection = 'central';

    protected $fillable = [
        'landing_site_id',
        'name',
        'slug',
        'page_key',
        'status',
        'sort_order',
        'seo_json',
        'settings_json',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'seo_json' => 'array',
        'settings_json' => 'array',
    ];

    public function landingSite(): BelongsTo
    {
        return $this->belongsTo(LandingSite::class, 'landing_site_id');
    }

    public function sections(): HasMany
    {
        return $this->hasMany(LandingPageSection::class, 'landing_page_id')->orderBy('sort_order');
    }
}
