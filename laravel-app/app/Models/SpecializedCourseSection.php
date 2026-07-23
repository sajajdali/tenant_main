<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SpecializedCourseSection extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'specialized_course_id',
        'title',
        'description',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'is_active' => 'boolean',
    ];

    public function course(): BelongsTo
    {
        return $this->belongsTo(SpecializedCourse::class, 'specialized_course_id');
    }

    public function lessons(): HasMany
    {
        return $this->hasMany(SpecializedCourseLesson::class)->orderBy('sort_order')->orderBy('id');
    }
}
