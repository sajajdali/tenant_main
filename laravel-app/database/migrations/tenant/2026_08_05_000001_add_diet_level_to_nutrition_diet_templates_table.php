<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('nutrition_diet_templates') && ! Schema::hasColumn('nutrition_diet_templates', 'diet_level')) {
            Schema::table('nutrition_diet_templates', function (Blueprint $table): void {
                $table->string('diet_level', 80)->nullable()->after('diet_basis');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('nutrition_diet_templates') && Schema::hasColumn('nutrition_diet_templates', 'diet_level')) {
            Schema::table('nutrition_diet_templates', function (Blueprint $table): void {
                $table->dropColumn('diet_level');
            });
        }
    }
};
