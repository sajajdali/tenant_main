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
        if (! $this->isNutritionAudience() || Schema::hasTable('nutrition_package_orders')) {
            return;
        }

        Schema::create('nutrition_package_orders', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('nutrition_package_id')->constrained('nutrition_packages')->cascadeOnDelete();
            $table->foreignId('nutrition_discount_code_id')->nullable()->constrained('nutrition_discount_codes')->nullOnDelete();
            $table->string('invoice_number')->unique();
            $table->enum('status', ['pending', 'paid', 'failed', 'cancelled'])->default('pending');
            $table->string('gateway')->nullable();
            $table->boolean('sandbox_mode')->default(false);
            $table->unsignedInteger('amount')->default(0);
            $table->unsignedInteger('discount_amount')->default(0);
            $table->unsignedInteger('payable_amount')->default(0);
            $table->string('transaction_id')->nullable();
            $table->string('reference_id')->nullable();
            $table->string('discount_code')->nullable();
            $table->json('discount_code_snapshot')->nullable();
            $table->json('meta_json')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->text('failure_reason')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nutrition_package_orders');
    }
};
