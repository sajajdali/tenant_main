<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('custom_landing_partners', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('mobile', 20)->index();
            $table->string('status', 20)->default('active')->index();
            $table->string('public_token', 64)->unique();
            $table->decimal('first_payment_percent', 5, 2)->default(0);
            $table->decimal('recurring_payment_percent', 5, 2)->default(0);
            $table->string('bank_card_number', 32)->nullable();
            $table->string('iban', 64)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('custom_landing_attributions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('custom_landing_partner_id')->constrained('custom_landing_partners')->restrictOnDelete();
            $table->foreignId('tenant_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('public_token_snapshot', 64);
            $table->timestamp('landed_at')->nullable();
            $table->timestamp('registered_at')->nullable();
            $table->timestamp('first_paid_at')->nullable();
            $table->timestamps();
            $table->unique('tenant_user_id');
        });

        Schema::create('custom_landing_commissions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('custom_landing_partner_id')->constrained('custom_landing_partners')->restrictOnDelete();
            $table->foreignId('tenant_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('source_type', 64);
            $table->string('source_id', 64);
            $table->string('payment_kind', 32)->index();
            $table->unsignedBigInteger('gross_amount');
            $table->decimal('commission_percent_snapshot', 5, 2);
            $table->unsignedBigInteger('commission_amount');
            $table->string('status', 20)->default('credited')->index();
            $table->timestamp('paid_at')->index();
            $table->timestamp('reversed_at')->nullable()->index();
            $table->text('reversal_note')->nullable();
            $table->timestamps();
            $table->unique(['source_type', 'source_id'], 'custom_landing_commission_source_unique');
        });

        Schema::create('custom_landing_settlements', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('custom_landing_partner_id')->constrained('custom_landing_partners')->restrictOnDelete();
            $table->unsignedBigInteger('amount');
            $table->string('payment_method', 32)->nullable();
            $table->string('payment_reference', 120)->nullable()->index();
            $table->timestamp('paid_at')->index();
            $table->text('note')->nullable();
            $table->foreignId('recorded_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('custom_landing_settlements');
        Schema::dropIfExists('custom_landing_commissions');
        Schema::dropIfExists('custom_landing_attributions');
        Schema::dropIfExists('custom_landing_partners');
    }
};
