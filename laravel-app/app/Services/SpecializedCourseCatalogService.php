<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\AudienceType;
use App\Domain\Tenant\Models\DiscountCode;
use App\Domain\Tenant\Models\Tenant;
use App\Models\SpecializedCourse;
use App\Models\SpecializedCourseCategory;
use App\Models\SpecializedCourseOrder;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class SpecializedCourseCatalogService
{
    public function home(Tenant $tenant, object $actor, ?string $discountCode = null): array
    {
        /** @var AudienceType|null $audience */
        $audience = $tenant->audienceType;
        abort_unless($audience !== null, 404);

        $settings = \App\Support\AudienceSpecializedCourseSettings::normalize(
            $audience->specialized_course_settings,
            $audience->slug,
        );

        if (! (bool) ($settings['enabled'] ?? false)) {
            return [
                'usesDemoFallback' => false,
                'discountContext' => null,
                'settings' => $settings,
                'categories' => [],
                'courses' => [],
                'sections' => [],
                'purchasedCourses' => [],
            ];
        }

        $discountContext = $this->resolveDiscountContext($discountCode, $audience);
        $teacherId = (bool) ($discountContext['restrictToTeacherCourses'] ?? false)
            ? (int) ($discountContext['connectedTeacherUserId'] ?? 0)
            : null;

        $courses = $this->visibleCourses($audience, $teacherId);
        $settings = $this->hydrateSettings($settings, $courses);
        $categories = $this->categories($audience, $courses);
        $sectionMaps = $this->sectionCourseIds($courses, $settings['sections'] ?? []);
        $serializedCourses = $courses
            ->map(fn (SpecializedCourse $course): array => $this->serializeCourseCard(
                $course,
                $sectionMaps['course_sections'][$course->id] ?? [],
            ))
            ->values();

        return [
            'usesDemoFallback' => $serializedCourses->isEmpty(),
            'discountContext' => $discountContext,
            'settings' => $settings,
            'categories' => $categories->values()->all(),
            'courses' => $serializedCourses->all(),
            'sections' => collect($settings['sections'] ?? [])
                ->filter(fn (array $section): bool => (bool) ($section['enabled'] ?? false))
                ->map(fn (array $section): array => [
                    'id' => (string) ($section['id'] ?? ''),
                    'title' => (string) ($section['title'] ?? ''),
                    'description' => (string) ($section['description'] ?? ''),
                    'courseIds' => array_values($sectionMaps['sections'][$section['id']] ?? []),
                ])
                ->values()
                ->all(),
            'purchasedCourses' => $this->purchasedCourses($tenant, $actor, $teacherId)->all(),
        ];
    }

    private function hydrateSettings(array $settings, Collection $courses): array
    {
        $coursesById = $courses->keyBy(fn (SpecializedCourse $course): int => (int) $course->id);
        $settings['carousel']['slides'] = collect($settings['carousel']['slides'] ?? [])
            ->map(function (array $slide) use ($coursesById): array {
                $courseId = isset($slide['course_id']) && is_numeric($slide['course_id'])
                    ? (int) $slide['course_id']
                    : null;
                /** @var SpecializedCourse|null $course */
                $course = $courseId !== null ? $coursesById->get($courseId) : null;

                $imageUrl = trim((string) ($slide['image_url'] ?? ''));
                $imagePosition = trim((string) ($slide['image_position'] ?? 'center center'));

                if ($course) {
                    $slide['course_id'] = $courseId;
                    $slide['eyebrow'] = trim((string) ($slide['eyebrow'] ?? '')) !== ''
                        ? (string) $slide['eyebrow']
                        : (string) ($course->category?->name ?? 'دوره منتخب');
                    $slide['title'] = trim((string) ($slide['title'] ?? '')) !== ''
                        ? (string) $slide['title']
                        : (string) $course->title;
                    $slide['description'] = trim((string) ($slide['description'] ?? '')) !== ''
                        ? (string) $slide['description']
                        : $this->courseSlideDescription($course);
                    $slide['cta'] = trim((string) ($slide['cta'] ?? '')) !== ''
                        ? (string) $slide['cta']
                        : 'مشاهده دوره';
                    $slide['stat'] = trim((string) ($slide['stat'] ?? '')) !== ''
                        ? (string) $slide['stat']
                        : $this->courseSlideStat($course);
                    $slide['image_url'] = $imageUrl !== ''
                        ? $imageUrl
                        : (string) ($course->heroImageUrl() ?? $course->coverImageUrl() ?? '');
                    $slide['image_position'] = $imagePosition !== ''
                        ? $imagePosition
                        : (string) ($course->meta_json['image_position'] ?? 'center center');
                    $slide['linked_course_id'] = (string) $course->id;

                    return $slide;
                }

                $slide['image_url'] = $imageUrl;
                $slide['image_position'] = $imagePosition !== '' ? $imagePosition : 'center center';
                $slide['linked_course_id'] = null;

                return $slide;
            })
            ->filter(fn (array $slide): bool => trim((string) ($slide['title'] ?? '')) !== '' || ! empty($slide['linked_course_id']))
            ->values()
            ->all();

        return $settings;
    }

    private function visibleCourses(AudienceType $audience, ?int $teacherId = null): Collection
    {
        return SpecializedCourse::query()
            ->with([
                'teacher:id,name',
                'category:id,name,slug,description,audience_type_id',
                'sections' => fn ($query) => $query
                    ->where('is_active', true)
                    ->with(['lessons' => fn ($lessonQuery) => $lessonQuery->where('is_active', true)]),
            ])
            ->where('is_active', true)
            ->where('is_published', true)
            ->where(function ($query) use ($audience): void {
                $query->where('audience_type_id', $audience->id)
                    ->orWhere(function ($fallbackQuery) use ($audience): void {
                        $fallbackQuery->whereNull('audience_type_id')
                            ->whereHas('category', fn ($categoryQuery) => $categoryQuery->where('audience_type_id', $audience->id));
                    });
            })
            ->when($teacherId !== null && $teacherId > 0, fn ($query) => $query->where('teacher_user_id', $teacherId))
            ->orderBy('sort_order')
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->get();
    }

    private function categories(AudienceType $audience, Collection $courses): Collection
    {
        $courseCounts = $courses
            ->filter(fn (SpecializedCourse $course): bool => $course->category !== null)
            ->countBy(fn (SpecializedCourse $course): int => (int) $course->category->id);

        return SpecializedCourseCategory::query()
            ->where('is_active', true)
            ->where('audience_type_id', $audience->id)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn (SpecializedCourseCategory $category): array => [
                'id' => (string) $category->id,
                'slug' => $category->slug,
                'title' => $category->name,
                'subtitle' => trim((string) $category->description) !== ''
                    ? trim((string) $category->description)
                    : 'مسیر تخصصی ' . $category->name,
                'courseCount' => (int) ($courseCounts[(int) $category->id] ?? 0),
            ]);
    }

    private function sectionCourseIds(Collection $courses, array $sections): array
    {
        $courseSections = [];
        $sectionCourseIds = [];
        $coursesByPopularity = $courses
            ->sortByDesc(fn (SpecializedCourse $course) => [
                $course->studentsCount(),
                (float) $course->rating_average,
                (int) $course->reviews_count,
                -(int) $course->sort_order,
                optional($course->published_at)->timestamp ?? 0,
                (int) $course->id,
            ])
            ->values();
        $featuredIds = $coursesByPopularity->take(6)->pluck('id')->map(fn ($id) => (int) $id)->all();
        $latestIds = $courses
            ->sortByDesc(fn (SpecializedCourse $course) => optional($course->published_at)->timestamp ?? $course->created_at?->timestamp ?? 0)
            ->take(6)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        foreach ($sections as $section) {
            $sectionId = (string) ($section['id'] ?? '');
            if ($sectionId === '' || ! ($section['enabled'] ?? true)) {
                continue;
            }

            if ($sectionId === 'featured') {
                $sectionCourseIds[$sectionId] = $featuredIds;
                continue;
            }

            if ($sectionId === 'latest') {
                $sectionCourseIds[$sectionId] = $latestIds;
                continue;
            }

            $sectionCourseIds[$sectionId] = $courses
                ->filter(fn (SpecializedCourse $course): bool => $this->courseMatchesSection($course, $sectionId))
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->values()
                ->all();
        }

        foreach ($courses as $course) {
            $ids = [];
            foreach ($sectionCourseIds as $sectionId => $items) {
                if (in_array((int) $course->id, $items, true)) {
                    $ids[] = $sectionId;
                }
            }

            $courseSections[(int) $course->id] = $ids;
        }

        return [
            'sections' => $sectionCourseIds,
            'course_sections' => $courseSections,
        ];
    }

    private function courseMatchesSection(SpecializedCourse $course, string $sectionId): bool
    {
        $configuredSections = collect($course->meta_json['home_section_ids'] ?? [])
            ->map(fn ($item) => trim((string) $item))
            ->filter()
            ->values()
            ->all();

        if (in_array($sectionId, $configuredSections, true)) {
            return true;
        }

        $categorySlug = Str::lower((string) ($course->category?->slug ?? ''));
        if ($categorySlug === '') {
            return false;
        }

        $sectionTokens = collect(explode('-', Str::lower($sectionId)))
            ->filter(fn ($token): bool => $token !== '' && $token !== 'focus')
            ->values();
        $categoryTokens = collect(explode('-', $categorySlug))
            ->filter()
            ->values();

        return $sectionTokens->intersect($categoryTokens)->isNotEmpty();
    }

    private function serializeCourseCard(SpecializedCourse $course, array $sectionIds): array
    {
        $lessonDuration = (int) $course->sections
            ->flatMap(fn ($section) => $section->lessons)
            ->sum(fn ($lesson) => (int) ($lesson->duration_seconds ?? 0));

        return [
            'id' => (string) $course->id,
            'title' => $course->title,
            'instructor' => $course->teacher?->name ?? 'مدرس دوره',
            'students' => $course->studentsCount(),
            'duration' => $this->formatDuration($lessonDuration),
            'rating' => (float) $course->rating_average,
            'reviews' => (int) $course->reviews_count,
            'price' => $course->payableAmount(),
            'previousPrice' => $course->sale_price_amount ? (int) $course->price_amount : null,
            'badge' => $course->meta_json['badge'] ?? null,
            'categoryId' => $course->category?->slug ?? 'all',
            'sectionIds' => $sectionIds,
            'imageUrl' => $course->coverImageUrl() ?? $course->heroImageUrl() ?? '',
            'imagePosition' => (string) ($course->meta_json['image_position'] ?? 'center center'),
            'imageAccent' => (string) ($course->category?->name ?? 'دوره تخصصی'),
        ];
    }

    private function purchasedCourses(Tenant $tenant, object $actor, ?int $teacherId = null): Collection
    {
        $orders = SpecializedCourseOrder::query()
            ->with(['course.sections.lessons', 'course.teacher'])
            ->where('status', 'paid')
            ->where('tenant_id', (string) $tenant->id)
            ->where('tenant_user_id', (int) ($actor->id ?? 0))
            ->when($teacherId !== null && $teacherId > 0, fn ($query) => $query->where('teacher_user_id', $teacherId))
            ->latest('paid_at')
            ->limit(6)
            ->get();

        return $orders
            ->filter(fn (SpecializedCourseOrder $order): bool => $order->course !== null)
            ->map(function (SpecializedCourseOrder $order): array {
                $course = $order->course;
                $firstLesson = $course->sections
                    ->flatMap(fn ($section) => $section->lessons)
                    ->first();

                return [
                    'id' => (string) $course->id,
                    'title' => $course->title,
                    'progress' => (int) ($order->meta_json['progress_percent'] ?? 0),
                    'nextLesson' => $firstLesson?->title ?? 'شروع دوره',
                    'teacherName' => $course->teacher?->name,
                ];
            })
            ->values();
    }

    private function resolveDiscountContext(?string $rawCode, AudienceType $audience): ?array
    {
        $code = Str::upper(trim((string) $rawCode));
        if ($code === '') {
            return null;
        }

        /** @var DiscountCode|null $discount */
        $discount = DiscountCode::query()
            ->with('salesUser')
            ->whereRaw('UPPER(code) = ?', [$code])
            ->first();

        if (! $discount || ! $discount->is_active) {
            return null;
        }

        if ($discount->audience_type_id !== null && (int) $discount->audience_type_id !== (int) $audience->id) {
            return null;
        }

        if ($discount->starts_at && now()->lt($discount->starts_at)) {
            return null;
        }

        if ($discount->ends_at && now()->gt($discount->ends_at)) {
            return null;
        }

        return [
            'code' => $discount->code,
            'title' => $discount->title,
            'salesUserId' => $discount->sales_user_id !== null ? (string) $discount->sales_user_id : null,
            'salesUserName' => $discount->salesUser?->name,
            'salesUserRole' => $discount->salesUser?->role,
            'connectedTeacherUserId' => $discount->connectedTeacherId(),
            'restrictToTeacherCourses' => $discount->restrictToTeacherCourses(),
        ];
    }

    private function formatDuration(int $seconds): string
    {
        if ($seconds <= 0) {
            return '۰ دقیقه';
        }

        $minutes = (int) ceil($seconds / 60);
        if ($minutes < 60) {
            return $minutes . ' دقیقه';
        }

        $hours = intdiv($minutes, 60);
        $remainingMinutes = $minutes % 60;

        if ($remainingMinutes === 0) {
            return $hours . ' ساعت';
        }

        return $hours . ' ساعت و ' . $remainingMinutes . ' دقیقه';
    }

    private function courseSlideDescription(SpecializedCourse $course): string
    {
        $candidates = [
            $course->excerpt,
            $course->subtitle,
            $course->description,
        ];

        foreach ($candidates as $candidate) {
            $text = trim((string) $candidate);
            if ($text !== '') {
                return Str::limit(strip_tags($text), 180);
            }
        }

        return 'این دوره برای همین طیف فعال شده و اطلاعات آن به‌صورت مستقیم از دیتابیس نمایش داده می‌شود.';
    }

    private function courseSlideStat(SpecializedCourse $course): string
    {
        $duration = (int) $course->sections
            ->flatMap(fn ($section) => $section->lessons)
            ->sum(fn ($lesson) => (int) ($lesson->duration_seconds ?? 0));

        if ($duration > 0) {
            return $this->formatDuration($duration);
        }

        $students = $course->studentsCount();
        if ($students > 0) {
            return $students . ' هنرجو';
        }

        return 'دوره فعال';
    }
}
