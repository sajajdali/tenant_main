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
            if (! Schema::hasColumn('nutrition_diet_requests', 'requires_manual_delivery_approval')) {
                $table->boolean('requires_manual_delivery_approval')->default(false)->after('allow_food_replacement');
            }

            if (! Schema::hasColumn('nutrition_diet_requests', 'manual_delivery_approved_at')) {
                $table->timestamp('manual_delivery_approved_at')->nullable()->after('ai_generated_at');
            }

            if (! Schema::hasColumn('nutrition_diet_requests', 'manual_delivery_approved_by_user_id')) {
                $table->unsignedBigInteger('manual_delivery_approved_by_user_id')->nullable()->after('manual_delivery_approved_at');
                $table->foreign('manual_delivery_approved_by_user_id', 'nutrition_diet_requests_manual_approved_by_fk')
                    ->references('id')
                    ->on('users')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        if (! $this->isNutritionAudience() || ! Schema::hasTable('nutrition_diet_requests')) {
            return;
        }

        Schema::table('nutrition_diet_requests', function (Blueprint $table): void {
            if (Schema::hasColumn('nutrition_diet_requests', 'manual_delivery_approved_by_user_id')) {
                $table->dropForeign('nutrition_diet_requests_manual_approved_by_fk');
                $table->dropColumn('manual_delivery_approved_by_user_id');
            }

            if (Schema::hasColumn('nutrition_diet_requests', 'manual_delivery_approved_at')) {
                $table->dropColumn('manual_delivery_approved_at');
            }

            if (Schema::hasColumn('nutrition_diet_requests', 'requires_manual_delivery_approval')) {
                $table->dropColumn('requires_manual_delivery_approval');
            }
        });
    }
};
