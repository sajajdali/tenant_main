<?php

declare(strict_types=1);

namespace App\Models;

use App\Domain\Tenant\Models\AudienceType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class HelpTopic extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'audience_type_id',
        'module_key',
        'topic_key',
        'title',
        'summary',
        'body',
        'video_url',
        'video_path',
        'cover_image_path',
        'sort_order',
        'is_active',
        'show_in_help_center',
        'show_in_page_header',
        'meta_json',
    ];

    protected $casts = [
        'audience_type_id' => 'integer',
        'sort_order' => 'integer',
        'is_active' => 'boolean',
        'show_in_help_center' => 'boolean',
        'show_in_page_header' => 'boolean',
        'meta_json' => 'array',
    ];

    public function audienceType(): BelongsTo
    {
        return $this->belongsTo(AudienceType::class, 'audience_type_id');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function videoUrl(): ?string
    {
        if (filled($this->video_url)) {
            return $this->video_url;
        }

        return filled($this->video_path) ? Storage::disk('public')->url($this->video_path) : null;
    }

    public function coverImageUrl(): ?string
    {
        return filled($this->cover_image_path) ? Storage::disk('public')->url($this->cover_image_path) : null;
    }
}
