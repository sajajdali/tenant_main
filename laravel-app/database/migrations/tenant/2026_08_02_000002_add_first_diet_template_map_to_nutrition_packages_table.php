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
        if (! $this->isNutritionAudience() || ! Schema::hasTable('nutrition_packages')) {
            return;
        }

        Schema::table('nutrition_packages', function (Blueprint $table): void {
            if (! Schema::hasColumn('nutrition_packages', 'first_diet_template_ids')) {
                $table->json('first_diet_template_ids')->nullable()->after('first_diet_template_id');
            }
        });
    }

    public function down(): void
    {
        if (! $this->isNutritionAudience() || ! Schema::hasTable('nutrition_packages')) {
            return;
        }

        Schema::table('nutrition_packages', function (Blueprint $table): void {
            if (Schema::hasColumn('nutrition_packages', 'first_diet_template_ids')) {
                $table->dropColumn('first_diet_template_ids');
            }
        });
    }
};
