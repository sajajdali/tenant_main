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

        Schema::create('nutrition_meal_replacement_suggestions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users', indexName: 'nmr_sugg_user_fk')->cascadeOnDelete();
            $table->foreignId('requested_by_user_id')->nullable()->constrained('users', indexName: 'nmr_sugg_req_user_fk')->nullOnDelete();
            $table->foreignId('nutrition_diet_prescription_id')->constrained('nutrition_diet_prescriptions', indexName: 'nmr_sugg_prescription_fk')->cascadeOnDelete();
            $table->foreignId('nutrition_diet_request_id')->nullable()->constrained('nutrition_diet_requests', indexName: 'nmr_sugg_request_fk')->nullOnDelete();
            $table->foreignId('nutrition_prescription_meal_slot_id')->nullable()->constrained('nutrition_prescription_meal_slots', indexName: 'nmr_sugg_meal_slot_fk')->nullOnDelete();
            $table->foreignId('nutrition_prescription_day_meal_id')->nullable()->constrained('nutrition_prescription_day_meals', indexName: 'nmr_sugg_day_meal_fk')->nullOnDelete();
            $table->enum('source_type', ['meal_slot', 'daily_meal'])->default('daily_meal');
            $table->string('source_signature', 64);
            $table->string('meal_slot_key', 64);
            $table->string('slot_title')->nullable();
            $table->unsignedTinyInteger('day_number')->nullable();
            $table->unsignedSmallInteger('meal_index')->nullable();
            $table->unsignedSmallInteger('suggestion_count')->default(0);
            $table->enum('status', ['queued', 'processing', 'generated', 'failed', 'cancelled'])->default('queued');
            $table->text('error_message')->nullable();
            $table->json('context_snapshot')->nullable();
            $table->json('options')->nullable();
            $table->json('ai_prompt_snapshot')->nullable();
            $table->json('ai_response_snapshot')->nullable();
            $table->timestamp('requested_at')->nullable();
            $table->timestamp('generated_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();

            $table->unique(['nutrition_diet_prescription_id', 'source_signature'], 'nutrition_meal_repl_unique');
            $table->index(['nutrition_diet_prescription_id', 'status'], 'nutrition_meal_repl_prescription_status_idx');
            $table->index(['user_id', 'meal_slot_key'], 'nutrition_meal_repl_user_slot_idx');
        });
    }

    public function down(): void
    {
        if (! $this->isNutritionAudience()) {
            return;
        }

        Schema::dropIfExists('nutrition_meal_replacement_suggestions');
    }
};
