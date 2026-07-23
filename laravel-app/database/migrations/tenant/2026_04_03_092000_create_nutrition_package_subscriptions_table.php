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
        if (! $this->isNutritionAudience() || Schema::hasTable('nutrition_package_subscriptions')) {
            return;
        }

        Schema::create('nutrition_package_subscriptions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('nutrition_package_id')->constrained('nutrition_packages')->cascadeOnDelete();
            $table->foreignId('nutrition_package_order_id')->nullable();
            $table->enum('status', ['active', 'expired', 'cancelled'])->default('active');
            $table->date('starts_at');
            $table->date('ends_at');
            $table->unsignedInteger('online_diet_total')->default(0);
            $table->unsignedInteger('online_diet_used')->default(0);
            $table->unsignedInteger('offline_diet_total')->default(0);
            $table->unsignedInteger('offline_diet_used')->default(0);
            $table->unsignedInteger('price_amount')->default(0);
            $table->unsignedInteger('payable_amount')->default(0);
            $table->json('meta_json')->nullable();
            $table->timestamps();

            $table->foreign('nutrition_package_order_id', 'nps_order_fk')
                ->references('id')
                ->on('nutrition_package_orders')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nutrition_package_subscriptions');
    }
};
