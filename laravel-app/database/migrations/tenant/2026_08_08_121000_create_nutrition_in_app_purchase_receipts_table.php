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
        if (! $this->isNutritionAudience() || Schema::hasTable('nutrition_in_app_purchase_receipts')) {
            return;
        }

        Schema::create('nutrition_in_app_purchase_receipts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users', indexName: 'nipr_user_fk')->cascadeOnDelete();
            $table->foreignId('nutrition_package_id')->constrained('nutrition_packages', indexName: 'nipr_package_fk')->cascadeOnDelete();
            $table->foreignId('nutrition_package_order_id')->nullable()->constrained('nutrition_package_orders', indexName: 'nipr_order_fk')->nullOnDelete();
            $table->string('store', 40)->default('cafebazaar');
            $table->string('product_id');
            $table->string('purchase_token')->unique('nipr_purchase_token_uq');
            $table->string('store_order_id')->nullable();
            $table->string('developer_payload')->nullable();
            $table->enum('status', ['pending', 'verified', 'granted', 'failed', 'consumed'])->default('pending');
            $table->json('raw_payload')->nullable();
            $table->timestamp('purchased_at')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->timestamp('granted_at')->nullable();
            $table->timestamp('consumed_reported_at')->nullable();
            $table->text('failure_reason')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'store', 'product_id'], 'nipr_user_store_product_idx');
            $table->index(['nutrition_package_order_id', 'status'], 'nipr_order_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nutrition_in_app_purchase_receipts');
    }
};
