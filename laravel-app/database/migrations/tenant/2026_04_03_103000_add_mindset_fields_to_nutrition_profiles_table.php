<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('nutrition_profiles')) {
            return;
        }

        Schema::table('nutrition_profiles', function (Blueprint $table): void {
            if (! Schema::hasColumn('nutrition_profiles', 'mindset_answers')) {
                $table->json('mindset_answers')->nullable()->after('food_allergies');
            }

            if (! Schema::hasColumn('nutrition_profiles', 'mindset_completed_at')) {
                $table->timestamp('mindset_completed_at')->nullable()->after('mindset_answers');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('nutrition_profiles')) {
            return;
        }

        Schema::table('nutrition_profiles', function (Blueprint $table): void {
            if (Schema::hasColumn('nutrition_profiles', 'mindset_completed_at')) {
                $table->dropColumn('mindset_completed_at');
            }

            if (Schema::hasColumn('nutrition_profiles', 'mindset_answers')) {
                $table->dropColumn('mindset_answers');
            }
        });
    }
};
