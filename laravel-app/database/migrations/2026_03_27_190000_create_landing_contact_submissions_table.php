<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landing_contact_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landing_site_id')->constrained('landing_sites')->cascadeOnDelete();
            $table->foreignId('landing_page_id')->nullable()->constrained('landing_pages')->nullOnDelete();
            $table->string('full_name');
            $table->string('mobile', 32);
            $table->string('email')->nullable();
            $table->text('message');
            $table->string('status', 32)->default('new');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->json('meta_json')->nullable();
            $table->timestamps();

            $table->index(['landing_site_id', 'submitted_at']);
            $table->index(['landing_site_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('landing_contact_submissions');
    }
};
