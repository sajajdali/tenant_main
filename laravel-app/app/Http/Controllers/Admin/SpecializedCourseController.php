<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Tenant\Models\AudienceType;
use App\Http\Controllers\Controller;
use App\Models\SpecializedCourse;
use App\Models\SpecializedCourseCategory;
use App\Models\SpecializedCourseSection;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class SpecializedCourseController extends Controller
{
    public function index(): View
    {
        $actor = auth()->user();
        abort_unless($actor && in_array($actor->role, ['admin', 'teacher'], true), 403);

        $courses = SpecializedCourse::query()
            ->with(['teacher:id,name,mobile', 'category', 'audienceType:id,name'])
            ->withCount(['sections', 'orders'])
            ->when($actor->role === 'teacher', fn ($query) => $query->where('teacher_user_id', $actor->id))
            ->latest('id')
            ->paginate(12);

        return view('admin.specialized-courses.index', [
            'courses' => $courses,
            'isTeacher' => $actor->role === 'teacher',
        ]);
    }

    public function create(): View
    {
        $actor = auth()->user();
        abort_unless($actor && in_array($actor->role, ['admin', 'teacher'], true), 403);

        return view('admin.specialized-courses.form', [
            'course' => new SpecializedCourse([
                'teacher_user_id' => $actor->role === 'teacher' ? $actor->id : null,
                'is_active' => true,
                'is_published' => false,
            ]),
            'audiences' => $this->audienceOptions(),
            'categories' => SpecializedCourseCategory::query()->with('audienceType:id,name')->where('is_active', true)->orderBy('sort_order')->orderBy('name')->get(),
            'teachers' => $this->teacherOptions($actor),
            'isEdit' => false,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $actor = auth()->user();
        abort_unless($actor && in_array($actor->role, ['admin', 'teacher'], true), 403);

        $payload = $this->validatePayload($request, null, $actor);

        DB::connection('central')->transaction(function () use ($request, $payload): void {
            $course = SpecializedCourse::query()->create($payload['course']);
            if ($payload['category_id']) {
                $course->categoryAssignment()->updateOrCreate([], [
                    'specialized_course_category_id' => $payload['category_id'],
                ]);
            }
            $this->syncCourseContent($request, $course, $payload['sections']);
        });

        return redirect()->route('admin.specialized-courses.index')->with('success', 'دوره با موفقیت ذخیره شد.');
    }

    public function edit(SpecializedCourse $specializedCourse): View
    {
        $actor = auth()->user();
        abort_unless($actor && in_array($actor->role, ['admin', 'teacher'], true), 403);
        abort_if($actor->role === 'teacher' && (int) $specializedCourse->teacher_user_id !== (int) $actor->id, 403);

        return view('admin.specialized-courses.form', [
            'course' => $specializedCourse->load(['sections.lessons', 'teacher', 'categoryAssignment', 'audienceType']),
            'audiences' => $this->audienceOptions(),
            'categories' => SpecializedCourseCategory::query()->with('audienceType:id,name')->where('is_active', true)->orderBy('sort_order')->orderBy('name')->get(),
            'teachers' => $this->teacherOptions($actor),
            'isEdit' => true,
        ]);
    }

    public function update(Request $request, SpecializedCourse $specializedCourse): RedirectResponse
    {
        $actor = auth()->user();
        abort_unless($actor && in_array($actor->role, ['admin', 'teacher'], true), 403);
        abort_if($actor->role === 'teacher' && (int) $specializedCourse->teacher_user_id !== (int) $actor->id, 403);

        $payload = $this->validatePayload($request, $specializedCourse, $actor);

        DB::connection('central')->transaction(function () use ($request, $specializedCourse, $payload): void {
            $specializedCourse->update($payload['course']);
            if ($payload['category_id']) {
                $specializedCourse->categoryAssignment()->updateOrCreate([], [
                    'specialized_course_category_id' => $payload['category_id'],
                ]);
            } else {
                $specializedCourse->categoryAssignment()?->delete();
            }
            $specializedCourse->sections()->delete();
            $this->syncCourseContent($request, $specializedCourse, $payload['sections']);
        });

        return redirect()->route('admin.specialized-courses.index')->with('success', 'دوره با موفقیت به‌روزرسانی شد.');
    }

    public function destroy(SpecializedCourse $specializedCourse): RedirectResponse
    {
        $actor = auth()->user();
        abort_unless($actor && in_array($actor->role, ['admin', 'teacher'], true), 403);
        abort_if($actor->role === 'teacher' && (int) $specializedCourse->teacher_user_id !== (int) $actor->id, 403);

        $specializedCourse->delete();

        return redirect()->route('admin.specialized-courses.index')->with('success', 'دوره حذف شد.');
    }

    private function validatePayload(Request $request, ?SpecializedCourse $course, User $actor): array
    {
        $validated = $request->validate([
            'teacher_user_id' => [
                Rule::requiredIf($actor->role === 'admin'),
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', 'teacher')),
            ],
            'audience_type_id' => ['required', 'integer', 'exists:audience_types,id'],
            'specialized_course_category_id' => ['nullable', 'integer', 'exists:specialized_course_categories,id'],
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', Rule::unique('specialized_courses', 'slug')->ignore($course?->id)],
            'subtitle' => ['nullable', 'string', 'max:255'],
            'excerpt' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'about' => ['nullable', 'string'],
            'learning_points_text' => ['nullable', 'string'],
            'requirements_text' => ['nullable', 'string'],
            'faq_text' => ['nullable', 'string'],
            'price_amount' => ['required', 'integer', 'min:0'],
            'sale_price_amount' => ['nullable', 'integer', 'min:0'],
            'discount_ends_at' => ['nullable', 'date'],
            'manual_students_count' => ['nullable', 'integer', 'min:0'],
            'reviews_count' => ['nullable', 'integer', 'min:0'],
            'rating_average' => ['nullable', 'numeric', 'min:0', 'max:5'],
            'preview_duration_seconds' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'is_published' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'cover_image' => ['nullable', 'image', 'max:8192'],
            'hero_image' => ['nullable', 'image', 'max:8192'],
            'preview_video' => ['nullable', 'file', 'max:256000'],
            'sections' => ['nullable', 'array'],
            'sections.*.title' => ['required', 'string', 'max:255'],
            'sections.*.description' => ['nullable', 'string'],
            'sections.*.is_active' => ['nullable', 'boolean'],
            'sections.*.lessons' => ['nullable', 'array'],
            'sections.*.lessons.*.title' => ['required', 'string', 'max:255'],
            'sections.*.lessons.*.description' => ['nullable', 'string'],
            'sections.*.lessons.*.duration_seconds' => ['nullable', 'integer', 'min:0'],
            'sections.*.lessons.*.duration_label' => ['nullable', 'string', 'max:50'],
            'sections.*.lessons.*.is_free' => ['nullable', 'boolean'],
            'sections.*.lessons.*.is_active' => ['nullable', 'boolean'],
            'sections.*.lessons.*.video' => ['nullable', 'file', 'max:512000'],
        ]);

        $teacherId = $actor->role === 'teacher'
            ? (int) $actor->id
            : (int) ($validated['teacher_user_id'] ?? 0);
        $audienceTypeId = (int) $validated['audience_type_id'];
        $categoryId = filled($validated['specialized_course_category_id'] ?? null) ? (int) $validated['specialized_course_category_id'] : null;

        if ($categoryId) {
            $categoryMatchesAudience = SpecializedCourseCategory::query()
                ->whereKey($categoryId)
                ->where('audience_type_id', $audienceTypeId)
                ->exists();

            if (! $categoryMatchesAudience) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'specialized_course_category_id' => 'گروه‌بندی انتخاب‌شده باید مربوط به همان طیف دوره باشد.',
                ]);
            }
        }

        $coursePayload = [
            'teacher_user_id' => $teacherId ?: null,
            'audience_type_id' => $audienceTypeId,
            'title' => $validated['title'],
            'slug' => filled($validated['slug'] ?? null) ? Str::slug((string) $validated['slug']) : Str::slug($validated['title']),
            'subtitle' => $validated['subtitle'] ?? null,
            'excerpt' => $validated['excerpt'] ?? null,
            'description' => $validated['description'] ?? null,
            'about' => $validated['about'] ?? null,
            'learning_points' => $this->splitLines($validated['learning_points_text'] ?? null),
            'requirements' => $this->splitLines($validated['requirements_text'] ?? null),
            'faq_items' => $this->parseFaq($validated['faq_text'] ?? null),
            'price_amount' => (int) $validated['price_amount'],
            'sale_price_amount' => filled($validated['sale_price_amount'] ?? null) ? (int) $validated['sale_price_amount'] : null,
            'discount_ends_at' => $validated['discount_ends_at'] ?? null,
            'manual_students_count' => (int) ($validated['manual_students_count'] ?? 0),
            'reviews_count' => (int) ($validated['reviews_count'] ?? 0),
            'rating_average' => (float) ($validated['rating_average'] ?? 0),
            'preview_duration_seconds' => filled($validated['preview_duration_seconds'] ?? null) ? (int) $validated['preview_duration_seconds'] : null,
            'is_active' => (bool) ($validated['is_active'] ?? false),
            'is_published' => (bool) ($validated['is_published'] ?? false),
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
            'published_at' => ($validated['is_published'] ?? false) ? ($course?->published_at ?? now()) : null,
        ];

        if ($request->hasFile('cover_image')) {
            $coursePayload['cover_image_path'] = $request->file('cover_image')->store('specialized-courses/covers', 'public');
        } elseif ($course) {
            $coursePayload['cover_image_path'] = $course->cover_image_path;
        }

        if ($request->hasFile('hero_image')) {
            $coursePayload['hero_image_path'] = $request->file('hero_image')->store('specialized-courses/heroes', 'public');
        } elseif ($course) {
            $coursePayload['hero_image_path'] = $course->hero_image_path;
        }

        if ($request->hasFile('preview_video')) {
            $coursePayload['preview_video_path'] = $request->file('preview_video')->store('specialized-courses/previews', 'public');
        } elseif ($course) {
            $coursePayload['preview_video_path'] = $course->preview_video_path;
        }

        $sections = collect($validated['sections'] ?? [])
            ->map(fn (array $section, int $index) => [
                'title' => $section['title'],
                'description' => $section['description'] ?? null,
                'sort_order' => $index + 1,
                'is_active' => (bool) ($section['is_active'] ?? false),
                'lessons' => collect($section['lessons'] ?? [])->map(fn (array $lesson, int $lessonIndex) => [
                    'title' => $lesson['title'],
                    'description' => $lesson['description'] ?? null,
                    'duration_seconds' => filled($lesson['duration_seconds'] ?? null) ? (int) $lesson['duration_seconds'] : null,
                    'duration_label' => $lesson['duration_label'] ?? null,
                    'is_free' => (bool) ($lesson['is_free'] ?? false),
                    'is_active' => (bool) ($lesson['is_active'] ?? false),
                    'sort_order' => $lessonIndex + 1,
                ])->all(),
            ])
            ->values()
            ->all();

        return [
            'course' => $coursePayload,
            'sections' => $sections,
            'category_id' => $categoryId,
        ];
    }

    private function syncCourseContent(Request $request, SpecializedCourse $course, array $sections): void
    {
        foreach ($sections as $sectionIndex => $sectionPayload) {
            $section = $course->sections()->create(collect($sectionPayload)->except('lessons')->all());

            foreach ($sectionPayload['lessons'] as $lessonIndex => $lessonPayload) {
                if ($request->hasFile("sections.$sectionIndex.lessons.$lessonIndex.video")) {
                    $lessonPayload['video_path'] = $request->file("sections.$sectionIndex.lessons.$lessonIndex.video")->store('specialized-courses/lessons', 'public');
                }

                $section->lessons()->create($lessonPayload);
            }
        }
    }

    private function splitLines(?string $text): array
    {
        return collect(preg_split("/\r\n|\n|\r/", (string) $text) ?: [])
            ->map(fn ($item) => trim((string) $item))
            ->filter()
            ->values()
            ->all();
    }

    private function parseFaq(?string $text): array
    {
        return collect($this->splitLines($text))
            ->map(function (string $item, int $index): array {
                [$question, $answer] = array_pad(explode('|', $item, 2), 2, '');

                return [
                    'id' => 'faq-'.($index + 1),
                    'question' => trim($question),
                    'answer' => trim($answer),
                ];
            })
            ->filter(fn (array $item) => filled($item['question']) && filled($item['answer']))
            ->values()
            ->all();
    }

    private function teacherOptions(User $actor)
    {
        return User::query()
            ->where('role', 'teacher')
            ->with('teacherProfile:user_id,commission_percent')
            ->when($actor->role === 'teacher', fn ($query) => $query->whereKey($actor->id))
            ->orderBy('name')
            ->get(['id', 'name', 'mobile', 'sales_commission_percent']);
    }

    private function audienceOptions()
    {
        return AudienceType::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name']);
    }
}
