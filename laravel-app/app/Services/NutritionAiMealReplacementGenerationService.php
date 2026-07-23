<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\NutritionDietPrescription;
use App\Domain\Tenant\Models\NutritionMealReplacementSuggestion;
use App\Domain\Tenant\Models\TenantUser;
use App\Events\NutritionMealReplacementSuggestionUpdated;
use App\Jobs\GenerateNutritionAiMealReplacementSuggestionsJob;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class NutritionAiMealReplacementGenerationService
{
    public function __construct(
        private readonly NutritionAiSettingsService $settings,
        private readonly NutritionDietRequestSettingsService $dietSettings,
        private readonly NutritionAiMealReplacementPromptBuilder $promptBuilder,
        private readonly OpenAiDietClient $client,
        private readonly NutritionTokenService $tokens,
    ) {
    }

    public function queue(NutritionDietPrescription $prescription, TenantUser $actor, array $payload): NutritionMealReplacementSuggestion
    {
        return $this->queueInternal($prescription, $actor, $payload);
    }

    public function queueForAdmin(NutritionDietPrescription $prescription, array $payload): NutritionMealReplacementSuggestion
    {
        return $this->queueInternal($prescription, null, $payload);
    }

    private function queueInternal(NutritionDietPrescription $prescription, ?TenantUser $actor, array $payload): NutritionMealReplacementSuggestion
    {
        $settings = $this->settings->ensureConfigured();
        unset($settings);

        $context = $this->resolveContext($prescription, $payload);
        $forceRegenerate = (bool) ($payload['force_regenerate'] ?? false);

        /** @var NutritionMealReplacementSuggestion $suggestion */
        $suggestion = DB::transaction(function () use ($actor, $context, $prescription, $forceRegenerate): NutritionMealReplacementSuggestion {
            /** @var NutritionMealReplacementSuggestion|null $existing */
            $existing = NutritionMealReplacementSuggestion::query()
                ->where('nutrition_diet_prescription_id', $prescription->id)
                ->where('source_signature', $context['source_signature'])
                ->lockForUpdate()
                ->first();

            if (! $forceRegenerate && $existing && $existing->status === 'generated' && is_array($existing->options) && $existing->options !== []) {
                return $existing;
            }

            if (! $forceRegenerate && $existing && in_array($existing->status, ['queued', 'processing'], true)) {
                return $existing;
            }

            if ($actor) {
                $this->dietSettings->assertAiUsageAllowed('meal_replacement', $prescription, $actor);
            }

            $attributes = [
                'user_id' => $prescription->user_id,
                'requested_by_user_id' => $actor?->id,
                'nutrition_diet_prescription_id' => $prescription->id,
                'nutrition_diet_request_id' => $prescription->nutrition_diet_request_id,
                'nutrition_prescription_meal_slot_id' => $context['nutrition_prescription_meal_slot_id'],
                'nutrition_prescription_day_meal_id' => $context['nutrition_prescription_day_meal_id'],
                'source_type' => $context['source_type'],
                'source_signature' => $context['source_signature'],
                'meal_slot_key' => $context['meal_slot_key'],
                'slot_title' => $context['slot_title'],
                'day_number' => $context['day_number'],
                'meal_index' => $context['meal_index'],
                'suggestion_count' => 0,
                'status' => 'queued',
                'error_message' => null,
                'context_snapshot' => $context['context_snapshot'],
                'options' => null,
                'ai_prompt_snapshot' => null,
                'ai_response_snapshot' => null,
                'requested_at' => now(),
                'generated_at' => null,
                'cancelled_at' => null,
            ];

            if (! $existing) {
                /** @var NutritionMealReplacementSuggestion $created */
                $created = NutritionMealReplacementSuggestion::query()->create($attributes);

                return $created;
            }

            $existing->forceFill($attributes)->save();

            return $existing->fresh();
        });

        if ($suggestion->status === 'queued') {
            DB::afterCommit(function () use ($suggestion): void {
                GenerateNutritionAiMealReplacementSuggestionsJob::dispatch((string) tenant('id'), (int) $suggestion->id);
            });
        }

        $this->broadcastSuggestionUpdated($suggestion->fresh());

        return $suggestion->fresh();
    }

    public function cancel(NutritionMealReplacementSuggestion $suggestion): NutritionMealReplacementSuggestion
    {
        if (! in_array($suggestion->status, ['queued', 'processing'], true)) {
            return $suggestion->fresh();
        }

        $suggestion->forceFill([
            'status' => 'cancelled',
            'error_message' => null,
            'cancelled_at' => now(),
        ])->save();

        $this->broadcastSuggestionUpdated($suggestion->fresh());

        return $suggestion->fresh();
    }

    public function handle(int $suggestionId): void
    {
        /** @var NutritionMealReplacementSuggestion|null $suggestion */
        $suggestion = NutritionMealReplacementSuggestion::query()->find($suggestionId);

        if (! $suggestion) {
            return;
        }

        if ($suggestion->status === 'cancelled') {
            return;
        }

        $suggestion->forceFill([
            'status' => 'processing',
            'error_message' => null,
        ])->save();
        $this->broadcastSuggestionUpdated($suggestion->fresh());

        try {
            $settings = $this->settings->ensureConfigured();
            $settings['diet_prompt_texts'] = $this->dietSettings->effectivePromptTexts();
            $prompt = $this->promptBuilder->build($suggestion, $settings);

            $suggestion->forceFill([
                'ai_prompt_snapshot' => array_merge($prompt['snapshot'], [
                    'provider' => (string) ($settings['provider'] ?? 'openai'),
                    'model' => (string) ($settings['model'] ?? ''),
                    'modelVersion' => $settings['model_version'] ?? null,
                ]),
            ])->save();

            $result = $this->client->generateStructuredDiet($settings, $prompt['messages'], $prompt['schema']);
            $this->tokens->debitForMealReplacementSuggestion(
                $suggestion,
                $suggestion->requested_by_user_id ? TenantUser::query()->find($suggestion->requested_by_user_id) : null,
                $result['usage'] ?? [],
                [
                    'model' => (string) ($settings['model'] ?? ''),
                    'model_version' => $settings['model_version'] ?? null,
                ],
            );

            $suggestion->refresh();

            if ($suggestion->status === 'cancelled') {
                return;
            }

            $slotKey = trim((string) ($result['content']['slot_key'] ?? ''));
            $items = is_array($result['content']['items'] ?? null) ? $result['content']['items'] : [];

            if ($slotKey === '' || $slotKey !== $suggestion->meal_slot_key) {
                throw new RuntimeException('AI برای وعده‌ی درستی پیشنهاد برنگرداند.');
            }

            if (count($items) < 10 || count($items) > 30) {
                throw new RuntimeException('تعداد غذاهای جایگزین باید بین ۱۰ تا ۳۰ مورد باشد.');
            }

            $normalizedItems = collect($items)
                ->filter(fn ($item): bool => is_array($item))
                ->map(function (array $item, int $index): array {
                    return [
                        'id' => 'suggestion_' . ($index + 1),
                        'title' => trim((string) ($item['title'] ?? '')),
                        'description' => trim((string) ($item['description'] ?? '')),
                        'preparation_text' => trim((string) ($item['preparation_text'] ?? '')),
                        'quantity_text' => trim((string) ($item['quantity_text'] ?? '')),
                        'grams' => max(0, (int) ($item['grams'] ?? 0)),
                        'calories' => max(0, (int) ($item['calories'] ?? 0)),
                        'match_reason' => trim((string) ($item['match_reason'] ?? '')),
                    ];
                })
                ->filter(fn (array $item): bool => $item['title'] !== '' && $item['quantity_text'] !== '')
                ->values()
                ->all();

            if (count($normalizedItems) < 10 || count($normalizedItems) > 30) {
                throw new RuntimeException('پاسخ AI پس از نرمال‌سازی تعداد کافی پیشنهاد معتبر نداشت.');
            }

            $suggestion->forceFill([
                'status' => 'generated',
                'error_message' => null,
                'options' => $normalizedItems,
                'suggestion_count' => count($normalizedItems),
                'generated_at' => now(),
                'cancelled_at' => null,
                'ai_response_snapshot' => $result['raw'],
            ])->save();
            $this->broadcastSuggestionUpdated($suggestion->fresh());
        } catch (\Throwable $exception) {
            $suggestion->refresh();

            if ($suggestion->status === 'cancelled') {
                return;
            }

            $suggestion->forceFill([
                'status' => 'failed',
                'error_message' => $exception->getMessage(),
            ])->save();
            $this->broadcastSuggestionUpdated($suggestion->fresh());

            report($exception);
        }
    }

    /**
     * @return array{
     *   source_type: string,
     *   source_signature: string,
     *   meal_slot_key: string,
     *   slot_title: string,
     *   day_number: int|null,
     *   meal_index: int|null,
     *   nutrition_prescription_meal_slot_id: int|null,
     *   nutrition_prescription_day_meal_id: int|null,
     *   context_snapshot: array<string, mixed>
     * }
     */
    private function resolveContext(NutritionDietPrescription $prescription, array $payload): array
    {
        $content = is_array($prescription->content_snapshot) ? $prescription->content_snapshot : [];
        $profile = is_array($prescription->profile_snapshot) ? $prescription->profile_snapshot : [];
        $template = is_array($prescription->template_snapshot) ? $prescription->template_snapshot : [];
        $sourceType = (string) ($payload['source_type'] ?? 'daily_meal');
        $mealSlotKey = trim((string) ($payload['meal_slot_key'] ?? ''));
        $requestedPromptMode = (string) ($payload['prompt_mode'] ?? 'tenant');
        $promptMode = in_array($requestedPromptMode, ['tenant', 'default', 'custom'], true)
            ? $requestedPromptMode
            : 'tenant';
        $customPromptText = trim((string) ($payload['custom_prompt'] ?? ''));
        $promptPreferences = [
            'mode' => $promptMode,
            'custom_text' => $promptMode === 'custom' ? $customPromptText : null,
        ];

        if ($mealSlotKey === '') {
            throw new RuntimeException('کلید وعده برای تولید جایگزین ارسال نشده است.');
        }

        if ($sourceType === 'meal_slot') {
            $slot = collect(is_array($content['meal_slots'] ?? null) ? $content['meal_slots'] : [])
                ->map(fn ($item) => is_array($item) ? $item : null)
                ->first(fn (?array $item): bool => trim((string) ($item['slot_key'] ?? '')) === $mealSlotKey);

            if (! $slot) {
                throw new RuntimeException('وعده انتخاب‌شده برای تولید جایگزین پیدا نشد.');
            }

            $mealSlotId = DB::table('nutrition_prescription_meal_slots')
                ->where('nutrition_diet_prescription_id', $prescription->id)
                ->where('slot_key', $mealSlotKey)
                ->value('id');

            $slotTitle = trim((string) ($slot['title'] ?? $payload['slot_title'] ?? ''));
            $signaturePayload = [
                'sourceType' => 'meal_slot',
                'mealSlotKey' => $mealSlotKey,
                'slotTitle' => $slotTitle,
                'slot' => $slot,
            ];

            return [
                'source_type' => 'meal_slot',
                'source_signature' => sha1(json_encode($signaturePayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
                'meal_slot_key' => $mealSlotKey,
                'slot_title' => $slotTitle,
                'day_number' => null,
                'meal_index' => null,
                'nutrition_prescription_meal_slot_id' => $mealSlotId ? (int) $mealSlotId : null,
                'nutrition_prescription_day_meal_id' => null,
                'context_snapshot' => [
                    'source_type' => 'meal_slot',
                    'meal_slot_key' => $mealSlotKey,
                    'slot_title' => $slotTitle,
                    'cache_scope' => 'prescription_meal_slot',
                    'cache_scope_label' => 'کل همین رژیم برای همین وعده',
                    'prompt_preferences' => $promptPreferences,
                    'min_items' => 10,
                    'max_items' => 30,
                    'profile' => $profile,
                    'template' => $template,
                    'prescription' => [
                        'id' => $prescription->id,
                        'mode' => $prescription->prescription_mode,
                        'summary_text' => $prescription->summary_text,
                        'notes' => $prescription->notes,
                        'allow_food_replacement' => (bool) $prescription->allow_food_replacement,
                        'current_weight_kg' => $prescription->current_weight_kg !== null ? (float) $prescription->current_weight_kg : null,
                        'target_weight_kg' => $prescription->target_weight_kg !== null ? (float) $prescription->target_weight_kg : null,
                        'weekly_weight_change_kg' => $prescription->weekly_weight_change_kg !== null ? (float) $prescription->weekly_weight_change_kg : null,
                        'content' => $content,
                    ],
                    'target' => [
                        'slot' => $slot,
                        'existing_options' => is_array($slot['options'] ?? null) ? $slot['options'] : [],
                    ],
                ],
            ];
        }

        $dayNumber = max(1, (int) ($payload['day_number'] ?? 0));
        $mealIndex = (int) ($payload['meal_index'] ?? -1);
        $plan = null;
        $meal = null;

        foreach (is_array($content['day_plans'] ?? null) ? $content['day_plans'] : [] as $candidatePlan) {
            if (! is_array($candidatePlan) || (int) ($candidatePlan['day_number'] ?? 0) !== $dayNumber) {
                continue;
            }

            $meals = is_array($candidatePlan['meals'] ?? null) ? $candidatePlan['meals'] : [];
            if (! isset($meals[$mealIndex]) || ! is_array($meals[$mealIndex])) {
                continue;
            }

            $plan = $candidatePlan;
            $meal = $meals[$mealIndex];
            break;
        }

        if (! $plan || ! $meal) {
            throw new RuntimeException('وعده روزانه انتخاب‌شده برای تولید جایگزین پیدا نشد.');
        }

        $mealDayPlanId = DB::table('nutrition_prescription_day_plans')
            ->where('nutrition_diet_prescription_id', $prescription->id)
            ->where('day_number', $dayNumber)
            ->value('id');

        $dayMealId = null;
        if ($mealDayPlanId) {
            $dayMealId = DB::table('nutrition_prescription_day_meals')
                ->where('nutrition_prescription_day_plan_id', $mealDayPlanId)
                ->where('slot_key', $mealSlotKey)
                ->value('id');
        }

        $slotTitle = trim((string) ($meal['title'] ?? $payload['slot_title'] ?? ''));
        $signaturePayload = [
            'sourceType' => 'daily_meal',
            'mealSlotKey' => $mealSlotKey,
            'slotTitle' => $slotTitle,
            'prescriptionId' => $prescription->id,
        ];

        return [
            'source_type' => 'daily_meal',
            'source_signature' => sha1(json_encode($signaturePayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
            'meal_slot_key' => $mealSlotKey,
            'slot_title' => $slotTitle,
            'day_number' => $dayNumber,
            'meal_index' => $mealIndex,
            'nutrition_prescription_meal_slot_id' => null,
            'nutrition_prescription_day_meal_id' => $dayMealId ? (int) $dayMealId : null,
            'context_snapshot' => [
                'source_type' => 'daily_meal',
                'meal_slot_key' => $mealSlotKey,
                'slot_title' => $slotTitle,
                'day_number' => $dayNumber,
                'meal_index' => $mealIndex,
                'cache_scope' => 'prescription_daily_slot',
                'cache_scope_label' => 'همه روزهای همین رژیم برای همین وعده',
                'prompt_preferences' => $promptPreferences,
                'min_items' => 10,
                'max_items' => 30,
                'profile' => $profile,
                'template' => $template,
                'prescription' => [
                    'id' => $prescription->id,
                    'mode' => $prescription->prescription_mode,
                    'summary_text' => $prescription->summary_text,
                    'notes' => $prescription->notes,
                    'allow_food_replacement' => (bool) $prescription->allow_food_replacement,
                    'current_weight_kg' => $prescription->current_weight_kg !== null ? (float) $prescription->current_weight_kg : null,
                    'target_weight_kg' => $prescription->target_weight_kg !== null ? (float) $prescription->target_weight_kg : null,
                    'weekly_weight_change_kg' => $prescription->weekly_weight_change_kg !== null ? (float) $prescription->weekly_weight_change_kg : null,
                    'content' => $content,
                ],
                'target' => [
                    'plan' => $plan,
                    'meal' => $meal,
                    'existing_replacements' => is_array($meal['replacements'] ?? null) ? $meal['replacements'] : [],
                ],
            ],
        ];
    }

    private function broadcastSuggestionUpdated(?NutritionMealReplacementSuggestion $suggestion): void
    {
        if (! $suggestion) {
            return;
        }

        $tenantId = tenant('id');

        if (! $tenantId) {
            return;
        }

        event(NutritionMealReplacementSuggestionUpdated::fromSuggestion((string) $tenantId, $suggestion));
    }
}
