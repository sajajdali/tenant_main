<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('tenant_feature_modules');

        Schema::create('tenant_feature_modules', function (Blueprint $table): void {
            $table->id();
            $table->string('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreignId('feature_module_id')->constrained('feature_modules')->cascadeOnDelete();
            $table->string('status', 32)->default('active');
            $table->date('activated_at')->nullable();
            $table->date('expires_at')->nullable();
            $table->timestamp('last_paid_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'feature_module_id'], 'tenant_feature_module_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_feature_modules');
    }
};
