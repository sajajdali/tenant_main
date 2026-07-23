<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('support_tickets', function (Blueprint $table) {
            $table->id();
            $table->uuid('tenant_id')->index();
            $table->string('tenant_name')->nullable();
            $table->string('tenant_domain')->nullable();
            $table->unsignedBigInteger('requester_tenant_user_id')->nullable()->index();
            $table->string('requester_name')->nullable();
            $table->string('requester_mobile', 20)->nullable()->index();
            $table->string('requester_role', 32)->nullable()->index();
            $table->string('subject');
            $table->string('status', 32)->default('waiting_admin')->index();
            $table->unsignedInteger('messages_count')->default(0);
            $table->unsignedInteger('requester_unread_count')->default(0);
            $table->unsignedInteger('admin_unread_count')->default(0);
            $table->timestamp('last_message_at')->nullable()->index();
            $table->timestamp('requester_last_seen_at')->nullable();
            $table->timestamp('admin_last_seen_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->unsignedBigInteger('closed_by_central_user_id')->nullable();
            $table->unsignedBigInteger('closed_by_requester_tenant_user_id')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'last_message_at']);
        });

        Schema::create('support_ticket_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('support_tickets')->cascadeOnDelete();
            $table->string('sender_type', 32)->index();
            $table->unsignedBigInteger('sender_central_user_id')->nullable()->index();
            $table->unsignedBigInteger('sender_tenant_user_id')->nullable()->index();
            $table->string('sender_name')->nullable();
            $table->string('sender_role', 32)->nullable()->index();
            $table->longText('body');
            $table->timestamps();

            $table->index(['ticket_id', 'created_at']);
        });

        Schema::create('support_ticket_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained('support_ticket_messages')->cascadeOnDelete();
            $table->string('disk', 32)->default('public');
            $table->string('path');
            $table->string('original_name');
            $table->string('mime_type', 100)->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_ticket_attachments');
        Schema::dropIfExists('support_ticket_messages');
        Schema::dropIfExists('support_tickets');
    }
};
