<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\NutritionDietPrescription;
use App\Domain\Tenant\Models\NutritionDietRequest;

class NutritionPrescriptionCompletenessService
{
    /**
     * @param array<string, mixed> $content
     * @return array{complete: bool, missing: array<int, string>}
     */
    public function evaluateRequestContent(NutritionDietRequest $request, array $content): array
    {
        $mode = (string) ($content['mode'] ?? $request->prescription_mode ?? 'daily_prescription');
        $template = is_array($request->template_snapshot) ? $request->template_snapshot : [];
        $expectedSlots = $this->expectedSlots($template);
        $expectedSlotKeys = array_keys($expectedSlots);

        return match ($mode) {
            'user_choice' => $this->evaluateUserChoice($content, $expectedSlots),
            'daily_prescription' => $this->evaluateDailyPrescription($request, $content, $expectedSlotKeys),
            'fixed_text' => $this->evaluateFixedText($content),
            default => ['complete' => true, 'missing' => []],
        };
    }

    public function isIncompleteForDelivery(NutritionDietRequest $request, array $content): bool
    {
        return ! $this->evaluateRequestContent($request, $content)['complete'];
    }

    /**
     * @return array{complete: bool, missing: array<int, string>}
     */
    public function evaluatePrescription(NutritionDietPrescription $prescription): array
    {
        $content = is_array($prescription->content_snapshot) ? $prescription->content_snapshot : [];
        $request = $prescription->request;

        if (! $request) {
            return ['complete' => true, 'missing' => []];
        }

        return $this->evaluateRequestContent($request, $content);
    }

    /**
     * @param array<string, mixed> $template
     * @return array<string, array{title: string, foodCount: int}>
     */
    private function expectedSlots(array $template): array
    {
        $slots = is_array($template['mealSlots'] ?? null) ? $template['mealSlots'] : [];

        return collect($slots)
            ->filter(fn ($slot): bool => is_array($slot))
            ->filter(function (array $slot): bool {
                if (array_key_exists('enabled', $slot)) {
                    return (bool) $slot['enabled'];
                }

                return true;
            })
            ->mapWithKeys(function (array $slot): array {
                $key = trim((string) ($slot['key'] ?? ''));

                if ($key === '') {
                    return [];
                }

                return [
                    $key => [
                        'title' => trim((string) ($slot['title'] ?? $key)),
                        'foodCount' => max(1, (int) ($slot['foodCount'] ?? $slot['food_count'] ?? 1)),
                    ],
                ];
            })
            ->all();
    }

    /**
     * @param array<string, mixed> $content
     * @param array<string, array{title: string, foodCount: int}> $expectedSlots
     * @return array{complete: bool, missing: array<int, string>}
     */
    private function evaluateUserChoice(array $content, array $expectedSlots): array
    {
        $slots = collect(is_array($content['meal_slots'] ?? null) ? $content['meal_slots'] : [])
            ->filter(fn ($slot): bool => is_array($slot))
            ->keyBy(fn (array $slot): string => trim((string) ($slot['slot_key'] ?? '')));

        $missing = [];

        foreach ($expectedSlots as $slotKey => $expectedSlot) {
            $slot = $slots->get($slotKey);
            $expectedCount = max(1, (int) ($expectedSlot['foodCount'] ?? 1));
            $slotLabel = (string) (($expectedSlot['title'] ?? '') ?: $slotKey);

            if (! is_array($slot)) {
                $missing[] = "وعده {$slotLabel} وجود ندارد.";
                continue;
            }

            $validOptions = collect(is_array($slot['options'] ?? null) ? $slot['options'] : [])
                ->filter(fn ($option): bool => is_array($option))
                ->filter(fn (array $option): bool => $this->filled($option['title'] ?? null) && $this->filled($option['quantity_text'] ?? null))
                ->count();

            if ($validOptions !== $expectedCount) {
                $missing[] = "وعده {$slotLabel} باید دقیقاً {$expectedCount} گزینه غذایی کامل داشته باشد، اما {$validOptions} گزینه معتبر دارد.";
            }
        }

        if ($expectedSlots === [] && $slots->isEmpty()) {
            $missing[] = 'هیچ وعده‌ای برای نسخه انتخابی ثبت نشده است.';
        }

        return [
            'complete' => $missing === [],
            'missing' => $missing,
        ];
    }

