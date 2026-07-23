<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landing_sites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('audience_type_id')->constrained('audience_types')->cascadeOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('status', 40)->default('draft')->index();
            $table->string('theme_mode', 20)->default('dark');
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false);
            $table->json('appearance_json')->nullable();
            $table->json('seo_json')->nullable();
            $table->json('settings_json')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique('audience_type_id');
        });

        Schema::create('landing_site_domains', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landing_site_id')->constrained('landing_sites')->cascadeOnDelete();
            $table->string('domain')->unique();
            $table->boolean('is_primary')->default(false);
            $table->string('status', 40)->default('pending')->index();
            $table->timestamp('verified_at')->nullable();
            $table->json('meta_json')->nullable();
            $table->timestamps();
        });

        Schema::create('landing_pages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landing_site_id')->constrained('landing_sites')->cascadeOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->string('page_key', 60);
            $table->string('status', 40)->default('draft')->index();
            $table->unsignedInteger('sort_order')->default(0);
            $table->json('seo_json')->nullable();
            $table->json('settings_json')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['landing_site_id', 'slug']);
            $table->unique(['landing_site_id', 'page_key']);
        });

        Schema::create('landing_page_sections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landing_page_id')->constrained('landing_pages')->cascadeOnDelete();
            $table->string('section_key', 100)->nullable();
            $table->string('section_type', 60)->index();
            $table->string('name')->nullable();
            $table->string('status', 40)->default('draft')->index();
            $table->unsignedInteger('sort_order')->default(0);
            $table->json('content_json')->nullable();
            $table->json('settings_json')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['landing_page_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('landing_page_sections');
        Schema::dropIfExists('landing_pages');
        Schema::dropIfExists('landing_site_domains');
        Schema::dropIfExists('landing_sites');
    }
};
