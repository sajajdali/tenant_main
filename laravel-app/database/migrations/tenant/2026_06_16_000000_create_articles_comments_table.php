<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('articles_comments')) {
            return;
        }

        Schema::create('articles_comments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('article_post_id')->constrained('articles_posts')->cascadeOnDelete();
            $table->foreignId('tenant_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('author_name', 160)->nullable();
            $table->string('author_mobile', 32)->nullable();
            $table->text('body');
            $table->string('status', 32)->default('pending')->index();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->index(['article_post_id', 'status', 'created_at'], 'articles_comments_post_status_created_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('articles_comments');
    }
};