    /**
     * @param array<string, mixed> $content
     * @param list<string> $expectedSlotKeys
     * @return array{complete: bool, missing: array<int, string>}
     */
    private function evaluateDailyPrescription(NutritionDietRequest $request, array $content, array $expectedSlotKeys): array
    {
        $requiresDailyMealQuantityText = $this->shouldRequireDailyMealQuantityText($request, $content);
        $plans = collect(is_array($content['day_plans'] ?? null) ? $content['day_plans'] : [])
            ->filter(fn ($plan): bool => is_array($plan))
            ->keyBy(fn (array $plan): int => max(1, (int) ($plan['day_number'] ?? 1)));

        $expectedDays = max(
            1,
            (int) (is_array($request->template_snapshot) ? ($request->template_snapshot['durationDays'] ?? 0) : 0),
            (int) ($content['duration_days'] ?? 0)
        );

        if ($expectedDays <= 1 && $request->started_at && $request->ends_at) {
            $expectedDays = max(1, $request->ends_at->diffInDays($request->started_at) + 1);
        }

        $missing = [];

        for ($day = 1; $day <= $expectedDays; $day++) {
            $plan = $plans->get($day);

            if (! is_array($plan)) {
                $missing[] = "روز {$day} ثبت نشده است.";
                continue;
            }

            $meals = collect(is_array($plan['meals'] ?? null) ? $plan['meals'] : [])
                ->filter(fn ($meal): bool => is_array($meal))
                ->keyBy(fn (array $meal): string => trim((string) ($meal['slot_key'] ?? '')));

            if ($expectedSlotKeys === []) {
                $validMealCount = $meals
                    ->filter(fn (array $meal): bool => $this->filled($meal['meal_text'] ?? null) || $this->filled($meal['title'] ?? null))
                    ->count();

                if ($validMealCount <= 0) {
                    $missing[] = "روز {$day} هیچ وعده کامل و قابل استفاده‌ای ندارد.";
                }

                foreach ($meals as $meal) {
                    if (! is_array($meal)) {
                        continue;
                    }

                    $mealLabel = trim((string) ($meal['title'] ?? $meal['slot_key'] ?? 'این وعده'));

                    if ($requiresDailyMealQuantityText && ! $this->filled($meal['quantity_text'] ?? null)) {
                        $missing[] = "روز {$day} برای {$mealLabel} quantity_text یا اجزای دقیق غذا خالی است.";
                    }
                }

                continue;
            }

            foreach ($expectedSlotKeys as $slotKey) {
                $meal = $meals->get($slotKey);

                if (! is_array($meal)) {
                    $missing[] = "روز {$day} برای وعده {$slotKey} غذایی ثبت نشده است.";
                    continue;
                }

                if (! $this->filled($meal['meal_text'] ?? null) && ! $this->filled($meal['title'] ?? null)) {
                    $missing[] = "روز {$day} برای وعده {$slotKey} متن غذا خالی است.";
                }

                if ($requiresDailyMealQuantityText && ! $this->filled($meal['quantity_text'] ?? null)) {
                    $missing[] = "روز {$day} برای وعده {$slotKey} quantity_text یا اجزای دقیق غذا خالی است.";
                }
            }
        }

        return [
            'complete' => $missing === [],
            'missing' => $missing,
        ];
    }

    /**
     * @param array<string, mixed> $content
     * @return array{complete: bool, missing: array<int, string>}
     */
    private function evaluateFixedText(array $content): array
    {
        $missing = [];

        if (count(array_filter(is_array($content['meal_slots'] ?? null) ? $content['meal_slots'] : [])) > 0) {
            $missing[] = 'در نسخه متن ثابت نباید meal_slots یا وعده غذایی وجود داشته باشد.';
        }

        if (count(array_filter(is_array($content['day_plans'] ?? null) ? $content['day_plans'] : [])) > 0) {
            $missing[] = 'در نسخه متن ثابت نباید day_plans یا برنامه روزانه وجود داشته باشد.';
        }

        $sections = collect(is_array($content['text_sections'] ?? null) ? $content['text_sections'] : [])
            ->filter(fn ($section): bool => is_array($section));

        $validCount = $sections
            ->filter(fn (array $section): bool => $this->filled($section['body'] ?? null))
            ->count();

        if ($validCount <= 0) {
            $missing[] = 'هیچ بخش متنی کامل و قابل نمایش برای این نسخه ثبت نشده است.';
        }

        return [
            'complete' => $missing === [],
            'missing' => $missing,
        ];
    }

    private function filled(mixed $value): bool
    {
        return trim((string) $value) !== '';
    }

    /**
     * فقط برای نسل‌های جدید daily_prescription این rule را enforce می‌کنیم
     * تا رژیم‌های قدیمی که قبل از این قرارداد تولید شده‌اند، در تایید ارسال گیر نکنند.
     *
     * @param array<string, mixed> $content
     */
    private function shouldRequireDailyMealQuantityText(NutritionDietRequest $request, array $content): bool
    {
        $mode = (string) ($content['mode'] ?? $request->prescription_mode ?? '');
        if ($mode !== 'daily_prescription') {
            return false;
        }

        $promptSnapshot = is_array($request->ai_prompt_snapshot) ? $request->ai_prompt_snapshot : [];

        return (bool) data_get($promptSnapshot, 'featureFlags.dailyMealQuantityTextRequired', false);
    }
}
