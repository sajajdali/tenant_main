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
        if (! $this->isNutritionAudience() || Schema::hasTable('nutrition_ai_prompt_presets')) {
            return;
        }

        Schema::create('nutrition_ai_prompt_presets', function (Blueprint $table): void {
            $table->id();
            $table->string('title');
            $table->text('body');
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        if (! $this->isNutritionAudience() || ! Schema::hasTable('nutrition_ai_prompt_presets')) {
            return;
        }

        Schema::dropIfExists('nutrition_ai_prompt_presets');
    }
};
