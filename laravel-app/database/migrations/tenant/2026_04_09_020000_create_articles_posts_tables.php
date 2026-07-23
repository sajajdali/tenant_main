<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('articles_posts')) {
            Schema::create('articles_posts', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('article_category_id')->nullable()->constrained('articles_categories')->nullOnDelete();
                $table->string('title', 255);
                $table->string('slug', 255)->unique();
                $table->text('excerpt')->nullable();
                $table->longText('content')->nullable();
                $table->string('author_name', 160);
                $table->string('image_path')->nullable();
                $table->unsignedInteger('sort_order')->default(0);
                $table->boolean('is_active')->default(true);
                $table->boolean('is_featured')->default(false);
                $table->boolean('show_in_featured_slider')->default(false);
                $table->boolean('is_important')->default(false);
                $table->timestamp('published_at')->nullable();
                $table->unsignedInteger('view_count')->default(0);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('articles_post_tag_assignments')) {
            Schema::create('articles_post_tag_assignments', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('article_post_id')->constrained('articles_posts')->cascadeOnDelete();
                $table->foreignId('article_tag_id')->constrained('articles_tags')->cascadeOnDelete();
                $table->timestamps();
                $table->unique(['article_post_id', 'article_tag_id'], 'articles_post_tag_unique');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('articles_post_tag_assignments');
        Schema::dropIfExists('articles_posts');
    }
};
