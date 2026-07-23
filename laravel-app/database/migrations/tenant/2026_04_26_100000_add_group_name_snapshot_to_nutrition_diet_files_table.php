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
        if (! $this->isNutritionAudience() || ! Schema::hasTable('nutrition_diet_files')) {
            return;
        }

        Schema::table('nutrition_diet_files', function (Blueprint $table): void {
            if (! Schema::hasColumn('nutrition_diet_files', 'group_name_snapshot')) {
                $table->string('group_name_snapshot')->nullable()->after('nutrition_diet_file_group_id');
            }
        });
    }

    public function down(): void
    {
        if (! $this->isNutritionAudience() || ! Schema::hasTable('nutrition_diet_files')) {
            return;
        }

        Schema::table('nutrition_diet_files', function (Blueprint $table): void {
            if (Schema::hasColumn('nutrition_diet_files', 'group_name_snapshot')) {
                $table->dropColumn('group_name_snapshot');
            }
        });
    }
};
