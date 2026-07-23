<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('central')->create('admin_action_logs', function (Blueprint $table): void {
            $table->id();
            $table->string('action_type', 80);
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('tenant_id')->nullable()->index();
            $table->foreignId('tenant_subscription_payment_id')->nullable()->constrained('tenant_subscription_payments')->nullOnDelete();
            $table->foreignId('landing_order_payment_id')->nullable()->constrained('landing_order_payments')->nullOnDelete();
            $table->string('title')->nullable();
            $table->text('reason');
            $table->json('meta_json')->nullable();
            $table->timestamp('occurred_at')->nullable()->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::connection('central')->dropIfExists('admin_action_logs');
    }
};
