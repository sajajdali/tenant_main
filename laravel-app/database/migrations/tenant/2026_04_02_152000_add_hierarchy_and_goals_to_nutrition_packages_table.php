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

        Schema::table('nutrition_packages', function (Blueprint $table) {
            if (! Schema::hasColumn('nutrition_packages', 'parent_id')) {
                $table->foreignId('parent_id')->nullable()->constrained('nutrition_packages')->nullOnDelete()->after('image_path');
            }

            if (! Schema::hasColumn('nutrition_packages', 'depth')) {
                $table->unsignedTinyInteger('depth')->default(0)->after('parent_id');
            }

            if (! Schema::hasColumn('nutrition_packages', 'applicable_goals')) {
                $table->json('applicable_goals')->nullable()->after('discounted_price_amount');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('nutrition_packages')) {
            return;
        }

        Schema::table('nutrition_packages', function (Blueprint $table) {
            if (Schema::hasColumn('nutrition_packages', 'parent_id')) {
                $table->dropConstrainedForeignId('parent_id');
            }

            if (Schema::hasColumn('nutrition_packages', 'depth')) {
                $table->dropColumn('depth');
            }

            if (Schema::hasColumn('nutrition_packages', 'applicable_goals')) {
                $table->dropColumn('applicable_goals');
            }
        });
    }
};
