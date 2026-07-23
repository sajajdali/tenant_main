<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landing_order_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landing_order_id')->constrained('landing_orders')->cascadeOnDelete();
            $table->string('invoice_number')->unique();
            $table->string('gateway', 60)->nullable()->index();
            $table->string('status', 40)->default('pending')->index();
            $table->boolean('sandbox_mode')->default(false);
            $table->unsignedBigInteger('amount')->default(0);
            $table->timestamp('expires_at')->nullable();
            $table->string('authority', 255)->nullable()->index();
            $table->string('reference_id', 255)->nullable()->index();
            $table->text('failure_reason')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->json('meta_json')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('landing_order_payments');
    }
};
