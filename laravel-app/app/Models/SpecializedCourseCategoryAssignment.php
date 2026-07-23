<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SpecializedCourseCategoryAssignment extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'specialized_course_id',
        'specialized_course_category_id',
    ];

    public function course(): BelongsTo
    {
        return $this->belongsTo(SpecializedCourse::class, 'specialized_course_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(SpecializedCourseCategory::class, 'specialized_course_category_id');
    }
}
