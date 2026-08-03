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
            if (! Schema::hasColumn('nutrition_packages', 'first_diet_template_mode')) {
                $table->string('first_diet_template_mode', 20)->default('default')->after('action_label');
            }

            if (! Schema::hasColumn('nutrition_packages', 'first_diet_template_id')) {
                $table->foreignId('first_diet_template_id')
                    ->nullable()
                    ->after('first_diet_template_mode')
                    ->constrained('nutrition_diet_templates')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        if (! $this->isNutritionAudience() || ! Schema::hasTable('nutrition_packages')) {
            return;
        }

        Schema::table('nutrition_packages', function (Blueprint $table): void {
            if (Schema::hasColumn('nutrition_packages', 'first_diet_template_id')) {
                $table->dropConstrainedForeignId('first_diet_template_id');
            }

            if (Schema::hasColumn('nutrition_packages', 'first_diet_template_mode')) {
                $table->dropColumn('first_diet_template_mode');
            }
        });
    }
};
