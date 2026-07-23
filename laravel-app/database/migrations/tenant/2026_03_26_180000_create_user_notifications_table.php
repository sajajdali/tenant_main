<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_notifications', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('recipient_mobile', 20)->nullable()->index();
            $table->string('recipient_name')->nullable();
            $table->string('recipient_role', 32)->nullable()->index();
            $table->string('title', 180);
            $table->text('message');
            $table->unsignedBigInteger('sender_central_user_id')->nullable()->index();
            $table->string('sender_name')->nullable();
            $table->string('target_type', 20)->default('all')->index();
            $table->json('meta')->nullable();
            $table->boolean('is_read')->default(false)->index();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_user_id', 'is_read']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_notifications');
    }
};

