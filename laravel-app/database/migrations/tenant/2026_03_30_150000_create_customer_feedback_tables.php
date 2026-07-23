<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_feedback_questions', function (Blueprint $table): void {
            $table->id();
            $table->string('title');
            $table->string('display_type', 16)->default('emoji');
            $table->string('placeholder')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('customer_feedback_invitations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('appointment_id')->constrained('appointments')->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('professional_id')->nullable()->constrained('professionals')->nullOnDelete();
            $table->string('token', 64)->unique();
            $table->string('status', 32)->default('pending');
            $table->string('customer_name')->nullable();
            $table->string('customer_mobile', 20)->nullable();
            $table->unsignedSmallInteger('send_attempts')->default(0);
            $table->timestamp('first_sent_at')->nullable();
            $table->timestamp('last_sent_at')->nullable();
            $table->timestamp('next_send_at')->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->unique('appointment_id');
            $table->index(['status', 'next_send_at']);
            $table->index(['customer_mobile', 'created_at']);
        });

        Schema::create('customer_feedback_responses', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('invitation_id')->constrained('customer_feedback_invitations')->cascadeOnDelete();
            $table->foreignId('appointment_id')->constrained('appointments')->cascadeOnDelete();
            $table->string('rating_type', 16);
            $table->unsignedTinyInteger('rating_value')->nullable();
            $table->string('emoji_key', 32)->nullable();
            $table->text('comment')->nullable();
            $table->json('answers')->nullable();
            $table->timestamps();

            $table->unique('invitation_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_feedback_responses');
        Schema::dropIfExists('customer_feedback_invitations');
        Schema::dropIfExists('customer_feedback_questions');
    }
};
