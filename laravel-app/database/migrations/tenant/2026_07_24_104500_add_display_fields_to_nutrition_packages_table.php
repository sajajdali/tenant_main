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
            $table->string('short_title')->nullable()->after('name');
            $table->string('subtitle')->nullable()->after('short_title');
            $table->json('features')->nullable()->after('description');
            $table->boolean('is_recommended')->default(false)->after('badge_title');
            $table->string('visual_style')->default('normal')->after('is_recommended');
            $table->string('action_label')->nullable()->after('visual_style');
        });
    }

    public function down(): void
    {
        if (! $this->isNutritionAudience() || ! Schema::hasTable('nutrition_packages')) {
            return;
        }

        Schema::table('nutrition_packages', function (Blueprint $table) {
            $table->dropColumn([
                'short_title',
                'subtitle',
                'features',
                'is_recommended',
                'visual_style',
                'action_label',
            ]);
        });
    }
};
