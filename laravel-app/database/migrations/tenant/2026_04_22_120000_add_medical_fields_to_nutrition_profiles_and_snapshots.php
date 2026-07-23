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
        if (! $this->isNutritionAudience()) {
            return;
        }

        if (Schema::hasTable('nutrition_profiles')) {
            Schema::table('nutrition_profiles', function (Blueprint $table): void {
                if (! Schema::hasColumn('nutrition_profiles', 'medical_conditions')) {
                    $table->text('medical_conditions')->nullable()->after('weekly_weight_change_kg');
                }

                if (! Schema::hasColumn('nutrition_profiles', 'medications_and_supplements')) {
                    $table->text('medications_and_supplements')->nullable()->after('medical_conditions');
                }
            });
        }

        if (Schema::hasTable('nutrition_profile_snapshots')) {
            Schema::table('nutrition_profile_snapshots', function (Blueprint $table): void {
                if (! Schema::hasColumn('nutrition_profile_snapshots', 'medical_conditions')) {
                    $table->text('medical_conditions')->nullable()->after('weekly_weight_change_kg');
                }

                if (! Schema::hasColumn('nutrition_profile_snapshots', 'medications_and_supplements')) {
                    $table->text('medications_and_supplements')->nullable()->after('medical_conditions');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('nutrition_profile_snapshots')) {
            Schema::table('nutrition_profile_snapshots', function (Blueprint $table): void {
                if (Schema::hasColumn('nutrition_profile_snapshots', 'medications_and_supplements')) {
                    $table->dropColumn('medications_and_supplements');
                }

                if (Schema::hasColumn('nutrition_profile_snapshots', 'medical_conditions')) {
                    $table->dropColumn('medical_conditions');
                }
            });
        }

        if (Schema::hasTable('nutrition_profiles')) {
            Schema::table('nutrition_profiles', function (Blueprint $table): void {
                if (Schema::hasColumn('nutrition_profiles', 'medications_and_supplements')) {
                    $table->dropColumn('medications_and_supplements');
                }

                if (Schema::hasColumn('nutrition_profiles', 'medical_conditions')) {
                    $table->dropColumn('medical_conditions');
                }
            });
        }
    }
};
