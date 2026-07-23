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
        if (! $this->isNutritionAudience() || Schema::hasTable('nutrition_subscription_credit_logs')) {
            return;
        }

        Schema::create('nutrition_subscription_credit_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('nutrition_package_subscription_id');
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->integer('online_diet_delta')->default(0);
            $table->integer('offline_diet_delta')->default(0);
            $table->unsignedInteger('online_diet_total_before')->default(0);
            $table->unsignedInteger('online_diet_total_after')->default(0);
            $table->unsignedInteger('online_diet_remaining_before')->default(0);
            $table->unsignedInteger('online_diet_remaining_after')->default(0);
            $table->unsignedInteger('offline_diet_total_before')->default(0);
            $table->unsignedInteger('offline_diet_total_after')->default(0);
            $table->unsignedInteger('offline_diet_remaining_before')->default(0);
            $table->unsignedInteger('offline_diet_remaining_after')->default(0);
            $table->text('notes')->nullable();
            $table->json('meta_json')->nullable();
            $table->timestamp('occurred_at')->nullable()->index();
            $table->timestamps();

            $table->index(['user_id', 'occurred_at'], 'nutrition_sub_credit_logs_user_date_idx');
            $table->index('nutrition_package_subscription_id', 'nutrition_sub_credit_logs_subscription_idx');
            $table->foreign('nutrition_package_subscription_id', 'nscl_pkg_sub_fk')
                ->references('id')
                ->on('nutrition_package_subscriptions')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nutrition_subscription_credit_logs');
    }
};
