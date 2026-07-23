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

        Schema::create('nutrition_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->string('diet_goal', 32);
            $table->string('gender', 16)->nullable();
            $table->string('athlete_mode', 24);
            $table->string('activity_level', 24);
            $table->date('birth_date')->nullable();
            $table->unsignedSmallInteger('height_cm');
            $table->decimal('weight_kg', 6, 2);
            $table->decimal('ideal_weight_kg', 6, 2)->nullable();
            $table->decimal('recommended_target_weight_kg', 6, 2)->nullable();
            $table->decimal('target_weight_kg', 6, 2)->nullable();
            $table->decimal('weekly_weight_change_kg', 4, 2)->nullable();
            $table->timestamp('onboarding_completed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nutrition_profiles');
    }
};
