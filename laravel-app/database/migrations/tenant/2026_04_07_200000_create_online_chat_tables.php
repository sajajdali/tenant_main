<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('online_chat_conversations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('customer_user_id')->constrained('users', indexName: 'occ_customer_user_fk')->cascadeOnDelete();
            $table->foreignId('assigned_to_user_id')->nullable()->constrained('users', indexName: 'occ_assigned_user_fk')->nullOnDelete();
            $table->enum('status', ['open', 'closed'])->default('open');
            $table->string('last_message_preview', 255)->nullable();
            $table->string('last_message_sender_role', 32)->nullable();
            $table->timestamp('last_message_at')->nullable();
            $table->unsignedInteger('customer_unread_count')->default(0);
            $table->unsignedInteger('admin_unread_count')->default(0);
            $table->timestamp('customer_last_seen_at')->nullable();
            $table->timestamp('admin_last_seen_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->unique('customer_user_id', 'occ_customer_user_unique');
            $table->index(['status', 'last_message_at'], 'occ_status_last_message_idx');
            $table->index(['assigned_to_user_id', 'status'], 'occ_assigned_status_idx');
        });

        Schema::create('online_chat_messages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('conversation_id')->constrained('online_chat_conversations', indexName: 'ocm_conversation_fk')->cascadeOnDelete();
            $table->foreignId('sender_user_id')->nullable()->constrained('users', indexName: 'ocm_sender_user_fk')->nullOnDelete();
            $table->enum('sender_type', ['customer', 'panel_user', 'system'])->default('customer');
            $table->string('sender_name')->nullable();
            $table->string('sender_role', 32)->nullable();
            $table->text('body')->nullable();
            $table->unsignedSmallInteger('attachments_count')->default(0);
            $table->timestamps();

            $table->index(['conversation_id', 'created_at'], 'ocm_conversation_created_idx');
        });

        Schema::create('online_chat_attachments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('message_id')->constrained('online_chat_messages', indexName: 'oca_message_fk')->cascadeOnDelete();
            $table->string('disk', 64)->default('public');
            $table->string('path');
            $table->string('original_name');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('online_chat_attachments');
        Schema::dropIfExists('online_chat_messages');
        Schema::dropIfExists('online_chat_conversations');
    }
};
