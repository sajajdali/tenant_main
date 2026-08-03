<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\NutritionDietPrescription;
use App\Domain\Tenant\Models\NutritionDietTemplate;
use App\Domain\Tenant\Models\NutritionTokenLedger;
use App\Domain\Tenant\Models\TenantUser;
use App\Domain\Tenant\Models\GeneralSetting;
use InvalidArgumentException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class NutritionDietRequestSettingsService
{
    public function __construct(
        private readonly NutritionAiDietPromptCatalog $promptCatalog,
    ) {
    }

    public function payload(): array
    {
        return [
            'manualAiApprovalRequired' => $this->manualAiApprovalRequired(),
            'holdIncompletePrescriptionsForReview' => $this->holdIncompletePrescriptionsForReview(),
            'exerciseLoggingEnabled' => $this->exerciseLoggingEnabled(),
            'outOfPlanMealLoggingEnabled' => $this->outOfPlanMealLoggingEnabled(),
            'mealPhotoAnalysisEnabled' => $this->mealPhotoAnalysisEnabled(),
            'mealPhotoAnalysisHourlyLimit' => $this->mealPhotoAnalysisHourlyLimit(),
            'mealPhotoAnalysisDietLimit' => $this->mealPhotoAnalysisDietLimit(),
            'manualMealNutritionHourlyLimit' => $this->manualMealNutritionHourlyLimit(),
            'manualMealNutritionDietLimit' => $this->manualMealNutritionDietLimit(),
            'mealReplacementHourlyLimit' => $this->mealReplacementHourlyLimit(),
            'mealReplacementDietLimit' => $this->mealReplacementDietLimit(),
            'autoFirstDietEnabled' => $this->autoFirstDietEnabled(),
            'autoFirstDietTemplateId' => $this->autoFirstDietTemplateId(),
            'autoFirstDietTemplateIds' => $this->autoFirstDietTemplateIds(),
            'autoFirstDietRequiresApproval' => $this->autoFirstDietRequiresApproval(),
            'dietTemplateOptions' => $this->dietTemplateOptions(),
            'dietGenerationPrompt' => $this->effectivePromptText('general'),
            'promptSettings' => $this->promptSettingsPayload(),
        ];
    }

    public function manualAiApprovalRequired(): bool
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $nutritionSettings = is_array($rules['nutrition_settings'] ?? null) ? $rules['nutrition_settings'] : [];
        $nutritionRequests = is_array($rules['nutrition_requests'] ?? null) ? $rules['nutrition_requests'] : [];

        if (array_key_exists('manual_ai_approval_required', $nutritionSettings)) {
            return (bool) $nutritionSettings['manual_ai_approval_required'];
        }

        return (bool) ($nutritionRequests['manual_ai_approval_required'] ?? false);
    }

    public function dietGenerationPrompt(): string
    {
        return $this->effectivePromptText('general');
    }

    public function holdIncompletePrescriptionsForReview(): bool
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $nutritionSettings = is_array($rules['nutrition_settings'] ?? null) ? $rules['nutrition_settings'] : [];

        return (bool) ($nutritionSettings['hold_incomplete_prescriptions_for_review'] ?? false);
    }

    public function exerciseLoggingEnabled(): bool
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $nutritionSettings = is_array($rules['nutrition_settings'] ?? null) ? $rules['nutrition_settings'] : [];

        if (array_key_exists('exercise_logging_enabled', $nutritionSettings)) {
            return (bool) $nutritionSettings['exercise_logging_enabled'];
        }

        return true;
    }

    public function outOfPlanMealLoggingEnabled(): bool
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $nutritionSettings = is_array($rules['nutrition_settings'] ?? null) ? $rules['nutrition_settings'] : [];

        if (array_key_exists('out_of_plan_meal_logging_enabled', $nutritionSettings)) {
            return (bool) $nutritionSettings['out_of_plan_meal_logging_enabled'];
        }

        return true;
    }

    public function mealPhotoAnalysisEnabled(): bool
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $nutritionSettings = is_array($rules['nutrition_settings'] ?? null) ? $rules['nutrition_settings'] : [];

        if (array_key_exists('meal_photo_analysis_enabled', $nutritionSettings)) {
            return (bool) $nutritionSettings['meal_photo_analysis_enabled'];
        }

        return true;
    }

    public function mealPhotoAnalysisHourlyLimit(): ?int
    {
        return $this->nullablePositiveInt('meal_photo_analysis_hourly_limit');
    }

    public function mealPhotoAnalysisDietLimit(): ?int
    {
        return $this->nullablePositiveInt('meal_photo_analysis_diet_limit');
    }

    public function manualMealNutritionHourlyLimit(): ?int
    {
        return $this->nullablePositiveInt('manual_meal_nutrition_hourly_limit');
    }

    public function manualMealNutritionDietLimit(): ?int
    {
        return $this->nullablePositiveInt('manual_meal_nutrition_diet_limit');
    }

    public function mealReplacementHourlyLimit(): ?int
    {
        return $this->nullablePositiveInt('meal_replacement_hourly_limit');
    }

    public function mealReplacementDietLimit(): ?int
    {
        return $this->nullablePositiveInt('meal_replacement_diet_limit');
    }

    public function autoFirstDietEnabled(): bool
    {
        return (bool) ($this->nutritionSettings()['auto_first_diet_enabled'] ?? false);
    }

    public function autoFirstDietTemplateId(): ?int
    {
        return $this->normalizeNullablePositiveInt($this->nutritionSettings()['auto_first_diet_template_id'] ?? null);
    }

    public function autoFirstDietTemplateIds(): array
    {
        $settings = $this->nutritionSettings();
        $values = is_array($settings['auto_first_diet_template_ids'] ?? null) ? $settings['auto_first_diet_template_ids'] : [];
        $fallback = $this->autoFirstDietTemplateId();

        return collect(['lose-weight', 'gain-weight', 'maintain-weight'])
            ->mapWithKeys(fn (string $goal): array => [
                $goal => $this->normalizeNullablePositiveInt($values[$goal] ?? null) ?? $fallback,
            ])
            ->all();
    }

    public function autoFirstDietTemplateIdForGoal(?string $goal): ?int
    {
        $goal = in_array($goal, ['lose-weight', 'gain-weight', 'maintain-weight'], true) ? $goal : 'lose-weight';

        return $this->autoFirstDietTemplateIds()[$goal] ?? null;
    }

    public function autoFirstDietRequiresApproval(): bool
    {
        return (bool) ($this->nutritionSettings()['auto_first_diet_requires_approval'] ?? false);
    }

    public function assertMealPhotoAnalysisUsageAllowed(NutritionDietPrescription $prescription, TenantUser $user): void
    {
        $this->assertAiUsageAllowed('meal_photo_analysis', $prescription, $user);
    }

    public function assertAiUsageAllowed(string $operationType, NutritionDietPrescription $prescription, TenantUser $user): void
    {
        $config = $this->aiUsageLimitConfig($operationType);
        $hourlyLimit = $config['hourly_limit'];
        $hourlyLimit = $this->effectiveLimit($operationType, $prescription, $hourlyLimit, 'hourly_limit');
        if ($hourlyLimit !== null) {
            $usedInHour = $this->aiUsageLedgerQuery($user, $config['reason_code'], $operationType)
                ->where('occurred_at', '>=', now()->subHour())
                ->count()
                + $this->pendingAiUsageCount($operationType, $prescription, $user, true);

            if ($usedInHour >= $hourlyLimit) {
                throw ValidationException::withMessages([
                    'ai_limit' => sprintf(
                        'برای حفظ کیفیت سرویس، سقف استفاده از «%s» در هر ساعت تکمیل شده است. کمی بعد دوباره تلاش کنید.',
                        $config['label'],
                    ),
                ]);
            }
        }

        $dietLimit = $config['diet_limit'];
        $dietRequestId = $prescription->nutrition_diet_request_id;
        $dietLimit = $this->effectiveLimit($operationType, $prescription, $dietLimit, 'diet_limit');
        if ($dietLimit !== null && $dietRequestId) {
            $usedInDiet = $this->aiUsageLedgerQuery($user, $config['reason_code'], $operationType)
                ->where('nutrition_diet_request_id', (int) $dietRequestId)
                ->count()
                + $this->pendingAiUsageCount($operationType, $prescription, $user, false);

            if ($usedInDiet >= $dietLimit) {
                throw ValidationException::withMessages([
                    'ai_limit' => sprintf(
                        'سقف استفاده از «%s» برای این رژیم تکمیل شده است. برای افزایش سقف با کارشناس خود هماهنگ کنید.',
                        $config['label'],
                    ),
                ]);
            }
        }
    }

    public function effectivePromptText(string $key): string
    {
        $override = $this->promptOverrides()[$key] ?? null;
        $override = trim((string) $override);

        if ($override !== '') {
            return $override;
        }

        return $this->defaultPromptText($key);
    }

    /**
     * @return array{general: string, user_choice: string, daily_prescription: string, fixed_text: string, meal_replacement: string, manual_meal_nutrition: string, meal_photo_analysis: string, diet_explanations: string}
     */
    public function effectivePromptTexts(): array
    {
        return [
            'general' => $this->effectivePromptText('general'),
            'user_choice' => $this->effectivePromptText('user_choice'),
            'daily_prescription' => $this->effectivePromptText('daily_prescription'),
            'fixed_text' => $this->effectivePromptText('fixed_text'),
            'meal_replacement' => $this->effectivePromptText('meal_replacement'),
            'manual_meal_nutrition' => $this->effectivePromptText('manual_meal_nutrition'),
            'meal_photo_analysis' => $this->effectivePromptText('meal_photo_analysis'),
            'diet_explanations' => $this->effectivePromptText('diet_explanations'),
        ];
    }

    public function update(array $validated): array
    {
        $general = GeneralSetting::query()->firstOrCreate([], [
            'timezone' => 'Asia/Tehran',
            'currency' => 'IRR',
            'booking_rules' => [],
        ]);

        $rules = $general->booking_rules ?? [];
        $nutritionSettings = is_array($rules['nutrition_settings'] ?? null) ? $rules['nutrition_settings'] : [];
        $nutritionRequests = is_array($rules['nutrition_requests'] ?? null) ? $rules['nutrition_requests'] : [];
        $promptOverrides = is_array($nutritionSettings['diet_prompt_overrides'] ?? null) ? $nutritionSettings['diet_prompt_overrides'] : [];

        if (array_key_exists('manualAiApprovalRequired', $validated)) {
            $nutritionSettings['manual_ai_approval_required'] = (bool) $validated['manualAiApprovalRequired'];
            $nutritionRequests['manual_ai_approval_required'] = $nutritionSettings['manual_ai_approval_required'];
        }

        if (array_key_exists('holdIncompletePrescriptionsForReview', $validated)) {
            $nutritionSettings['hold_incomplete_prescriptions_for_review'] = (bool) $validated['holdIncompletePrescriptionsForReview'];
        }

        if (array_key_exists('exerciseLoggingEnabled', $validated)) {
            $nutritionSettings['exercise_logging_enabled'] = (bool) $validated['exerciseLoggingEnabled'];
        }

        if (array_key_exists('outOfPlanMealLoggingEnabled', $validated)) {
            $nutritionSettings['out_of_plan_meal_logging_enabled'] = (bool) $validated['outOfPlanMealLoggingEnabled'];
        }

        if (array_key_exists('mealPhotoAnalysisEnabled', $validated)) {
            $nutritionSettings['meal_photo_analysis_enabled'] = (bool) $validated['mealPhotoAnalysisEnabled'];
        }

        if (array_key_exists('mealPhotoAnalysisHourlyLimit', $validated)) {
            $nutritionSettings['meal_photo_analysis_hourly_limit'] = $this->normalizeNullablePositiveInt($validated['mealPhotoAnalysisHourlyLimit'] ?? null);
        }

        if (array_key_exists('mealPhotoAnalysisDietLimit', $validated)) {
            $nutritionSettings['meal_photo_analysis_diet_limit'] = $this->normalizeNullablePositiveInt($validated['mealPhotoAnalysisDietLimit'] ?? null);
        }

        if (array_key_exists('manualMealNutritionHourlyLimit', $validated)) {
            $nutritionSettings['manual_meal_nutrition_hourly_limit'] = $this->normalizeNullablePositiveInt($validated['manualMealNutritionHourlyLimit'] ?? null);
        }

        if (array_key_exists('manualMealNutritionDietLimit', $validated)) {
            $nutritionSettings['manual_meal_nutrition_diet_limit'] = $this->normalizeNullablePositiveInt($validated['manualMealNutritionDietLimit'] ?? null);
        }

        if (array_key_exists('mealReplacementHourlyLimit', $validated)) {
            $nutritionSettings['meal_replacement_hourly_limit'] = $this->normalizeNullablePositiveInt($validated['mealReplacementHourlyLimit'] ?? null);
        }

        if (array_key_exists('mealReplacementDietLimit', $validated)) {
            $nutritionSettings['meal_replacement_diet_limit'] = $this->normalizeNullablePositiveInt($validated['mealReplacementDietLimit'] ?? null);
        }

        if (array_key_exists('autoFirstDietEnabled', $validated)) {
            $nutritionSettings['auto_first_diet_enabled'] = (bool) $validated['autoFirstDietEnabled'];
        }

        if (array_key_exists('autoFirstDietTemplateId', $validated)) {
            $nutritionSettings['auto_first_diet_template_id'] = $this->normalizeNullablePositiveInt($validated['autoFirstDietTemplateId'] ?? null);
        }

        if (array_key_exists('autoFirstDietTemplateIds', $validated)) {
            $nutritionSettings['auto_first_diet_template_ids'] = $this->normalizeGoalTemplateIds($validated['autoFirstDietTemplateIds'] ?? []);
        }

        if (array_key_exists('autoFirstDietRequiresApproval', $validated)) {
            $nutritionSettings['auto_first_diet_requires_approval'] = (bool) $validated['autoFirstDietRequiresApproval'];
        }

        $incomingPromptSettings = is_array($validated['promptSettings'] ?? null) ? $validated['promptSettings'] : [];

        if (array_key_exists('dietGenerationPrompt', $validated) && ! array_key_exists('general', $incomingPromptSettings)) {
            $incomingPromptSettings['general'] = $validated['dietGenerationPrompt'];
        }

        foreach ($this->promptKeys() as $key) {
            if (! array_key_exists($key, $incomingPromptSettings)) {
                continue;
            }

            $incomingValue = trim((string) $incomingPromptSettings[$key]);
            $defaultValue = trim($this->defaultPromptText($key));

            if ($incomingValue === '' || $incomingValue === $defaultValue) {
                unset($promptOverrides[$key]);
                continue;
            }

            $promptOverrides[$key] = $incomingValue;
        }

        $nutritionSettings['diet_prompt_overrides'] = $promptOverrides;
        $nutritionSettings['diet_generation_prompt'] = trim((string) ($promptOverrides['general'] ?? ''));
        $rules['nutrition_settings'] = $nutritionSettings;
        $rules['nutrition_requests'] = $nutritionRequests;

        $general->update([
            'booking_rules' => $rules,
        ]);

        return $this->payload();
    }

    /**
     * @return array<string, array{value: string, default: string, customized: bool}>
     */
    private function promptSettingsPayload(): array
    {
        $overrides = $this->promptOverrides();
        $payload = [];

        foreach ($this->promptKeys() as $key) {
            $default = $this->defaultPromptText($key);
            $override = trim((string) ($overrides[$key] ?? ''));
            $customized = $override !== '' && $override !== trim($default);

            $payload[$key] = [
                'value' => $customized ? $override : $default,
                'default' => $default,
                'customized' => $customized,
            ];
        }

        return $payload;
    }

    /**
     * @return array<string, string>
     */
    private function promptOverrides(): array
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $nutritionSettings = is_array($rules['nutrition_settings'] ?? null) ? $rules['nutrition_settings'] : [];
        $overrides = is_array($nutritionSettings['diet_prompt_overrides'] ?? null) ? $nutritionSettings['diet_prompt_overrides'] : [];

        $legacyGeneral = trim((string) ($nutritionSettings['diet_generation_prompt'] ?? ''));
        if ($legacyGeneral !== '' && ! array_key_exists('general', $overrides)) {
            $overrides['general'] = $legacyGeneral;
        }

        return array_filter($overrides, fn ($value): bool => is_string($value) || is_numeric($value));
    }

    private function defaultPromptText(string $key): string
    {
        if (! in_array($key, $this->promptKeys(), true)) {
            throw new InvalidArgumentException("Unsupported prompt settings key [{$key}]");
        }

        return $this->promptCatalog->defaultEditablePrompt($key);
    }

    /**
     * @return list<string>
     */
    private function promptKeys(): array
    {
        return array_merge(['general'], $this->promptCatalog->supportedModes(), ['meal_replacement', 'manual_meal_nutrition', 'meal_photo_analysis', 'diet_explanations']);
    }

    private function nullablePositiveInt(string $key): ?int
    {
        return $this->normalizeNullablePositiveInt($this->nutritionSettings()[$key] ?? null);
    }

    private function nutritionSettings(): array
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];

        return is_array($rules['nutrition_settings'] ?? null) ? $rules['nutrition_settings'] : [];
    }

    private function dietTemplateOptions(): array
    {
        return NutritionDietTemplate::query()
            ->where('is_active', true)
            ->orderBy('depth')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'depth'])
            ->map(fn (NutritionDietTemplate $item): array => [
                'value' => (string) $item->id,
                'label' => str_repeat('— ', (int) $item->depth) . $item->name,
            ])
            ->values()
            ->all();
    }

    private function normalizeNullablePositiveInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        $number = (int) $value;

        return $number > 0 ? $number : null;
    }

    private function normalizeGoalTemplateIds(mixed $value): array
    {
        $items = is_array($value) ? $value : [];

        return collect(['lose-weight', 'gain-weight', 'maintain-weight'])
            ->mapWithKeys(fn (string $goal): array => [$goal => $this->normalizeNullablePositiveInt($items[$goal] ?? null)])
            ->filter(fn (?int $templateId): bool => $templateId !== null)
            ->all();
    }

    /**
     * @return array{label: string, reason_code: string, hourly_limit: ?int, diet_limit: ?int}
     */
    private function aiUsageLimitConfig(string $operationType): array
    {
        return match ($operationType) {
            'meal_photo_analysis' => [
                'label' => 'تحلیل عکس غذا',
                'reason_code' => 'manual_meal_nutrition_ai',
                'hourly_limit' => $this->mealPhotoAnalysisHourlyLimit(),
                'diet_limit' => $this->mealPhotoAnalysisDietLimit(),
            ],
            'manual_meal_nutrition' => [
                'label' => 'محاسبه کالری غذای دستی',
                'reason_code' => 'manual_meal_nutrition_ai',
                'hourly_limit' => $this->manualMealNutritionHourlyLimit(),
                'diet_limit' => $this->manualMealNutritionDietLimit(),
            ],
            'meal_replacement' => [
                'label' => 'جایگزین غذا',
                'reason_code' => 'meal_replacement_ai',
                'hourly_limit' => $this->mealReplacementHourlyLimit(),
                'diet_limit' => $this->mealReplacementDietLimit(),
            ],
            default => throw new InvalidArgumentException("Unsupported AI operation type [{$operationType}]"),
        };
    }

    private function effectiveLimit(string $operationType, NutritionDietPrescription $prescription, ?int $defaultLimit, string $limitKey): ?int
    {
        $request = $prescription->relationLoaded('request')
            ? $prescription->request
            : $prescription->request()->first();
        $limits = is_array($request?->ai_usage_limits) ? $request->ai_usage_limits : [];
        $override = data_get($limits, "{$operationType}.{$limitKey}");

        if ($override === null || $override === '') {
            return $defaultLimit;
        }

        $override = (int) $override;

        return $override > 0 ? $override : $defaultLimit;
    }

    private function aiUsageLedgerQuery(TenantUser $user, string $reasonCode, string $operationType)
    {
        return NutritionTokenLedger::query()
            ->where('subject_user_id', $user->id)
            ->where('event_type', 'diet_request_ai')
            ->where('reason_code', $reasonCode)
            ->where('meta_json->operation_type', $operationType);
    }

    private function pendingAiUsageCount(string $operationType, NutritionDietPrescription $prescription, TenantUser $user, bool $hourly): int
    {
        if ($operationType === 'manual_meal_nutrition') {
            if (! Schema::hasTable('nutrition_meal_logs') || ! Schema::hasColumn('nutrition_meal_logs', 'ai_nutrition_status')) {
                return 0;
            }

            $query = DB::table('nutrition_meal_logs')
                ->where('user_id', $user->id)
                ->where('nutrition_diet_prescription_id', $prescription->id)
                ->where('consumption_type', 'manual')
                ->whereIn('ai_nutrition_status', ['queued', 'processing']);

            if ($hourly) {
                $query->where('created_at', '>=', now()->subHour());
            }

            return (int) $query->count();
        }

        if ($operationType === 'meal_replacement') {
            if (! Schema::hasTable('nutrition_meal_replacement_suggestions')) {
                return 0;
            }

            $query = DB::table('nutrition_meal_replacement_suggestions')
                ->where('user_id', $user->id)
                ->where('requested_by_user_id', $user->id)
                ->whereIn('status', ['queued', 'processing']);

            if ($prescription->nutrition_diet_request_id) {
                $query->where('nutrition_diet_request_id', (int) $prescription->nutrition_diet_request_id);
            } else {
                $query->where('nutrition_diet_prescription_id', $prescription->id);
            }

            if ($hourly) {
                $query->where(
                    Schema::hasColumn('nutrition_meal_replacement_suggestions', 'requested_at') ? 'requested_at' : 'created_at',
                    '>=',
                    now()->subHour(),
                );
            }

            return (int) $query->count();
        }

        return 0;
    }
}
