<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class SpecializedCourseLesson extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'specialized_course_section_id',
        'title',
        'description',
        'video_path',
        'duration_seconds',
        'duration_label',
        'is_free',
        'is_active',
        'sort_order',
        'meta_json',
    ];

    protected $casts = [
        'duration_seconds' => 'integer',
        'is_free' => 'boolean',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
        'meta_json' => 'array',
    ];

    public function section(): BelongsTo
    {
        return $this->belongsTo(SpecializedCourseSection::class, 'specialized_course_section_id');
    }

    public function videoUrl(): ?string
    {
        return filled($this->video_path) ? Storage::disk('public')->url($this->video_path) : null;
    }
}
