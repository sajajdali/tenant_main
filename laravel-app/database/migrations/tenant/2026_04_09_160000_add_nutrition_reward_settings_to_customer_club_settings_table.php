<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('customer_club_settings', function (Blueprint $table): void {
            $table->boolean('nutrition_rewards_enabled')->default(false)->after('show_tier_to_customer');
            $table->boolean('nutrition_daily_food_log_enabled')->default(false)->after('nutrition_rewards_enabled');
            $table->unsignedInteger('nutrition_daily_food_log_points')->default(0)->after('nutrition_daily_food_log_enabled');
            $table->boolean('nutrition_per_meal_log_enabled')->default(false)->after('nutrition_daily_food_log_points');
            $table->unsignedInteger('nutrition_per_meal_log_points')->default(0)->after('nutrition_per_meal_log_enabled');
            $table->boolean('nutrition_daily_water_log_enabled')->default(false)->after('nutrition_per_meal_log_points');
            $table->unsignedInteger('nutrition_daily_water_log_points')->default(0)->after('nutrition_daily_water_log_enabled');
            $table->boolean('nutrition_weight_loss_reward_enabled')->default(false)->after('nutrition_daily_water_log_points');
            $table->unsignedInteger('nutrition_weight_loss_reward_points')->default(0)->after('nutrition_weight_loss_reward_enabled');
            $table->boolean('nutrition_online_diet_request_reward_enabled')->default(false)->after('nutrition_weight_loss_reward_points');
            $table->unsignedInteger('nutrition_online_diet_request_reward_points')->default(0)->after('nutrition_online_diet_request_reward_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('customer_club_settings', function (Blueprint $table): void {
            $table->dropColumn([
                'nutrition_rewards_enabled',
                'nutrition_daily_food_log_enabled',
                'nutrition_daily_food_log_points',
                'nutrition_per_meal_log_enabled',
                'nutrition_per_meal_log_points',
                'nutrition_daily_water_log_enabled',
                'nutrition_daily_water_log_points',
                'nutrition_weight_loss_reward_enabled',
                'nutrition_weight_loss_reward_points',
                'nutrition_online_diet_request_reward_enabled',
                'nutrition_online_diet_request_reward_points',
            ]);
        });
    }
};
