<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('customer_club_reward_redemptions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('member_account_id')->constrained('customer_club_member_accounts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('reward_id')->constrained('customer_club_rewards')->cascadeOnDelete();
            $table->string('status', 30)->default('redeemed');
            $table->unsignedInteger('cost_points')->default(0);
            $table->unsignedInteger('wallet_amount')->default(0);
            $table->string('issued_code', 60)->nullable();
            $table->timestamp('redeemed_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->foreignId('redeemed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('meta_json')->nullable();
            $table->timestamps();
            $table->index(['reward_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_club_reward_redemptions');
    }
};
