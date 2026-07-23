<?php

declare(strict_types=1);

namespace App\Domain\Landing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class LandingFeature extends Model
{
    use SoftDeletes;

    protected $connection = 'central';
    protected $fillable = ['landing_site_id', 'slug', 'title', 'badge_text', 'short_description', 'description', 'status', 'is_primary', 'sort_order', 'video_url', 'video_path', 'cover_url', 'cover_path', 'image_url', 'image_path', 'benefits_json', 'seo_json'];
    protected $casts = ['is_primary' => 'boolean', 'sort_order' => 'integer', 'benefits_json' => 'array', 'seo_json' => 'array'];

    public function landingSite(): BelongsTo
    {
        return $this->belongsTo(LandingSite::class, 'landing_site_id');
    }
}
