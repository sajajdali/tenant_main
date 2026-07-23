<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\NutritionDietPrescription;
use App\Domain\Tenant\Models\NutritionDietRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class NutritionAiDietPersister
{
    public function __construct(
        private readonly NutritionPrescriptionActivationService $activation,
    ) {
    }

    /**
     * @param  array<string, mixed>  $content
     * @param  array{publishImmediately?: bool, overwriteExisting?: bool}|array<string, mixed>  $options
     */
    public function persist(NutritionDietRequest $request, array $content, array $options = []): NutritionDietPrescription
    {
        $content = $this->enrichContent($request, $content);
        $publishImmediately = (bool) ($options['publishImmediately'] ?? true);
        $overwriteExisting = array_key_exists('overwriteExisting', $options)
            ? (bool) $options['overwriteExisting']
            : $this->shouldOverwriteExistingPrescription($request);

        return DB::transaction(function () use ($content, $overwriteExisting, $publishImmediately, $request): NutritionDietPrescription {
            $previous = NutritionDietPrescription::query()
                ->where('nutrition_diet_request_id', $request->id)
                ->latest('id')
                ->first();

            if ($publishImmediately) {
                $this->activation->archiveOtherCurrentPrescriptions(
                    (int) $request->user_id,
                    $overwriteExisting ? $previous?->id : null,
                );
            }

            if ($overwriteExisting && $previous) {
                $updateAttributes = [
                    'nutrition_profile_snapshot_id' => $request->nutrition_profile_snapshot_id,
                    'nutrition_diet_template_id' => $request->nutrition_diet_template_id,
                    'issued_by_user_id' => $request->ai_requested_by_user_id,
                    'approved_by_user_id' => $publishImmediately ? $request->ai_requested_by_user_id : null,
                    'delivery_channel' => 'ai',
                    'prescription_mode' => (string) ($content['mode'] ?? $request->prescription_mode),
                    'status' => $publishImmediately ? 'active' : 'draft',
                    'allow_food_replacement' => (bool) ($content['allow_food_replacement'] ?? false),
                    'current_weight_kg' => $request->current_weight_kg,
                    'target_weight_kg' => $request->target_weight_kg,
                    'weekly_weight_change_kg' => $request->weekly_weight_change_kg,
                    'started_at' => $request->started_at,
                    'ends_at' => $request->ends_at,
                    'is_current' => $publishImmediately,
                    'summary_text' => $this->asString($content['summary_text'] ?? null),
                    'notes' => $this->asString($content['notes'] ?? null),
                    'template_snapshot' => $request->template_snapshot,
                    'profile_snapshot' => $request->profile_snapshot,
                    'content_snapshot' => $content,
                    'published_at' => $publishImmediately ? now() : null,
                ];

                if (Schema::hasColumn('nutrition_prescriptions', 'suggest_daily_replacements')) {
                    $updateAttributes['suggest_daily_replacements'] = (bool) ($content['suggest_daily_replacements'] ?? false);
                }

                $previous->forceFill($updateAttributes)->save();

                $prescription = $previous;
                $this->clearPrescriptionChildren((int) $prescription->id);
            } else {
                if ($previous && $publishImmediately) {
                    $previous->forceFill([
                        'is_current' => false,
                        'status' => 'archived',
                    ])->save();
                }

                $createAttributes = [
                    'nutrition_diet_request_id' => $request->id,
                    'user_id' => $request->user_id,
                    'nutrition_profile_snapshot_id' => $request->nutrition_profile_snapshot_id,
                    'nutrition_diet_template_id' => $request->nutrition_diet_template_id,
                    'issued_by_user_id' => $request->ai_requested_by_user_id,
                    'approved_by_user_id' => $publishImmediately ? $request->ai_requested_by_user_id : null,
                    'supersedes_prescription_id' => $previous?->id,
                    'delivery_channel' => 'ai',
                    'prescription_mode' => (string) ($content['mode'] ?? $request->prescription_mode),
                    'status' => $publishImmediately ? 'active' : 'draft',
                    'allow_food_replacement' => (bool) ($content['allow_food_replacement'] ?? false),
                    'current_weight_kg' => $request->current_weight_kg,
                    'target_weight_kg' => $request->target_weight_kg,
                    'weekly_weight_change_kg' => $request->weekly_weight_change_kg,
                    'started_at' => $request->started_at,
                    'ends_at' => $request->ends_at,
                    'version' => $previous ? ((int) $previous->version + 1) : 1,
                    'is_current' => $publishImmediately,
                    'summary_text' => $this->asString($content['summary_text'] ?? null),
                    'notes' => $this->asString($content['notes'] ?? null),
                    'template_snapshot' => $request->template_snapshot,
                    'profile_snapshot' => $request->profile_snapshot,
                    'content_snapshot' => $content,
                    'published_at' => $publishImmediately ? now() : null,
                ];

                if (Schema::hasColumn('nutrition_prescriptions', 'suggest_daily_replacements')) {
                    $createAttributes['suggest_daily_replacements'] = (bool) ($content['suggest_daily_replacements'] ?? false);
                }

                $prescription = NutritionDietPrescription::query()->create($createAttributes);
            }

            $this->persistMealSlots($prescription->id, $content);
            $this->persistDayPlans($prescription->id, $content);
            $this->persistTextSections($prescription->id, $content);

            return $prescription;
        });
    }

    /**
     * @param  array<string, mixed>  $content
     */
    private function persistMealSlots(int $prescriptionId, array $content): void
    {
        $slots = is_array($content['meal_slots'] ?? null) ? $content['meal_slots'] : [];

        foreach ($slots as $slot) {
            if (! is_array($slot)) {
                continue;
            }

            $slotId = DB::table('nutrition_prescription_meal_slots')->insertGetId([
                'nutrition_diet_prescription_id' => $prescriptionId,
                'nutrition_diet_template_meal_slot_id' => null,
                'slot_key' => $this->asString($slot['slot_key'] ?? null),
                'title' => $this->asString($slot['title'] ?? null),
                'icon' => null,
                'description' => $this->asString($slot['description'] ?? null),
                'food_count' => max(0, (int) ($slot['food_count'] ?? 0)),
                'sort_order' => max(0, (int) ($slot['sort_order'] ?? 0)),
                'is_enabled' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            foreach (is_array($slot['options'] ?? null) ? $slot['options'] : [] as $option) {
                if (! is_array($option)) {
                    continue;
                }

                DB::table('nutrition_prescription_meal_options')->insert([
                    'nutrition_prescription_meal_slot_id' => $slotId,
                    'nutrition_diet_template_meal_option_id' => null,
                    'title' => $this->asString($option['title'] ?? null),
                    'description' => $this->asString($option['description'] ?? null),
                    'quantity_text' => $this->asString($option['quantity_text'] ?? null),
                    'calories' => isset($option['calories']) ? max(0, (int) $option['calories']) : null,
                    'metadata' => json_encode([
                        'targetCalories' => isset($slot['target_calories']) ? max(0, (int) $slot['target_calories']) : null,
                    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    'sort_order' => 0,
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    /**
     * @param  array<string, mixed>  $content
     */
    private function persistDayPlans(int $prescriptionId, array $content): void
    {
        $plans = is_array($content['day_plans'] ?? null) ? $content['day_plans'] : [];

        foreach ($plans as $plan) {
            if (! is_array($plan)) {
                continue;
            }

            $planId = DB::table('nutrition_prescription_day_plans')->insertGetId([
                'nutrition_diet_prescription_id' => $prescriptionId,
                'nutrition_diet_template_day_plan_id' => null,
                'day_number' => max(1, (int) ($plan['day_number'] ?? 1)),
                'day_label' => $this->asString($plan['day_label'] ?? null),
                'notes' => $this->asString($plan['notes'] ?? null),
                'sort_order' => max(0, (int) (($plan['day_number'] ?? 1) - 1)),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            foreach (is_array($plan['meals'] ?? null) ? $plan['meals'] : [] as $meal) {
                if (! is_array($meal)) {
                    continue;
                }

                $mealId = DB::table('nutrition_prescription_day_meals')->insertGetId([
                    'nutrition_prescription_day_plan_id' => $planId,
                    'nutrition_diet_template_day_meal_id' => null,
                    'slot_key' => $this->asString($meal['slot_key'] ?? null),
                    'title' => $this->asString($meal['title'] ?? null),
                    'meal_text' => $this->asString($meal['meal_text'] ?? null),
                    'description' => $this->asString($meal['description'] ?? null) . (isset($meal['calories']) ? "\nکالری: " . max(0, (int) $meal['calories']) . ' kcal' : ''),
                    'sort_order' => 0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                foreach (is_array($meal['replacements'] ?? null) ? $meal['replacements'] : [] as $replacement) {
                    if (! is_array($replacement)) {
                        continue;
                    }

                    DB::table('nutrition_prescription_day_meal_replacements')->insert([
                        'nutrition_prescription_day_meal_id' => $mealId,
                        'nutrition_diet_template_day_meal_replacement_id' => null,
                        'title' => $this->asString($replacement['title'] ?? null),
                        'description' => $this->asString($replacement['description'] ?? null),
                        'quantity_text' => $this->asString($replacement['quantity_text'] ?? null),
                        'calories' => isset($replacement['calories']) ? max(0, (int) $replacement['calories']) : null,
                        'metadata' => null,
                        'sort_order' => 0,
                        'is_active' => true,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }
    }

    /**
     * @param  array<string, mixed>  $content
     */
    private function persistTextSections(int $prescriptionId, array $content): void
    {
        foreach (is_array($content['text_sections'] ?? null) ? $content['text_sections'] : [] as $section) {
            if (! is_array($section)) {
                continue;
            }

            DB::table('nutrition_prescription_text_sections')->insert([
                'nutrition_diet_prescription_id' => $prescriptionId,
                'nutrition_diet_template_text_section_id' => null,
                'title' => $this->asString($section['title'] ?? null),
                'body' => $this->asString($section['body'] ?? null),
                'page_number' => max(1, (int) ($section['page_number'] ?? 1)),
                'sort_order' => max(0, (int) (($section['page_number'] ?? 1) - 1)),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function asString(mixed $value): string
    {
        return trim((string) $value);
    }

    private function shouldOverwriteExistingPrescription(NutritionDietRequest $request): bool
    {
        return NutritionDietPrescription::query()
            ->where('nutrition_diet_request_id', $request->id)
            ->exists();
    }

    private function clearPrescriptionChildren(int $prescriptionId): void
    {
        DB::table('nutrition_prescription_audio_tracks')
            ->where('nutrition_diet_prescription_id', $prescriptionId)
            ->delete();

        DB::table('nutrition_prescription_text_sections')
            ->where('nutrition_diet_prescription_id', $prescriptionId)
            ->delete();

        $dayPlanIds = DB::table('nutrition_prescription_day_plans')
            ->where('nutrition_diet_prescription_id', $prescriptionId)
            ->pluck('id');

        if ($dayPlanIds->isNotEmpty()) {
            $dayMealIds = DB::table('nutrition_prescription_day_meals')
                ->whereIn('nutrition_prescription_day_plan_id', $dayPlanIds->all())
                ->pluck('id');

            if ($dayMealIds->isNotEmpty()) {
                DB::table('nutrition_prescription_day_meal_replacements')
                    ->whereIn('nutrition_prescription_day_meal_id', $dayMealIds->all())
                    ->delete();
            }

            DB::table('nutrition_prescription_day_meals')
                ->whereIn('nutrition_prescription_day_plan_id', $dayPlanIds->all())
                ->delete();
        }

        DB::table('nutrition_prescription_day_plans')
            ->where('nutrition_diet_prescription_id', $prescriptionId)
            ->delete();

        $slotIds = DB::table('nutrition_prescription_meal_slots')
            ->where('nutrition_diet_prescription_id', $prescriptionId)
            ->pluck('id');

        if ($slotIds->isNotEmpty()) {
            DB::table('nutrition_prescription_meal_options')
                ->whereIn('nutrition_prescription_meal_slot_id', $slotIds->all())
                ->delete();
        }

        DB::table('nutrition_prescription_meal_slots')
            ->where('nutrition_diet_prescription_id', $prescriptionId)
            ->delete();
    }

    /**
     * @param array<string, mixed> $content
     * @return array<string, mixed>
     */
    private function enrichContent(NutritionDietRequest $request, array $content): array
    {
        $profile = is_array($request->profile_snapshot) ? $request->profile_snapshot : [];
        $template = is_array($request->template_snapshot) ? $request->template_snapshot : [];
        $mode = (string) ($request->prescription_mode ?? $content['mode'] ?? '');

        if ($mode === 'fixed_text') {
            return $this->enrichFixedTextContent($request, $content, $template);
        }

        $content = $this->normalizeDailyPlans($request, $content);
        $content = $this->normalizeMacroTargets($content);
        $content['water_plan'] = $this->waterPlan($content['water_plan'] ?? null, $profile);
        $content['supplement_plan'] = $this->supplementPlan($content['supplement_plan'] ?? null, $template, $request);
        $content['guidance_sections'] = is_array($content['guidance_sections'] ?? null) ? $content['guidance_sections'] : [];
        $content['calorie_plan'] = $this->caloriePlan($content['calorie_plan'] ?? null, $request, $content);
        $content['allow_food_replacement'] = (bool) $request->allow_food_replacement;
        $content['suggest_daily_replacements'] = (bool) $request->suggest_daily_replacements;
        $content['intro_banner'] = $this->asString($content['intro_banner'] ?? null) !== ''
            ? $this->asString($content['intro_banner'] ?? null)
            : sprintf('این رژیم را باید %d روز با دقت رعایت کنید.', max(1, optional($request->ends_at)->diffInDays($request->started_at) + 1));

        return $content;
    }

    /**
     * @param array<string, mixed> $content
     * @param array<string, mixed> $template
     * @return array<string, mixed>
     */
    private function enrichFixedTextContent(NutritionDietRequest $request, array $content, array $template): array
    {
        $sections = collect(is_array($content['text_sections'] ?? null) ? $content['text_sections'] : [])
            ->filter(fn ($section): bool => is_array($section))
            ->map(function (array $section, int $index): array {
                return [
                    'page_number' => max(1, (int) ($section['page_number'] ?? ($index + 1))),
                    'title' => $this->asString($section['title'] ?? null) !== '' ? $this->asString($section['title'] ?? null) : 'توصیه',
                    'body' => $this->asString($section['body'] ?? null),
                ];
            })
            ->filter(fn (array $section): bool => $section['body'] !== '')
            ->values()
            ->all();

        if ($sections === []) {
            $fallbackBody = trim(implode("\n\n", array_filter([
                $this->asString($template['templateNotes'] ?? null),
                $this->asString($request->generation_instructions),
                $this->asString($request->expert_notes),
            ], fn (string $value): bool => $value !== '')));

            if ($fallbackBody !== '') {
                $sections[] = [
                    'page_number' => 1,
                    'title' => 'توصیه‌های رژیم',
                    'body' => $fallbackBody,
                ];
            }
        }

        $content['mode'] = 'fixed_text';
        $content['meal_slots'] = [];
        $content['day_plans'] = [];
        $content['text_sections'] = $sections;
        $content['water_plan'] = [
            'daily_target_ml' => 0,
            'daily_target_glasses' => 0,
            'summary_text' => '',
            'timing_tips' => [],
        ];
        $content['supplement_plan'] = [
            'enabled' => false,
            'summary_text' => '',
            'items' => [],
        ];
        $content['guidance_sections'] = [];
        $content['calorie_plan'] = [
            'base_calories' => 0,
            'prescribed_calories' => 0,
            'goal_adjustment' => '',
            'reasoning' => '',
            'summary_text' => '',
        ];
        $content['allow_food_replacement'] = false;
        $content['suggest_daily_replacements'] = false;
        $content['summary_text'] = $this->asString($content['summary_text'] ?? null) !== ''
            ? $this->asString($content['summary_text'] ?? null)
            : 'توصیه‌های اختصاصی شما';
        $content['notes'] = $this->asString($content['notes'] ?? null);
        $content['intro_banner'] = $this->asString($content['intro_banner'] ?? null) !== ''
            ? $this->asString($content['intro_banner'] ?? null)
            : 'این نسخه شامل توصیه‌های متنی کارشناس برای اجرای بهتر برنامه شماست.';
        $content['duration_days'] = max(1, (int) (($content['duration_days'] ?? null)
            ?: (is_array($request->template_snapshot) ? ($request->template_snapshot['durationDays'] ?? 0) : 0)
            ?: max(1, optional($request->ends_at)->diffInDays($request->started_at) + 1)));

        return $content;
    }

    /**
     * @param array<string, mixed> $content
     * @return array<string, mixed>
     */
    private function normalizeDailyPlans(NutritionDietRequest $request, array $content): array
    {
        $mode = (string) ($content['mode'] ?? $request->prescription_mode ?? '');
        if ($mode !== 'daily_prescription') {
            return $content;
        }

        $requiredDurationDays = (int) (($content['duration_days'] ?? null)
            ?: (is_array($request->template_snapshot) ? ($request->template_snapshot['durationDays'] ?? 0) : 0)
            ?: max(1, optional($request->ends_at)->diffInDays($request->started_at) + 1));

        $plans = collect(is_array($content['day_plans'] ?? null) ? $content['day_plans'] : [])
            ->filter(fn ($plan): bool => is_array($plan))
            ->values();

        if ($plans->isEmpty()) {
            return $content;
        }

        $normalizedPlans = [];

        foreach ($plans as $index => $sourcePlan) {
            if (! is_array($sourcePlan)) {
                continue;
            }

            $dayNumber = max(1, (int) ($sourcePlan['day_number'] ?? ($index + 1)));
            if ($dayNumber > $requiredDurationDays) {
                continue;
            }

            $plan = $sourcePlan;
            $plan['day_number'] = $dayNumber;
            $plan['day_label'] = $this->asString($plan['day_label'] ?? null) !== ''
                ? $this->asString($plan['day_label'] ?? null)
                : 'روز ' . $dayNumber;
            $plan['notes'] = $this->asString($plan['notes'] ?? null);
            $plan['day_total_calories'] = isset($plan['day_total_calories']) ? max(0, (int) $plan['day_total_calories']) : 0;
            $plan['meals'] = array_values(array_filter(
                is_array($plan['meals'] ?? null) ? $plan['meals'] : [],
                fn ($meal): bool => is_array($meal)
            ));
            $plan['macro_targets'] = $this->macroTargets($plan['macro_targets'] ?? null, $this->sumMealMacros($plan['meals']));

            $normalizedPlans[$dayNumber] = $plan;
        }

        ksort($normalizedPlans);

        $content['day_plans'] = array_values($normalizedPlans);
        $content['duration_days'] = max(1, $requiredDurationDays);

        return $content;
    }

    /**
     * @param array<string, mixed> $content
     * @return array<string, mixed>
     */
    private function normalizeMacroTargets(array $content): array
    {
        $mode = (string) ($content['mode'] ?? '');

        if ($mode === 'daily_prescription') {
            $plans = collect(is_array($content['day_plans'] ?? null) ? $content['day_plans'] : [])
                ->filter(fn ($plan): bool => is_array($plan))
                ->values();
            $planTargets = $plans
                ->map(fn (array $plan): array => $this->macroTargets($plan['macro_targets'] ?? null, $this->sumMealMacros(is_array($plan['meals'] ?? null) ? $plan['meals'] : [])))
                ->filter(fn (array $targets): bool => array_sum($targets) > 0)
                ->values();

            $content['macro_targets'] = $this->macroTargets(
                $content['macro_targets'] ?? null,
                $this->averageMacroTargets($planTargets->all()),
            );

            return $content;
        }

        if ($mode === 'user_choice') {
            $content['macro_targets'] = $this->macroTargets(
                $content['macro_targets'] ?? null,
                $this->estimateUserChoiceMacroTargets(is_array($content['meal_slots'] ?? null) ? $content['meal_slots'] : []),
            );

            return $content;
        }

        $content['macro_targets'] = $this->macroTargets($content['macro_targets'] ?? null);

        return $content;
    }

    /**
     * @param mixed $value
     * @param array<string, float|int>|null $fallback
     * @return array{protein_grams:float,fat_grams:float,carbohydrate_grams:float,fiber_grams:float}
     */
    private function macroTargets(mixed $value, ?array $fallback = null): array
    {
        $source = is_array($value) ? $value : [];
        $fallback ??= [];

        return [
            'protein_grams' => $this->macroValue($source['protein_grams'] ?? $fallback['protein_grams'] ?? 0, 300),
            'fat_grams' => $this->macroValue($source['fat_grams'] ?? $fallback['fat_grams'] ?? 0, 300),
            'carbohydrate_grams' => $this->macroValue($source['carbohydrate_grams'] ?? $fallback['carbohydrate_grams'] ?? 0, 600),
            'fiber_grams' => $this->macroValue($source['fiber_grams'] ?? $fallback['fiber_grams'] ?? 0, 150),
        ];
    }

    private function macroValue(mixed $value, float $max): float
    {
        return round(max(0, min($max, (float) $value)), 1);
    }

    /**
     * @param array<int, mixed> $meals
     * @return array<string, float>
     */
    private function sumMealMacros(array $meals): array
    {
        $totals = ['protein_grams' => 0.0, 'fat_grams' => 0.0, 'carbohydrate_grams' => 0.0, 'fiber_grams' => 0.0];

        foreach ($meals as $meal) {
            if (! is_array($meal)) {
                continue;
            }

            foreach (array_keys($totals) as $key) {
                $totals[$key] += max(0, (float) ($meal[$key] ?? 0));
            }
        }

        return array_map(fn (float $value): float => round($value, 1), $totals);
    }

    /**
     * @param array<int, array<string, float|int>> $targets
     * @return array<string, float>
     */
    private function averageMacroTargets(array $targets): array
    {
        if ($targets === []) {
            return [];
        }

        $totals = ['protein_grams' => 0.0, 'fat_grams' => 0.0, 'carbohydrate_grams' => 0.0, 'fiber_grams' => 0.0];

        foreach ($targets as $target) {
            foreach (array_keys($totals) as $key) {
                $totals[$key] += max(0, (float) ($target[$key] ?? 0));
            }
        }

        return array_map(fn (float $value): float => round($value / count($targets), 1), $totals);
    }

    /**
     * @param array<int, mixed> $slots
     * @return array<string, float>
     */
    private function estimateUserChoiceMacroTargets(array $slots): array
    {
        $totals = ['protein_grams' => 0.0, 'fat_grams' => 0.0, 'carbohydrate_grams' => 0.0, 'fiber_grams' => 0.0];

        foreach ($slots as $slot) {
            if (! is_array($slot)) {
                continue;
            }

            $options = collect(is_array($slot['options'] ?? null) ? $slot['options'] : [])
                ->filter(fn ($option): bool => is_array($option))
                ->values();

            if ($options->isEmpty()) {
                continue;
            }

            foreach (array_keys($totals) as $key) {
                $totals[$key] += (float) $options->avg(fn (array $option): float => max(0, (float) ($option[$key] ?? 0)));
            }
        }

        return array_map(fn (float $value): float => round($value, 1), $totals);
    }

    /**
     * @param mixed $existing
     * @param array<string, mixed> $profile
     * @return array<string, mixed>
     */
    private function waterPlan(mixed $existing, array $profile): array
    {
        $plan = is_array($existing) ? $existing : [];
        $weightKg = isset($profile['weightKg']) ? (float) $profile['weightKg'] : 0.0;
        $targetMl = isset($plan['daily_target_ml']) && (int) $plan['daily_target_ml'] > 0
            ? (int) $plan['daily_target_ml']
            : max(1800, ((int) round($weightKg > 0 ? $weightKg * 35 : 2100 / 1)));
        $targetGlasses = isset($plan['daily_target_glasses']) && (int) $plan['daily_target_glasses'] > 0
            ? (int) $plan['daily_target_glasses']
            : max(6, (int) round($targetMl / 250));

        return [
            'daily_target_ml' => $targetMl,
            'daily_target_glasses' => $targetGlasses,
            'summary_text' => $this->asString($plan['summary_text'] ?? null) !== ''
                ? $this->asString($plan['summary_text'] ?? null)
                : 'مقدار آب روزانه این نسخه بر اساس وزن فعلی و شرایط ثبت‌شده شما تعیین شده است.',
            'timing_tips' => is_array($plan['timing_tips'] ?? null) && $plan['timing_tips'] !== []
                ? array_values($plan['timing_tips'])
                : ['یک لیوان بعد از بیدار شدن', 'یک لیوان بین صبحانه و ناهار', 'یک لیوان بین ناهار و شام'],
        ];
    }

    /**
     * @param mixed $existing
     * @param array<string, mixed> $template
     * @return array<string, mixed>
     */
    private function supplementPlan(mixed $existing, array $template, NutritionDietRequest $request): array
    {
        $plan = is_array($existing) ? $existing : [];
        $instructionText = implode(' ', array_filter([
            (string) $request->generation_instructions,
            (string) $request->must_include,
            (string) $request->expert_notes,
            (string) $request->clinical_notes,
        ]));
        $requestedByPrompt = preg_match('/مکمل|supplement/i', $instructionText) === 1;
        $enabled = isset($plan['enabled'])
            ? (bool) $plan['enabled']
            : ((bool) ($template['supplementsEnabled'] ?? false) || $requestedByPrompt);
        $templateNotes = trim((string) ($template['supplementNotes'] ?? ''));
        $items = is_array($plan['items'] ?? null) ? $plan['items'] : [];

        if ($enabled && $items === [] && ($templateNotes !== '' || $instructionText !== '')) {
            $items = [[
                'title' => 'مکمل پیشنهادی',
                'usage' => $templateNotes !== '' ? $templateNotes : $instructionText,
                'timing' => 'طبق دستور نسخه',
                'notes' => 'قبل از مصرف با شرایط بدنی و داروهای فعلی کاربر تطبیق داده شود.',
            ]];
        }

        return [
            'enabled' => $enabled,
            'summary_text' => $this->asString($plan['summary_text'] ?? null) !== ''
                ? $this->asString($plan['summary_text'] ?? null)
                : ($enabled ? ($templateNotes !== '' ? $templateNotes : 'در این نسخه مصرف مکمل هم در نظر گرفته شده است.') : 'در این نسخه مکمل ضروری ثبت نشده است.'),
            'items' => $items,
        ];
    }

    /**
     * @param mixed $existing
     * @param array<string, mixed> $content
     * @return array<string, mixed>
     */
    private function caloriePlan(mixed $existing, NutritionDietRequest $request, array $content): array
    {
        $plan = is_array($existing) ? $existing : [];

        $baseCalories = isset($plan['base_calories']) && (int) $plan['base_calories'] > 0
            ? (int) $plan['base_calories']
            : max(1200, (int) round(((float) ($request->current_weight_kg ?? 0)) * 24));

        $prescribedCalories = isset($plan['prescribed_calories']) && (int) $plan['prescribed_calories'] > 0
            ? (int) $plan['prescribed_calories']
            : $this->guessPrescribedCalories($content, $baseCalories, (float) ($request->weekly_weight_change_kg ?? 0));

        return [
            'base_calories' => $baseCalories,
            'prescribed_calories' => $prescribedCalories,
            'goal_adjustment' => $this->asString($plan['goal_adjustment'] ?? null) !== ''
                ? $this->asString($plan['goal_adjustment'] ?? null)
                : sprintf('با توجه به هدف %s و سرعت تغییر وزن %s کیلو در هفته، کالری نسخه تنظیم شده است.', $request->diet_goal ?: 'کاربر', number_format((float) ($request->weekly_weight_change_kg ?? 0), 1)),
            'reasoning' => $this->asString($plan['reasoning'] ?? null) !== ''
                ? $this->asString($plan['reasoning'] ?? null)
                : 'این نسخه از کالری پایه شروع می‌کند و با توجه به هدف و شرایط کاربر، کسری یا مازاد کنترل‌شده ایجاد می‌کند.',
            'summary_text' => $this->asString($plan['summary_text'] ?? null) !== ''
                ? $this->asString($plan['summary_text'] ?? null)
                : sprintf('کالری پایه کاربر %d و کالری نسخه %d در نظر گرفته شده است.', $baseCalories, $prescribedCalories),
        ];
    }

    /**
     * @param array<string, mixed> $content
     */
    private function guessPrescribedCalories(array $content, int $baseCalories, float $weeklyWeightChange): int
    {
        $slotCalories = collect(is_array($content['meal_slots'] ?? null) ? $content['meal_slots'] : [])
            ->sum(fn ($slot): int => is_array($slot) ? (int) ($slot['target_calories'] ?? 0) : 0);

        if ($slotCalories > 0) {
            return $slotCalories;
        }

        $dayCalories = collect(is_array($content['day_plans'] ?? null) ? $content['day_plans'] : [])
            ->avg(fn ($plan): float => is_array($plan) ? (float) ($plan['day_total_calories'] ?? 0) : 0.0);

        if ($dayCalories > 0) {
            return (int) round($dayCalories);
        }

        if ($weeklyWeightChange > 0) {
            return max(900, $baseCalories - (int) round($weeklyWeightChange * 250));
        }

        return $baseCalories;
    }
}
