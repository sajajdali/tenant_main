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

        if (! Schema::hasTable('nutrition_packages') || Schema::hasColumn('nutrition_packages', 'badge_title')) {
            return;
        }

        Schema::table('nutrition_packages', function (Blueprint $table) {
            $table->string('badge_title')->nullable()->after('discounted_price_amount');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('nutrition_packages') || ! Schema::hasColumn('nutrition_packages', 'badge_title')) {
            return;
        }

        Schema::table('nutrition_packages', function (Blueprint $table) {
            $table->dropColumn('badge_title');
        });
    }
};
