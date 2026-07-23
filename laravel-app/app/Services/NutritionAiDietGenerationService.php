<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\NutritionDietPrescription;
use App\Domain\Tenant\Models\NutritionDietRequest;
use App\Domain\Tenant\Models\TenantUser;
use App\Events\NutritionDietRequestUpdated;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class NutritionAiDietGenerationService
{
    public function __construct(
        private readonly NutritionAiSettingsService $settings,
        private readonly NutritionDietRequestSettingsService $dietSettings,
        private readonly NutritionPrescriptionCompletenessService $completeness,
        private readonly NutritionAiDietPromptBuilder $promptBuilder,
        private readonly OpenAiDietClient $client,
        private readonly NutritionAiDietPersister $persister,
        private readonly NutritionTokenService $tokens,
        private readonly NutritionDietNotificationService $notifications,
    ) {
    }

    public function queue(NutritionDietRequest $request, TenantUser $actor, array $payload): NutritionDietRequest
    {
        if ($request->request_type !== 'ai') {
            throw new RuntimeException('فقط درخواست‌های AI را می‌توان به OpenAI صف کرد.');
        }

        $settings = $this->settings->ensureConfigured();
        unset($settings);

        $cost = $this->tokens->tokenCost('ai_diet_request_cost');
        $wallet = $this->tokens->wallet();

        if ($cost > 0 && (int) $wallet->balance_tokens < $cost) {
            throw new RuntimeException('موجودی توکن برای تولید رژیم AI کافی نیست.');
        }

        $request->forceFill([
            'ai_requested_by_user_id' => $actor->id,
            'ai_generation_status' => 'queued',
            'expert_notes' => $this->nullableTrim($payload['expertNotes'] ?? null),
            'clinical_notes' => $this->nullableTrim($payload['clinicalNotes'] ?? null),
            'generation_instructions' => $this->nullableTrim($payload['generationInstructions'] ?? null),
            'must_include' => $this->nullableTrim($payload['mustInclude'] ?? null),
            'must_avoid' => $this->nullableTrim($payload['mustAvoid'] ?? null),
            'ai_job_dispatched_at' => now(),
            'ai_generation_error' => null,
            'status' => 'in_progress',
            'manual_delivery_approved_at' => null,
            'manual_delivery_approved_by_user_id' => null,
        ])->save();

        $this->broadcastDietRequestUpdated($request->fresh());

        return $request->fresh();
    }

    public function handle(int $dietRequestId): void
    {
        /** @var NutritionDietRequest|null $request */
        $request = NutritionDietRequest::query()->find($dietRequestId);

        if (! $request || $request->request_type !== 'ai') {
            return;
        }

        if ($request->ai_generation_status === 'cancelled') {
            $request->forceFill([
                'status' => $this->fallbackRequestStatus($request),
            ])->save();

            return;
        }

        $request->forceFill([
            'ai_generation_status' => 'processing',
            'ai_generation_error' => null,
            'status' => 'in_progress',
        ])->save();
        $this->broadcastDietRequestUpdated($request->fresh());

        try {
            $settings = $this->settings->ensureConfigured();
            $settings['diet_prompt_texts'] = $this->dietSettings->effectivePromptTexts();
            $prompt = $this->promptBuilder->build($request, $settings);
            $currentPrescription = $this->latestRequestPrescription($request);
            $request->forceFill([
                'ai_prompt_snapshot' => array_merge($prompt['snapshot'], [
                    'provider' => (string) ($settings['provider'] ?? 'openai'),
                    'model' => (string) ($settings['model'] ?? ''),
                    'modelVersion' => $settings['model_version'] ?? null,
                ]),
            ])->save();

            $result = $this->client->generateStructuredDiet($settings, $prompt['messages'], $prompt['schema']);
            $result = $this->ensureRevisionChanged($request, $currentPrescription, $prompt, $settings, $result);
            if ($currentPrescription && $this->revisionRequested($request)) {
                $result['content'] = $this->mergeRevisionIntoExistingPrescription($currentPrescription, $result['content'], $request);
            }
            $result = $this->ensureDailyReplacementCoverage($request, $prompt, $settings, $result);
            $result = $this->ensureDietExplanationsWhenRequested($request, $prompt, $settings, $result);
            $result['content'] = $this->sanitizeGeneratedContent($request, $result['content']);
            $result = $this->ensureCompleteFixedTextPrescription($request, $prompt, $settings, $result);
            $result = $this->ensureCompleteUserChoicePrescription($request, $prompt, $settings, $result);
            if ((string) ($result['content']['mode'] ?? $request->prescription_mode ?? '') === 'user_choice') {
                $result['content'] = $this->sanitizeGeneratedContent($request, $result['content']);
            }
            $result = $this->ensureCompleteDailyPrescription($request, $prompt, $settings, $result);
            $request->refresh();

            if ($request->ai_generation_status === 'cancelled') {
                $request->forceFill([
                    'status' => $this->fallbackRequestStatus($request),
                    'ai_generation_error' => null,
                ])->save();
                $this->broadcastDietRequestUpdated($request->fresh());

                return;
            }

            $holdIncompleteForReview = $this->dietSettings->holdIncompletePrescriptionsForReview();
            $prePersistCompleteness = $this->completeness->evaluateRequestContent($request, is_array($result['content'] ?? null) ? $result['content'] : []);
            $requiresManualApproval = (bool) $request->requires_manual_delivery_approval || ($holdIncompleteForReview && ! $prePersistCompleteness['complete']);
            $hasPublishedCurrent = $currentPrescription?->published_at !== null;
            $prescription = $this->persister->persist($request, $result['content'], [
                'publishImmediately' => ! $requiresManualApproval,
                'overwriteExisting' => ! $requiresManualApproval || ! $hasPublishedCurrent,
            ]);
            $prescription->refresh();
            $completeness = $this->completeness->evaluatePrescription($prescription);
            $isIncomplete = ! $completeness['complete'];
            $this->tokens->debitForDietGeneration(
                $request,
                $request->ai_requested_by_user_id ? TenantUser::query()->find($request->ai_requested_by_user_id) : null,
                $result['usage'] ?? [],
                [
                    'operation_type' => $currentPrescription && $this->revisionRequested($request)
                        ? 'diet_revision'
                        : 'diet_generation',
                    'model' => (string) ($settings['model'] ?? ''),
                    'model_version' => $settings['model_version'] ?? null,
                ],
            );

            $request->forceFill([
                'ai_generation_status' => 'generated',
                'ai_generated_at' => now(),
                'ai_generation_error' => null,
                'ai_response_snapshot' => $result['raw'],
                'status' => $requiresManualApproval ? 'not_sent' : 'finished',
                'requires_manual_delivery_approval' => (bool) $request->requires_manual_delivery_approval || ($holdIncompleteForReview && $isIncomplete),
                'request_payload_snapshot' => array_merge(is_array($request->request_payload_snapshot) ? $request->request_payload_snapshot : [], [
                    'generatedPrescriptionId' => $prescription->id,
                    'aiProvider' => (string) ($settings['provider'] ?? 'openai'),
                    'aiModel' => (string) ($settings['model'] ?? ''),
                    'aiModelVersion' => $settings['model_version'] ?? null,
                    'incompletePrescriptionReviewTriggered' => $holdIncompleteForReview && $isIncomplete,
                    'prescriptionCompleteness' => $completeness,
                ]),
            ])->save();
            $this->broadcastDietRequestUpdated($request->fresh());

            $request->loadMissing('user');
            if ($requiresManualApproval) {
                $this->notifications->notifyAdminsPrescriptionGenerated($request, $prescription, true);
            } else {
                $this->notifications->notifyUserPrescriptionReady($request, $prescription, false);
                $this->notifications->notifyAdminsPrescriptionGenerated($request, $prescription, false);
            }
        } catch (\Throwable $exception) {
            $request->forceFill([
                'ai_generation_status' => 'failed',
                'ai_generation_error' => $exception->getMessage(),
                'status' => 'sent',
            ])->save();
            $this->broadcastDietRequestUpdated($request->fresh());

            $request->loadMissing('user');
            $this->notifications->notifyAdminsPrescriptionFailed($request, $exception->getMessage());

            report($exception);
        }
    }

    private function nullableTrim(mixed $value): ?string
    {
        $trimmed = trim((string) $value);

        return $trimmed !== '' ? $trimmed : null;
    }

    private function fallbackRequestStatus(NutritionDietRequest $request): string
    {
        $hasCurrentPrescription = $request->prescriptions()
            ->exists();

        return $hasCurrentPrescription ? 'finished' : 'sent';
    }

    private function broadcastDietRequestUpdated(?NutritionDietRequest $request): void
    {
        if (! $request) {
            return;
        }

        $tenantId = tenant('id');

        if (! $tenantId) {
            return;
        }

        event(NutritionDietRequestUpdated::fromRequest((string) $tenantId, $request));
    }

    /**
     * @param array{messages: array<int, array<string, mixed>>, schema: array<string, mixed>, snapshot: array<string, mixed>} $prompt
     * @param array{raw: array<string, mixed>, content: array<string, mixed>, usage?: array<string, int>} $result
     * @return array{raw: array<string, mixed>, content: array<string, mixed>, usage?: array<string, int>}
     */
    private function ensureRevisionChanged(
        NutritionDietRequest $request,
        ?NutritionDietPrescription $currentPrescription,
        array $prompt,
        array $settings,
        array $result,
    ): array {
        if (! $currentPrescription) {
            return $result;
        }

        if (! $this->revisionRequested($request)) {
            return $result;
        }

        if (! $this->revisionLooksUnchanged($currentPrescription, $result['content'], $request)) {
            return $result;
        }

        $retryMessages = $prompt['messages'];
        $retryMessages[] = [
            'role' => 'user',
            'content' => json_encode([
                'revisionGuard' => true,
                'message' => 'پیش‌نویس قبلی شما بخش درخواستی را واقعاً تغییر نداد. نسخه را دوباره تولید کن و مطمئن شو وعده‌های خواسته‌شده با غذاهای به‌وضوح متفاوت جایگزین شده‌اند، در حالی که بخش‌های دست‌نخورده حفظ می‌شوند.',
                'targets' => $this->extractRevisionTargets($request),
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ];

        $retryResult = $this->client->generateStructuredDiet($settings, $retryMessages, $prompt['schema']);
        $retryResult['usage'] = $this->mergeUsage($result['usage'] ?? [], $retryResult['usage'] ?? []);

        if ($this->revisionLooksUnchanged($currentPrescription, $retryResult['content'], $request)) {
            throw new RuntimeException('AI نسخه را مطابق درخواست کارشناس تغییر نداد. لطفاً دستور دقیق‌تری برای بخش موردنظر وارد کنید.');
        }

        return $retryResult;
    }

    /**
     * @param array{messages: array<int, array<string, mixed>>, schema: array<string, mixed>, snapshot: array<string, mixed>} $prompt
     * @param array{raw: array<string, mixed>, content: array<string, mixed>, usage?: array<string, int>} $result
     * @return array{raw: array<string, mixed>, content: array<string, mixed>, usage?: array<string, int>}
     */
    private function ensureCompleteUserChoicePrescription(
        NutritionDietRequest $request,
        array $prompt,
        array $settings,
        array $result,
    ): array {
        $mode = (string) ($result['content']['mode'] ?? $request->prescription_mode ?? '');
        if ($mode !== 'user_choice') {
            return $result;
        }

        $bestResult = $result;
        $bestCompleteness = $this->completeness->evaluateRequestContent(
            $request,
            is_array($result['content'] ?? null) ? $result['content'] : []
        );

        if ($bestCompleteness['complete']) {
            return $bestResult;
        }

        for ($attempt = 1; $attempt <= 2; $attempt++) {
            $retryMessages = $prompt['messages'];
            $retryMessages[] = [
                'role' => 'user',
                'content' => json_encode([
                    'userChoiceOptionCountGuard' => true,
                    'attempt' => $attempt,
                    'message' => 'پیش‌نویس قبلی برای mode انتخاب وعده ناقص بود. برای هر slot فعال باید تعداد options دقیقاً برابر required_option_count همان slot باشد. خروجی را دوباره تولید کن و هیچ slot فعال را با گزینه کمتر یا بیشتر برنگردان.',
                    'requiredMealSlots' => $this->userChoiceMealSlotRequirements($request),
                    'missingItems' => $bestCompleteness['missing'],
                    'rules' => [
                        'Only for user_choice: fill meal_slots, not day_plans.',
                        'For every required meal slot, options.length must equal required_option_count exactly.',
                        'Set each returned slot food_count to the same required_option_count.',
                        'Every option must include title, quantity_text, preparation_text, grams and calories.',
                        'Do not return options for inactive slots.',
                    ],
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ];

            $retryResult = $this->client->generateStructuredDiet($settings, $retryMessages, $prompt['schema']);
            $retryResult['usage'] = $this->mergeUsage($bestResult['usage'] ?? [], $retryResult['usage'] ?? []);

            $retryCompleteness = $this->completeness->evaluateRequestContent(
                $request,
                is_array($retryResult['content'] ?? null) ? $retryResult['content'] : []
            );

            if (count($retryCompleteness['missing']) < count($bestCompleteness['missing'])) {
                $bestResult = $retryResult;
                $bestCompleteness = $retryCompleteness;
            }

            if ($retryCompleteness['complete']) {
                return $retryResult;
            }
        }

        throw new RuntimeException('AI نتوانست برای رژیم انتخابی تعداد گزینه‌های وعده‌ها را کامل تولید کند: ' . implode(' | ', $bestCompleteness['missing']));
    }

    /**
     * @return array<int, array{slot_key: string, title: string, required_option_count: int}>
     */
    private function userChoiceMealSlotRequirements(NutritionDietRequest $request): array
    {
        $template = is_array($request->template_snapshot) ? $request->template_snapshot : [];
        $slots = is_array($template['mealSlots'] ?? null) ? $template['mealSlots'] : [];

        return collect($slots)
            ->filter(fn ($slot): bool => is_array($slot))
            ->filter(function (array $slot): bool {
                if (array_key_exists('enabled', $slot)) {
                    return (bool) $slot['enabled'];
                }

                return true;
            })
            ->map(function (array $slot): array {
                return [
                    'slot_key' => trim((string) ($slot['key'] ?? '')),
                    'title' => trim((string) ($slot['title'] ?? $slot['key'] ?? '')),
                    'required_option_count' => max(1, (int) ($slot['foodCount'] ?? $slot['food_count'] ?? 1)),
                ];
            })
            ->filter(fn (array $slot): bool => $slot['slot_key'] !== '')
            ->values()
            ->all();
    }

    /**
     * @param array{messages: array<int, array<string, mixed>>, schema: array<string, mixed>, snapshot: array<string, mixed>} $prompt
     * @param array{raw: array<string, mixed>, content: array<string, mixed>, usage?: array<string, int>} $result
     * @return array{raw: array<string, mixed>, content: array<string, mixed>, usage?: array<string, int>}
     */
    private function ensureCompleteDailyPrescription(
        NutritionDietRequest $request,
        array $prompt,
        array $settings,
        array $result,
    ): array {
        $mode = (string) ($result['content']['mode'] ?? $request->prescription_mode ?? '');
        if ($mode !== 'daily_prescription') {
            return $result;
        }

        $requiredDurationDays = $this->resolveRequiredDurationDays($request, $result);
        $bestResult = $result;
        $bestCompleteness = $this->completeness->evaluateRequestContent(
            $request,
            is_array($result['content'] ?? null) ? $result['content'] : []
        );

        if ($bestCompleteness['complete']) {
            return $bestResult;
        }

        for ($attempt = 1; $attempt <= 2; $attempt++) {
            $retryMessages = $prompt['messages'];
            $retryMessages[] = [
                'role' => 'user',
                'content' => json_encode([
                    'dailyPlanGuard' => true,
                    'attempt' => $attempt,
                    'message' => 'پیش‌نویس قبلی ناقص بود. در mode روزانه باید همه روزها بدون حذف شدن برگردند. خروجی را دوباره تولید کن و مطمئن شو day_plans دقیقاً همه روزهای بازه را پوشش می‌دهد.',
                    'requiredDurationDays' => $requiredDurationDays,
                    'missingItems' => $bestCompleteness['missing'],
                    'rules' => [
                        'Only for daily_prescription: return one complete day_plan for every day_number from 1 to duration_days.',
                        'Do not omit any day.',
                        'The day_plans array must contain exactly duration_days items.',
                        'Each returned day must include all required meals for enabled slot keys.',
                        'Each daily meal must include a non-empty quantity_text.',
                        'quantity_text must describe the meal components and their amounts, not repeat meal_text.',
                    ],
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ];

            $retryResult = $this->client->generateStructuredDiet($settings, $retryMessages, $prompt['schema']);
            $retryResult['usage'] = $this->mergeUsage($bestResult['usage'] ?? [], $retryResult['usage'] ?? []);

            $retryCompleteness = $this->completeness->evaluateRequestContent(
                $request,
                is_array($retryResult['content'] ?? null) ? $retryResult['content'] : []
            );

            if (count($retryCompleteness['missing']) < count($bestCompleteness['missing'])) {
                $bestResult = $retryResult;
                $bestCompleteness = $retryCompleteness;
            }

            if ($retryCompleteness['complete']) {
                return $retryResult;
            }
        }

        throw new RuntimeException('AI نتوانست برای رژیم روزانه همه روزهای بازه را کامل تولید کند: ' . implode(' | ', $bestCompleteness['missing']));
    }

    /**
     * @param array{messages: array<int, array<string, mixed>>, schema: array<string, mixed>, snapshot: array<string, mixed>} $prompt
     * @param array{raw: array<string, mixed>, content: array<string, mixed>, usage?: array<string, int>} $result
     * @return array{raw: array<string, mixed>, content: array<string, mixed>, usage?: array<string, int>}
     */
    private function ensureCompleteFixedTextPrescription(
        NutritionDietRequest $request,
        array $prompt,
        array $settings,
        array $result,
    ): array {
        $mode = (string) ($result['content']['mode'] ?? $request->prescription_mode ?? '');
        if ($mode !== 'fixed_text' && (string) ($request->prescription_mode ?? '') !== 'fixed_text') {
            return $result;
        }

        $bestResult = $result;
        $bestCompleteness = $this->completeness->evaluateRequestContent(
            $request,
            is_array($result['content'] ?? null) ? $result['content'] : []
        );

        if ($bestCompleteness['complete']) {
            return $bestResult;
        }

        for ($attempt = 1; $attempt <= 2; $attempt++) {
            $retryMessages = $prompt['messages'];
            $retryMessages[] = [
                'role' => 'user',
                'content' => json_encode([
                    'fixedTextGuard' => true,
                    'attempt' => $attempt,
                    'message' => 'پیش‌نویس قبلی برای mode متن ثابت درست نبود. این mode فقط متن توصیه‌ای می‌خواهد. خروجی را دوباره تولید کن: text_sections باید body کامل داشته باشد، meal_slots و day_plans دقیقاً خالی باشند، آب و مکمل و guidance ساختاریافته هم خالی/غیرفعال باشند.',
                    'missingItems' => $bestCompleteness['missing'],
                    'rules' => [
                        'Only for fixed_text: fill text_sections.',
                        'meal_slots must be exactly an empty array.',
                        'day_plans must be exactly an empty array.',
                        'Do not generate meals, food options, replacements, grams or calories.',
                        'water_plan must be zero, supplement_plan disabled, guidance_sections empty.',
                    ],
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ];

            $retryResult = $this->client->generateStructuredDiet($settings, $retryMessages, $prompt['schema']);
            $retryResult['usage'] = $this->mergeUsage($bestResult['usage'] ?? [], $retryResult['usage'] ?? []);
            $retryResult['content'] = $this->sanitizeGeneratedContent($request, is_array($retryResult['content'] ?? null) ? $retryResult['content'] : []);

            $retryCompleteness = $this->completeness->evaluateRequestContent($request, $retryResult['content']);

            if (count($retryCompleteness['missing']) < count($bestCompleteness['missing'])) {
                $bestResult = $retryResult;
                $bestCompleteness = $retryCompleteness;
            }

            if ($retryCompleteness['complete']) {
                return $retryResult;
            }
        }

        throw new RuntimeException('AI نتوانست نسخه متن ثابت را کامل تولید کند: ' . implode(' | ', $bestCompleteness['missing']));
    }

    /**
     * @param array{raw?: array<string, mixed>, content?: array<string, mixed>, usage?: array<string, int>} $result
     */
    private function resolveRequiredDurationDays(NutritionDietRequest $request, array $result): int
    {
        return (int) (($result['content']['duration_days'] ?? null)
            ?: (is_array($request->template_snapshot) ? ($request->template_snapshot['durationDays'] ?? 0) : 0)
            ?: max(1, optional($request->ends_at)->diffInDays($request->started_at) + 1));
    }

    /**
     * @param array<string, mixed> $content
     * @return array<string, mixed>
     */
    private function sanitizeGeneratedContent(NutritionDietRequest $request, array $content): array
    {
        $mode = (string) ($content['mode'] ?? $request->prescription_mode ?? '');
        if ($mode === 'fixed_text' || (string) ($request->prescription_mode ?? '') === 'fixed_text') {
            $content['mode'] = 'fixed_text';
            $content['meal_slots'] = [];
            $content['day_plans'] = [];
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
            $content['allow_food_replacement'] = false;
            $content['suggest_daily_replacements'] = false;
            $content['calorie_plan'] = [
                'base_calories' => 0,
                'prescribed_calories' => 0,
                'goal_adjustment' => '',
                'reasoning' => '',
                'summary_text' => '',
            ];

            return $content;
        }

        if ($mode !== 'daily_prescription') {
            $template = is_array($request->template_snapshot) ? $request->template_snapshot : [];
            $content['guidance_sections'] = (bool) ($template['showDietExplanations'] ?? false)
                ? (is_array($content['guidance_sections'] ?? null) ? $content['guidance_sections'] : [])
                : [];

            return $content;
        }

        $template = is_array($request->template_snapshot) ? $request->template_snapshot : [];
        $shouldSuggestDailyReplacements = (bool) $request->suggest_daily_replacements;
        $content['day_plans'] = collect(is_array($content['day_plans'] ?? null) ? $content['day_plans'] : [])
            ->map(function ($plan) use ($shouldSuggestDailyReplacements) {
                if (! is_array($plan)) {
                    return $plan;
                }

                $plan['meals'] = collect(is_array($plan['meals'] ?? null) ? $plan['meals'] : [])
                    ->map(function ($meal) use ($shouldSuggestDailyReplacements) {
                        if (! is_array($meal)) {
                            return $meal;
                        }

                        $replacements = collect(is_array($meal['replacements'] ?? null) ? $meal['replacements'] : [])
                            ->filter(fn ($replacement): bool => is_array($replacement))
                            ->values();

                        $meal['replacements'] = $shouldSuggestDailyReplacements
                            ? $replacements->take(1)->all()
                            : [];

                        return $meal;
                    })
                    ->values()
                    ->all();

                return $plan;
            })
            ->values()
            ->all();

        $content['guidance_sections'] = (bool) ($template['showDietExplanations'] ?? false)
            ? (is_array($content['guidance_sections'] ?? null) ? $content['guidance_sections'] : [])
            : [];

        return $content;
    }

    /**
     * @param array{messages: array<int, array<string, mixed>>, schema: array<string, mixed>, snapshot: array<string, mixed>} $prompt
     * @param array{raw: array<string, mixed>, content: array<string, mixed>, usage?: array<string, int>} $result
     * @return array{raw: array<string, mixed>, content: array<string, mixed>, usage?: array<string, int>}
     */
    private function ensureDietExplanationsWhenRequested(
        NutritionDietRequest $request,
        array $prompt,
        array $settings,
        array $result,
    ): array {
        $template = is_array($request->template_snapshot) ? $request->template_snapshot : [];
        if ((string) ($request->prescription_mode ?? '') === 'fixed_text') {
            return $result;
        }

        if (! (bool) ($template['showDietExplanations'] ?? false)) {
            return $result;
        }

        if ($this->hasMeaningfulGuidanceSections($result['content'])) {
            return $result;
        }

        $retryMessages = $prompt['messages'];
        $retryMessages[] = [
            'role' => 'user',
            'content' => json_encode([
                'dietExplanationsGuard' => true,
                'message' => 'برای این الگو guidance_sections الزامی است. چند بخش توضیحی کاربردی، حرفه‌ای و متناسب با dietExplanationInstructions و شرایط کاربر تولید کن و guidance_sections را خالی نگذار.',
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ];

        $retryResult = $this->client->generateStructuredDiet($settings, $retryMessages, $prompt['schema']);
        $retryResult['usage'] = $this->mergeUsage($result['usage'] ?? [], $retryResult['usage'] ?? []);

        if (! $this->hasMeaningfulGuidanceSections($retryResult['content'])) {
            throw new RuntimeException('AI نتوانست توضیحات رژیم را مطابق تنظیمات الگو تولید کند.');
        }

        return $retryResult;
    }

    /**
     * @param array<string, mixed> $content
     */
    private function hasMeaningfulGuidanceSections(array $content): bool
    {
        $sections = collect(is_array($content['guidance_sections'] ?? null) ? $content['guidance_sections'] : [])
            ->filter(fn ($section): bool => is_array($section))
            ->filter(function (array $section): bool {
                return trim((string) ($section['title'] ?? '')) !== ''
                    && trim((string) ($section['body'] ?? '')) !== '';
            })
            ->values();

        return $sections->isNotEmpty();
    }

    /**
     * @param array{messages: array<int, array<string, mixed>>, schema: array<string, mixed>, snapshot: array<string, mixed>} $prompt
     * @param array{raw: array<string, mixed>, content: array<string, mixed>, usage?: array<string, int>} $result
     * @return array{raw: array<string, mixed>, content: array<string, mixed>, usage?: array<string, int>}
     */
    private function ensureDailyReplacementCoverage(
        NutritionDietRequest $request,
        array $prompt,
        array $settings,
        array $result,
    ): array {
        if (! $request->suggest_daily_replacements) {
            return $result;
        }

        $mode = (string) ($result['content']['mode'] ?? $request->prescription_mode ?? '');
        if ($mode !== 'daily_prescription') {
            return $result;
        }

        if ($this->hasDailyReplacementForEveryMeal($result['content'])) {
            return $result;
        }

        $retryMessages = $prompt['messages'];
        $retryMessages[] = [
            'role' => 'user',
            'content' => json_encode([
                'dailyReplacementGuard' => true,
                'message' => 'برای این درخواست باید در mode روزانه، برای تک‌تک meals در همه day_plans دقیقاً ۱ replacement برگردانی. هیچ mealی نباید بدون replacement باشد و نباید بیشتر از ۱ replacement برای هر meal بدهی.',
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ];

        $retryResult = $this->client->generateStructuredDiet($settings, $retryMessages, $prompt['schema']);
        $retryResult['usage'] = $this->mergeUsage($result['usage'] ?? [], $retryResult['usage'] ?? []);

        if (! $this->hasDailyReplacementForEveryMeal($retryResult['content'])) {
            throw new RuntimeException('AI نتوانست برای همه وعده‌های رژیم روزانه دقیقاً یک جایگزین تولید کند.');
        }

        return $retryResult;
    }

    /**
     * @param array<string, mixed> $content
     */
    private function hasDailyReplacementForEveryMeal(array $content): bool
    {
        $plans = is_array($content['day_plans'] ?? null) ? $content['day_plans'] : [];
        if ($plans === []) {
            return false;
        }

        foreach ($plans as $plan) {
            if (! is_array($plan)) {
                return false;
            }

            $meals = is_array($plan['meals'] ?? null) ? $plan['meals'] : [];
            if ($meals === []) {
                return false;
            }

            foreach ($meals as $meal) {
                if (! is_array($meal)) {
                    return false;
                }

                $replacements = collect(is_array($meal['replacements'] ?? null) ? $meal['replacements'] : [])
                    ->filter(fn ($replacement): bool => is_array($replacement))
                    ->values();

                if ($replacements->count() < 1) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * @param array<string, int> $first
     * @param array<string, int> $second
     * @return array{promptTokens: int, completionTokens: int, totalTokens: int}
     */
    private function mergeUsage(array $first, array $second): array
    {
        return [
            'promptTokens' => max(0, (int) ($first['promptTokens'] ?? 0)) + max(0, (int) ($second['promptTokens'] ?? 0)),
            'completionTokens' => max(0, (int) ($first['completionTokens'] ?? 0)) + max(0, (int) ($second['completionTokens'] ?? 0)),
            'totalTokens' => max(0, (int) ($first['totalTokens'] ?? 0)) + max(0, (int) ($second['totalTokens'] ?? 0)),
        ];
    }

    private function revisionRequested(NutritionDietRequest $request): bool
    {
        $instructionText = $this->instructionText($request);

        return $instructionText !== '';
    }

    private function latestRequestPrescription(NutritionDietRequest $request): ?NutritionDietPrescription
    {
        return NutritionDietPrescription::query()
            ->where('nutrition_diet_request_id', $request->id)
            ->orderByDesc('is_current')
            ->latest('id')
            ->first();
    }

    /**
     * @param array<string, mixed> $newContent
     */
    private function revisionLooksUnchanged(
        NutritionDietPrescription $currentPrescription,
        array $newContent,
        NutritionDietRequest $request,
    ): bool {
        $oldContent = is_array($currentPrescription->content_snapshot) ? $currentPrescription->content_snapshot : [];
        $targets = $this->extractRevisionTargets($request);

        if ($targets !== []) {
            foreach ($targets as $target) {
                if (! $this->sameTargetContent($oldContent, $newContent, $target)) {
                    return false;
                }
            }

            return true;
        }

        return $this->contentSignature($oldContent) === $this->contentSignature($newContent);
    }

    /**
     * @return list<string>
     */
    private function extractRevisionTargets(NutritionDietRequest $request): array
    {
        $text = $this->instructionText($request);
        $targets = [];

        $specificSnackTargets = [
            'before_sleep_snack' => ['قبل خواب', 'قبل‌خواب', 'پیش از خواب', 'قبل از خواب', 'before sleep', 'bedtime'],
            'morning_snack' => ['میان وعده صبح', 'میان‌وعده صبح', 'morning snack'],
            'afternoon_snack' => ['میان وعده عصر', 'میان‌وعده عصر', 'afternoon snack'],
        ];

        foreach ($specificSnackTargets as $target => $keywords) {
            foreach ($keywords as $keyword) {
                if (mb_stripos($text, $keyword) !== false) {
                    $targets[] = $target;
                    break;
                }
            }
        }

        $map = [
            'breakfast' => ['صبحانه', 'breakfast'],
            'lunch' => ['ناهار', 'lunch'],
            'dinner' => ['شام', 'dinner'],
        ];

        if ($targets === []) {
            $map['snack'] = ['میان', 'snack'];
        }

        foreach ($map as $target => $keywords) {
            foreach ($keywords as $keyword) {
                if (mb_stripos($text, $keyword) !== false) {
                    $targets[] = $target;
                    break;
                }
            }
        }

        return array_values(array_unique($targets));
    }

    private function instructionText(NutritionDietRequest $request): string
    {
        return trim(implode("\n", array_filter([
            (string) $request->generation_instructions,
            (string) $request->must_include,
            (string) $request->must_avoid,
            (string) $request->expert_notes,
            (string) $request->clinical_notes,
        ], fn ($value): bool => trim($value) !== '')));
    }

    /**
     * @param array<string, mixed> $oldContent
     * @param array<string, mixed> $newContent
     */
    private function sameTargetContent(array $oldContent, array $newContent, string $target): bool
    {
        $old = $this->targetSignature($oldContent, $target);
        $new = $this->targetSignature($newContent, $target);

        if ($old !== '' && $new === '') {
            return true;
        }

        if ($old !== '' && $old === $new) {
            return true;
        }

        return $this->targetLooksTooSimilar($oldContent, $newContent, $target);
    }

    /**
     * @param array<string, mixed> $content
     */
    private function targetSignature(array $content, string $target): string
    {
        $parts = [];

        foreach (is_array($content['meal_slots'] ?? null) ? $content['meal_slots'] : [] as $slot) {
            if (! is_array($slot)) {
                continue;
            }

            $slotKey = mb_strtolower(trim((string) ($slot['slot_key'] ?? '')));
            $title = trim((string) ($slot['title'] ?? ''));
            if (! $this->matchesTarget($target, $slotKey, $title)) {
                continue;
            }

            $parts[] = $slotKey . '|' . $title;
            foreach (is_array($slot['options'] ?? null) ? $slot['options'] : [] as $option) {
                if (! is_array($option)) {
                    continue;
                }

                $parts[] = trim((string) ($option['title'] ?? '')) . '|' . trim((string) ($option['description'] ?? '')) . '|' . trim((string) ($option['quantity_text'] ?? ''));
            }
        }

        foreach (is_array($content['day_plans'] ?? null) ? $content['day_plans'] : [] as $plan) {
            if (! is_array($plan)) {
                continue;
            }

            foreach (is_array($plan['meals'] ?? null) ? $plan['meals'] : [] as $meal) {
                if (! is_array($meal)) {
                    continue;
                }

                $slotKey = mb_strtolower(trim((string) ($meal['slot_key'] ?? '')));
                $title = trim((string) ($meal['title'] ?? ''));
                if (! $this->matchesTarget($target, $slotKey, $title)) {
                    continue;
                }

                $parts[] = $slotKey . '|' . $title . '|' . trim((string) ($meal['meal_text'] ?? '')) . '|' . trim((string) ($meal['description'] ?? ''));
            }
        }

        return implode("\n", $parts);
    }

    private function matchesTarget(string $target, string $slotKey, string $title): bool
    {
        $haystack = mb_strtolower($slotKey . ' ' . $title);

        return match ($target) {
            'breakfast' => str_contains($haystack, 'breakfast') || str_contains($haystack, 'صبحانه'),
            'lunch' => str_contains($haystack, 'lunch') || str_contains($haystack, 'ناهار'),
            'dinner' => str_contains($haystack, 'dinner') || str_contains($haystack, 'شام'),
            'morning_snack' => str_contains($haystack, 'morning_snack') || str_contains($haystack, 'میان‌وعده صبح') || str_contains($haystack, 'میان وعده صبح'),
            'afternoon_snack' => str_contains($haystack, 'afternoon_snack') || str_contains($haystack, 'میان‌وعده عصر') || str_contains($haystack, 'میان وعده عصر'),
            'before_sleep_snack' => str_contains($haystack, 'before_sleep_snack') || str_contains($haystack, 'قبل خواب') || str_contains($haystack, 'قبل‌خواب') || str_contains($haystack, 'پیش از خواب'),
            'snack' => str_contains($haystack, 'snack') || str_contains($haystack, 'میان'),
            default => false,
        };
    }

    /**
     * @param array<string, mixed> $content
     */
    private function contentSignature(array $content): string
    {
        $normalized = json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return is_string($normalized) ? $normalized : '';
    }

    /**
     * @param array<string, mixed> $oldContent
     * @param array<string, mixed> $newContent
     */
    private function targetLooksTooSimilar(array $oldContent, array $newContent, string $target): bool
    {
        $oldTitles = $this->targetFoodTitles($oldContent, $target);
        $newTitles = $this->targetFoodTitles($newContent, $target);

        if ($oldTitles === [] || $newTitles === []) {
            return false;
        }

        $oldUnique = array_values(array_unique($oldTitles));
        $newUnique = array_values(array_unique($newTitles));
        $intersection = array_values(array_intersect($oldUnique, $newUnique));

        if ($intersection === []) {
            return false;
        }

        return count($intersection) >= max(1, (int) ceil(min(count($oldUnique), count($newUnique)) * 0.5));
    }

    /**
     * @param array<string, mixed> $content
     * @return list<string>
     */
    private function targetFoodTitles(array $content, string $target): array
    {
        $titles = [];

        foreach (is_array($content['meal_slots'] ?? null) ? $content['meal_slots'] : [] as $slot) {
            if (! is_array($slot)) {
                continue;
            }

            $slotKey = mb_strtolower(trim((string) ($slot['slot_key'] ?? '')));
            $title = trim((string) ($slot['title'] ?? ''));
            if (! $this->matchesTarget($target, $slotKey, $title)) {
                continue;
            }

            foreach (is_array($slot['options'] ?? null) ? $slot['options'] : [] as $option) {
                if (! is_array($option)) {
                    continue;
                }

                $normalized = $this->normalizeComparableText((string) ($option['title'] ?? ''));
                if ($normalized !== '') {
                    $titles[] = $normalized;
                }
            }
        }

        foreach (is_array($content['day_plans'] ?? null) ? $content['day_plans'] : [] as $plan) {
            if (! is_array($plan)) {
                continue;
            }

            foreach (is_array($plan['meals'] ?? null) ? $plan['meals'] : [] as $meal) {
                if (! is_array($meal)) {
                    continue;
                }

                $slotKey = mb_strtolower(trim((string) ($meal['slot_key'] ?? '')));
                $title = trim((string) ($meal['title'] ?? ''));
                if (! $this->matchesTarget($target, $slotKey, $title)) {
                    continue;
                }

                $normalized = $this->normalizeComparableText((string) ($meal['meal_text'] ?? $meal['title'] ?? ''));
                if ($normalized !== '') {
                    $titles[] = $normalized;
                }
            }
        }

        return $titles;
    }

    private function normalizeComparableText(string $value): string
    {
        $value = mb_strtolower(trim($value));
        $value = preg_replace('/\s+/u', ' ', $value) ?? $value;
        $value = preg_replace('/[^\p{L}\p{N}\s]+/u', '', $value) ?? $value;

        return trim($value);
    }

    /**
     * @param array<string, mixed> $newContent
     * @return array<string, mixed>
     */
    private function mergeRevisionIntoExistingPrescription(
        NutritionDietPrescription $currentPrescription,
        array $newContent,
        NutritionDietRequest $request,
    ): array {
        $oldContent = is_array($currentPrescription->content_snapshot) ? $currentPrescription->content_snapshot : [];
        $targets = $this->extractRevisionTargets($request);

        if ($targets === []) {
            return array_replace($oldContent, $newContent);
        }

        $merged = $oldContent;

        if (array_key_exists('summary_text', $newContent) && trim((string) ($newContent['summary_text'] ?? '')) !== '') {
            $merged['summary_text'] = $newContent['summary_text'];
        }

        if (array_key_exists('notes', $newContent) && trim((string) ($newContent['notes'] ?? '')) !== '') {
            $merged['notes'] = $newContent['notes'];
        }

        if (array_key_exists('meal_slots', $newContent)) {
            $merged['meal_slots'] = $this->mergeTargetMealSlots(
                is_array($oldContent['meal_slots'] ?? null) ? $oldContent['meal_slots'] : [],
                is_array($newContent['meal_slots'] ?? null) ? $newContent['meal_slots'] : [],
                $targets,
            );
        }

        if (array_key_exists('day_plans', $newContent)) {
            $merged['day_plans'] = $this->mergeTargetDayPlans(
                is_array($oldContent['day_plans'] ?? null) ? $oldContent['day_plans'] : [],
                is_array($newContent['day_plans'] ?? null) ? $newContent['day_plans'] : [],
                $targets,
            );
        }

        return $merged;
    }

    /**
     * @param array<int, mixed> $oldSlots
     * @param array<int, mixed> $newSlots
     * @param list<string> $targets
     * @return array<int, mixed>
     */
    private function mergeTargetMealSlots(array $oldSlots, array $newSlots, array $targets): array
    {
        $replacementByTarget = [];

        foreach ($newSlots as $slot) {
            if (! is_array($slot)) {
                continue;
            }

            $slotKey = mb_strtolower(trim((string) ($slot['slot_key'] ?? '')));
            $title = trim((string) ($slot['title'] ?? ''));

            foreach ($targets as $target) {
                if ($this->matchesTarget($target, $slotKey, $title)) {
                    $replacementByTarget[$target] = $slot;
                }
            }
        }

        $merged = [];

        foreach ($oldSlots as $slot) {
            if (! is_array($slot)) {
                $merged[] = $slot;
                continue;
            }

            $slotKey = mb_strtolower(trim((string) ($slot['slot_key'] ?? '')));
            $title = trim((string) ($slot['title'] ?? ''));
            $replaced = false;

            foreach ($targets as $target) {
                if ($this->matchesTarget($target, $slotKey, $title) && isset($replacementByTarget[$target])) {
                    $merged[] = $replacementByTarget[$target];
                    $replaced = true;
                    break;
                }
            }

            if (! $replaced) {
                $merged[] = $slot;
            }
        }

        return $merged;
    }

    /**
     * @param array<int, mixed> $oldPlans
     * @param array<int, mixed> $newPlans
     * @param list<string> $targets
     * @return array<int, mixed>
     */
    private function mergeTargetDayPlans(array $oldPlans, array $newPlans, array $targets): array
    {
        $newMealsByDayAndTarget = [];

        foreach ($newPlans as $plan) {
            if (! is_array($plan)) {
                continue;
            }

            $dayNumber = (int) ($plan['day_number'] ?? 0);
            if ($dayNumber <= 0) {
                continue;
            }

            foreach (is_array($plan['meals'] ?? null) ? $plan['meals'] : [] as $meal) {
                if (! is_array($meal)) {
                    continue;
                }

                $slotKey = mb_strtolower(trim((string) ($meal['slot_key'] ?? '')));
                $title = trim((string) ($meal['title'] ?? ''));

                foreach ($targets as $target) {
                    if ($this->matchesTarget($target, $slotKey, $title)) {
                        $newMealsByDayAndTarget[$dayNumber][$target] = $meal;
                    }
                }
            }
        }

        $merged = [];

        foreach ($oldPlans as $plan) {
            if (! is_array($plan)) {
                $merged[] = $plan;
                continue;
            }

            $dayNumber = (int) ($plan['day_number'] ?? 0);
            $meals = [];

            foreach (is_array($plan['meals'] ?? null) ? $plan['meals'] : [] as $meal) {
                if (! is_array($meal)) {
                    $meals[] = $meal;
                    continue;
                }

                $slotKey = mb_strtolower(trim((string) ($meal['slot_key'] ?? '')));
                $title = trim((string) ($meal['title'] ?? ''));
                $replaced = false;

                foreach ($targets as $target) {
                    if ($this->matchesTarget($target, $slotKey, $title) && isset($newMealsByDayAndTarget[$dayNumber][$target])) {
                        $meals[] = $newMealsByDayAndTarget[$dayNumber][$target];
                        $replaced = true;
                        break;
                    }
                }

                if (! $replaced) {
                    $meals[] = $meal;
                }
            }

            $plan['meals'] = $meals;
            $merged[] = $plan;
        }

        return $merged;
    }
}
