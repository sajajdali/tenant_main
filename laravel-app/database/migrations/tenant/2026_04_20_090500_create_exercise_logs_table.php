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
            Schema::dropIfExists('exercise_logs');

            return;
        }

        if (Schema::hasTable('exercise_logs')) {
            return;
        }

        Schema::create('exercise_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('nutrition_diet_prescription_id')->nullable();
            $table->unsignedBigInteger('nutrition_exercise_id')->nullable();
            $table->foreignId('logged_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('consumed_date')->nullable();
            $table->timestamp('consumed_at')->nullable();
            $table->string('exercise_title')->nullable();
            $table->string('exercise_group_title')->nullable();
            $table->string('exercise_icon_key', 64)->nullable();
            $table->string('intensity', 24)->default('moderate');
            $table->unsignedSmallInteger('duration_minutes');
            $table->decimal('distance_km', 6, 2)->nullable();
            $table->decimal('speed_kmh', 6, 2)->nullable();
            $table->decimal('weight_kg', 6, 2);
            $table->unsignedSmallInteger('calories_burned');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('nutrition_diet_prescription_id', 'exercise_logs_prescription_fk')
                ->references('id')
                ->on('nutrition_diet_prescriptions')
                ->nullOnDelete();
            $table->index(['user_id', 'consumed_date'], 'exercise_logs_user_date_idx');
            $table->index(['nutrition_diet_prescription_id', 'consumed_date'], 'exercise_logs_prescription_date_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exercise_logs');
    }
};
