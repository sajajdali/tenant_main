<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Tenant\Models\AudienceType;
use App\Http\Controllers\Controller;
use App\Models\SpecializedCourse;
use App\Support\AudienceSpecializedCourseSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SpecializedCourseSettingsController extends Controller
{
    public function index(): View
    {
        abort_unless(auth()->user()?->role === 'admin', 403);

        return view('admin.specialized-course-settings.index', [
            'audiences' => AudienceType::query()
                ->orderByDesc('is_active')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function edit(AudienceType $audienceType): View
    {
        abort_unless(auth()->user()?->role === 'admin', 403);

        return view('admin.specialized-course-settings.edit', [
            'audience' => $audienceType,
            'audiences' => AudienceType::query()
                ->orderByDesc('is_active')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name', 'slug', 'is_active']),
            'availableCourses' => SpecializedCourse::query()
                ->with(['teacher:id,name', 'category:id,name'])
                ->where(function ($query) use ($audienceType): void {
                    $query->where('audience_type_id', $audienceType->id)
                        ->orWhere(function ($fallbackQuery) use ($audienceType): void {
                            $fallbackQuery->whereNull('audience_type_id')
                                ->whereHas('category', fn ($categoryQuery) => $categoryQuery->where('audience_type_id', $audienceType->id));
                        });
                })
                ->orderByDesc('is_published')
                ->orderBy('sort_order')
                ->orderBy('title')
                ->get(['id', 'title', 'teacher_user_id', 'audience_type_id', 'is_published']),
            'specializedCourseSettings' => AudienceSpecializedCourseSettings::normalize(
                $audienceType->specialized_course_settings,
                $audienceType->slug,
            ),
            'isStandalonePage' => true,
        ]);
    }

    public function update(Request $request, AudienceType $audienceType): RedirectResponse
    {
        abort_unless(auth()->user()?->role === 'admin', 403);

        $validated = $request->validate([
            'specialized_course_settings' => ['nullable', 'array'],
        ]);

        $audienceType->update([
            'specialized_course_settings' => AudienceSpecializedCourseSettings::normalize(
                $validated['specialized_course_settings'] ?? [],
                $audienceType->slug,
            ),
        ]);

        return redirect()
            ->route('admin.specialized-course-settings.edit', $audienceType)
            ->with('success', 'تنظیمات دوره‌های تخصصی برای این طیف ذخیره شد.');
    }
}
