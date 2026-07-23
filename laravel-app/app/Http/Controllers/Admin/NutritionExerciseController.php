<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\NutritionExercise;
use App\Models\NutritionExerciseGroup;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class NutritionExerciseController extends Controller
{
    public function index(): View
    {
        return view('admin.nutrition-exercises.index', [
            'groups' => NutritionExerciseGroup::query()
                ->with(['exercises' => fn ($query) => $query->orderBy('sort_order')->orderBy('title')])
                ->orderBy('sort_order')
                ->orderBy('title')
                ->get(),
        ]);
    }

    public function createGroup(): View
    {
        return view('admin.nutrition-exercises.form', [
            'mode' => 'group',
            'item' => new NutritionExerciseGroup([
                'icon_key' => 'Dumbbell',
                'accent_color' => '#f59e0b',
                'soft_color' => '#451a03',
                'sort_order' => 0,
                'is_active' => true,
            ]),
            'groups' => collect(),
            'isEdit' => false,
        ]);
    }

    public function storeGroup(Request $request): RedirectResponse
    {
        NutritionExerciseGroup::query()->create($this->validateGroup($request));

        return redirect()->route('admin.nutrition-exercises.index')->with('success', 'گروه ورزشی ذخیره شد.');
    }

    public function editGroup(NutritionExerciseGroup $group): View
    {
        return view('admin.nutrition-exercises.form', [
            'mode' => 'group',
            'item' => $group,
            'groups' => collect(),
            'isEdit' => true,
        ]);
    }

    public function updateGroup(Request $request, NutritionExerciseGroup $group): RedirectResponse
    {
        $group->update($this->validateGroup($request, $group));

        return redirect()->route('admin.nutrition-exercises.index')->with('success', 'گروه ورزشی به‌روزرسانی شد.');
    }

    public function destroyGroup(NutritionExerciseGroup $group): RedirectResponse
    {
        $group->delete();

        return redirect()->route('admin.nutrition-exercises.index')->with('success', 'گروه ورزشی حذف شد.');
    }

    public function createExercise(): View
    {
        return view('admin.nutrition-exercises.form', [
            'mode' => 'exercise',
            'item' => new NutritionExercise([
                'icon_key' => 'Activity',
                'default_intensity' => 'moderate',
                'sort_order' => 0,
                'supports_intensity' => true,
                'supports_distance' => false,
                'supports_speed' => false,
                'is_active' => true,
            ]),
            'groups' => NutritionExerciseGroup::query()->orderBy('sort_order')->orderBy('title')->get(),
            'isEdit' => false,
        ]);
    }

    public function storeExercise(Request $request): RedirectResponse
    {
        NutritionExercise::query()->create($this->validateExercise($request));

        return redirect()->route('admin.nutrition-exercises.index')->with('success', 'فعالیت ورزشی ذخیره شد.');
    }

    public function editExercise(NutritionExercise $exercise): View
    {
        return view('admin.nutrition-exercises.form', [
            'mode' => 'exercise',
            'item' => $exercise,
            'groups' => NutritionExerciseGroup::query()->orderBy('sort_order')->orderBy('title')->get(),
            'isEdit' => true,
        ]);
    }

    public function updateExercise(Request $request, NutritionExercise $exercise): RedirectResponse
    {
        $exercise->update($this->validateExercise($request, $exercise));

        return redirect()->route('admin.nutrition-exercises.index')->with('success', 'فعالیت ورزشی به‌روزرسانی شد.');
    }

    public function destroyExercise(NutritionExercise $exercise): RedirectResponse
    {
        $exercise->delete();

        return redirect()->route('admin.nutrition-exercises.index')->with('success', 'فعالیت ورزشی حذف شد.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validateGroup(Request $request, ?NutritionExerciseGroup $group = null): array
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:120', 'alpha_dash', Rule::unique(NutritionExerciseGroup::class, 'slug')->ignore($group?->id)],
            'description' => ['nullable', 'string'],
            'icon_key' => ['nullable', 'string', 'max:64'],
            'accent_color' => ['nullable', 'string', 'max:16'],
            'soft_color' => ['nullable', 'string', 'max:16'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return [
            'title' => trim((string) $validated['title']),
            'slug' => trim((string) $validated['slug']),
            'description' => trim((string) ($validated['description'] ?? '')) ?: null,
            'icon_key' => trim((string) ($validated['icon_key'] ?? 'Dumbbell')) ?: 'Dumbbell',
            'accent_color' => trim((string) ($validated['accent_color'] ?? '#f59e0b')) ?: '#f59e0b',
            'soft_color' => trim((string) ($validated['soft_color'] ?? '#451a03')) ?: '#451a03',
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
            'is_active' => (bool) ($validated['is_active'] ?? false),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function validateExercise(Request $request, ?NutritionExercise $exercise = null): array
    {
        $validated = $request->validate([
            'nutrition_exercise_group_id' => ['required', Rule::exists(NutritionExerciseGroup::class, 'id')],
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:120', 'alpha_dash', Rule::unique(NutritionExercise::class, 'slug')->ignore($exercise?->id)],
            'description' => ['nullable', 'string'],
            'icon_key' => ['nullable', 'string', 'max:64'],
            'badge_text' => ['nullable', 'string', 'max:120'],
            'search_terms' => ['nullable', 'string'],
            'supports_intensity' => ['nullable', 'boolean'],
            'supports_distance' => ['nullable', 'boolean'],
            'supports_speed' => ['nullable', 'boolean'],
            'default_intensity' => ['nullable', 'in:light,moderate,vigorous'],
            'met_light' => ['nullable', 'numeric', 'min:1', 'max:30'],
            'met_moderate' => ['nullable', 'numeric', 'min:1', 'max:30'],
            'met_vigorous' => ['nullable', 'numeric', 'min:1', 'max:30'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return [
            'nutrition_exercise_group_id' => (int) $validated['nutrition_exercise_group_id'],
            'title' => trim((string) $validated['title']),
            'slug' => trim((string) $validated['slug']),
            'description' => trim((string) ($validated['description'] ?? '')) ?: null,
            'icon_key' => trim((string) ($validated['icon_key'] ?? 'Activity')) ?: 'Activity',
            'badge_text' => trim((string) ($validated['badge_text'] ?? '')) ?: null,
            'search_terms' => trim((string) ($validated['search_terms'] ?? '')) ?: null,
            'supports_intensity' => (bool) ($validated['supports_intensity'] ?? false),
            'supports_distance' => (bool) ($validated['supports_distance'] ?? false),
            'supports_speed' => (bool) ($validated['supports_speed'] ?? false),
            'default_intensity' => (string) ($validated['default_intensity'] ?? 'moderate'),
            'met_light' => isset($validated['met_light']) ? (float) $validated['met_light'] : null,
            'met_moderate' => isset($validated['met_moderate']) ? (float) $validated['met_moderate'] : null,
            'met_vigorous' => isset($validated['met_vigorous']) ? (float) $validated['met_vigorous'] : null,
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
            'is_active' => (bool) ($validated['is_active'] ?? false),
        ];
    }
}
