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

        if (! Schema::hasTable('nutrition_diet_templates') || Schema::hasColumn('nutrition_diet_templates', 'image_path')) {
            return;
        }

        Schema::table('nutrition_diet_templates', function (Blueprint $table) {
            $table->string('image_path')->nullable()->after('slug');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('nutrition_diet_templates') || ! Schema::hasColumn('nutrition_diet_templates', 'image_path')) {
            return;
        }

        Schema::table('nutrition_diet_templates', function (Blueprint $table) {
            $table->dropColumn('image_path');
        });
    }
};
