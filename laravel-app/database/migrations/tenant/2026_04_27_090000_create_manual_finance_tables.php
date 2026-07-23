<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('manual_finance_categories', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('audience_slug', 80)->nullable()->index();
            $table->unsignedInteger('default_share_percent')->nullable();
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['name', 'audience_slug']);
        });

        Schema::create('manual_finance_entries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('appointment_id')->nullable()->constrained('appointments')->nullOnDelete();
            $table->foreignId('professional_id')->nullable()->constrained('professionals')->nullOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('customer_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('customer_name_snapshot');
            $table->string('customer_phone_snapshot', 32)->index();
            $table->date('entry_date')->index();
            $table->unsignedBigInteger('total_amount')->default(0);
            $table->unsignedBigInteger('paid_amount')->default(0);
            $table->bigInteger('balance_amount')->default(0);
            $table->unsignedBigInteger('professional_share_amount')->default(0);
            $table->unsignedBigInteger('business_share_amount')->default(0);
            $table->string('payment_method', 40)->default('cash');
            $table->enum('status', ['paid', 'partial', 'debt'])->default('paid')->index();
            $table->json('items')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['professional_id', 'entry_date']);
            $table->index(['customer_phone_snapshot', 'entry_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manual_finance_entries');
        Schema::dropIfExists('manual_finance_categories');
    }
};
