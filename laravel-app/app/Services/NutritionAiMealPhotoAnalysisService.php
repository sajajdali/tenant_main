<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\NutritionDietPrescription;
use App\Domain\Tenant\Models\NutritionDietRequest;
use App\Domain\Tenant\Models\TenantUser;
use App\Support\TenantLocale;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

class NutritionAiMealPhotoAnalysisService
{
    public function __construct(
        private readonly NutritionAiSettingsService $settings,
        private readonly NutritionDietRequestSettingsService $dietSettings,
        private readonly NutritionAiDietPromptCatalog $catalog,
        private readonly OpenAiDietClient $client,
        private readonly NutritionTokenService $tokens,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function analyze(
        NutritionDietPrescription $prescription,
        TenantUser $user,
        array $payload,
        UploadedFile $image,
    ): array {
        $settings = $this->settings->ensureConfigured();
        $settings['temperature'] = min(0.2, (float) ($settings['temperature'] ?? 0.2));
        $settings['diet_prompt_texts'] = $this->dietSettings->effectivePromptTexts();

        $slotContext = $this->buildSlotContext($prescription, $payload);
        $messages = $this->buildMessages($payload, $image, $slotContext, $settings);
        $schema = $this->schema();
        $result = $this->client->generateStructuredDiet($settings, $messages['messages'], $schema);
        $content = is_array($result['content'] ?? null) ? $result['content'] : [];

        $dietRequest = $prescription->nutrition_diet_request_id
            ? NutritionDietRequest::query()->find((int) $prescription->nutrition_diet_request_id)
            : null;

        if ($dietRequest) {
            $this->tokens->debitForManualMealNutrition(
                $dietRequest,
                actor: $user,
                usage: $result['usage'] ?? [],
                meta: [
                    'operation_type' => 'meal_photo_analysis',
                    'meal_slot_key' => $slotContext['slotKey'],
                    'slot_title' => $slotContext['slotTitle'],
                    'consumed_date' => $payload['consumed_date'] ?? null,
                    'model' => (string) ($settings['model'] ?? ''),
                    'model_version' => $settings['model_version'] ?? null,
                ],
            );
        }

        return [
            'foodTitle' => trim((string) ($content['food_title'] ?? '')),
            'foodDescription' => $this->nullableTrim($content['food_description'] ?? null),
            'fullPortionText' => $this->nullableTrim($content['full_portion_text'] ?? null),
            'suggestedQuantityText' => trim((string) ($content['suggested_quantity_text'] ?? '')),
            'suggestedCalories' => max(0, min(3000, (int) ($content['suggested_calories'] ?? 0))),
            'suggestedProteinGrams' => $this->macro($content['suggested_protein_grams'] ?? 0, 300),
            'suggestedFatGrams' => $this->macro($content['suggested_fat_grams'] ?? 0, 300),
            'suggestedCarbohydrateGrams' => $this->macro($content['suggested_carbohydrate_grams'] ?? 0, 600),
            'suggestedFiberGrams' => $this->macro($content['suggested_fiber_grams'] ?? 0, 150),
            'guidanceText' => trim((string) ($content['guidance_text'] ?? '')),
            'confidence' => trim((string) ($content['confidence'] ?? 'medium')),
            'notes' => $this->nullableTrim($content['notes'] ?? null),
        ];
    }

    /**
     * @return array{messages: array<int, array<string, mixed>>, snapshot: array<string, mixed>}
     */
    private function buildMessages(array $payload, UploadedFile $image, array $slotContext, array $settings): array
    {
        $editablePromptTexts = is_array($settings['diet_prompt_texts'] ?? null) ? $settings['diet_prompt_texts'] : [];
        $promptText = trim((string) ($editablePromptTexts['meal_photo_analysis'] ?? $this->catalog->defaultEditablePrompt('meal_photo_analysis')));
        $systemPrompt = trim($promptText . "\n\n" . implode("\n", $this->catalog->immutableMealPhotoAnalysisSystemLines()));
        $imageBase64 = base64_encode((string) file_get_contents($image->getRealPath()));
        $mimeType = $image->getMimeType() ?: 'image/jpeg';
        $localeConfig = TenantLocale::configFor((string) app()->getLocale());
        $input = [
            'task' => 'analyze_manual_meal_photo',
            'language' => (string) ($localeConfig['date_locale'] ?? app()->getLocale()),
            'consumedDate' => $payload['consumed_date'] ?? null,
            'slot' => $slotContext,
        ];
        $userFoodTitle = trim((string) ($payload['user_food_title'] ?? ''));
        if ($userFoodTitle !== '') {
            $input['userProvidedFoodTitle'] = $userFoodTitle;
            $input['userProvidedFoodTitleInstruction'] = "این غذا {$userFoodTitle} هست و سپس محاسبات را بر اساس همین غذا انجام بده.";
        }
        $userNote = trim((string) ($payload['user_note'] ?? ''));
        if ($userNote !== '') {
            $input['userNote'] = $userNote;
            $input['userNoteInstruction'] = 'یادداشت کاربر را با اولویت بالا اعمال کن. اگر کاربر گفته تشخیص قبلی غذا اشتباه بوده یا این غذا چیز دیگری است، نام غذا، مواد، روش پخت، مقدار پیشنهادی، کالری و ماکروها را بر اساس متن کاربر اصلاح کن و تصویر را فقط برای تخمین حجم و شواهد بصری استفاده کن.';
        }

        return [
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                [
                    'role' => 'user',
                    'content' => [
                        ['type' => 'text', 'text' => json_encode($input, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)],
                        ['type' => 'image_url', 'image_url' => ['url' => 'data:' . $mimeType . ';base64,' . $imageBase64]],
                    ],
                ],
            ],
            'snapshot' => [
                'systemPrompt' => $systemPrompt,
                'input' => $input,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildSlotContext(NutritionDietPrescription $prescription, array $payload): array
    {
        $content = is_array($prescription->content_snapshot) ? $prescription->content_snapshot : [];
        $slotKey = trim((string) ($payload['meal_slot_key'] ?? ''));
        $slotTitle = trim((string) ($payload['slot_title'] ?? $this->slotTitle($slotKey)));
        $consumedDate = trim((string) ($payload['consumed_date'] ?? ''));
        $dayNumber = $this->resolveDayNumber($prescription, $consumedDate);
        $dayMeals = [];
        $slotOptions = [];
        $targetCalories = 0;

        foreach ((array) ($content['day_plans'] ?? []) as $planValue) {
            $plan = is_array($planValue) ? $planValue : [];
            if ((int) ($plan['day_number'] ?? 0) !== $dayNumber) {
                continue;
            }

            foreach ((array) ($plan['meals'] ?? []) as $mealValue) {
                $meal = is_array($mealValue) ? $mealValue : [];
                if (trim((string) ($meal['slot_key'] ?? '')) !== $slotKey) {
                    continue;
                }

                $dayMeals[] = [
                    'title' => trim((string) ($meal['meal_text'] ?? $meal['title'] ?? '')),
                    'description' => $this->nullableTrim($meal['description'] ?? null),
                    'quantityText' => $this->nullableTrim($meal['quantity_text'] ?? null),
                    'grams' => max(0, (int) ($meal['grams'] ?? 0)),
                    'calories' => max(0, (int) ($meal['calories'] ?? 0)),
                ];
            }
        }

        foreach ((array) ($content['meal_slots'] ?? []) as $slotValue) {
            $slot = is_array($slotValue) ? $slotValue : [];
            if (trim((string) ($slot['slot_key'] ?? '')) !== $slotKey) {
                continue;
            }

            foreach ((array) ($slot['options'] ?? []) as $optionValue) {
                $option = is_array($optionValue) ? $optionValue : [];
                $slotOptions[] = [
                    'title' => trim((string) ($option['title'] ?? '')),
                    'description' => $this->nullableTrim($option['description'] ?? null),
                    'quantityText' => $this->nullableTrim($option['quantity_text'] ?? null),
                    'grams' => max(0, (int) ($option['grams'] ?? 0)),
                    'calories' => max(0, (int) ($option['calories'] ?? 0)),
                ];
            }
        }

        if ($dayMeals !== []) {
            $targetCalories = max(0, (int) ($dayMeals[0]['calories'] ?? 0));
        } elseif ($slotOptions !== []) {
            $calories = array_values(array_filter(array_map(fn (array $option): int => (int) ($option['calories'] ?? 0), $slotOptions)));
            if ($calories !== []) {
                $targetCalories = (int) round(array_sum($calories) / count($calories));
            }
        }

        $consumedCaloriesInSlot = (int) DB::table('nutrition_meal_logs')
            ->where('nutrition_diet_prescription_id', $prescription->id)
            ->where('consumed_date', $consumedDate)
            ->where('meal_slot_key', $slotKey)
            ->sum('option_calories');

        return [
            'slotKey' => $slotKey,
            'slotTitle' => $slotTitle,
            'dayNumber' => $dayNumber > 0 ? $dayNumber : null,
            'targetCalories' => $targetCalories,
            'consumedCaloriesInSlot' => $consumedCaloriesInSlot,
            'remainingCaloriesInSlot' => max(0, $targetCalories - $consumedCaloriesInSlot),
            'plannedMeals' => array_slice($dayMeals, 0, 3),
            'slotOptions' => array_slice($slotOptions, 0, 6),
        ];
    }

    private function resolveDayNumber(NutritionDietPrescription $prescription, string $consumedDate): int
    {
        if (! $prescription->started_at || $consumedDate === '') {
            return 0;
        }

        try {
            $target = new \Carbon\Carbon($consumedDate);
        } catch (\Throwable) {
            return 0;
        }

        $startedAt = $prescription->started_at->copy()->startOfDay();
        $targetDate = $target->copy()->startOfDay();
        $dayOffset = (int) $startedAt->diffInDays($targetDate, false);

        return max(1, $dayOffset + 1);
    }

    private function schema(): array
    {
        return [
            'type' => 'object',
            'additionalProperties' => false,
            'required' => [
                'food_title',
                'food_description',
                'full_portion_text',
                'suggested_quantity_text',
                'suggested_calories',
                'suggested_protein_grams',
                'suggested_fat_grams',
                'suggested_carbohydrate_grams',
                'suggested_fiber_grams',
                'guidance_text',
                'confidence',
                'notes',
            ],
            'properties' => [
                'food_title' => ['type' => 'string'],
                'food_description' => ['type' => 'string'],
                'full_portion_text' => ['type' => 'string'],
                'suggested_quantity_text' => ['type' => 'string'],
                'suggested_calories' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 3000],
                'suggested_protein_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 300],
                'suggested_fat_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 300],
                'suggested_carbohydrate_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 600],
                'suggested_fiber_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 150],
                'guidance_text' => ['type' => 'string'],
                'confidence' => ['type' => 'string', 'enum' => ['low', 'medium', 'high']],
                'notes' => ['type' => 'string'],
            ],
        ];
    }

    private function slotTitle(string $slotKey): string
    {
        return match ($slotKey) {
            'breakfast' => 'صبحانه',
            'morning_snack' => 'میان وعده صبح',
            'lunch' => 'ناهار',
            'afternoon_snack' => 'میان وعده عصر',
            'dinner' => 'شام',
            'night_snack' => 'میان وعده شب',
            default => $slotKey !== '' ? $slotKey : 'وعده',
        };
    }

    private function nullableTrim(mixed $value): ?string
    {
        $trimmed = trim((string) $value);

        return $trimmed === '' ? null : $trimmed;
    }

    private function macro(mixed $value, float $max): float
    {
        return round(max(0, min($max, (float) $value)), 2);
    }
}
