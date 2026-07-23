<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('tenant_subscription_payments');

        Schema::create('tenant_subscription_payments', function (Blueprint $table): void {
            $table->id();
            $table->string('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->string('payment_type', 64)->default('support_renewal');
            $table->foreignId('subscription_package_id')->nullable()->constrained('subscription_packages')->nullOnDelete();
            $table->string('status', 32)->default('pending');
            $table->string('gateway', 32)->nullable();
            $table->string('invoice_number', 64)->unique();
            $table->unsignedBigInteger('amount');
            $table->unsignedBigInteger('discount_amount')->default(0);
            $table->unsignedBigInteger('payable_amount');
            $table->boolean('sandbox_mode')->default(false);
            $table->string('authority', 120)->nullable()->index();
            $table->string('reference_id', 120)->nullable();
            $table->string('initiated_by_tenant_user_id', 64)->nullable();
            $table->string('initiated_by_name')->nullable();
            $table->string('initiated_by_mobile', 32)->nullable();
            $table->string('initiated_by_role', 32)->nullable();
            $table->date('previous_support_ends_at')->nullable();
            $table->date('new_support_ends_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->text('failure_reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_subscription_payments');
    }
};
