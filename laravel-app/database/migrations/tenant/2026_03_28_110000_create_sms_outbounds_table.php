<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sms_outbounds', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('campaign_id')->nullable()->constrained('sms_campaigns')->nullOnDelete();
            $table->string('type', 32)->index();
            $table->string('template_key', 120)->nullable();
            $table->string('provider', 32)->nullable()->index();
            $table->string('sender', 50)->nullable();
            $table->string('recipient_mobile', 20)->index();
            $table->string('recipient_name')->nullable();
            $table->longText('message');
            $table->string('message_encoding', 16);
            $table->unsignedInteger('parts_count')->default(0);
            $table->unsignedInteger('unit_price')->default(0);
            $table->unsignedInteger('total_price')->default(0);
            $table->string('status', 32)->default('pending')->index();
            $table->string('provider_message_id')->nullable()->index();
            $table->text('error_message')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index(['campaign_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sms_outbounds');
    }
};
