<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\NutritionExercise;
use App\Models\NutritionExerciseGroup;
use App\Models\TenantNutritionExercise;
use App\Models\TenantNutritionExerciseGroup;
use App\Services\TenantNutritionExerciseLibraryService;
use App\Support\TenantAudienceScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class NutritionExerciseAdminController extends Controller
{
    public function __construct(
        private readonly TenantNutritionExerciseLibraryService $library,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        return response()->json([
            'success' => true,
            'data' => [
                'groups' => $this->library->adminGroups(),
            ],
        ]);
    }

    public function storeGroup(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);
        $this->ensureGroupOverrideTableAvailable();

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:120', 'alpha_dash', Rule::unique('tenant_nutrition_exercise_groups', 'slug')],
            'description' => ['nullable', 'string'],
            'icon_key' => ['nullable', 'string', 'max:64'],
            'accent_color' => ['nullable', 'string', 'max:16'],
            'soft_color' => ['nullable', 'string', 'max:16'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $group = TenantNutritionExerciseGroup::query()->create([
            'central_group_id' => null,
            'title' => trim((string) $validated['title']),
            'slug' => trim((string) $validated['slug']),
            'description' => $this->nullableTrim($validated['description'] ?? null),
            'icon_key' => trim((string) ($validated['icon_key'] ?? 'Dumbbell')),
            'accent_color' => trim((string) ($validated['accent_color'] ?? '#f59e0b')),
            'soft_color' => trim((string) ($validated['soft_color'] ?? '#451a03')),
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
            'is_active' => (bool) ($validated['is_active'] ?? true),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'گروه ورزشی برای این سایت ذخیره شد.',
            'data' => [
                'group' => $this->library->findAdminGroupReference('tenant-' . $group->id),
            ],
        ]);
    }

    public function updateGroup(Request $request, string $groupId): JsonResponse
    {
        $this->ensureAdmin($request);
        $this->ensureGroupOverrideTableAvailable();

        $reference = $this->library->parseReference($groupId);
        abort_unless($reference, 404, 'گروه ورزشی پیدا نشد.');

        $tenantGroup = $reference['source'] === 'tenant'
            ? TenantNutritionExerciseGroup::query()->findOrFail((int) $reference['id'])
            : TenantNutritionExerciseGroup::query()->firstWhere('central_group_id', (int) $reference['id']);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:120', 'alpha_dash', Rule::unique('tenant_nutrition_exercise_groups', 'slug')->ignore($tenantGroup?->id)],
            'description' => ['nullable', 'string'],
            'icon_key' => ['nullable', 'string', 'max:64'],
            'accent_color' => ['nullable', 'string', 'max:16'],
            'soft_color' => ['nullable', 'string', 'max:16'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if ($reference['source'] === 'tenant') {
            $tenantGroup->update([
                'title' => trim((string) $validated['title']),
                'slug' => trim((string) $validated['slug']),
                'description' => $this->nullableTrim($validated['description'] ?? null),
                'icon_key' => trim((string) ($validated['icon_key'] ?? 'Dumbbell')),
                'accent_color' => trim((string) ($validated['accent_color'] ?? '#f59e0b')),
                'soft_color' => trim((string) ($validated['soft_color'] ?? '#451a03')),
                'sort_order' => (int) ($validated['sort_order'] ?? 0),
                'is_active' => (bool) ($validated['is_active'] ?? true),
            ]);

            $responseReference = 'tenant-' . $tenantGroup->id;
        } else {
            $centralGroup = NutritionExerciseGroup::query()->findOrFail((int) $reference['id']);

            $tenantGroup = TenantNutritionExerciseGroup::query()->updateOrCreate(
                ['central_group_id' => $centralGroup->id],
                [
                    'title' => trim((string) $validated['title']),
                    'slug' => trim((string) $validated['slug']),
                    'description' => $this->nullableTrim($validated['description'] ?? null),
                    'icon_key' => trim((string) ($validated['icon_key'] ?? 'Dumbbell')),
                    'accent_color' => trim((string) ($validated['accent_color'] ?? '#f59e0b')),
                    'soft_color' => trim((string) ($validated['soft_color'] ?? '#451a03')),
                    'sort_order' => (int) ($validated['sort_order'] ?? 0),
                    'is_active' => (bool) ($validated['is_active'] ?? true),
                ],
            );

            $responseReference = 'tenant-' . $tenantGroup->id;
        }

        return response()->json([
            'success' => true,
            'message' => 'گروه ورزشی برای این سایت به‌روزرسانی شد.',
            'data' => [
                'group' => $this->library->findAdminGroupReference($responseReference),
            ],
        ]);
    }

    public function destroyGroup(Request $request, string $groupId): JsonResponse
    {
        $this->ensureAdmin($request);
        $this->ensureGroupOverrideTableAvailable();

        $reference = $this->library->parseReference($groupId);
        abort_unless($reference, 404, 'گروه ورزشی پیدا نشد.');

        if ($reference['source'] === 'tenant') {
            $group = TenantNutritionExerciseGroup::query()->findOrFail((int) $reference['id']);

            if ($group->central_group_id === null) {
                $group->delete();
            } else {
                $group->update(['is_active' => false]);
            }
        } else {
            $centralGroup = NutritionExerciseGroup::query()->findOrFail((int) $reference['id']);

            TenantNutritionExerciseGroup::query()->updateOrCreate(
                ['central_group_id' => $centralGroup->id],
                [
                    'title' => $centralGroup->title,
                    'slug' => $centralGroup->slug,
                    'description' => $centralGroup->description,
                    'icon_key' => $centralGroup->icon_key,
                    'accent_color' => $centralGroup->accent_color,
                    'soft_color' => $centralGroup->soft_color,
                    'sort_order' => (int) ($centralGroup->sort_order ?? 0),
                    'is_active' => false,
                ],
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'گروه برای این سایت مخفی شد.',
        ]);
    }

    public function storeExercise(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);
        $this->ensureExerciseOverrideTablesAvailable();

        $validated = $this->validateExercisePayload($request);
        $groupAssignment = $this->resolveGroupAssignment((string) $validated['group_ref']);

        $exercise = TenantNutritionExercise::query()->create([
            'central_exercise_id' => null,
            'tenant_nutrition_exercise_group_id' => $groupAssignment['tenant_group_id'],
            'central_group_id' => $groupAssignment['central_group_id'],
            'title' => trim((string) $validated['title']),
            'slug' => trim((string) $validated['slug']),
            'description' => $this->nullableTrim($validated['description'] ?? null),
            'icon_key' => trim((string) ($validated['icon_key'] ?? 'Activity')),
            'badge_text' => $this->nullableTrim($validated['badge_text'] ?? null),
            'search_terms' => $this->nullableTrim($validated['search_terms'] ?? null),
            'supports_intensity' => (bool) ($validated['supports_intensity'] ?? true),
            'supports_distance' => (bool) ($validated['supports_distance'] ?? false),
            'supports_speed' => (bool) ($validated['supports_speed'] ?? false),
            'default_intensity' => (string) ($validated['default_intensity'] ?? 'moderate'),
            'met_light' => isset($validated['met_light']) ? (float) $validated['met_light'] : null,
            'met_moderate' => isset($validated['met_moderate']) ? (float) $validated['met_moderate'] : null,
            'met_vigorous' => isset($validated['met_vigorous']) ? (float) $validated['met_vigorous'] : null,
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
            'is_active' => (bool) ($validated['is_active'] ?? true),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'فعالیت ورزشی برای این سایت ذخیره شد.',
            'data' => [
                'exercise' => $this->findAdminExerciseReference('tenant-' . $exercise->id),
            ],
        ]);
    }

    public function updateExercise(Request $request, string $exerciseId): JsonResponse
    {
        $this->ensureAdmin($request);
        $this->ensureExerciseOverrideTablesAvailable();

        $reference = $this->library->parseReference($exerciseId);
        abort_unless($reference, 404, 'فعالیت ورزشی پیدا نشد.');

        $tenantExercise = $reference['source'] === 'tenant'
            ? TenantNutritionExercise::query()->findOrFail((int) $reference['id'])
            : TenantNutritionExercise::query()->firstWhere('central_exercise_id', (int) $reference['id']);

        $validated = $this->validateExercisePayload($request, $tenantExercise?->id);
        $groupAssignment = $this->resolveGroupAssignment((string) $validated['group_ref']);

        if ($reference['source'] === 'tenant') {
            $tenantExercise->update([
                'tenant_nutrition_exercise_group_id' => $groupAssignment['tenant_group_id'],
                'central_group_id' => $groupAssignment['central_group_id'],
                'title' => trim((string) $validated['title']),
                'slug' => trim((string) $validated['slug']),
                'description' => $this->nullableTrim($validated['description'] ?? null),
                'icon_key' => trim((string) ($validated['icon_key'] ?? 'Activity')),
                'badge_text' => $this->nullableTrim($validated['badge_text'] ?? null),
                'search_terms' => $this->nullableTrim($validated['search_terms'] ?? null),
                'supports_intensity' => (bool) ($validated['supports_intensity'] ?? true),
                'supports_distance' => (bool) ($validated['supports_distance'] ?? false),
                'supports_speed' => (bool) ($validated['supports_speed'] ?? false),
                'default_intensity' => (string) ($validated['default_intensity'] ?? 'moderate'),
                'met_light' => isset($validated['met_light']) ? (float) $validated['met_light'] : null,
                'met_moderate' => isset($validated['met_moderate']) ? (float) $validated['met_moderate'] : null,
                'met_vigorous' => isset($validated['met_vigorous']) ? (float) $validated['met_vigorous'] : null,
                'sort_order' => (int) ($validated['sort_order'] ?? 0),
                'is_active' => (bool) ($validated['is_active'] ?? true),
            ]);

            $responseReference = 'tenant-' . $tenantExercise->id;
        } else {
            $centralExercise = NutritionExercise::query()->findOrFail((int) $reference['id']);

            $tenantExercise = TenantNutritionExercise::query()->updateOrCreate(
                ['central_exercise_id' => $centralExercise->id],
                [
                    'tenant_nutrition_exercise_group_id' => $groupAssignment['tenant_group_id'],
                    'central_group_id' => $groupAssignment['central_group_id'],
                    'title' => trim((string) $validated['title']),
                    'slug' => trim((string) $validated['slug']),
                    'description' => $this->nullableTrim($validated['description'] ?? null),
                    'icon_key' => trim((string) ($validated['icon_key'] ?? 'Activity')),
                    'badge_text' => $this->nullableTrim($validated['badge_text'] ?? null),
                    'search_terms' => $this->nullableTrim($validated['search_terms'] ?? null),
                    'supports_intensity' => (bool) ($validated['supports_intensity'] ?? true),
                    'supports_distance' => (bool) ($validated['supports_distance'] ?? false),
                    'supports_speed' => (bool) ($validated['supports_speed'] ?? false),
                    'default_intensity' => (string) ($validated['default_intensity'] ?? 'moderate'),
                    'met_light' => isset($validated['met_light']) ? (float) $validated['met_light'] : null,
                    'met_moderate' => isset($validated['met_moderate']) ? (float) $validated['met_moderate'] : null,
                    'met_vigorous' => isset($validated['met_vigorous']) ? (float) $validated['met_vigorous'] : null,
                    'sort_order' => (int) ($validated['sort_order'] ?? 0),
                    'is_active' => (bool) ($validated['is_active'] ?? true),
                ],
            );

            $responseReference = 'tenant-' . $tenantExercise->id;
        }

        return response()->json([
            'success' => true,
            'message' => 'فعالیت ورزشی برای این سایت به‌روزرسانی شد.',
            'data' => [
                'exercise' => $this->findAdminExerciseReference($responseReference),
            ],
        ]);
    }

    public function destroyExercise(Request $request, string $exerciseId): JsonResponse
    {
        $this->ensureAdmin($request);
        $this->ensureExerciseOverrideTablesAvailable();

        $reference = $this->library->parseReference($exerciseId);
        abort_unless($reference, 404, 'فعالیت ورزشی پیدا نشد.');

        if ($reference['source'] === 'tenant') {
            $exercise = TenantNutritionExercise::query()->findOrFail((int) $reference['id']);

            if ($exercise->central_exercise_id === null) {
                $exercise->delete();
            } else {
                $exercise->update(['is_active' => false]);
            }
        } else {
            $centralExercise = NutritionExercise::query()->findOrFail((int) $reference['id']);

            TenantNutritionExercise::query()->updateOrCreate(
                ['central_exercise_id' => $centralExercise->id],
                [
                    'tenant_nutrition_exercise_group_id' => null,
                    'central_group_id' => $centralExercise->nutrition_exercise_group_id,
                    'title' => $centralExercise->title,
                    'slug' => $centralExercise->slug,
                    'description' => $centralExercise->description,
                    'icon_key' => $centralExercise->icon_key,
                    'badge_text' => $centralExercise->badge_text,
                    'search_terms' => $centralExercise->search_terms,
                    'supports_intensity' => (bool) $centralExercise->supports_intensity,
                    'supports_distance' => (bool) $centralExercise->supports_distance,
                    'supports_speed' => (bool) $centralExercise->supports_speed,
                    'default_intensity' => $centralExercise->default_intensity,
                    'met_light' => $centralExercise->met_light !== null ? (float) $centralExercise->met_light : null,
                    'met_moderate' => $centralExercise->met_moderate !== null ? (float) $centralExercise->met_moderate : null,
                    'met_vigorous' => $centralExercise->met_vigorous !== null ? (float) $centralExercise->met_vigorous : null,
                    'sort_order' => (int) ($centralExercise->sort_order ?? 0),
                    'is_active' => false,
                ],
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'فعالیت ورزشی برای این سایت مخفی شد.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validateExercisePayload(Request $request, ?int $tenantExerciseId = null): array
    {
        return $request->validate([
            'group_ref' => ['required', 'string'],
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:120', 'alpha_dash', Rule::unique('tenant_nutrition_exercises', 'slug')->ignore($tenantExerciseId)],
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
    }

    /**
     * @return array{tenant_group_id:int|null, central_group_id:int|null}
     */
    private function resolveGroupAssignment(string $groupRef): array
    {
        $reference = $this->library->parseReference($groupRef);
        abort_unless($reference, 422, 'گروه انتخاب‌شده معتبر نیست.');

        if ($reference['source'] === 'tenant') {
            $group = TenantNutritionExerciseGroup::query()->findOrFail((int) $reference['id']);

            return [
                'tenant_group_id' => (int) $group->id,
                'central_group_id' => null,
            ];
        }

        NutritionExerciseGroup::query()->findOrFail((int) $reference['id']);

        return [
            'tenant_group_id' => null,
            'central_group_id' => (int) $reference['id'],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findAdminExerciseReference(string $reference): ?array
    {
        foreach ($this->library->adminGroups() as $group) {
            foreach ($group['exercises'] as $exercise) {
                if (($exercise['id'] ?? null) === $reference) {
                    return $exercise;
                }
            }
        }

        return null;
    }

    private function ensureAdmin(Request $request): void
    {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));
    }

    private function ensureGroupOverrideTableAvailable(): void
    {
        abort_if(
            ! Schema::hasTable('tenant_nutrition_exercise_groups'),
            503,
            'برای ویرایش کتابخانه ورزش این سایت، migration جدید ورزش را روی tenant اجرا کنید.'
        );
    }

    private function ensureExerciseOverrideTablesAvailable(): void
    {
        abort_if(
            ! Schema::hasTable('tenant_nutrition_exercise_groups') || ! Schema::hasTable('tenant_nutrition_exercises'),
            503,
            'برای ویرایش یا ساخت ورزش اختصاصی این سایت، migration جدید ورزش را روی tenant اجرا کنید.'
        );
    }

    private function nullableTrim(mixed $value): ?string
    {
        $text = trim((string) ($value ?? ''));

        return $text !== '' ? $text : null;
    }
}
