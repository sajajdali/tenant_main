<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('created_by_user_id')->nullable();
            $table->foreignId('professional_id')->constrained('professionals')->cascadeOnDelete();
            $table->foreignId('service_id')->constrained()->cascadeOnDelete();
            $table->date('appointment_date')->nullable();
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->string('status')->default('pending');
            $table->string('customer_name_snapshot')->nullable();
            $table->string('customer_phone_snapshot', 20)->nullable();
            $table->string('professional_name_snapshot')->nullable();
            $table->string('service_name_snapshot')->nullable();
            $table->unsignedInteger('price_amount')->default(0);
            $table->unsignedSmallInteger('duration_minutes')->default(0);
            $table->string('public_code', 4)->unique();
            $table->string('booked_by_name_snapshot')->nullable();
            $table->string('booked_by_phone_snapshot', 20)->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['professional_id', 'starts_at']);
            $table->index(['service_id', 'starts_at']);
            $table->index(['professional_id', 'appointment_date', 'status', 'start_time'], 'appointments_professional_day_status_time_idx');
            $table->index(['customer_id', 'status', 'appointment_date'], 'appointments_customer_status_day_idx');
            $table->index(['appointment_date', 'status'], 'appointments_day_status_idx');
            $table->index(['customer_phone_snapshot', 'appointment_date'], 'appointments_customer_phone_day_idx');
            $table->index(['created_by_user_id', 'appointment_date'], 'appointments_creator_day_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appointments');
    }
};
