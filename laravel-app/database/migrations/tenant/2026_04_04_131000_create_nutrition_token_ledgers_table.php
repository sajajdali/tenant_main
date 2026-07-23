<?php

declare(strict_types=1);

use App\Support\Concerns\ChecksNutritionAudience;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    use ChecksNutritionAudience;

    public function up(): void
    {
        if (! $this->isNutritionAudience() || Schema::hasTable('nutrition_token_ledgers')) {
            return;
        }

        Schema::create('nutrition_token_ledgers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('nutrition_token_wallet_id')->constrained('nutrition_token_wallets')->cascadeOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('subject_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('nutrition_diet_request_id')->nullable()->constrained('nutrition_diet_requests')->nullOnDelete();
            $table->unsignedBigInteger('tokens_amount');
            $table->enum('direction', ['credit', 'debit']);
            $table->enum('event_type', ['topup', 'diet_request_ai', 'ai_question']);
            $table->unsignedBigInteger('balance_after');
            $table->string('reason_title');
            $table->string('reason_code')->nullable();
            $table->json('meta_json')->nullable();
            $table->timestamp('occurred_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nutrition_token_ledgers');
    }
};
