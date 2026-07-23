<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('nutrition_exercise_groups')) {
            Schema::create('nutrition_exercise_groups', function (Blueprint $table): void {
                $table->id();
                $table->string('title');
                $table->string('slug')->unique();
                $table->text('description')->nullable();
                $table->string('icon_key', 64)->default('Dumbbell');
                $table->string('accent_color', 16)->default('#f59e0b');
                $table->string('soft_color', 16)->default('#451a03');
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('nutrition_exercises')) {
            Schema::create('nutrition_exercises', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('nutrition_exercise_group_id')
                    ->constrained('nutrition_exercise_groups')
                    ->cascadeOnDelete();
                $table->string('title');
                $table->string('slug')->unique();
                $table->text('description')->nullable();
                $table->string('icon_key', 64)->default('Activity');
                $table->string('badge_text', 120)->nullable();
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

                $table->index(['nutrition_exercise_group_id', 'is_active', 'sort_order'], 'nutrition_exercises_group_active_sort_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('nutrition_exercises');
        Schema::dropIfExists('nutrition_exercise_groups');
    }
};
