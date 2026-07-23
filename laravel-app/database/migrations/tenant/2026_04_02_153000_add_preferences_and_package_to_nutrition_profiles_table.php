<?php

declare(strict_types=1);

use App\Support\Concerns\ChecksNutritionAudience;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    use ChecksNutritionAudience;

    public function up(): void
    {
        if (! $this->isNutritionAudience() || ! Schema::hasTable('nutrition_profiles')) {
            return;
        }

        Schema::table('nutrition_profiles', function (Blueprint $table) {
            if (! Schema::hasColumn('nutrition_profiles', 'disliked_foods')) {
                $table->text('disliked_foods')->nullable()->after('target_weight_kg');
            }

            if (! Schema::hasColumn('nutrition_profiles', 'food_allergies')) {
                $table->text('food_allergies')->nullable()->after('disliked_foods');
            }

            if (! Schema::hasColumn('nutrition_profiles', 'selected_nutrition_package_id')) {
                $table->foreignId('selected_nutrition_package_id')->nullable()->after('food_allergies')->constrained('nutrition_packages')->nullOnDelete();
            }

            if (! Schema::hasColumn('nutrition_profiles', 'preferences_completed_at')) {
                $table->timestamp('preferences_completed_at')->nullable()->after('selected_nutrition_package_id');
            }

            if (! Schema::hasColumn('nutrition_profiles', 'package_selected_at')) {
                $table->timestamp('package_selected_at')->nullable()->after('preferences_completed_at');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('nutrition_profiles')) {
            return;
        }

        Schema::table('nutrition_profiles', function (Blueprint $table) {
            if (Schema::hasColumn('nutrition_profiles', 'selected_nutrition_package_id')) {
                $table->dropConstrainedForeignId('selected_nutrition_package_id');
            }

            foreach (['disliked_foods', 'food_allergies', 'preferences_completed_at', 'package_selected_at'] as $column) {
                if (Schema::hasColumn('nutrition_profiles', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
