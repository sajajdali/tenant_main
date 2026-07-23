<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenant_storage_addons', function (Blueprint $table): void {
            $table->id();
            $table->string('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->unsignedInteger('gb');
            $table->unsignedInteger('price_per_gb_month');
            $table->unsignedBigInteger('amount')->default(0);
            $table->unsignedBigInteger('payable_amount')->default(0);
            $table->date('starts_at');
            $table->date('ends_at')->nullable();
            $table->string('status', 32)->default('pending');
            $table->foreignId('tenant_subscription_payment_id')->nullable()->constrained('tenant_subscription_payments')->nullOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_storage_addons');
    }
};
