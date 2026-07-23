<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('customer_club_settings', function (Blueprint $table): void {
            $table->id();
            $table->boolean('is_enabled')->default(true);
            $table->boolean('points_enabled')->default(true);
            $table->boolean('wallet_enabled')->default(true);
            $table->boolean('tiers_enabled')->default(true);
            $table->boolean('rewards_enabled')->default(true);
            $table->boolean('auto_tier_upgrade_enabled')->default(true);
            $table->boolean('appointment_points_enabled')->default(true);
            $table->unsignedInteger('appointment_fixed_points')->default(10);
            $table->unsignedInteger('appointment_points_per_100k')->default(0);
            $table->boolean('appointment_wallet_enabled')->default(false);
            $table->unsignedInteger('appointment_fixed_wallet')->default(0);
            $table->boolean('store_points_enabled')->default(true);
            $table->unsignedInteger('store_fixed_points')->default(0);
            $table->unsignedInteger('store_points_per_100k')->default(5);
            $table->boolean('store_wallet_enabled')->default(true);
            $table->unsignedInteger('store_wallet_percent')->default(3);
            $table->boolean('welcome_bonus_enabled')->default(false);
            $table->unsignedInteger('welcome_bonus_points')->default(0);
            $table->unsignedInteger('welcome_bonus_wallet')->default(0);
            $table->boolean('birthday_bonus_enabled')->default(false);
            $table->unsignedInteger('birthday_bonus_points')->default(0);
            $table->unsignedInteger('birthday_bonus_wallet')->default(0);
            $table->boolean('manual_adjustments_enabled')->default(true);
            $table->boolean('allow_negative_wallet')->default(false);
            $table->boolean('show_wallet_to_customer')->default(true);
            $table->boolean('show_points_to_customer')->default(true);
            $table->boolean('show_tier_to_customer')->default(true);
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_club_settings');
    }
};
