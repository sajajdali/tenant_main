<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('discount_codes', function (Blueprint $table): void {
            $table->id();
            $table->string('code', 80)->unique();
            $table->string('title')->nullable();
            $table->foreignId('audience_type_id')->nullable()->constrained('audience_types')->nullOnDelete();
            $table->foreignId('sales_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('applies_to', 32)->default('both')->index();
            $table->string('discount_type', 20)->default('fixed');
            $table->unsignedBigInteger('discount_value')->default(0);
            $table->unsignedBigInteger('maximum_discount_amount')->nullable();
            $table->unsignedBigInteger('minimum_amount')->nullable();
            $table->unsignedBigInteger('maximum_amount')->nullable();
            $table->unsignedInteger('max_uses')->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->json('meta_json')->nullable();
            $table->timestamps();
        });

        Schema::create('discount_code_redemptions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('discount_code_id')->constrained('discount_codes')->cascadeOnDelete();
            $table->foreignId('audience_type_id')->nullable()->constrained('audience_types')->nullOnDelete();
            $table->foreignId('sales_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('context_type', 40)->index();
            $table->string('tenant_id')->nullable()->index();
            $table->foreignId('landing_site_id')->nullable()->constrained('landing_sites')->nullOnDelete();
            $table->foreignId('landing_customer_id')->nullable()->constrained('landing_customers')->nullOnDelete();
            $table->foreignId('landing_order_id')->nullable()->constrained('landing_orders')->nullOnDelete();
            $table->foreignId('landing_order_payment_id')->nullable()->constrained('landing_order_payments')->nullOnDelete();
            $table->foreignId('tenant_subscription_payment_id')->nullable()->constrained('tenant_subscription_payments')->nullOnDelete();
            $table->string('customer_mobile', 32)->nullable();
            $table->unsignedBigInteger('base_amount')->default(0);
            $table->unsignedBigInteger('discount_amount')->default(0);
            $table->unsignedBigInteger('payable_amount')->default(0);
            $table->json('meta_json')->nullable();
            $table->timestamp('redeemed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discount_code_redemptions');
        Schema::dropIfExists('discount_codes');
    }
};
