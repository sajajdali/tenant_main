<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('customer_club_rewards', function (Blueprint $table): void {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('reward_type', 40);
            $table->unsignedInteger('cost_points')->default(0);
            $table->unsignedInteger('wallet_amount')->default(0);
            $table->unsignedInteger('bonus_points')->default(0);
            $table->unsignedInteger('vip_days')->default(0);
            $table->unsignedInteger('discount_percent')->default(0);
            $table->unsignedInteger('discount_amount')->default(0);
            $table->unsignedInteger('maximum_discount_amount')->default(0);
            $table->unsignedInteger('per_user_limit')->default(1);
            $table->unsignedInteger('total_limit')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->text('description')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_club_rewards');
    }
};
