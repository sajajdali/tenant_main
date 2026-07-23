<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('central')->create('sales_bank_accounts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('bank_name');
            $table->string('card_number', 32);
            $table->string('iban', 64);
            $table->string('account_holder_name');
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->json('meta_json')->nullable();
            $table->timestamps();
        });

        Schema::connection('central')->create('sales_withdrawal_requests', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('sales_bank_account_id')->constrained('sales_bank_accounts')->restrictOnDelete();
            $table->foreignId('processed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedBigInteger('requested_amount');
            $table->unsignedBigInteger('paid_amount')->default(0);
            $table->unsignedBigInteger('balance_before');
            $table->unsignedBigInteger('balance_after');
            $table->string('status', 32)->default('pending')->index();
            $table->text('request_note')->nullable();
            $table->text('admin_note')->nullable();
            $table->string('payment_reference')->nullable();
            $table->timestamp('requested_at')->index();
            $table->timestamp('processed_at')->nullable()->index();
            $table->timestamp('paid_at')->nullable()->index();
            $table->json('meta_json')->nullable();
            $table->timestamps();
        });

        Schema::connection('central')->create('sales_wallet_transactions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('sales_commission_ledger_id')->nullable()->constrained('sales_commission_ledgers')->nullOnDelete();
            $table->foreignId('sales_withdrawal_request_id')->nullable()->constrained('sales_withdrawal_requests')->nullOnDelete();
            $table->string('type', 32)->index();
            $table->string('reference_type', 64)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->bigInteger('amount');
            $table->bigInteger('balance_after')->default(0);
            $table->string('description')->nullable();
            $table->json('meta_json')->nullable();
            $table->timestamp('occurred_at')->index();
            $table->timestamps();

            $table->unique(['user_id', 'type', 'reference_type', 'reference_id'], 'sales_wallet_transactions_reference_unique');
        });

        Schema::connection('central')->create('sales_withdrawal_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('sales_withdrawal_request_id')->constrained('sales_withdrawal_requests')->cascadeOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 64)->index();
            $table->string('from_status', 32)->nullable()->index();
            $table->string('to_status', 32)->nullable()->index();
            $table->bigInteger('amount')->default(0);
            $table->text('note')->nullable();
            $table->json('meta_json')->nullable();
            $table->timestamp('occurred_at')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::connection('central')->dropIfExists('sales_withdrawal_logs');
        Schema::connection('central')->dropIfExists('sales_wallet_transactions');
        Schema::connection('central')->dropIfExists('sales_withdrawal_requests');
        Schema::connection('central')->dropIfExists('sales_bank_accounts');
    }
};
