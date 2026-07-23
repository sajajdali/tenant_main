<?php

declare(strict_types=1);

use App\Support\Concerns\ChecksNutritionAudience;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    use ChecksNutritionAudience;

    public function up(): void
    {
        if (! $this->isNutritionAudience() || ! Schema::hasTable('nutrition_diet_prescriptions') || ! Schema::hasColumn('nutrition_diet_prescriptions', 'delivery_channel')) {
            return;
        }

        DB::statement("ALTER TABLE nutrition_diet_prescriptions MODIFY delivery_channel ENUM('ai','expert','expert_file') NOT NULL DEFAULT 'expert'");
    }

    public function down(): void
    {
        if (! $this->isNutritionAudience() || ! Schema::hasTable('nutrition_diet_prescriptions') || ! Schema::hasColumn('nutrition_diet_prescriptions', 'delivery_channel')) {
            return;
        }

        DB::statement("ALTER TABLE nutrition_diet_prescriptions MODIFY delivery_channel ENUM('ai','expert') NOT NULL DEFAULT 'expert'");
    }
};
