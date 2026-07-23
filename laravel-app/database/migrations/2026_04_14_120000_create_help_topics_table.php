<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('central')->create('help_topics', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('audience_type_id')->nullable()->constrained('audience_types')->nullOnDelete();
            $table->string('module_key')->nullable()->index();
            $table->string('topic_key')->index();
            $table->string('title');
            $table->text('summary')->nullable();
            $table->longText('body')->nullable();
            $table->string('video_url')->nullable();
            $table->string('video_path')->nullable();
            $table->string('cover_image_path')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true)->index();
            $table->boolean('show_in_help_center')->default(true)->index();
            $table->boolean('show_in_page_header')->default(true)->index();
            $table->json('meta_json')->nullable();
            $table->timestamps();

            $table->unique(['topic_key', 'audience_type_id'], 'help_topics_topic_audience_unique');
        });
    }

    public function down(): void
    {
        Schema::connection('central')->dropIfExists('help_topics');
    }
};
