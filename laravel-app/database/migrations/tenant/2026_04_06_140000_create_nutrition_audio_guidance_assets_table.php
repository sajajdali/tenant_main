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
        if (! $this->isNutritionAudience() || Schema::hasTable('nutrition_audio_guidance_assets')) {
            return;
        }

        Schema::create('nutrition_audio_guidance_assets', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('nutrition_diet_template_id')->nullable();
            $table->unsignedInteger('session_number')->nullable();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('file_path');
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by_user_id')->nullable();
            $table->timestamps();

            $table->foreign('nutrition_diet_template_id', 'nutrition_audio_guidance_tpl_fk')
                ->references('id')
                ->on('nutrition_diet_templates')
                ->nullOnDelete();
            $table->foreign('created_by_user_id', 'nutrition_audio_guidance_user_fk')
                ->references('id')
                ->on('users')
                ->nullOnDelete();
            $table->index(['nutrition_diet_template_id', 'session_number'], 'nutrition_audio_guidance_scope_idx');
            $table->index(['is_active', 'sort_order'], 'nutrition_audio_guidance_active_idx');
        });
    }

    public function down(): void
    {
        if (! $this->isNutritionAudience() || ! Schema::hasTable('nutrition_audio_guidance_assets')) {
            return;
        }

        Schema::dropIfExists('nutrition_audio_guidance_assets');
    }
};
