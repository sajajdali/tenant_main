<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::connection('central')->create('landing_features', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landing_site_id')->constrained('landing_sites')->cascadeOnDelete();
            $table->string('slug');
            $table->string('title');
            $table->string('badge_text')->nullable();
            $table->text('short_description')->nullable();
            $table->longText('description')->nullable();
            $table->string('status')->default('active');
            $table->boolean('is_primary')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->text('video_url')->nullable();
            $table->text('video_path')->nullable();
            $table->text('cover_url')->nullable();
            $table->text('cover_path')->nullable();
            $table->text('image_url')->nullable();
            $table->text('image_path')->nullable();
            $table->json('benefits_json')->nullable();
            $table->json('seo_json')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['landing_site_id', 'slug']);
            $table->index(['landing_site_id', 'status', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::connection('central')->dropIfExists('landing_features');
    }
};
