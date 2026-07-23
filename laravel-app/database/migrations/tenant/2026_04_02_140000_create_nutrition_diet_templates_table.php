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

        Schema::create('nutrition_diet_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')->nullable()->constrained('nutrition_diet_templates')->nullOnDelete();
            $table->unsignedTinyInteger('depth')->default(0);
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('image_path')->nullable();
            $table->string('diet_basis', 32);
            $table->enum('prescription_mode', ['daily_prescription', 'user_choice', 'fixed_text'])->default('daily_prescription');
            $table->boolean('allow_food_replacement')->default(false);
            $table->unsignedSmallInteger('structure_version')->default(1);
            $table->json('applicable_goals')->nullable();
            $table->json('meal_slots')->nullable();
            $table->text('description')->nullable();
            $table->text('template_notes')->nullable();
            $table->text('conditions_text')->nullable();
            $table->unsignedSmallInteger('duration_days')->default(30);
            $table->boolean('supplements_enabled')->default(false);
            $table->text('supplement_notes')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nutrition_diet_templates');
    }
};
