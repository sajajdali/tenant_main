<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('nutrition_meal_logs')) {
            return;
        }

        Schema::table('nutrition_meal_logs', function (Blueprint $table): void {
            if (! Schema::hasColumn('nutrition_meal_logs', 'manual_entry_method')) {
                $table->string('manual_entry_method', 32)->nullable()->after('consumption_type');
            }

            if (! Schema::hasColumn('nutrition_meal_logs', 'photo_path')) {
                $table->string('photo_path')->nullable()->after('quantity_text');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('nutrition_meal_logs')) {
            return;
        }

        Schema::table('nutrition_meal_logs', function (Blueprint $table): void {
            foreach (['photo_path', 'manual_entry_method'] as $column) {
                if (Schema::hasColumn('nutrition_meal_logs', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
