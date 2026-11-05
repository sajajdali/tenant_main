<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\NutritionAiDietPromptBuilder;
use App\Services\NutritionAiDietPromptCatalog;
use Mockery;
use Tests\TestCase;

class NutritionAiDietPromptBuilderWeightLossInjectionTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();

        parent::tearDown();
    }

    public function test_weight_loss_injection_is_included_in_clinical_safety_context(): void
    {
        $builder = new NutritionAiDietPromptBuilder(Mockery::mock(NutritionAiDietPromptCatalog::class));
        $method = new \ReflectionMethod($builder, 'buildClinicalSafetyContext');

        $context = $method->invoke($builder, [
            'usesWeightLossInjections' => true,
            'weightLossInjectionName' => 'اوزمپیک',
            'weightLossInjectionDoseCount' => 3,
        ], []);

        $this->assertTrue($context['enabled']);
        $this->assertTrue($context['usesWeightLossInjections']);
        $this->assertSame('اوزمپیک', $context['weightLossInjectionName']);
        $this->assertSame(3, $context['weightLossInjectionDoseCount']);
        $this->assertStringContainsString('سابقه مصرف آمپول لاغری: اوزمپیک، 3 دوز', $context['safetySummary']);
    }
}
