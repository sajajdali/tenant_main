<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('store_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('order_number')->unique();
            $table->string('status', 30)->default('pending_payment');
            $table->string('payment_method', 30);
            $table->string('shipping_method', 30);
            $table->string('customer_name');
            $table->string('customer_phone', 20);
            $table->string('delivery_title')->nullable();
            $table->unsignedInteger('delivery_province_id')->nullable();
            $table->string('delivery_province_name')->nullable();
            $table->unsignedInteger('delivery_city_id')->nullable();
            $table->string('delivery_city_name')->nullable();
            $table->decimal('delivery_latitude', 10, 7)->nullable();
            $table->decimal('delivery_longitude', 10, 7)->nullable();
            $table->text('delivery_address')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedInteger('items_count')->default(0);
            $table->unsignedBigInteger('subtotal_amount')->default(0);
            $table->unsignedBigInteger('shipping_amount')->default(0);
            $table->unsignedBigInteger('discount_amount')->default(0);
            $table->unsignedBigInteger('total_amount')->default(0);
            $table->timestamp('paid_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['status', 'payment_method']);
            $table->index(['customer_phone', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('store_orders');
    }
};
