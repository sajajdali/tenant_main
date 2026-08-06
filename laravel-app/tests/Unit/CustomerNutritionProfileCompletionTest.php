<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Domain\Tenant\Models\NutritionProfile;
use App\Domain\Tenant\Models\NutritionPackageSubscription;
use App\Services\Api\CustomerNutritionProfileDataService;
use App\Services\NutritionDietRequestSettingsService;
use App\Services\NutritionPackagePaymentService;
use Mockery;
use Tests\TestCase;

class CustomerNutritionProfileCompletionTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();

        parent::tearDown();
    }

    public function test_diet_request_flow_uses_the_same_complete_profile_rule_as_the_site(): void
    {
        $profile = (new NutritionProfile)->forceFill([
            'diet_goal' => 'lose-weight',
            'gender' => 'female',
            'athlete_mode' => 'non-athlete',
            'activity_level' => 'moderate',
            'birth_date' => '1994-04-12',
            'height_cm' => 168,
            'weight_kg' => 78.5,
            'target_weight_kg' => 68,
            'weekly_weight_change_kg' => 0.5,
            'preferences_completed_at' => now(),
        ]);

        $this->assertTrue($this->service()->profileCompleted($profile));
    }

    public function test_an_existing_but_incomplete_profile_cannot_start_diet_selection(): void
    {
        $profile = (new NutritionProfile)->forceFill([
            'diet_goal' => 'lose-weight',
            'gender' => 'female',
            'weight_kg' => 78.5,
        ]);

        $this->assertFalse($this->service()->profileCompleted($profile));
    }

    public function test_profile_without_completed_preferences_is_not_a_completed_membership(): void
    {
        $profile = (new NutritionProfile)->forceFill([
            'diet_goal' => 'lose-weight',
            'gender' => 'female',
            'athlete_mode' => 'non-athlete',
            'activity_level' => 'moderate',
            'birth_date' => '1994-04-12',
            'height_cm' => 168,
            'weight_kg' => 78.5,
            'target_weight_kg' => 68,
            'weekly_weight_change_kg' => 0.5,
            'preferences_completed_at' => null,
        ]);

        $this->assertFalse($this->service()->profileCompleted($profile));
    }

    public function test_incomplete_membership_continues_from_the_first_missing_step(): void
    {
        $profile = (new NutritionProfile)->forceFill([
            'diet_goal' => 'lose-weight',
            'gender' => 'female',
            'athlete_mode' => 'non-athlete',
            'activity_level' => 'moderate',
            'birth_date' => '1994-04-12',
            'height_cm' => 168,
            'weight_kg' => null,
        ]);

        $this->assertSame(
            '/nutrition/membership/weight',
            $this->invokePrivate('firstIncompleteMembershipHref', [$profile]),
        );
    }

    public function test_finished_first_diet_starts_the_fifteen_step_follow_up(): void
    {
        $profile = (new NutritionProfile)->forceFill([
            'diet_goal' => 'lose-weight',
            'gender' => 'female',
            'athlete_mode' => 'non-athlete',
            'activity_level' => 'moderate',
            'birth_date' => '1994-04-12',
            'height_cm' => 168,
            'weight_kg' => 78.5,
            'target_weight_kg' => 68,
            'weekly_weight_change_kg' => 0.5,
            'preferences_completed_at' => now(),
            'mindset_completed_at' => now(),
        ]);

        $this->assertSame(
            '/nutrition/diet-followup/1',
            $this->invokePrivate('dietStartHref', [$profile, true, 1]),
        );
    }

    public function test_active_subscription_with_remaining_diet_credit_is_usable(): void
    {
        $subscription = (new NutritionPackageSubscription)->forceFill([
            'status' => 'active',
            'online_diet_total' => 2,
            'online_diet_used' => 0,
            'offline_diet_total' => 0,
            'offline_diet_used' => 0,
        ]);

        $this->assertTrue($this->invokePrivate('hasUsableSubscription', [$subscription]));
    }

    public function test_active_subscription_without_remaining_diet_credit_is_not_usable(): void
    {
        $subscription = (new NutritionPackageSubscription)->forceFill([
            'status' => 'active',
            'online_diet_total' => 2,
            'online_diet_used' => 2,
            'offline_diet_total' => 0,
            'offline_diet_used' => 0,
        ]);

        $this->assertFalse($this->invokePrivate('hasUsableSubscription', [$subscription]));
    }

    private function invokePrivate(string $method, array $arguments): mixed
    {
        $reflection = new \ReflectionMethod(CustomerNutritionProfileDataService::class, $method);

        return $reflection->invoke($this->service(), ...$arguments);
    }

    private function service(): CustomerNutritionProfileDataService
    {
        return new CustomerNutritionProfileDataService(
            Mockery::mock(NutritionPackagePaymentService::class),
            Mockery::mock(NutritionDietRequestSettingsService::class),
        );
    }
}
