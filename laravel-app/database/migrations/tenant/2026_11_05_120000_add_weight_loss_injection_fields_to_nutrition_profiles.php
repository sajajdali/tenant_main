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

        foreach (['nutrition_profiles', 'nutrition_profile_snapshots'] as $tableName) {
            if (! Schema::hasTable($tableName)) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table) use ($tableName): void {
                if (! Schema::hasColumn($tableName, 'uses_weight_loss_injections')) {
                    $table->boolean('uses_weight_loss_injections')->nullable()->after('medications_and_supplements');
                }

                if (! Schema::hasColumn($tableName, 'weight_loss_injection_name')) {
                    $table->string('weight_loss_injection_name')->nullable()->after('uses_weight_loss_injections');
                }

                if (! Schema::hasColumn($tableName, 'weight_loss_injection_dose_count')) {
                    $table->unsignedSmallInteger('weight_loss_injection_dose_count')->nullable()->after('weight_loss_injection_name');
                }
            });
        }
    }

    public function down(): void
    {
        foreach (['nutrition_profile_snapshots', 'nutrition_profiles'] as $tableName) {
            if (! Schema::hasTable($tableName)) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table) use ($tableName): void {
                $columns = array_values(array_filter([
                    'uses_weight_loss_injections',
                    'weight_loss_injection_name',
                    'weight_loss_injection_dose_count',
                ], fn (string $column): bool => Schema::hasColumn($tableName, $column)));

                if ($columns !== []) {
                    $table->dropColumn($columns);
                }
            });
        }
    }
};
