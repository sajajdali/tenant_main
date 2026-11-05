<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_club_reward_rules', function (Blueprint $table): void {
            $table->id();
            $table->string('title');
            $table->boolean('is_active')->default(true);
            $table->string('event_type', 80);
            $table->string('scope_type', 50)->default('all');
            $table->json('scope_ids')->nullable();
            $table->json('conditions_json')->nullable();
            $table->string('reward_type', 30)->default('wallet_credit');
            $table->unsignedBigInteger('reward_amount');
            $table->string('award_timing', 30)->default('immediate');
            $table->unsignedInteger('per_user_limit')->nullable();
            $table->string('limit_period', 30)->default('source');
            $table->unsignedInteger('priority')->default(0);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['event_type', 'is_active']);
        });

        Schema::create('customer_club_reward_rule_awards', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('rule_id')->constrained('customer_club_reward_rules')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('ledger_entry_id')->nullable()->constrained('customer_club_ledger_entries')->nullOnDelete();
            $table->string('status', 30)->default('awarded');
            $table->string('source_type', 80);
            $table->string('source_id', 100);
            $table->unsignedBigInteger('reward_amount');
            $table->json('context_json')->nullable();
            $table->timestamp('awarded_at')->nullable();
            $table->timestamps();
            $table->unique(['rule_id', 'user_id', 'source_type', 'source_id'], 'club_rule_awards_source_unique');
            $table->index(['rule_id', 'user_id', 'status']);
        });

        Schema::create('customer_club_reward_rule_reviews', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('award_id')->unique()->constrained('customer_club_reward_rule_awards')->cascadeOnDelete();
            $table->string('status', 30)->default('pending');
            $table->foreignId('reviewed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_club_reward_rule_reviews');
        Schema::dropIfExists('customer_club_reward_rule_awards');
        Schema::dropIfExists('customer_club_reward_rules');
    }
};
