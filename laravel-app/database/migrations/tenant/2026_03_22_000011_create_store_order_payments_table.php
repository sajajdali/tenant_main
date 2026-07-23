<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('store_order_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_order_id')->constrained('store_orders')->cascadeOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('invoice_number')->unique();
            $table->string('method', 30);
            $table->string('gateway', 50)->nullable();
            $table->string('status', 30)->default('pending');
            $table->boolean('sandbox_mode')->default(false);
            $table->unsignedBigInteger('amount')->default(0);
            $table->string('transaction_id')->nullable()->index();
            $table->string('reference_id')->nullable();
            $table->text('failure_reason')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamp('paid_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['method', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('store_order_payments');
    }
};
