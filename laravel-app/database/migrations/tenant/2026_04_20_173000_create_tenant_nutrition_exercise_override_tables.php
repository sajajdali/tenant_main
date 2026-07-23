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
            Schema::dropIfExists('tenant_nutrition_exercises');
            Schema::dropIfExists('tenant_nutrition_exercise_groups');

            return;
        }

        if (! Schema::hasTable('tenant_nutrition_exercise_groups')) {
            Schema::create('tenant_nutrition_exercise_groups', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('central_group_id')->nullable()->unique();
                $table->string('title');
                $table->string('slug', 120);
                $table->text('description')->nullable();
                $table->string('icon_key', 64)->nullable();
                $table->string('accent_color', 16)->nullable();
                $table->string('soft_color', 16)->nullable();
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->unique(['slug'], 'tenant_nutrition_exercise_groups_slug_unique');
                $table->index(['is_active', 'sort_order'], 'tenant_nutrition_exercise_groups_active_sort_idx');
            });
        }

        if (! Schema::hasTable('tenant_nutrition_exercises')) {
            Schema::create('tenant_nutrition_exercises', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('central_exercise_id')->nullable()->unique();
                $table->unsignedBigInteger('tenant_nutrition_exercise_group_id')->nullable();
                $table->unsignedBigInteger('central_group_id')->nullable();
                $table->string('title');
                $table->string('slug', 120);
                $table->text('description')->nullable();
                $table->string('icon_key', 64)->nullable();
                $table->string('badge_text')->nullable();
                $table->text('search_terms')->nullable();
                $table->boolean('supports_intensity')->default(true);
                $table->boolean('supports_distance')->default(false);
                $table->boolean('supports_speed')->default(false);
                $table->string('default_intensity', 24)->default('moderate');
                $table->decimal('met_light', 5, 2)->nullable();
                $table->decimal('met_moderate', 5, 2)->nullable();
                $table->decimal('met_vigorous', 5, 2)->nullable();
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->unique(['slug'], 'tenant_nutrition_exercises_slug_unique');
                $table->index(['tenant_nutrition_exercise_group_id', 'is_active', 'sort_order'], 'tenant_nutrition_exercises_group_active_sort_idx');
                $table->index(['central_group_id'], 'tenant_nutrition_exercises_central_group_idx');
                $table->foreign('tenant_nutrition_exercise_group_id', 'tenant_nutrition_exercises_group_fk')
                    ->references('id')
                    ->on('tenant_nutrition_exercise_groups')
                    ->nullOnDelete();
            });
        }

        if (Schema::hasTable('exercise_logs') && ! Schema::hasColumn('exercise_logs', 'tenant_nutrition_exercise_id')) {
            Schema::table('exercise_logs', function (Blueprint $table): void {
                $table->unsignedBigInteger('tenant_nutrition_exercise_id')->nullable()->after('nutrition_exercise_id');
                $table->index(['tenant_nutrition_exercise_id'], 'exercise_logs_tenant_exercise_idx');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('exercise_logs') && Schema::hasColumn('exercise_logs', 'tenant_nutrition_exercise_id')) {
            Schema::table('exercise_logs', function (Blueprint $table): void {
                $table->dropIndex('exercise_logs_tenant_exercise_idx');
                $table->dropColumn('tenant_nutrition_exercise_id');
            });
        }

        Schema::dropIfExists('tenant_nutrition_exercises');
        Schema::dropIfExists('tenant_nutrition_exercise_groups');
    }
};
