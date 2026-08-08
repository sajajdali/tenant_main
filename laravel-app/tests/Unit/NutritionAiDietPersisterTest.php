<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Domain\Tenant\Models\NutritionDietRequest;
use App\Services\NutritionAiDietPersister;
use App\Services\NutritionPrescriptionActivationService;
use ReflectionMethod;
use Tests\TestCase;

class NutritionAiDietPersisterTest extends TestCase
{
    public function test_enrich_content_removes_disabled_template_meal_slots_from_ai_daily_prescription(): void
    {
        $request = (new NutritionDietRequest)->forceFill([
            'prescription_mode' => 'daily_prescription',
            'allow_food_replacement' => false,
            'suggest_daily_replacements' => false,
            'current_weight_kg' => 80,
            'weekly_weight_change_kg' => 0.5,
            'started_at' => now(),
            'ends_at' => now()->addDays(1),
            'profile_snapshot' => [
                'weightKg' => 80,
            ],
            'template_snapshot' => [
                'durationDays' => 2,
                'mealSlots' => [
                    ['key' => 'breakfast', 'title' => 'صبحانه', 'enabled' => true],
                    ['key' => 'morning_snack', 'title' => 'میان وعده صبح', 'enabled' => false],
                    ['key' => 'lunch', 'title' => 'ناهار', 'enabled' => true],
                    ['key' => 'afternoon_snack', 'title' => 'میان وعده عصر', 'enabled' => false],
                    ['key' => 'dinner', 'title' => 'شام', 'enabled' => true],
                ],
            ],
        ]);

        $content = [
            'mode' => 'daily_prescription',
            'duration_days' => 2,
            'day_plans' => [
                [
                    'day_number' => 1,
                    'meals' => [
                        ['slot_key' => 'breakfast', 'title' => 'صبحانه', 'meal_text' => 'املت', 'calories' => 300],
                        ['slot_key' => 'morning_snack', 'title' => 'میان وعده صبح', 'meal_text' => '', 'calories' => 0],
                        ['slot_key' => 'lunch', 'title' => 'ناهار', 'meal_text' => 'مرغ و برنج', 'calories' => 550],
                        ['slot_key' => 'afternoon_snack', 'title' => 'میان وعده عصر', 'meal_text' => '', 'calories' => 0],
                        ['slot_key' => 'dinner', 'title' => 'شام', 'meal_text' => 'سوپ', 'calories' => 350],
                    ],
                ],
                [
                    'day_number' => 2,
                    'meals' => [
                        ['slot_key' => 'breakfast', 'title' => 'صبحانه', 'meal_text' => 'نان و پنیر', 'calories' => 280],
                        ['slot_key' => 'morning_snack', 'title' => 'میان وعده صبح', 'meal_text' => '', 'calories' => 0],
                        ['slot_key' => 'lunch', 'title' => 'ناهار', 'meal_text' => 'خوراک لوبیا', 'calories' => 500],
                        ['slot_key' => 'afternoon_snack', 'title' => 'میان وعده عصر', 'meal_text' => '', 'calories' => 0],
                        ['slot_key' => 'dinner', 'title' => 'شام', 'meal_text' => 'سالاد مرغ', 'calories' => 360],
                    ],
                ],
            ],
        ];

        $persister = new NutritionAiDietPersister($this->createMock(NutritionPrescriptionActivationService::class));
        $method = new ReflectionMethod($persister, 'enrichContent');
        $method->setAccessible(true);

        $enriched = $method->invoke($persister, $request, $content);

        $this->assertSame(['breakfast', 'lunch', 'dinner'], array_column($enriched['day_plans'][0]['meals'], 'slot_key'));
        $this->assertSame(['breakfast', 'lunch', 'dinner'], array_column($enriched['day_plans'][1]['meals'], 'slot_key'));
    }
}

