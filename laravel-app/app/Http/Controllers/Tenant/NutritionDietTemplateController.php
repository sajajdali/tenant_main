<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\NutritionDietTemplate;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class NutritionDietTemplateController extends Controller
{
    private const PRESCRIPTION_MODES = [
        'daily_prescription',
        'user_choice',
        'fixed_text',
    ];

    private const DIET_BASES = [
        'exchange',
        'calorie',
        'macros',
        'fasting',
        'food-based',
        'glycemic-index',
    ];

    private const APPLICABLE_GOALS = [
        'lose-weight',
        'gain-weight',
        'maintain-weight',
    ];

    private const MEAL_SLOT_DEFINITIONS = [
        'breakfast' => ['title' => 'صبحانه', 'icon' => 'sun'],
        'morning_snack' => ['title' => 'میان‌وعده صبح', 'icon' => 'sparkles'],
        'lunch' => ['title' => 'نهار', 'icon' => 'salad'],
        'afternoon_snack' => ['title' => 'میان‌وعده عصر', 'icon' => 'sunset'],
        'dinner' => ['title' => 'شام', 'icon' => 'moon_star'],
        'before_sleep_snack' => ['title' => 'میان‌وعده قبل خواب', 'icon' => 'bed'],
        'sahari' => ['title' => 'سحری', 'icon' => 'stars'],
        'iftar' => ['title' => 'افطار', 'icon' => 'lamp_desk'],
        'pre_workout_snack' => ['title' => 'میان‌وعده قبل تمرین', 'icon' => 'dumbbell'],
        'post_workout_snack' => ['title' => 'میان‌وعده بعد تمرین', 'icon' => 'flame'],
        'pre_fasting_meal' => ['title' => 'وعده قبل از شروع فستینگ', 'icon' => 'hourglass'],
        'post_fasting_meal' => ['title' => 'وعده بعد از پایان فستینگ', 'icon' => 'timer_reset'],
        'recovery_snack' => ['title' => 'میان‌وعده ریکاوری', 'icon' => 'heart_pulse'],
        'free_meal' => ['title' => 'وعده آزاد', 'icon' => 'party_popper'],
        'supplement_meal' => ['title' => 'وعده مکمل', 'icon' => 'pill'],
    ];

    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $items = NutritionDietTemplate::query()
            ->with(['children.children'])
            ->whereNull('parent_id')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $parentOptions = NutritionDietTemplate::query()
            ->orderBy('depth')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn (NutritionDietTemplate $item) => [
                'id' => (string) $item->id,
                'name' => $item->name,
                'depth' => (int) $item->depth,
                'label' => str_repeat('— ', (int) $item->depth) . $item->name,
                'canHaveChild' => (int) $item->depth < 2,
            ])
            ->values()
            ->all();

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $items->map(fn (NutritionDietTemplate $item) => $this->transformTemplate($item))->values()->all(),
                'parentOptions' => $parentOptions,
                'dietBasisOptions' => $this->dietBasisOptions()
                    ->map(fn (string $label, string $value) => [
                        'value' => $value,
                        'label' => $label,
                    ])
                    ->values()
                    ->all(),
                'goalOptions' => $this->goalOptions()
                    ->map(fn (string $label, string $value) => [
                        'value' => $value,
                        'label' => $label,
                    ])
                    ->values()
                    ->all(),
            ],
        ]);
    }

    public function publicIndex(Request $request): JsonResponse
    {
        $goal = trim((string) $request->query('goal', ''));

        $items = NutritionDietTemplate::query()
            ->with(['children.children'])
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $this->buildTemplateTree($items, $goal),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        [$validated, $parent, $depth] = $this->validateTemplateRequest($request);

        $template = DB::transaction(function () use ($depth, $parent, $validated): NutritionDietTemplate {
            $meta = $this->extractTemplateMeta(
                $validated['prescription_mode'] ?? null,
                $validated['allow_food_replacement'] ?? null,
                $validated['suggest_daily_replacements'] ?? null,
                $validated['conditions_text'] ?? null,
            );

            $mealSlots = $this->normalizeMealSlots($validated['meal_slots'] ?? [], $meta['prescription_mode'] === 'fixed_text');

            $templateImage = isset($validated['image']) && $validated['image'] instanceof UploadedFile
                ? $validated['image']->store('nutrition/templates', 'media_public')
                : null;
            if ($templateImage !== null) {
                $this->recordTenantMediaFile($templateImage, (int) $validated['image']->getSize());
            }

            $template = NutritionDietTemplate::query()->create([
                'parent_id' => $parent?->id,
                'depth' => $depth,
                'name' => trim((string) $validated['name']),
                'slug' => $this->uniqueSlug((string) ($validated['slug'] ?? $validated['name'])),
                'image_path' => $templateImage,
                'diet_basis' => $validated['diet_basis'],
                'diet_level' => $this->nullableTrim($validated['diet_level'] ?? null),
                'prescription_mode' => $meta['prescription_mode'],
                'allow_food_replacement' => $meta['allow_food_replacement'],
                'suggest_daily_replacements' => $meta['suggest_daily_replacements'],
                'show_diet_explanations' => (bool) ($validated['show_diet_explanations'] ?? false),
                'diet_explanation_prompt' => (bool) ($validated['show_diet_explanations'] ?? false)
                    ? $this->nullableTrim($validated['diet_explanation_prompt'] ?? null)
                    : null,
                'structure_version' => 1,
                'applicable_goals' => array_values($validated['applicable_goals']),
                'meal_slots' => $mealSlots,
                'description' => $this->nullableTrim($validated['description'] ?? null),
                'template_notes' => $this->nullableTrim($validated['template_notes'] ?? null),
                'conditions_text' => $this->nullableTrim($validated['conditions_text'] ?? null),
                'duration_days' => max(1, (int) ($validated['duration_days'] ?? 30)),
                'supplements_enabled' => (bool) ($validated['supplements_enabled'] ?? false),
                'supplement_notes' => (bool) ($validated['supplements_enabled'] ?? false)
                    ? $this->nullableTrim($validated['supplement_notes'] ?? null)
                    : null,
                'sort_order' => (int) ($validated['sort_order'] ?? 0),
                'is_active' => (bool) ($validated['is_active'] ?? true),
            ]);

            $this->syncMealSlotRows($template, $mealSlots);

            return $template;
        });

        return response()->json([
            'success' => true,
            'message' => 'الگوی رژیم ذخیره شد.',
            'data' => [
                'item' => $this->transformTemplate($template->fresh(['children.children'])),
            ],
        ]);
    }

    public function update(Request $request, NutritionDietTemplate $nutritionDietTemplate): JsonResponse
    {
        $this->ensureAdmin($request);

        [$validated, $parent, $depth] = $this->validateTemplateRequest($request, $nutritionDietTemplate);

        if ((bool) ($validated['remove_image'] ?? false)) {
            $this->deletePhysicalFile($nutritionDietTemplate->image_path);
            $nutritionDietTemplate->image_path = null;
        }

        if (isset($validated['image']) && $validated['image'] instanceof UploadedFile) {
            $this->deletePhysicalFile($nutritionDietTemplate->image_path);
            $nutritionDietTemplate->image_path = $validated['image']->store('nutrition/templates', 'media_public');
            $this->recordTenantMediaFile($nutritionDietTemplate->image_path, (int) $validated['image']->getSize());
        }

        DB::transaction(function () use ($depth, $nutritionDietTemplate, $parent, $validated): void {
            $meta = $this->extractTemplateMeta(
                $validated['prescription_mode'] ?? null,
                $validated['allow_food_replacement'] ?? null,
                $validated['suggest_daily_replacements'] ?? null,
                $validated['conditions_text'] ?? null,
            );

            $mealSlots = $this->normalizeMealSlots($validated['meal_slots'] ?? [], $meta['prescription_mode'] === 'fixed_text');

            $nutritionDietTemplate->update([
                'parent_id' => $parent?->id,
                'depth' => $depth,
                'name' => trim((string) $validated['name']),
                'slug' => $this->uniqueSlug((string) ($validated['slug'] ?? $validated['name']), (int) $nutritionDietTemplate->id),
                'image_path' => $nutritionDietTemplate->image_path,
                'diet_basis' => $validated['diet_basis'],
                'diet_level' => $this->nullableTrim($validated['diet_level'] ?? null),
                'prescription_mode' => $meta['prescription_mode'],
                'allow_food_replacement' => $meta['allow_food_replacement'],
                'suggest_daily_replacements' => $meta['suggest_daily_replacements'],
                'show_diet_explanations' => (bool) ($validated['show_diet_explanations'] ?? false),
                'diet_explanation_prompt' => (bool) ($validated['show_diet_explanations'] ?? false)
                    ? $this->nullableTrim($validated['diet_explanation_prompt'] ?? null)
                    : null,
                'applicable_goals' => array_values($validated['applicable_goals']),
                'meal_slots' => $mealSlots,
                'description' => $this->nullableTrim($validated['description'] ?? null),
                'template_notes' => $this->nullableTrim($validated['template_notes'] ?? null),
                'conditions_text' => $this->nullableTrim($validated['conditions_text'] ?? null),
                'duration_days' => max(1, (int) ($validated['duration_days'] ?? 30)),
                'supplements_enabled' => (bool) ($validated['supplements_enabled'] ?? false),
                'supplement_notes' => (bool) ($validated['supplements_enabled'] ?? false)
                    ? $this->nullableTrim($validated['supplement_notes'] ?? null)
                    : null,
                'sort_order' => (int) ($validated['sort_order'] ?? 0),
                'is_active' => (bool) ($validated['is_active'] ?? true),
            ]);

            $this->syncMealSlotRows($nutritionDietTemplate, $mealSlots);
        });

        return response()->json([
            'success' => true,
            'message' => 'الگوی رژیم به‌روزرسانی شد.',
            'data' => [
                'item' => $this->transformTemplate($nutritionDietTemplate->fresh(['children.children'])),
            ],
        ]);
    }

    public function destroy(Request $request, NutritionDietTemplate $nutritionDietTemplate): JsonResponse
    {
        $this->ensureAdmin($request);

        abort_if(
            $nutritionDietTemplate->children()->exists(),
            422,
            'این الگو زیرمجموعه دارد. ابتدا زیرمجموعه‌های آن را حذف یا جابه‌جا کنید.'
        );

        $this->deletePhysicalFile($nutritionDietTemplate->image_path);
        $nutritionDietTemplate->delete();

        return response()->json([
            'success' => true,
            'message' => 'الگوی رژیم حذف شد.',
        ]);
    }

    private function validateTemplateRequest(Request $request, ?NutritionDietTemplate $template = null): array
    {
        if (is_string($request->input('meal_slots'))) {
            $decoded = json_decode((string) $request->input('meal_slots'), true);
            $request->merge([
                'meal_slots' => is_array($decoded) ? $decoded : [],
            ]);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255'],
            'parent_id' => ['nullable', 'integer', 'exists:nutrition_diet_templates,id'],
            'image' => ['nullable', 'file', 'mimes:jpg,jpeg,png,gif,webp,avif', 'max:8192'],
            'diet_basis' => ['required', 'string', 'in:' . implode(',', self::DIET_BASES)],
            'diet_level' => ['nullable', 'string', 'max:80'],
            'applicable_goals' => ['required', 'array', 'min:1'],
            'applicable_goals.*' => ['string', 'in:' . implode(',', self::APPLICABLE_GOALS)],
            'meal_slots' => ['nullable', 'array'],
            'meal_slots.*.key' => ['required', 'string'],
            'meal_slots.*.title' => ['required', 'string', 'max:255'],
            'meal_slots.*.icon' => ['required', 'string', 'max:64'],
            'meal_slots.*.enabled' => ['nullable', 'boolean'],
            'meal_slots.*.description' => ['nullable', 'string'],
            'meal_slots.*.food_count' => ['nullable', 'integer', 'min:0', 'max:100'],
            'meal_slots.*.sort_order' => ['nullable', 'integer', 'min:0', 'max:100'],
            'prescription_mode' => ['nullable', 'string', 'in:' . implode(',', self::PRESCRIPTION_MODES)],
            'allow_food_replacement' => ['nullable', 'boolean'],
            'suggest_daily_replacements' => ['nullable', 'boolean'],
            'show_diet_explanations' => ['nullable', 'boolean'],
            'diet_explanation_prompt' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'template_notes' => ['nullable', 'string'],
            'conditions_text' => ['nullable', 'string'],
            'duration_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'supplements_enabled' => ['nullable', 'boolean'],
            'supplement_notes' => ['nullable', 'string'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'remove_image' => ['nullable', 'boolean'],
        ], [
            'name.required' => 'نام الگو را وارد کنید.',
            'diet_basis.required' => 'مبنای رژیم را انتخاب کنید.',
            'applicable_goals.required' => 'حداقل یک هدف تجویز را انتخاب کنید.',
        ]);

        $parent = null;
        $depth = 0;

        if (! empty($validated['parent_id'])) {
            /** @var NutritionDietTemplate|null $parent */
            $parent = NutritionDietTemplate::query()->find((int) $validated['parent_id']);

            abort_if(! $parent, 422, 'والد انتخاب‌شده معتبر نیست.');
            abort_if($template && $parent->id === $template->id, 422, 'یک الگو نمی‌تواند والد خودش باشد.');
            abort_if($template && $parent->parent_id === $template->id, 422, 'این جابه‌جایی باعث حلقه در ساختار الگوها می‌شود.');
            abort_if((int) $parent->depth >= 2, 422, 'حداکثر عمق زیرمجموعه برای الگوهای رژیم دو مرحله است.');

            $depth = (int) $parent->depth + 1;
        }

        return [$validated, $parent, $depth];
    }

    private function transformTemplate(NutritionDietTemplate $item): array
    {
        $item->loadMissing(['children.children']);

        return [
            'id' => (string) $item->id,
            'parentId' => $item->parent_id ? (string) $item->parent_id : null,
            'depth' => (int) $item->depth,
            'name' => $item->name,
            'slug' => $item->slug,
            'imageUrl' => $this->tenantMediaUrl($item->image_path),
            'dietBasis' => $item->diet_basis,
            'dietBasisLabel' => $this->dietBasisOptions()->get($item->diet_basis),
            'dietLevel' => $item->diet_level,
            'applicableGoals' => collect($item->applicable_goals ?? [])
                ->filter()
                ->values()
                ->all(),
            'mealSlots' => $this->normalizeMealSlots($item->meal_slots ?? []),
            'prescriptionMode' => $item->prescription_mode,
            'allowFoodReplacement' => (bool) $item->allow_food_replacement,
            'suggestDailyReplacements' => (bool) $item->suggest_daily_replacements,
            'showDietExplanations' => (bool) $item->show_diet_explanations,
            'dietExplanationPrompt' => $item->diet_explanation_prompt,
            'structureVersion' => (int) $item->structure_version,
            'applicableGoalLabels' => collect($item->applicable_goals ?? [])
                ->map(fn (string $goal) => $this->goalOptions()->get($goal, $goal))
                ->values()
                ->all(),
            'description' => $item->description,
            'templateNotes' => $item->template_notes,
            'conditionsText' => $item->conditions_text,
            'durationDays' => (int) $item->duration_days,
            'supplementsEnabled' => (bool) $item->supplements_enabled,
            'supplementNotes' => $item->supplement_notes,
            'sortOrder' => (int) $item->sort_order,
            'isActive' => (bool) $item->is_active,
            'children' => $item->children
                ->sortBy(['sort_order', 'name'])
                ->map(fn (NutritionDietTemplate $child) => $this->transformTemplate($child))
                ->values()
                ->all(),
            'createdAt' => $item->created_at?->toISOString(),
        ];
    }

    private function transformTemplateForPublic(NutritionDietTemplate $item, string $goal): ?array
    {
        $item->loadMissing(['children.children']);

        $children = $item->children
            ->sortBy(['sort_order', 'name'])
            ->map(fn (NutritionDietTemplate $child) => $this->transformTemplateForPublic($child, $goal))
            ->filter()
            ->values()
            ->all();

        if (! $item->is_active) {
            return null;
        }

        $matchesGoal = $this->matchesGoal($item, $goal);

        if (! $matchesGoal && count($children) === 0) {
            return null;
        }

        return [
            'id' => (string) $item->id,
            'parentId' => $item->parent_id ? (string) $item->parent_id : null,
            'depth' => (int) $item->depth,
            'name' => $item->name,
            'slug' => $item->slug,
            'imageUrl' => $this->tenantMediaUrl($item->image_path),
            'dietBasis' => $item->diet_basis,
            'dietBasisLabel' => $this->dietBasisOptions()->get($item->diet_basis),
            'dietLevel' => $item->diet_level,
            'applicableGoals' => collect($item->applicable_goals ?? [])->filter()->values()->all(),
            'mealSlots' => $this->normalizeMealSlots($item->meal_slots ?? []),
            'prescriptionMode' => $item->prescription_mode,
            'allowFoodReplacement' => (bool) $item->allow_food_replacement,
            'suggestDailyReplacements' => (bool) $item->suggest_daily_replacements,
            'showDietExplanations' => (bool) $item->show_diet_explanations,
            'dietExplanationPrompt' => $item->diet_explanation_prompt,
            'structureVersion' => (int) $item->structure_version,
            'applicableGoalLabels' => collect($item->applicable_goals ?? [])
                ->map(fn (string $itemGoal) => $this->goalOptions()->get($itemGoal, $itemGoal))
                ->values()
                ->all(),
            'description' => $item->description,
            'templateNotes' => $item->template_notes,
            'conditionsText' => $item->conditions_text,
            'durationDays' => (int) $item->duration_days,
            'supplementsEnabled' => (bool) $item->supplements_enabled,
            'supplementNotes' => $item->supplement_notes,
            'sortOrder' => (int) $item->sort_order,
            'isActive' => true,
            'children' => $children,
            'createdAt' => $item->created_at?->toISOString(),
        ];
    }

    private function buildTemplateTree($items, string $goal): array
    {
        $roots = $items
            ->filter(fn (NutritionDietTemplate $item) => $item->parent_id === null)
            ->sortBy(['sort_order', 'name'])
            ->values();

        return $roots
            ->map(fn (NutritionDietTemplate $item) => $this->transformTemplateForPublic($item, $goal))
            ->filter()
            ->values()
            ->all();
    }

    private function matchesGoal(NutritionDietTemplate $item, string $goal): bool
    {
        if ($goal === '') {
            return true;
        }

        $goals = collect($item->applicable_goals ?? [])->filter()->values()->all();

        return $goals === [] || in_array($goal, $goals, true);
    }

    private function uniqueSlug(string $value, ?int $ignoreId = null): string
    {
        $base = Str::slug(trim($value) !== '' ? $value : 'diet-template');
        $slug = $base !== '' ? $base : 'diet-template';
        $counter = 1;

        while (
            NutritionDietTemplate::query()
                ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
                ->where('slug', $slug)
                ->exists()
        ) {
            $slug = $base . '-' . $counter;
            $counter++;
        }

        return $slug;
    }

    private function nullableTrim(?string $value): ?string
    {
        $trimmed = trim((string) $value);

        return $trimmed !== '' ? $trimmed : null;
    }

    private function normalizeMealSlots(array $mealSlots, bool $disableAll = false): array
    {
        $incoming = collect($mealSlots)
            ->filter(fn ($item) => is_array($item) && isset($item['key']))
            ->keyBy(fn ($item) => (string) $item['key']);

        return collect(self::MEAL_SLOT_DEFINITIONS)
            ->map(function (array $definition, string $key) use ($incoming, $disableAll): array {
                $item = $incoming->get($key, []);

                return [
                    'key' => $key,
                    'title' => (string) ($definition['title'] ?? $item['title'] ?? $key),
                    'icon' => (string) ($definition['icon'] ?? $item['icon'] ?? 'utensils'),
                    'enabled' => $disableAll ? false : (bool) ($item['enabled'] ?? false),
                    'description' => $this->nullableTrim(is_string($item['description'] ?? null) ? $item['description'] : null),
                    'foodCount' => $disableAll ? 0 : max(0, (int) ($item['food_count'] ?? $item['foodCount'] ?? 0)),
                    'sortOrder' => max(0, (int) ($item['sort_order'] ?? $item['sortOrder'] ?? array_search($key, array_keys(self::MEAL_SLOT_DEFINITIONS), true) ?: 0)),
                ];
            })
            ->sortBy('sortOrder')
            ->values()
            ->all();
    }

    private function syncMealSlotRows(NutritionDietTemplate $template, array $mealSlots): void
    {
        DB::table('nutrition_diet_template_meal_slots')
            ->where('nutrition_diet_template_id', $template->id)
            ->delete();

        $rows = collect($mealSlots)
            ->map(fn (array $slot): array => [
                'nutrition_diet_template_id' => $template->id,
                'slot_key' => (string) $slot['key'],
                'title' => (string) $slot['title'],
                'icon' => (string) ($slot['icon'] ?? ''),
                'description' => $this->nullableTrim(is_string($slot['description'] ?? null) ? $slot['description'] : null),
                'food_count' => max(0, (int) ($slot['foodCount'] ?? 0)),
                'sort_order' => max(0, (int) ($slot['sortOrder'] ?? 0)),
                'is_enabled' => (bool) ($slot['enabled'] ?? false),
                'created_at' => now(),
                'updated_at' => now(),
            ])
            ->all();

        if ($rows !== []) {
            DB::table('nutrition_diet_template_meal_slots')->insert($rows);
        }
    }

    /**
     * @return array{prescription_mode:string,allow_food_replacement:bool,suggest_daily_replacements:bool}
     */
    private function extractTemplateMeta(mixed $explicitMode, mixed $explicitReplacement, mixed $explicitDailyReplacementSuggestion, mixed $conditionsText): array
    {
        $metaPrefix = '[[NUTRITION_TEMPLATE_META]]';
        $mode = in_array($explicitMode, self::PRESCRIPTION_MODES, true) ? (string) $explicitMode : null;
        $allowReplacement = filter_var($explicitReplacement, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        $suggestDailyReplacements = filter_var($explicitDailyReplacementSuggestion, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

        if ($mode === null && is_string($conditionsText) && str_contains($conditionsText, $metaPrefix)) {
            foreach (preg_split('/\r\n|\r|\n/', $conditionsText) ?: [] as $line) {
                if (! str_starts_with($line, $metaPrefix)) {
                    continue;
                }

                $decoded = json_decode(substr($line, strlen($metaPrefix)), true);

                if (is_array($decoded) && in_array($decoded['dietPlanMode'] ?? null, self::PRESCRIPTION_MODES, true)) {
                    $mode = (string) $decoded['dietPlanMode'];
                }

                if (is_array($decoded) && $allowReplacement === null) {
                    $allowReplacement = ($decoded['allowFoodReplacement'] ?? false) === true;
                }

                if (is_array($decoded) && $suggestDailyReplacements === null) {
                    $suggestDailyReplacements = ($decoded['suggestDailyReplacements'] ?? false) === true;
                }

                break;
            }
        }

        $resolvedMode = $mode ?? 'daily_prescription';

        return [
            'prescription_mode' => $resolvedMode,
            'allow_food_replacement' => $resolvedMode === 'daily_prescription' ? ($allowReplacement ?? false) : false,
            'suggest_daily_replacements' => $resolvedMode === 'daily_prescription' ? ($suggestDailyReplacements ?? false) : false,
        ];
    }

    private function deletePhysicalFile(?string $path): void
    {
        $this->deleteTenantMediaFile($path);
    }

    private function ensureAdmin(Request $request): void
    {
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));
    }

    private function dietBasisOptions(): Collection
    {
        return collect([
            'exchange' => 'واحدی (Exchange)',
            'calorie' => 'مبتنی بر کالری',
            'macros' => 'مبتنی بر ماکرو (Macros)',
            'fasting' => 'فستینگ (زمان‌بندی)',
            'food-based' => 'مبتنی بر نوع غذا (Food-based)',
            'glycemic-index' => 'مبتنی بر شاخص گلایسمی',
        ]);
    }

    private function goalOptions(): Collection
    {
        return collect([
            'lose-weight' => 'کاهش وزن',
            'gain-weight' => 'افزایش وزن',
            'maintain-weight' => 'تثبیت وزن',
        ]);
    }
}
