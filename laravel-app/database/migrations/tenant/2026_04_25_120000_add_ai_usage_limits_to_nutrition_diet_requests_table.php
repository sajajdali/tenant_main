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
        if (! $this->isNutritionAudience() || ! Schema::hasTable('nutrition_diet_requests')) {
            return;
        }

        Schema::table('nutrition_diet_requests', function (Blueprint $table): void {
            if (! Schema::hasColumn('nutrition_diet_requests', 'ai_usage_limits')) {
                $table->json('ai_usage_limits')->nullable()->after('ai_response_snapshot');
            }
        });
    }

    public function down(): void
    {
        if (! $this->isNutritionAudience() || ! Schema::hasTable('nutrition_diet_requests')) {
            return;
        }

        Schema::table('nutrition_diet_requests', function (Blueprint $table): void {
            if (Schema::hasColumn('nutrition_diet_requests', 'ai_usage_limits')) {
                $table->dropColumn('ai_usage_limits');
            }
        });
    }
};
