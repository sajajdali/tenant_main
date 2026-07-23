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
        if (! $this->isNutritionAudience() || Schema::hasTable('nutrition_token_wallets')) {
            return;
        }

        Schema::create('nutrition_token_wallets', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('balance_tokens')->default(0);
            $table->unsignedBigInteger('purchased_tokens')->default(0);
            $table->unsignedBigInteger('used_tokens')->default(0);
            $table->json('settings_json')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nutrition_token_wallets');
    }
};
