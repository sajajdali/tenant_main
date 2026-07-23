<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('referral_leads', function (Blueprint $table): void {
            $table->id();
            $table->string('referrer_tenant_id');
            $table->unsignedBigInteger('referrer_tenant_user_id')->nullable();
            $table->string('referrer_name')->nullable();
            $table->string('referrer_mobile')->nullable();
            $table->string('referred_mobile')->unique();
            $table->string('status')->default('pending');
            $table->string('converted_tenant_id')->nullable();
            $table->foreignId('subscription_package_id')->nullable()->constrained('subscription_packages')->nullOnDelete();
            $table->unsignedInteger('purchased_duration_days')->nullable();
            $table->unsignedInteger('reward_duration_days')->nullable();
            $table->date('reward_previous_support_ends_at')->nullable();
            $table->date('reward_new_support_ends_at')->nullable();
            $table->timestamp('converted_at')->nullable();
            $table->timestamp('rewarded_at')->nullable();
            $table->timestamps();

            $table->index(['referrer_tenant_id', 'status']);
            $table->index(['converted_tenant_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('referral_leads');
    }
};
