<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\CustomerClubSetting;
use App\Domain\Tenant\Models\NutritionDietPrescription;
use App\Domain\Tenant\Models\NutritionDietRequest;
use App\Domain\Tenant\Models\TenantUser;
use App\Support\TenantAudienceScope;
use Illuminate\Support\Facades\DB;

class NutritionCustomerClubRewardService
{
    public function __construct(
        private readonly CustomerClubService $customerClub,
    ) {
    }

    public function awardForScheduledMealLog(TenantUser $user, NutritionDietPrescription $prescription, string $consumedDate, string $slotKey): void
    {
        $settings = $this->settings();

        if (! $settings) {
            return;
        }

        if ($settings->nutrition_per_meal_log_enabled && (int) $settings->nutrition_per_meal_log_points > 0) {
            $this->customerClub->awardCustomEarning(
                $user,
                'nutrition_meal_slot_earn',
                'nutrition_meal_slot',
                $prescription->id.':'.$consumedDate.':'.$slotKey,
                (int) $settings->nutrition_per_meal_log_points,
                0,
                'امتیاز ثبت وعده غذایی',
                'به خاطر ثبت یکی از وعده‌های رژیم، امتیاز باشگاه مشتریان برای شما ثبت شد.',
            );
        }

        if (! $settings->nutrition_daily_food_log_enabled || (int) $settings->nutrition_daily_food_log_points <= 0) {
            return;
        }

        $scheduledSlotCount = (int) DB::table('nutrition_prescription_meal_slots')
            ->where('nutrition_diet_prescription_id', $prescription->id)
            ->distinct('slot_key')
            ->count('slot_key');

        if ($scheduledSlotCount <= 0) {
            return;
        }

        $loggedSlotCount = (int) DB::table('nutrition_meal_logs')
            ->where('user_id', $user->id)
            ->where('nutrition_diet_prescription_id', $prescription->id)
            ->whereDate('consumed_date', $consumedDate)
            ->where('consumption_type', 'scheduled')
            ->distinct('meal_slot_key')
            ->count('meal_slot_key');

        if ($loggedSlotCount < $scheduledSlotCount) {
            return;
        }

        $this->customerClub->awardCustomEarning(
            $user,
            'nutrition_daily_food_log_earn',
            'nutrition_daily_food_log',
            $prescription->id.':'.$consumedDate,
            (int) $settings->nutrition_daily_food_log_points,
            0,
            'امتیاز تکمیل وعده‌های روز',
            'به خاطر ثبت کامل وعده‌های غذایی این روز، امتیاز باشگاه مشتریان برای شما ثبت شد.',
        );
    }

    public function awardForWaterLog(TenantUser $user, NutritionDietPrescription $prescription, string $consumedDate): void
    {
        $settings = $this->settings();

        if (! $settings || ! $settings->nutrition_daily_water_log_enabled || (int) $settings->nutrition_daily_water_log_points <= 0) {
            return;
        }

        $this->customerClub->awardCustomEarning(
            $user,
            'nutrition_daily_water_log_earn',
            'nutrition_daily_water_log',
            $prescription->id.':'.$consumedDate,
            (int) $settings->nutrition_daily_water_log_points,
            0,
            'امتیاز ثبت آب روزانه',
            'به خاطر ثبت مصرف آب روزانه، امتیاز باشگاه مشتریان برای شما ثبت شد.',
        );
    }

    public function awardForOnlineDietRequest(TenantUser $user, NutritionDietRequest $request): void
    {
        $settings = $this->settings();

        if (! $settings || ! $settings->nutrition_online_diet_request_reward_enabled || (int) $settings->nutrition_online_diet_request_reward_points <= 0) {
            return;
        }

        $this->customerClub->awardCustomEarning(
            $user,
            'nutrition_online_diet_request_earn',
            'nutrition_online_diet_request',
            (string) $request->id,
            (int) $settings->nutrition_online_diet_request_reward_points,
            0,
            'امتیاز دریافت رژیم آنلاین',
            'به خاطر ثبت درخواست رژیم آنلاین، امتیاز باشگاه مشتریان برای شما ثبت شد.',
        );
    }

    public function awardForWeightLossFollowup(TenantUser $user, NutritionDietRequest $request, ?float $previousWeightKg, ?float $currentWeightKg): void
    {
        $settings = $this->settings();

        if (
            ! $settings
            || ! $settings->nutrition_weight_loss_reward_enabled
            || (int) $settings->nutrition_weight_loss_reward_points <= 0
            || $previousWeightKg === null
            || $currentWeightKg === null
            || $currentWeightKg >= $previousWeightKg
        ) {
            return;
        }

        $lostWeightKg = round($previousWeightKg - $currentWeightKg, 2);

        $this->customerClub->awardCustomEarning(
            $user,
            'nutrition_weight_loss_followup_earn',
            'nutrition_weight_loss_followup',
            (string) $request->id,
            (int) $settings->nutrition_weight_loss_reward_points,
            0,
            'امتیاز نتیجه کاهش وزن',
            'به خاطر کاهش وزن در مقایسه با رژیم قبلی، '.$lostWeightKg.' کیلوگرم پیشرفت برای شما ثبت شد.',
        );
    }

    private function settings(): ?CustomerClubSetting
    {
        if (! $this->customerClub->isActiveForTenant() || ! TenantAudienceScope::currentTenantUsesNutrition()) {
            return null;
        }

        $settings = CustomerClubSetting::query()->firstOrCreate([], [
            'nutrition_rewards_enabled' => false,
            'nutrition_daily_food_log_enabled' => false,
            'nutrition_daily_food_log_points' => 0,
            'nutrition_per_meal_log_enabled' => false,
            'nutrition_per_meal_log_points' => 0,
            'nutrition_daily_water_log_enabled' => false,
            'nutrition_daily_water_log_points' => 0,
            'nutrition_weight_loss_reward_enabled' => false,
            'nutrition_weight_loss_reward_points' => 0,
            'nutrition_online_diet_request_reward_enabled' => false,
            'nutrition_online_diet_request_reward_points' => 0,
        ]);

        return $settings->nutrition_rewards_enabled ? $settings : null;
    }
}
