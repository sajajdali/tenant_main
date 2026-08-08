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
            if (! Schema::hasColumn('nutrition_packages', 'cafebazaar_product_id')) {
                $table->string('cafebazaar_product_id')->nullable()->after('discounted_price_amount');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('nutrition_packages') || ! Schema::hasColumn('nutrition_packages', 'cafebazaar_product_id')) {
            return;
        }

        Schema::table('nutrition_packages', function (Blueprint $table): void {
            $table->dropColumn('cafebazaar_product_id');
        });
    }
};
