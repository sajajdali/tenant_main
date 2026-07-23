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
        if (! $this->isNutritionAudience() || ! Schema::hasTable('nutrition_diet_requests') || ! Schema::hasColumn('nutrition_diet_requests', 'ai_generation_status')) {
            return;
        }

        DB::statement("ALTER TABLE nutrition_diet_requests MODIFY ai_generation_status ENUM('not_requested','queued','processing','generated','failed','cancelled') NOT NULL DEFAULT 'not_requested'");
    }

    public function down(): void
    {
        if (! $this->isNutritionAudience() || ! Schema::hasTable('nutrition_diet_requests') || ! Schema::hasColumn('nutrition_diet_requests', 'ai_generation_status')) {
            return;
        }

        DB::statement("ALTER TABLE nutrition_diet_requests MODIFY ai_generation_status ENUM('not_requested','queued','processing','generated','failed') NOT NULL DEFAULT 'not_requested'");
    }
};
