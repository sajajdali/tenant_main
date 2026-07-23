<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cooking_recipes', function (Blueprint $table): void {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('servings')->default(1);
            $table->longText('ingredients')->nullable();
            $table->json('ingredients_json')->nullable();
            $table->longText('instructions')->nullable();
            $table->json('instructions_json')->nullable();
            $table->json('nutrition')->nullable();
            $table->json('micronutrients')->nullable();
            $table->boolean('is_published')->default(true);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->json('flags')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['is_active', 'is_published', 'sort_order']);
            $table->index('title');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cooking_recipes');
    }
};
