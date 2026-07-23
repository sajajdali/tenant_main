<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenant_subscription_renewals', function (Blueprint $table): void {
            $table->id();
            $table->string('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreignId('subscription_package_id')->constrained('subscription_packages')->cascadeOnDelete();
            $table->foreignId('renewed_by_user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedInteger('duration_days');
            $table->date('previous_support_ends_at')->nullable();
            $table->date('new_support_ends_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_subscription_renewals');
    }
};
