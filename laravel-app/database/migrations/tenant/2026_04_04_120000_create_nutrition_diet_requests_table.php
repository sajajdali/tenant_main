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
        if (! $this->isNutritionAudience() || Schema::hasTable('nutrition_diet_requests')) {
            return;
        }

        Schema::create('nutrition_diet_requests', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('nutrition_profile_id')->nullable()->constrained('nutrition_profiles')->nullOnDelete();
            $table->foreignId('nutrition_profile_snapshot_id')->nullable();
            $table->foreignId('nutrition_package_subscription_id')->nullable();
            $table->foreignId('nutrition_diet_template_id')->nullable()->constrained('nutrition_diet_templates')->nullOnDelete();
            $table->enum('request_type', ['ai', 'expert']);
            $table->enum('prescription_mode', ['daily_prescription', 'user_choice', 'fixed_text'])->default('daily_prescription');
            $table->enum('status', ['sent', 'not_sent', 'finished', 'in_progress', 'cancelled'])->default('sent');
            $table->boolean('ask_ai_enabled')->default(false);
            $table->boolean('allow_food_replacement')->default(false);
            $table->string('diet_template_name')->nullable();
            $table->string('diet_goal')->nullable();
            $table->string('gender')->nullable();
            $table->string('athlete_mode')->nullable();
            $table->string('activity_level')->nullable();
            $table->date('birth_date')->nullable();
            $table->unsignedSmallInteger('height_cm')->nullable();
            $table->decimal('current_weight_kg', 6, 2)->nullable();
            $table->decimal('target_weight_kg', 6, 2)->nullable();
            $table->decimal('weekly_weight_change_kg', 4, 2)->nullable();
            $table->date('started_at')->nullable();
            $table->date('ends_at')->nullable();
            $table->foreignId('ai_requested_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('ai_generation_status', ['not_requested', 'queued', 'processing', 'generated', 'failed'])->default('not_requested');
            $table->text('expert_notes')->nullable();
            $table->text('clinical_notes')->nullable();
            $table->longText('generation_instructions')->nullable();
            $table->text('must_include')->nullable();
            $table->text('must_avoid')->nullable();
            $table->timestamp('ai_job_dispatched_at')->nullable();
            $table->timestamp('ai_generated_at')->nullable();
            $table->text('ai_generation_error')->nullable();
            $table->json('profile_snapshot')->nullable();
            $table->json('template_snapshot')->nullable();
            $table->json('request_payload_snapshot')->nullable();
            $table->json('ai_prompt_snapshot')->nullable();
            $table->json('ai_response_snapshot')->nullable();
            $table->timestamps();

            $table->foreign('nutrition_package_subscription_id', 'ndr_pkg_sub_fk')
                ->references('id')
                ->on('nutrition_package_subscriptions')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nutrition_diet_requests');
    }
};
