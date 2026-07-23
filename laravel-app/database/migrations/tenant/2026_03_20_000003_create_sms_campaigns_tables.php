<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sms_campaigns', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('preset_key', 64);
            $table->string('status', 32)->default('draft')->index();
            $table->longText('message');
            $table->string('message_encoding', 16)->nullable();
            $table->unsignedInteger('message_characters_count')->default(0);
            $table->unsignedInteger('message_parts_count')->default(0);
            $table->unsignedInteger('unit_price')->default(0);
            $table->unsignedBigInteger('estimated_total_price')->default(0);
            $table->unsignedBigInteger('spent_total_price')->default(0);
            $table->json('filters')->nullable();
            $table->unsignedBigInteger('created_by_user_id')->nullable()->index();
            $table->unsignedInteger('recipients_count')->default(0);
            $table->unsignedInteger('sent_count')->default(0);
            $table->unsignedInteger('success_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->unsignedInteger('cancelled_count')->default(0);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();
        });

        Schema::create('sms_campaign_recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained('sms_campaigns')->cascadeOnDelete();
            $table->string('customer_phone', 20)->index();
            $table->string('customer_name')->nullable();
            $table->unsignedBigInteger('last_barber_id')->nullable()->index();
            $table->string('last_barber_name')->nullable();
            $table->unsignedBigInteger('last_service_id')->nullable()->index();
            $table->string('last_service_name')->nullable();
            $table->date('last_appointment_at')->nullable()->index();
            $table->date('first_appointment_at')->nullable();
            $table->unsignedInteger('appointments_count')->default(0);
            $table->string('message_encoding', 16)->nullable();
            $table->unsignedInteger('message_parts_count')->default(0);
            $table->unsignedInteger('unit_price')->default(0);
            $table->string('status', 32)->default('pending')->index();
            $table->string('provider_message_id')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index(['campaign_id', 'status']);
        });

        Schema::create('sms_blacklists', function (Blueprint $table) {
            $table->id();
            $table->string('phone', 20)->unique();
            $table->string('name')->nullable();
            $table->string('reason')->nullable();
            $table->timestamp('blocked_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sms_blacklists');
        Schema::dropIfExists('sms_campaign_recipients');
        Schema::dropIfExists('sms_campaigns');
    }
};
