<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('nutrition_diet_templates') && ! Schema::hasColumn('nutrition_diet_templates', 'suggest_daily_replacements')) {
            Schema::table('nutrition_diet_templates', function (Blueprint $table): void {
                $table->boolean('suggest_daily_replacements')->default(false)->after('allow_food_replacement');
            });
        }

        if (Schema::hasTable('nutrition_diet_requests') && ! Schema::hasColumn('nutrition_diet_requests', 'suggest_daily_replacements')) {
            Schema::table('nutrition_diet_requests', function (Blueprint $table): void {
                $table->boolean('suggest_daily_replacements')->default(false)->after('allow_food_replacement');
            });
        }

        if (Schema::hasTable('nutrition_prescriptions') && ! Schema::hasColumn('nutrition_prescriptions', 'suggest_daily_replacements')) {
            Schema::table('nutrition_prescriptions', function (Blueprint $table): void {
                $table->boolean('suggest_daily_replacements')->default(false)->after('allow_food_replacement');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('nutrition_prescriptions') && Schema::hasColumn('nutrition_prescriptions', 'suggest_daily_replacements')) {
            Schema::table('nutrition_prescriptions', function (Blueprint $table): void {
                $table->dropColumn('suggest_daily_replacements');
            });
        }

        if (Schema::hasTable('nutrition_diet_requests') && Schema::hasColumn('nutrition_diet_requests', 'suggest_daily_replacements')) {
            Schema::table('nutrition_diet_requests', function (Blueprint $table): void {
                $table->dropColumn('suggest_daily_replacements');
            });
        }

        if (Schema::hasTable('nutrition_diet_templates') && Schema::hasColumn('nutrition_diet_templates', 'suggest_daily_replacements')) {
            Schema::table('nutrition_diet_templates', function (Blueprint $table): void {
                $table->dropColumn('suggest_daily_replacements');
            });
        }
    }
};
