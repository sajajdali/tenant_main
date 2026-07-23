<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('nutrition_diet_templates') && ! Schema::hasColumn('nutrition_diet_templates', 'show_diet_explanations')) {
            Schema::table('nutrition_diet_templates', function (Blueprint $table): void {
                $table->boolean('show_diet_explanations')->default(false)->after('suggest_daily_replacements');
                $table->text('diet_explanation_prompt')->nullable()->after('show_diet_explanations');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('nutrition_diet_templates') && Schema::hasColumn('nutrition_diet_templates', 'diet_explanation_prompt')) {
            Schema::table('nutrition_diet_templates', function (Blueprint $table): void {
                $table->dropColumn(['show_diet_explanations', 'diet_explanation_prompt']);
            });
        }
    }
};
