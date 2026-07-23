<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\NutritionDietPrescription;
use App\Domain\Tenant\Models\NutritionDietRequest;
use App\Domain\Tenant\Models\TenantUser;
use App\Jobs\CalculateNutritionManualMealNutritionJob;
use App\Support\TenantLocale;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class NutritionAiManualMealNutritionService
{
    public function __construct(
        private readonly NutritionAiSettingsService $settings,
        private readonly NutritionDietRequestSettingsService $dietSettings,
        private readonly NutritionAiDietPromptCatalog $catalog,
        private readonly OpenAiDietClient $client,
        private readonly NutritionTokenService $tokens,
    ) {
    }

    public function queue(int $mealLogId): void
    {
        if (! $this->mealLogAiNutritionColumnsExist()) {
            return;
        }

        DB::table('nutrition_meal_logs')
            ->where('id', $mealLogId)
            ->where('consumption_type', 'manual')
            ->update([
                'ai_nutrition_status' => 'queued',
                'ai_nutrition_error' => null,
                'updated_at' => now(),
            ]);

        $tenantId = tenant('id');
        if (! $tenantId) {
            throw new RuntimeException('شناسه tenant برای محاسبه AI غذا پیدا نشد.');
        }

        CalculateNutritionManualMealNutritionJob::dispatch((string) $tenantId, $mealLogId);
    }

    public function handle(int $mealLogId): void
    {
        if (! $this->mealLogAiNutritionColumnsExist()) {
            return;
        }

        $mealLog = DB::table('nutrition_meal_logs')->where('id', $mealLogId)->first();

        if (! $mealLog || (string) $mealLog->consumption_type !== 'manual') {
            return;
        }

        if (in_array((string) ($mealLog->ai_nutrition_status ?? ''), ['cancelled', 'generated'], true)) {
            return;
        }

        DB::table('nutrition_meal_logs')
            ->where('id', $mealLogId)
            ->update([
                'ai_nutrition_status' => 'processing',
                'ai_nutrition_error' => null,
                'updated_at' => now(),
            ]);

        try {
            $settings = $this->settings->ensureConfigured();
            $settings['temperature'] = min(0.2, (float) ($settings['temperature'] ?? 0.2));
            $settings['diet_prompt_texts'] = $this->dietSettings->effectivePromptTexts();
            $prompt = $this->buildPrompt($mealLog, $settings);
            DB::table('nutrition_meal_logs')
                ->where('id', $mealLogId)
                ->update([
                    'ai_nutrition_prompt_snapshot' => json_encode($prompt['snapshot'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    'updated_at' => now(),
                ]);

            $result = $this->client->generateStructuredDiet($settings, $prompt['messages'], $prompt['schema']);
            $content = is_array($result['content'] ?? null) ? $result['content'] : [];
            $prescription = NutritionDietPrescription::query()->find((int) $mealLog->nutrition_diet_prescription_id);
            $dietRequest = $prescription?->nutrition_diet_request_id
                ? NutritionDietRequest::query()->find((int) $prescription->nutrition_diet_request_id)
                : null;
            $actor = ! empty($mealLog->logged_by_user_id)
                ? TenantUser::query()->find((int) $mealLog->logged_by_user_id)
                : null;

            if ($dietRequest) {
                $this->tokens->debitForManualMealNutrition(
                    $dietRequest,
                    actor: $actor,
                    usage: $result['usage'] ?? [],
                    meta: [
                        'meal_log_id' => (int) $mealLog->id,
                        'meal_slot_key' => trim((string) ($mealLog->meal_slot_key ?? '')),
                        'slot_title' => $this->slotTitle(trim((string) ($mealLog->meal_slot_key ?? ''))),
                        'food_title' => trim((string) ($mealLog->food_title ?? '')),
                        'model' => (string) ($settings['model'] ?? ''),
                        'model_version' => $settings['model_version'] ?? null,
                    ],
                );
            }

            $update = [
                'option_calories' => max(0, min(3000, (int) ($content['calories'] ?? 0))),
                'protein_grams' => $this->macro($content['protein_grams'] ?? 0, 300),
                'fat_grams' => $this->macro($content['fat_grams'] ?? 0, 300),
                'carbohydrate_grams' => $this->macro($content['carbohydrate_grams'] ?? 0, 600),
                'fiber_grams' => $this->macro($content['fiber_grams'] ?? 0, 150),
            ];
            $update['notes'] = $this->mergeNutritionNotes((string) ($mealLog->notes ?? ''), $update, (string) ($content['reasoning'] ?? ''));
            $update['ai_nutrition_status'] = 'generated';
            $update['ai_nutrition_error'] = null;
            $update['ai_nutrition_response_snapshot'] = json_encode($result['raw'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $update['updated_at'] = now();

            DB::table('nutrition_meal_logs')
                ->where('id', $mealLogId)
                ->where('consumption_type', 'manual')
                ->where('ai_nutrition_status', 'processing')
                ->update($update);
        } catch (\Throwable $exception) {
            DB::table('nutrition_meal_logs')
                ->where('id', $mealLogId)
                ->where('consumption_type', 'manual')
                ->whereIn('ai_nutrition_status', ['queued', 'processing'])
                ->update([
                    'ai_nutrition_status' => 'failed',
                    'ai_nutrition_error' => $exception->getMessage(),
                    'updated_at' => now(),
                ]);

            report($exception);
        }
    }

    private function buildPrompt(object $mealLog, array $settings): array
    {
        $editablePromptTexts = is_array($settings['diet_prompt_texts'] ?? null) ? $settings['diet_prompt_texts'] : [];
        $promptText = trim((string) ($editablePromptTexts['manual_meal_nutrition'] ?? $this->catalog->defaultEditablePrompt('manual_meal_nutrition')));
        $systemPrompt = trim($promptText . "\n\n" . implode("\n", $this->catalog->immutableManualMealNutritionSystemLines()));
        $localeConfig = TenantLocale::configFor((string) app()->getLocale());
        $input = [
            'task' => 'estimate_manual_meal_nutrition',
            'language' => (string) ($localeConfig['date_locale'] ?? app()->getLocale()),
            'meal' => [
                'title' => trim((string) ($mealLog->food_title ?? '')),
                'quantityText' => trim((string) ($mealLog->quantity_text ?? '')),
                'description' => trim((string) ($mealLog->food_description ?? '')),
                'notes' => trim((string) ($mealLog->notes ?? '')),
                'slotKey' => trim((string) ($mealLog->meal_slot_key ?? '')),
            ],
        ];

        return [
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => json_encode($input, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)],
            ],
            'schema' => $this->schema(),
            'snapshot' => [
                'systemPrompt' => $systemPrompt,
                'input' => $input,
            ],
        ];
    }

    private function schema(): array
    {
        return [
            'type' => 'object',
            'additionalProperties' => false,
            'required' => ['calories', 'protein_grams', 'fat_grams', 'carbohydrate_grams', 'fiber_grams', 'confidence', 'reasoning'],
            'properties' => [
                'calories' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 3000],
                'protein_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 300],
                'fat_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 300],
                'carbohydrate_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 600],
                'fiber_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 150],
                'confidence' => ['type' => 'string', 'enum' => ['low', 'medium', 'high']],
                'reasoning' => ['type' => 'string'],
            ],
        ];
    }

    private function macro(mixed $value, float $max): float
    {
        return round(max(0, min($max, (float) $value)), 2);
    }

    private function mergeNutritionNotes(string $notes, array $nutrition, string $reasoning): string
    {
        $parts = collect(explode('|', $notes))
            ->map(fn (string $part): string => trim($part))
            ->filter(fn (string $part): bool => $part !== '')
            ->reject(fn (string $part): bool => preg_match('/^(calories|protein_grams|fat_grams|carbohydrate_grams|fiber_grams|ai_nutrition_reason):/u', $part) === 1)
            ->values()
            ->all();

        $parts[] = 'calories:' . (int) $nutrition['option_calories'];
        foreach (['protein_grams', 'fat_grams', 'carbohydrate_grams', 'fiber_grams'] as $key) {
            $parts[] = $key . ':' . rtrim(rtrim(number_format((float) $nutrition[$key], 1, '.', ''), '0'), '.');
        }

        $reasoning = trim($reasoning);
        if ($reasoning !== '') {
            $parts[] = 'ai_nutrition_reason:' . $reasoning;
        }

        return implode(' | ', $parts);
    }

    private function mealLogAiNutritionColumnsExist(): bool
    {
        if (! Schema::hasTable('nutrition_meal_logs')) {
            return false;
        }

        foreach ([
            'option_calories',
            'protein_grams',
            'fat_grams',
            'carbohydrate_grams',
            'fiber_grams',
            'ai_nutrition_status',
            'ai_nutrition_error',
            'ai_nutrition_prompt_snapshot',
            'ai_nutrition_response_snapshot',
        ] as $column) {
            if (! Schema::hasColumn('nutrition_meal_logs', $column)) {
                return false;
            }
        }

        return true;
    }

    private function slotTitle(string $slotKey): string
    {
        return match ($slotKey) {
            'breakfast' => 'صبحانه',
            'morning_snack' => 'میان‌وعده صبح',
            'lunch' => 'ناهار',
            'afternoon_snack' => 'میان‌وعده عصر',
            'dinner' => 'شام',
            'night_snack' => 'میان‌وعده شب',
            default => $slotKey !== '' ? $slotKey : 'وعده',
        };
    }
}
