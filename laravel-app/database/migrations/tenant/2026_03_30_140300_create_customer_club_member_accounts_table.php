<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('customer_club_member_accounts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('current_tier_id')->nullable()->constrained('customer_club_tiers')->nullOnDelete();
            $table->unsignedBigInteger('points_balance')->default(0);
            $table->unsignedBigInteger('lifetime_points_earned')->default(0);
            $table->unsignedBigInteger('lifetime_points_spent')->default(0);
            $table->unsignedBigInteger('wallet_balance')->default(0);
            $table->unsignedBigInteger('lifetime_wallet_earned')->default(0);
            $table->unsignedBigInteger('lifetime_wallet_spent')->default(0);
            $table->timestamp('joined_at')->nullable();
            $table->timestamp('last_activity_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->unique('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_club_member_accounts');
    }
};
