<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_club_settings', function (Blueprint $table): void {
            $table->boolean('birthday_sms_enabled')->default(false)->after('birthday_bonus_wallet');
            $table->string('birthday_sms_template_name', 100)->nullable()->after('birthday_sms_enabled');
        });

        Schema::table('sms_outbounds', function (Blueprint $table): void {
            $table->string('provider_template', 100)->nullable()->after('provider');
            $table->json('provider_params')->nullable()->after('provider_template');
        });

        Schema::create('customer_birthday_sms_sends', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('sms_outbound_id')->nullable()->constrained('sms_outbounds')->nullOnDelete();
            $table->unsignedSmallInteger('birthday_year');
            $table->date('birthday_date');
            $table->string('template_name', 100);
            $table->timestamp('queued_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'birthday_year'], 'birthday_sms_user_year_unique');
            $table->index(['birthday_date', 'queued_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_birthday_sms_sends');

        Schema::table('sms_outbounds', function (Blueprint $table): void {
            $table->dropColumn(['provider_template', 'provider_params']);
        });

        Schema::table('customer_club_settings', function (Blueprint $table): void {
            $table->dropColumn(['birthday_sms_enabled', 'birthday_sms_template_name']);
        });
    }
};
