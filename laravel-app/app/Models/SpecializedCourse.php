<?php

declare(strict_types=1);

namespace App\Models;

use App\Domain\Tenant\Models\AudienceType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SpecializedCourse extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'teacher_user_id',
        'audience_type_id',
        'title',
        'slug',
        'subtitle',
        'excerpt',
        'description',
        'about',
        'learning_points',
        'requirements',
        'faq_items',
        'cover_image_path',
        'hero_image_path',
        'preview_video_path',
        'preview_duration_seconds',
        'price_amount',
        'sale_price_amount',
        'discount_ends_at',
        'manual_students_count',
        'purchased_students_count',
        'reviews_count',
        'rating_average',
        'is_active',
        'is_published',
        'sort_order',
        'published_at',
        'meta_json',
    ];

    protected $casts = [
        'learning_points' => 'array',
        'requirements' => 'array',
        'faq_items' => 'array',
        'meta_json' => 'array',
        'discount_ends_at' => 'datetime',
        'published_at' => 'datetime',
        'audience_type_id' => 'integer',
        'preview_duration_seconds' => 'integer',
        'price_amount' => 'integer',
        'sale_price_amount' => 'integer',
        'manual_students_count' => 'integer',
        'purchased_students_count' => 'integer',
        'reviews_count' => 'integer',
        'rating_average' => 'decimal:2',
        'is_active' => 'boolean',
        'is_published' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::saving(function (self $course): void {
            if (blank($course->slug) && filled($course->title)) {
                $course->slug = Str::slug($course->title).'-'.Str::lower(Str::random(5));
            }
        });
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_user_id');
    }

    public function audienceType(): BelongsTo
    {
        return $this->belongsTo(AudienceType::class, 'audience_type_id');
    }

    public function sections(): HasMany
    {
        return $this->hasMany(SpecializedCourseSection::class)->orderBy('sort_order')->orderBy('id');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(SpecializedCourseOrder::class)->latest();
    }

    public function categoryAssignment(): HasOne
    {
        return $this->hasOne(SpecializedCourseCategoryAssignment::class);
    }

    public function category(): HasOneThrough
    {
        return $this->hasOneThrough(
            SpecializedCourseCategory::class,
            SpecializedCourseCategoryAssignment::class,
            'specialized_course_id',
            'id',
            'id',
            'specialized_course_category_id'
        );
    }

    public function payableAmount(): int
    {
        return (int) ($this->sale_price_amount ?: $this->price_amount);
    }

    public function studentsCount(): int
    {
        return (int) $this->manual_students_count + (int) $this->purchased_students_count;
    }

    public function coverImageUrl(): ?string
    {
        return filled($this->cover_image_path) ? Storage::disk('public')->url($this->cover_image_path) : null;
    }

    public function heroImageUrl(): ?string
    {
        return filled($this->hero_image_path) ? Storage::disk('public')->url($this->hero_image_path) : null;
    }
}
