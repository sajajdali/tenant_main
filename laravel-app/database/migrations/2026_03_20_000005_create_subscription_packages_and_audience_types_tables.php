<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_packages', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->unsignedInteger('duration_days');
            $table->unsignedInteger('user_limit')->nullable();
            $table->unsignedBigInteger('price_amount')->default(0);
            $table->unsignedBigInteger('discounted_price_amount')->nullable();
            $table->unsignedBigInteger('sms_credit_gift_amount')->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['duration_days', 'user_limit'], 'subscription_packages_duration_user_limit_idx');
        });

        Schema::create('audience_types', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('singular_label');
            $table->string('plural_label');
            $table->string('business_label')->default('مجموعه');
            $table->json('enabled_features')->nullable();
            $table->json('future_features')->nullable();
            $table->json('nutrition_features')->nullable();
            $table->json('specialized_course_settings')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audience_types');
        Schema::dropIfExists('subscription_packages');
    }
};
