<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_campaigns', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('preset_key', 80);
            $table->string('status', 32)->default('draft')->index();
            $table->string('title', 180);
            $table->longText('message');
            $table->json('filters')->nullable();
            $table->unsignedBigInteger('created_by_user_id')->nullable()->index();
            $table->unsignedInteger('recipients_count')->default(0);
            $table->unsignedInteger('success_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->unsignedInteger('cancelled_count')->default(0);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();
        });

        Schema::create('notification_campaign_recipients', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('campaign_id')->constrained('notification_campaigns')->cascadeOnDelete();
            $table->unsignedBigInteger('tenant_user_id')->nullable()->index();
            $table->string('recipient_phone', 20)->index();
            $table->string('recipient_name')->nullable();
            $table->string('recipient_role', 32)->nullable()->index();
            $table->unsignedInteger('appointments_count')->default(0);
            $table->date('last_appointment_at')->nullable()->index();
            $table->unsignedInteger('store_orders_count')->default(0);
            $table->unsignedInteger('store_paid_orders_count')->default(0);
            $table->unsignedBigInteger('store_total_amount')->default(0);
            $table->string('status', 32)->default('pending')->index();
            $table->text('error_message')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index(['campaign_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_campaign_recipients');
        Schema::dropIfExists('notification_campaigns');
    }
};

