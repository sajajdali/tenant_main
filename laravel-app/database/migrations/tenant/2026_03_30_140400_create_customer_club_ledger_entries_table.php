<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('customer_club_ledger_entries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('member_account_id')->constrained('customer_club_member_accounts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('entry_type', 50);
            $table->string('source_type', 80)->nullable();
            $table->string('source_id', 80)->nullable();
            $table->bigInteger('points_delta')->default(0);
            $table->bigInteger('wallet_delta')->default(0);
            $table->unsignedBigInteger('points_balance_after')->default(0);
            $table->unsignedBigInteger('wallet_balance_after')->default(0);
            $table->string('title');
            $table->text('description')->nullable();
            $table->json('meta_json')->nullable();
            $table->timestamp('occurred_at')->nullable();
            $table->timestamps();
            $table->index(['entry_type', 'occurred_at']);
            $table->index(['source_type', 'source_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_club_ledger_entries');
    }
};
