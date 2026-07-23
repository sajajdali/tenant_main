<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Tenant\Models\AudienceType;
use App\Http\Controllers\Controller;
use App\Models\SpecializedCourseCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\View\View;

class SpecializedCourseCategoryController extends Controller
{
    public function index(): View
    {
        abort_unless(auth()->user()?->role === 'admin', 403);

        return view('admin.specialized-course-categories.index', [
            'categories' => SpecializedCourseCategory::query()
                ->with('audienceType:id,name')
                ->withCount('assignments')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->paginate(15),
        ]);
    }

    public function create(): View
    {
        abort_unless(auth()->user()?->role === 'admin', 403);

        return view('admin.specialized-course-categories.form', [
            'category' => new SpecializedCourseCategory(['is_active' => true]),
            'audiences' => AudienceType::query()->where('is_active', true)->orderBy('sort_order')->orderBy('name')->get(['id', 'name']),
            'isEdit' => false,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless(auth()->user()?->role === 'admin', 403);

        SpecializedCourseCategory::query()->create($this->validatePayload($request));

        return redirect()->route('admin.specialized-course-categories.index')->with('success', 'گروه‌بندی دوره ذخیره شد.');
    }

    public function edit(SpecializedCourseCategory $specializedCourseCategory): View
    {
        abort_unless(auth()->user()?->role === 'admin', 403);

        return view('admin.specialized-course-categories.form', [
            'category' => $specializedCourseCategory,
            'audiences' => AudienceType::query()->where('is_active', true)->orderBy('sort_order')->orderBy('name')->get(['id', 'name']),
            'isEdit' => true,
        ]);
    }

    public function update(Request $request, SpecializedCourseCategory $specializedCourseCategory): RedirectResponse
    {
        abort_unless(auth()->user()?->role === 'admin', 403);

        $specializedCourseCategory->update($this->validatePayload($request, $specializedCourseCategory));

        return redirect()->route('admin.specialized-course-categories.index')->with('success', 'گروه‌بندی دوره به‌روزرسانی شد.');
    }

    public function destroy(SpecializedCourseCategory $specializedCourseCategory): RedirectResponse
    {
        abort_unless(auth()->user()?->role === 'admin', 403);

        $specializedCourseCategory->delete();

        return redirect()->route('admin.specialized-course-categories.index')->with('success', 'گروه‌بندی دوره حذف شد.');
    }

    private function validatePayload(Request $request, ?SpecializedCourseCategory $category = null): array
    {
        $validated = $request->validate([
            'audience_type_id' => ['required', 'integer', 'exists:audience_types,id'],
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:specialized_course_categories,slug,' . ($category?->id ?? 'NULL') . ',id'],
            'description' => ['nullable', 'string', 'max:500'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return [
            'audience_type_id' => (int) $validated['audience_type_id'],
            'name' => $validated['name'],
            'slug' => filled($validated['slug'] ?? null) ? Str::slug((string) $validated['slug']) : Str::slug($validated['name']),
            'description' => $validated['description'] ?? null,
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
            'is_active' => (bool) ($validated['is_active'] ?? false),
        ];
    }
}
