<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('appointment_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('appointment_id')->nullable()->constrained('appointments')->nullOnDelete();
            $table->foreignId('professional_id')->constrained('professionals')->cascadeOnDelete();
            $table->foreignId('service_id')->constrained('services')->cascadeOnDelete();
            $table->string('invoice_number')->unique();
            $table->string('gateway', 50);
            $table->string('status', 20)->default('pending');
            $table->boolean('sandbox_mode')->default(false);
            $table->unsignedBigInteger('amount')->default(0);
            $table->date('appointment_date');
            $table->time('start_time');
            $table->time('end_time');
            $table->string('transaction_id')->nullable()->index();
            $table->string('reference_id')->nullable();
            $table->string('customer_name_snapshot');
            $table->string('customer_phone_snapshot', 20);
            $table->string('booked_by_name_snapshot')->nullable();
            $table->string('booked_by_phone_snapshot', 20)->nullable();
            $table->text('notes')->nullable();
            $table->text('failure_reason')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamp('paid_at')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['professional_id', 'appointment_date', 'status'], 'appointment_payments_professional_date_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appointment_payments');
    }
};
