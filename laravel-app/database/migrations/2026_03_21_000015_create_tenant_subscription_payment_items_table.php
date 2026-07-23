<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('tenant_subscription_payment_items');

        Schema::create('tenant_subscription_payment_items', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('tenant_subscription_payment_id');
            $table->foreign('tenant_subscription_payment_id', 'tspi_payment_fk')->references('id')->on('tenant_subscription_payments')->cascadeOnDelete();
            $table->string('item_type', 64);
            $table->unsignedBigInteger('subscription_package_id')->nullable();
            $table->foreign('subscription_package_id', 'tspi_package_fk')->references('id')->on('subscription_packages')->nullOnDelete();
            $table->unsignedBigInteger('feature_module_id')->nullable();
            $table->foreign('feature_module_id', 'tspi_feature_module_fk')->references('id')->on('feature_modules')->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->unsignedInteger('quantity')->default(1);
            $table->unsignedBigInteger('unit_amount')->default(0);
            $table->unsignedBigInteger('amount')->default(0);
            $table->unsignedBigInteger('discount_amount')->default(0);
            $table->unsignedBigInteger('payable_amount')->default(0);
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_subscription_payment_items');
    }
};
