<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\NutritionExercise;
use App\Models\NutritionExerciseGroup;
use App\Models\TenantNutritionExercise;
use App\Models\TenantNutritionExerciseGroup;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

class TenantNutritionExerciseLibraryService
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public function adminGroups(): array
    {
        return $this->buildMergedGroups(includeInactive: true);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function catalogGroups(): array
    {
        return $this->buildMergedGroups(includeInactive: false);
    }

    /**
     * @return array<string, int|string>|null
     */
    public function parseReference(?string $reference): ?array
    {
        $raw = trim((string) $reference);
        if ($raw === '' || ! preg_match('/^(central|tenant)-(\d+)$/', $raw, $matches)) {
            return null;
        }

        return [
            'source' => $matches[1],
            'id' => (int) $matches[2],
        ];
    }

    public function findCentralGroup(int $groupId): ?NutritionExerciseGroup
    {
        return NutritionExerciseGroup::query()->find($groupId);
    }

    public function findTenantGroup(int $groupId): ?TenantNutritionExerciseGroup
    {
        if (! Schema::hasTable('tenant_nutrition_exercise_groups')) {
            return null;
        }

        return TenantNutritionExerciseGroup::query()->find($groupId);
    }

    public function findCentralExercise(int $exerciseId): ?NutritionExercise
    {
        return NutritionExercise::query()->find($exerciseId);
    }

    public function findTenantExercise(int $exerciseId): ?TenantNutritionExercise
    {
        if (! Schema::hasTable('tenant_nutrition_exercises')) {
            return null;
        }

        return TenantNutritionExercise::query()->find($exerciseId);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findCatalogExercise(string $reference): ?array
    {
        foreach ($this->catalogGroups() as $group) {
            foreach ($group['exercises'] as $exercise) {
                if (($exercise['id'] ?? null) === $reference) {
                    return $exercise;
                }
            }
        }

        return null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findAdminGroupReference(string $reference): ?array
    {
        foreach ($this->adminGroups() as $group) {
            if (($group['id'] ?? null) === $reference) {
                return $group;
            }
        }

        return null;
    }

    private function formatReference(string $source, int $id): string
    {
        return $source . '-' . $id;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildMergedGroups(bool $includeInactive): array
    {
        $centralGroups = NutritionExerciseGroup::query()
            ->orderBy('sort_order')
            ->orderBy('title')
            ->get();
        $centralExercises = NutritionExercise::query()
            ->orderBy('sort_order')
            ->orderBy('title')
            ->get();
        $tenantGroups = Schema::hasTable('tenant_nutrition_exercise_groups')
            ? TenantNutritionExerciseGroup::query()
                ->orderBy('sort_order')
                ->orderBy('title')
                ->get()
            : new Collection();
        $tenantExercises = Schema::hasTable('tenant_nutrition_exercises')
            ? TenantNutritionExercise::query()
                ->orderBy('sort_order')
                ->orderBy('title')
                ->get()
            : new Collection();

        $tenantGroupOverrides = $tenantGroups->filter(fn (TenantNutritionExerciseGroup $group) => $group->central_group_id !== null)
            ->keyBy(fn (TenantNutritionExerciseGroup $group) => (int) $group->central_group_id);
        $tenantCustomGroups = $tenantGroups->filter(fn (TenantNutritionExerciseGroup $group) => $group->central_group_id === null);
        $tenantExerciseOverrides = $tenantExercises->filter(fn (TenantNutritionExercise $exercise) => $exercise->central_exercise_id !== null)
            ->keyBy(fn (TenantNutritionExercise $exercise) => (int) $exercise->central_exercise_id);
        $tenantCustomExercises = $tenantExercises->filter(fn (TenantNutritionExercise $exercise) => $exercise->central_exercise_id === null);

        $groupsByRef = [];
        $centralGroupRefById = [];
        $tenantGroupRefById = [];

        foreach ($centralGroups as $centralGroup) {
            $override = $tenantGroupOverrides->get((int) $centralGroup->id);
            $groupRef = $override
                ? $this->formatReference('tenant', (int) $override->id)
                : $this->formatReference('central', (int) $centralGroup->id);

            $groupsByRef[$groupRef] = [
                'id' => $groupRef,
                'source' => $override ? 'tenant' : 'central',
                'centralId' => (string) $centralGroup->id,
                'tenantId' => $override ? (string) $override->id : null,
                'isCustom' => false,
                'isOverride' => (bool) $override,
                'title' => $override?->title ?? $centralGroup->title,
                'slug' => $override?->slug ?? $centralGroup->slug,
                'description' => $override?->description ?? $centralGroup->description,
                'iconKey' => $override?->icon_key ?? $centralGroup->icon_key,
                'accentColor' => $override?->accent_color ?? $centralGroup->accent_color,
                'softColor' => $override?->soft_color ?? $centralGroup->soft_color,
                'sortOrder' => (int) ($override?->sort_order ?? $centralGroup->sort_order ?? 0),
                'isActive' => (bool) ($override?->is_active ?? $centralGroup->is_active),
                'exercisesCount' => 0,
                'exercises' => [],
            ];

            $centralGroupRefById[(int) $centralGroup->id] = $groupRef;
            if ($override) {
                $tenantGroupRefById[(int) $override->id] = $groupRef;
            }
        }

        foreach ($tenantCustomGroups as $tenantGroup) {
            $groupRef = $this->formatReference('tenant', (int) $tenantGroup->id);
            $groupsByRef[$groupRef] = [
                'id' => $groupRef,
                'source' => 'tenant',
                'centralId' => null,
                'tenantId' => (string) $tenantGroup->id,
                'isCustom' => true,
                'isOverride' => false,
                'title' => $tenantGroup->title,
                'slug' => $tenantGroup->slug,
                'description' => $tenantGroup->description,
                'iconKey' => $tenantGroup->icon_key,
                'accentColor' => $tenantGroup->accent_color,
                'softColor' => $tenantGroup->soft_color,
                'sortOrder' => (int) ($tenantGroup->sort_order ?? 0),
                'isActive' => (bool) $tenantGroup->is_active,
                'exercisesCount' => 0,
                'exercises' => [],
            ];

            $tenantGroupRefById[(int) $tenantGroup->id] = $groupRef;
        }

        foreach ($centralExercises as $centralExercise) {
            $override = $tenantExerciseOverrides->get((int) $centralExercise->id);
            $groupRef = $this->resolveGroupReferenceForExercise(
                centralGroupId: (int) $centralExercise->nutrition_exercise_group_id,
                tenantGroupId: $override?->tenant_nutrition_exercise_group_id !== null ? (int) $override->tenant_nutrition_exercise_group_id : null,
                overrideCentralGroupId: $override?->central_group_id !== null ? (int) $override->central_group_id : null,
                centralGroupRefById: $centralGroupRefById,
                tenantGroupRefById: $tenantGroupRefById,
            );

            if (! $groupRef || ! isset($groupsByRef[$groupRef])) {
                continue;
            }

            $exerciseRef = $override
                ? $this->formatReference('tenant', (int) $override->id)
                : $this->formatReference('central', (int) $centralExercise->id);

            $groupsByRef[$groupRef]['exercises'][] = [
                'id' => $exerciseRef,
                'source' => $override ? 'tenant' : 'central',
                'centralId' => (string) $centralExercise->id,
                'tenantId' => $override ? (string) $override->id : null,
                'isCustom' => false,
                'isOverride' => (bool) $override,
                'groupId' => $groupRef,
                'groupTitle' => $groupsByRef[$groupRef]['title'],
                'title' => $override?->title ?? $centralExercise->title,
                'slug' => $override?->slug ?? $centralExercise->slug,
                'description' => $override?->description ?? $centralExercise->description,
                'iconKey' => $override?->icon_key ?? $centralExercise->icon_key,
                'badgeText' => $override?->badge_text ?? $centralExercise->badge_text,
                'searchTerms' => $override?->search_terms ?? $centralExercise->search_terms,
                'supportsIntensity' => (bool) ($override?->supports_intensity ?? $centralExercise->supports_intensity),
                'supportsDistance' => (bool) ($override?->supports_distance ?? $centralExercise->supports_distance),
                'supportsSpeed' => (bool) ($override?->supports_speed ?? $centralExercise->supports_speed),
                'defaultIntensity' => $override?->default_intensity ?? $centralExercise->default_intensity,
                'metLight' => ($override?->met_light ?? $centralExercise->met_light) !== null ? (float) ($override?->met_light ?? $centralExercise->met_light) : null,
                'metModerate' => ($override?->met_moderate ?? $centralExercise->met_moderate) !== null ? (float) ($override?->met_moderate ?? $centralExercise->met_moderate) : null,
                'metVigorous' => ($override?->met_vigorous ?? $centralExercise->met_vigorous) !== null ? (float) ($override?->met_vigorous ?? $centralExercise->met_vigorous) : null,
                'sortOrder' => (int) ($override?->sort_order ?? $centralExercise->sort_order ?? 0),
                'isActive' => (bool) ($override?->is_active ?? $centralExercise->is_active),
            ];
        }

        foreach ($tenantCustomExercises as $tenantExercise) {
            $groupRef = $this->resolveGroupReferenceForExercise(
                centralGroupId: null,
                tenantGroupId: $tenantExercise->tenant_nutrition_exercise_group_id !== null ? (int) $tenantExercise->tenant_nutrition_exercise_group_id : null,
                overrideCentralGroupId: $tenantExercise->central_group_id !== null ? (int) $tenantExercise->central_group_id : null,
                centralGroupRefById: $centralGroupRefById,
                tenantGroupRefById: $tenantGroupRefById,
            );

            if (! $groupRef || ! isset($groupsByRef[$groupRef])) {
                continue;
            }

            $groupsByRef[$groupRef]['exercises'][] = [
                'id' => $this->formatReference('tenant', (int) $tenantExercise->id),
                'source' => 'tenant',
                'centralId' => null,
                'tenantId' => (string) $tenantExercise->id,
                'isCustom' => true,
                'isOverride' => false,
                'groupId' => $groupRef,
                'groupTitle' => $groupsByRef[$groupRef]['title'],
                'title' => $tenantExercise->title,
                'slug' => $tenantExercise->slug,
                'description' => $tenantExercise->description,
                'iconKey' => $tenantExercise->icon_key,
                'badgeText' => $tenantExercise->badge_text,
                'searchTerms' => $tenantExercise->search_terms,
                'supportsIntensity' => (bool) $tenantExercise->supports_intensity,
                'supportsDistance' => (bool) $tenantExercise->supports_distance,
                'supportsSpeed' => (bool) $tenantExercise->supports_speed,
                'defaultIntensity' => $tenantExercise->default_intensity,
                'metLight' => $tenantExercise->met_light !== null ? (float) $tenantExercise->met_light : null,
                'metModerate' => $tenantExercise->met_moderate !== null ? (float) $tenantExercise->met_moderate : null,
                'metVigorous' => $tenantExercise->met_vigorous !== null ? (float) $tenantExercise->met_vigorous : null,
                'sortOrder' => (int) ($tenantExercise->sort_order ?? 0),
                'isActive' => (bool) $tenantExercise->is_active,
            ];
        }

        $groups = collect($groupsByRef)
            ->map(function (array $group) use ($includeInactive): ?array {
                $exercises = collect($group['exercises'])
                    ->sortBy(fn (array $exercise): string => sprintf(
                        '%08d_%s',
                        (int) ($exercise['sortOrder'] ?? 0),
                        mb_strtolower((string) ($exercise['title'] ?? ''))
                    ))
                    ->values()
                    ->all();

                if (! $includeInactive) {
                    $exercises = array_values(array_filter($exercises, fn (array $exercise): bool => (bool) ($exercise['isActive'] ?? false)));
                }

                $group['exercises'] = $exercises;
                $group['exercisesCount'] = count($exercises);

                if (! $includeInactive && (! $group['isActive'] || $group['exercisesCount'] === 0)) {
                    return null;
                }

                return $group;
            })
            ->filter()
            ->sortBy(fn (array $group): string => sprintf(
                '%08d_%s',
                (int) ($group['sortOrder'] ?? 0),
                mb_strtolower((string) ($group['title'] ?? ''))
            ))
            ->values()
            ->all();

        return $groups;
    }

    /**
     * @param  array<int, string>  $centralGroupRefById
     * @param  array<int, string>  $tenantGroupRefById
     */
    private function resolveGroupReferenceForExercise(
        ?int $centralGroupId,
        ?int $tenantGroupId,
        ?int $overrideCentralGroupId,
        array $centralGroupRefById,
        array $tenantGroupRefById,
    ): ?string {
        if ($tenantGroupId !== null && isset($tenantGroupRefById[$tenantGroupId])) {
            return $tenantGroupRefById[$tenantGroupId];
        }

        if ($overrideCentralGroupId !== null && isset($centralGroupRefById[$overrideCentralGroupId])) {
            return $centralGroupRefById[$overrideCentralGroupId];
        }

        if ($centralGroupId !== null && isset($centralGroupRefById[$centralGroupId])) {
            return $centralGroupRefById[$centralGroupId];
        }

        return null;
    }
}
