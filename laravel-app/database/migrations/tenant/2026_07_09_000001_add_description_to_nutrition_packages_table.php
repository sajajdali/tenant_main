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

        if (! Schema::hasTable('nutrition_packages') || Schema::hasColumn('nutrition_packages', 'description')) {
            return;
        }

        Schema::table('nutrition_packages', function (Blueprint $table) {
            $table->text('description')->nullable()->after('slug');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('nutrition_packages') || ! Schema::hasColumn('nutrition_packages', 'description')) {
            return;
        }

        Schema::table('nutrition_packages', function (Blueprint $table) {
            $table->dropColumn('description');
        });
    }
};
