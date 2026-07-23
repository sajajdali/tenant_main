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
            return;
        }

        Schema::create('nutrition_profile_snapshots', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('nutrition_profile_id')->nullable();
            $table->foreignId('selected_nutrition_package_id')->nullable();
            $table->string('snapshot_source', 32)->default('diet_request');
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('diet_goal', 32)->nullable();
            $table->string('gender', 16)->nullable();
            $table->string('athlete_mode', 24)->nullable();
            $table->string('activity_level', 24)->nullable();
            $table->date('birth_date')->nullable();
            $table->unsignedSmallInteger('height_cm')->nullable();
            $table->decimal('weight_kg', 6, 2)->nullable();
            $table->decimal('ideal_weight_kg', 6, 2)->nullable();
            $table->decimal('recommended_target_weight_kg', 6, 2)->nullable();
            $table->decimal('target_weight_kg', 6, 2)->nullable();
            $table->decimal('weekly_weight_change_kg', 4, 2)->nullable();
            $table->text('disliked_foods')->nullable();
            $table->text('food_allergies')->nullable();
            $table->json('mindset_answers')->nullable();
            $table->json('collected_payload')->nullable();
            $table->timestamp('captured_at')->nullable();
            $table->timestamps();

            $table->foreign('nutrition_profile_id', 'nutrition_profile_snapshots_profile_fk')
                ->references('id')
                ->on('nutrition_profiles')
                ->nullOnDelete();
            $table->foreign('selected_nutrition_package_id', 'nutrition_profile_snapshots_pkg_fk')
                ->references('id')
                ->on('nutrition_packages')
                ->nullOnDelete();
            $table->index(['user_id', 'captured_at'], 'nutrition_profile_snapshots_user_captured_idx');
            $table->index(['snapshot_source', 'source_id'], 'nutrition_profile_snapshots_source_idx');
        });

        Schema::table('nutrition_diet_requests', function (Blueprint $table): void {
            $table->foreign('nutrition_profile_snapshot_id', 'nutrition_diet_requests_profile_snapshot_fk')
                ->references('id')
                ->on('nutrition_profile_snapshots')
                ->nullOnDelete();
        });

        Schema::create('nutrition_diet_template_meal_slots', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('nutrition_diet_template_id');
            $table->string('slot_key', 64);
            $table->string('title');
            $table->string('icon', 64)->nullable();
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('food_count')->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_enabled')->default(false);
            $table->timestamps();

            $table->foreign('nutrition_diet_template_id', 'nutrition_template_meal_slots_tpl_fk')
                ->references('id')
                ->on('nutrition_diet_templates')
                ->cascadeOnDelete();
            $table->unique(['nutrition_diet_template_id', 'slot_key'], 'nutrition_template_meal_slots_unique');
            $table->index(['nutrition_diet_template_id', 'sort_order'], 'nutrition_template_meal_slots_order_idx');
        });

        Schema::create('nutrition_diet_template_meal_options', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('nutrition_diet_template_meal_slot_id');
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('quantity_text')->nullable();
            $table->unsignedSmallInteger('calories')->nullable();
            $table->json('metadata')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('nutrition_diet_template_meal_slot_id', 'nutrition_template_meal_options_slot_fk')
                ->references('id')
                ->on('nutrition_diet_template_meal_slots')
                ->cascadeOnDelete();
        });

        Schema::create('nutrition_diet_template_day_plans', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('nutrition_diet_template_id');
            $table->unsignedTinyInteger('day_number');
            $table->string('day_label', 64)->nullable();
            $table->text('notes')->nullable();
            $table->unsignedTinyInteger('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('nutrition_diet_template_id', 'nutrition_template_day_plans_tpl_fk')
                ->references('id')
                ->on('nutrition_diet_templates')
                ->cascadeOnDelete();
            $table->unique(['nutrition_diet_template_id', 'day_number'], 'nutrition_template_day_plans_unique');
        });

        Schema::create('nutrition_diet_template_day_meals', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('nutrition_diet_template_day_plan_id');
            $table->string('slot_key', 64);
            $table->string('title');
            $table->text('meal_text');
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('nutrition_diet_template_day_plan_id', 'nutrition_template_day_meals_plan_fk')
                ->references('id')
                ->on('nutrition_diet_template_day_plans')
                ->cascadeOnDelete();
            $table->unique(['nutrition_diet_template_day_plan_id', 'slot_key'], 'nutrition_template_day_meals_unique');
        });

        Schema::create('nutrition_diet_template_day_meal_replacements', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('nutrition_diet_template_day_meal_id');
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('quantity_text')->nullable();
            $table->unsignedSmallInteger('calories')->nullable();
            $table->json('metadata')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('nutrition_diet_template_day_meal_id', 'nutrition_template_day_meal_repl_fk')
                ->references('id')
                ->on('nutrition_diet_template_day_meals')
                ->cascadeOnDelete();
        });

        Schema::create('nutrition_diet_template_text_sections', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('nutrition_diet_template_id');
            $table->string('title');
            $table->longText('body');
            $table->unsignedSmallInteger('page_number')->default(1);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('nutrition_diet_template_id', 'nutrition_template_text_sections_tpl_fk')
                ->references('id')
                ->on('nutrition_diet_templates')
                ->cascadeOnDelete();
            $table->index(['nutrition_diet_template_id', 'page_number'], 'nutrition_template_text_sections_page_idx');
        });

        Schema::create('nutrition_diet_template_audio_tracks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('nutrition_diet_template_id');
            $table->enum('section_type', ['template', 'meal_slot', 'day_plan', 'text_section'])->default('template');
            $table->unsignedBigInteger('section_id')->nullable();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('file_path')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->text('transcript')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('nutrition_diet_template_id', 'nutrition_template_audio_tpl_fk')
                ->references('id')
                ->on('nutrition_diet_templates')
                ->cascadeOnDelete();
            $table->index(['nutrition_diet_template_id', 'section_type'], 'nutrition_template_audio_section_idx');
        });

        Schema::create('nutrition_diet_prescriptions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('nutrition_diet_request_id')->nullable()->constrained('nutrition_diet_requests')->nullOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('nutrition_profile_snapshot_id')->nullable();
            $table->foreignId('nutrition_diet_template_id')->nullable();
            $table->foreignId('issued_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('supersedes_prescription_id')->nullable();
            $table->enum('delivery_channel', ['ai', 'expert'])->default('expert');
            $table->enum('prescription_mode', ['daily_prescription', 'user_choice', 'fixed_text'])->default('daily_prescription');
            $table->enum('status', ['draft', 'active', 'completed', 'cancelled', 'archived'])->default('draft');
            $table->boolean('allow_food_replacement')->default(false);
            $table->decimal('current_weight_kg', 6, 2)->nullable();
            $table->decimal('target_weight_kg', 6, 2)->nullable();
            $table->decimal('weekly_weight_change_kg', 4, 2)->nullable();
            $table->date('started_at')->nullable();
            $table->date('ends_at')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->boolean('is_current')->default(true);
            $table->text('summary_text')->nullable();
            $table->longText('notes')->nullable();
            $table->json('template_snapshot')->nullable();
            $table->json('profile_snapshot')->nullable();
            $table->json('content_snapshot')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->foreign('nutrition_profile_snapshot_id', 'nutrition_prescriptions_profile_snap_fk')
                ->references('id')
                ->on('nutrition_profile_snapshots')
                ->nullOnDelete();
            $table->foreign('nutrition_diet_template_id', 'nutrition_prescriptions_template_fk')
                ->references('id')
                ->on('nutrition_diet_templates')
                ->nullOnDelete();
            $table->foreign('supersedes_prescription_id', 'nutrition_prescriptions_supersedes_fk')
                ->references('id')
                ->on('nutrition_diet_prescriptions')
                ->nullOnDelete();
            $table->index(['user_id', 'status', 'is_current'], 'nutrition_prescriptions_status_idx');
        });

        Schema::create('nutrition_prescription_meal_slots', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('nutrition_diet_prescription_id');
            $table->foreignId('nutrition_diet_template_meal_slot_id')->nullable();
            $table->string('slot_key', 64);
            $table->string('title');
            $table->string('icon', 64)->nullable();
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('food_count')->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_enabled')->default(false);
            $table->timestamps();

            $table->foreign('nutrition_diet_prescription_id', 'nutrition_prescription_meal_slots_pr_fk')
                ->references('id')
                ->on('nutrition_diet_prescriptions')
                ->cascadeOnDelete();
            $table->foreign('nutrition_diet_template_meal_slot_id', 'nutrition_prescription_meal_slots_tpl_fk')
                ->references('id')
                ->on('nutrition_diet_template_meal_slots')
                ->nullOnDelete();
            $table->unique(['nutrition_diet_prescription_id', 'slot_key'], 'nutrition_prescription_meal_slots_unique');
        });

        Schema::create('nutrition_prescription_meal_options', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('nutrition_prescription_meal_slot_id');
            $table->foreignId('nutrition_diet_template_meal_option_id')->nullable();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('quantity_text')->nullable();
            $table->unsignedSmallInteger('calories')->nullable();
            $table->json('metadata')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('nutrition_prescription_meal_slot_id', 'nutrition_prescription_meal_opts_slot_fk')
                ->references('id')
                ->on('nutrition_prescription_meal_slots')
                ->cascadeOnDelete();
            $table->foreign('nutrition_diet_template_meal_option_id', 'nutrition_prescription_meal_opts_tpl_fk')
                ->references('id')
                ->on('nutrition_diet_template_meal_options')
                ->nullOnDelete();
        });

        Schema::create('nutrition_prescription_day_plans', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('nutrition_diet_prescription_id');
            $table->foreignId('nutrition_diet_template_day_plan_id')->nullable();
            $table->unsignedTinyInteger('day_number');
            $table->string('day_label', 64)->nullable();
            $table->text('notes')->nullable();
            $table->unsignedTinyInteger('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('nutrition_diet_prescription_id', 'nutrition_prescription_day_plans_pr_fk')
                ->references('id')
                ->on('nutrition_diet_prescriptions')
                ->cascadeOnDelete();
            $table->foreign('nutrition_diet_template_day_plan_id', 'nutrition_prescription_day_plans_tpl_fk')
                ->references('id')
                ->on('nutrition_diet_template_day_plans')
                ->nullOnDelete();
            $table->unique(['nutrition_diet_prescription_id', 'day_number'], 'nutrition_prescription_day_plans_unique');
        });

        Schema::create('nutrition_prescription_day_meals', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('nutrition_prescription_day_plan_id');
            $table->foreignId('nutrition_diet_template_day_meal_id')->nullable();
            $table->string('slot_key', 64);
            $table->string('title');
            $table->text('meal_text');
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('nutrition_prescription_day_plan_id', 'nutrition_prescription_day_meals_plan_fk')
                ->references('id')
                ->on('nutrition_prescription_day_plans')
                ->cascadeOnDelete();
            $table->foreign('nutrition_diet_template_day_meal_id', 'nutrition_prescription_day_meals_tpl_fk')
                ->references('id')
                ->on('nutrition_diet_template_day_meals')
                ->nullOnDelete();
            $table->unique(['nutrition_prescription_day_plan_id', 'slot_key'], 'nutrition_prescription_day_meals_unique');
        });

        Schema::create('nutrition_prescription_day_meal_replacements', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('nutrition_prescription_day_meal_id');
            $table->foreignId('nutrition_diet_template_day_meal_replacement_id')->nullable();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('quantity_text')->nullable();
            $table->unsignedSmallInteger('calories')->nullable();
            $table->json('metadata')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('nutrition_prescription_day_meal_id', 'nutrition_prescription_day_repl_meal_fk')
                ->references('id')
                ->on('nutrition_prescription_day_meals')
                ->cascadeOnDelete();
            $table->foreign('nutrition_diet_template_day_meal_replacement_id', 'nutrition_prescription_day_repl_tpl_fk')
                ->references('id')
                ->on('nutrition_diet_template_day_meal_replacements')
                ->nullOnDelete();
        });

        Schema::create('nutrition_prescription_text_sections', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('nutrition_diet_prescription_id');
            $table->foreignId('nutrition_diet_template_text_section_id')->nullable();
            $table->string('title');
            $table->longText('body');
            $table->unsignedSmallInteger('page_number')->default(1);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('nutrition_diet_prescription_id', 'nutrition_prescription_text_sections_pr_fk')
                ->references('id')
                ->on('nutrition_diet_prescriptions')
                ->cascadeOnDelete();
            $table->foreign('nutrition_diet_template_text_section_id', 'nutrition_prescription_text_sections_tpl_fk')
                ->references('id')
                ->on('nutrition_diet_template_text_sections')
                ->nullOnDelete();
        });

        Schema::create('nutrition_prescription_audio_tracks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('nutrition_diet_prescription_id');
            $table->foreignId('nutrition_diet_template_audio_track_id')->nullable();
            $table->enum('section_type', ['prescription', 'meal_slot', 'day_plan', 'text_section'])->default('prescription');
            $table->unsignedBigInteger('section_id')->nullable();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('file_path')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->text('transcript')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('nutrition_diet_prescription_id', 'nutrition_prescription_audio_tracks_pr_fk')
                ->references('id')
                ->on('nutrition_diet_prescriptions')
                ->cascadeOnDelete();
            $table->foreign('nutrition_diet_template_audio_track_id', 'nutrition_prescription_audio_tracks_tpl_fk')
                ->references('id')
                ->on('nutrition_diet_template_audio_tracks')
                ->nullOnDelete();
        });

        Schema::create('nutrition_meal_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('nutrition_diet_prescription_id')->nullable();
            $table->foreignId('nutrition_prescription_day_plan_id')->nullable();
            $table->foreignId('nutrition_prescription_day_meal_id')->nullable();
            $table->foreignId('nutrition_prescription_meal_slot_id')->nullable();
            $table->foreignId('logged_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('consumed_date')->nullable();
            $table->timestamp('consumed_at')->nullable();
            $table->string('meal_slot_key', 64)->nullable();
            $table->enum('consumption_type', ['scheduled', 'replacement', 'manual'])->default('scheduled');
            $table->enum('status', ['eaten', 'skipped'])->default('eaten');
            $table->string('food_title')->nullable();
            $table->text('food_description')->nullable();
            $table->string('quantity_text')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('nutrition_diet_prescription_id', 'nutrition_meal_logs_prescription_fk')
                ->references('id')
                ->on('nutrition_diet_prescriptions')
                ->nullOnDelete();
            $table->foreign('nutrition_prescription_day_plan_id', 'nutrition_meal_logs_day_plan_fk')
                ->references('id')
                ->on('nutrition_prescription_day_plans')
                ->nullOnDelete();
            $table->foreign('nutrition_prescription_day_meal_id', 'nutrition_meal_logs_day_meal_fk')
                ->references('id')
                ->on('nutrition_prescription_day_meals')
                ->nullOnDelete();
            $table->foreign('nutrition_prescription_meal_slot_id', 'nutrition_meal_logs_meal_slot_fk')
                ->references('id')
                ->on('nutrition_prescription_meal_slots')
                ->nullOnDelete();
            $table->index(['user_id', 'consumed_date'], 'nutrition_meal_logs_user_date_idx');
        });

        Schema::create('nutrition_water_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('nutrition_diet_prescription_id')->nullable();
            $table->foreignId('logged_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('consumed_date')->nullable();
            $table->timestamp('consumed_at')->nullable();
            $table->unsignedSmallInteger('amount_ml');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('nutrition_diet_prescription_id', 'nutrition_water_logs_prescription_fk')
                ->references('id')
                ->on('nutrition_diet_prescriptions')
                ->nullOnDelete();
            $table->index(['user_id', 'consumed_date'], 'nutrition_water_logs_user_date_idx');
        });

        Schema::create('nutrition_weight_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('nutrition_diet_prescription_id')->nullable();
            $table->foreignId('logged_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('source', ['profile', 'diet_request', 'manual', 'prescription_checkin'])->default('manual');
            $table->date('recorded_on')->nullable();
            $table->timestamp('recorded_at')->nullable();
            $table->decimal('weight_kg', 6, 2);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('nutrition_diet_prescription_id', 'nutrition_weight_logs_prescription_fk')
                ->references('id')
                ->on('nutrition_diet_prescriptions')
                ->nullOnDelete();
            $table->index(['user_id', 'recorded_on'], 'nutrition_weight_logs_user_date_idx');
        });
    }

    public function down(): void
    {
        Schema::table('nutrition_diet_requests', function (Blueprint $table): void {
            $table->dropForeign('nutrition_diet_requests_profile_snapshot_fk');
        });

        Schema::dropIfExists('nutrition_weight_logs');
        Schema::dropIfExists('nutrition_water_logs');
        Schema::dropIfExists('nutrition_meal_logs');
        Schema::dropIfExists('nutrition_prescription_audio_tracks');
        Schema::dropIfExists('nutrition_prescription_text_sections');
        Schema::dropIfExists('nutrition_prescription_day_meal_replacements');
        Schema::dropIfExists('nutrition_prescription_day_meals');
        Schema::dropIfExists('nutrition_prescription_day_plans');
        Schema::dropIfExists('nutrition_prescription_meal_options');
        Schema::dropIfExists('nutrition_prescription_meal_slots');
        Schema::dropIfExists('nutrition_diet_prescriptions');
        Schema::dropIfExists('nutrition_diet_template_audio_tracks');
        Schema::dropIfExists('nutrition_diet_template_text_sections');
        Schema::dropIfExists('nutrition_diet_template_day_meal_replacements');
        Schema::dropIfExists('nutrition_diet_template_day_meals');
        Schema::dropIfExists('nutrition_diet_template_day_plans');
        Schema::dropIfExists('nutrition_diet_template_meal_options');
        Schema::dropIfExists('nutrition_diet_template_meal_slots');
        Schema::dropIfExists('nutrition_profile_snapshots');
    }
};
