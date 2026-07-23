<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('nutrition_meal_logs')) {
            return;
        }

        Schema::table('nutrition_meal_logs', function (Blueprint $table): void {
            if (! Schema::hasColumn('nutrition_meal_logs', 'option_calories')) {
                $table->unsignedSmallInteger('option_calories')->nullable()->after('quantity_text');
            }

            if (! Schema::hasColumn('nutrition_meal_logs', 'protein_grams')) {
                $table->decimal('protein_grams', 6, 2)->nullable()->after('option_calories');
            }

            if (! Schema::hasColumn('nutrition_meal_logs', 'fat_grams')) {
                $table->decimal('fat_grams', 6, 2)->nullable()->after('protein_grams');
            }

            if (! Schema::hasColumn('nutrition_meal_logs', 'carbohydrate_grams')) {
                $table->decimal('carbohydrate_grams', 6, 2)->nullable()->after('fat_grams');
            }

            if (! Schema::hasColumn('nutrition_meal_logs', 'fiber_grams')) {
                $table->decimal('fiber_grams', 6, 2)->nullable()->after('carbohydrate_grams');
            }

            if (! Schema::hasColumn('nutrition_meal_logs', 'ai_nutrition_status')) {
                $table->string('ai_nutrition_status', 32)->default('not_requested')->after('notes');
            }

            if (! Schema::hasColumn('nutrition_meal_logs', 'ai_nutrition_error')) {
                $table->text('ai_nutrition_error')->nullable()->after('ai_nutrition_status');
            }

            if (! Schema::hasColumn('nutrition_meal_logs', 'ai_nutrition_prompt_snapshot')) {
                $table->json('ai_nutrition_prompt_snapshot')->nullable()->after('ai_nutrition_error');
            }

            if (! Schema::hasColumn('nutrition_meal_logs', 'ai_nutrition_response_snapshot')) {
                $table->json('ai_nutrition_response_snapshot')->nullable()->after('ai_nutrition_prompt_snapshot');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('nutrition_meal_logs')) {
            return;
        }

        Schema::table('nutrition_meal_logs', function (Blueprint $table): void {
            foreach ([
                'ai_nutrition_response_snapshot',
                'ai_nutrition_prompt_snapshot',
                'ai_nutrition_error',
                'ai_nutrition_status',
                'fiber_grams',
                'carbohydrate_grams',
                'fat_grams',
                'protein_grams',
                'option_calories',
            ] as $column) {
                if (Schema::hasColumn('nutrition_meal_logs', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
