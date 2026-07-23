<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales_customer_assignments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('sales_expert_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('sales_manager_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('assigned_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('audience_type_id')->nullable()->constrained('audience_types')->nullOnDelete();
            $table->foreignId('landing_customer_id')->nullable()->constrained('landing_customers')->nullOnDelete();
            $table->string('tenant_id')->nullable()->index();
            $table->string('customer_name')->nullable();
            $table->string('customer_mobile', 20)->nullable()->index();
            $table->string('status', 32)->default('won')->index();
            $table->string('source_type', 64)->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('latest_source_type', 64)->nullable();
            $table->unsignedBigInteger('latest_source_id')->nullable();
            $table->decimal('sales_expert_percent', 5, 2)->nullable();
            $table->decimal('sales_manager_percent', 5, 2)->nullable();
            $table->timestamp('first_purchased_at')->nullable()->index();
            $table->timestamp('last_purchased_at')->nullable()->index();
            $table->timestamp('last_followed_up_at')->nullable()->index();
            $table->timestamp('next_follow_up_at')->nullable()->index();
            $table->date('support_expires_at')->nullable()->index();
            $table->date('last_renewed_at')->nullable()->index();
            $table->json('meta_json')->nullable();
            $table->timestamps();
        });

        Schema::create('sales_follow_ups', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('sales_customer_assignment_id')->constrained('sales_customer_assignments')->cascadeOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_role', 32)->nullable();
            $table->string('follow_up_type', 32)->index();
            $table->string('result_status', 32)->nullable()->index();
            $table->string('summary');
            $table->text('details')->nullable();
            $table->timestamp('scheduled_for')->nullable()->index();
            $table->timestamp('followed_at')->nullable()->index();
            $table->timestamp('next_follow_up_at')->nullable()->index();
            $table->json('meta_json')->nullable();
            $table->timestamps();
        });

        Schema::create('sales_commission_ledgers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('sales_customer_assignment_id')->nullable()->constrained('sales_customer_assignments')->nullOnDelete();
            $table->foreignId('sales_expert_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('sales_manager_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('source_type', 64);
            $table->unsignedBigInteger('source_id');
            $table->string('source_label')->nullable();
            $table->foreignId('landing_order_id')->nullable()->constrained('landing_orders')->nullOnDelete();
            $table->foreignId('tenant_subscription_payment_id')->nullable()->constrained('tenant_subscription_payments')->nullOnDelete();
            $table->string('tenant_id')->nullable()->index();
            $table->string('customer_name')->nullable();
            $table->string('customer_mobile', 20)->nullable()->index();
            $table->unsignedBigInteger('gross_amount')->default(0);
            $table->unsignedBigInteger('discount_amount')->default(0);
            $table->unsignedBigInteger('net_amount')->default(0);
            $table->decimal('sales_expert_percent', 5, 2)->nullable();
            $table->unsignedBigInteger('sales_expert_amount')->default(0);
            $table->decimal('sales_manager_percent', 5, 2)->nullable();
            $table->unsignedBigInteger('sales_manager_amount')->default(0);
            $table->string('status', 32)->default('recorded')->index();
            $table->timestamp('occurred_at')->index();
            $table->json('meta_json')->nullable();
            $table->timestamps();

            $table->unique(['source_type', 'source_id'], 'sales_commission_ledgers_source_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_commission_ledgers');
        Schema::dropIfExists('sales_follow_ups');
        Schema::dropIfExists('sales_customer_assignments');
    }
};
