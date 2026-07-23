<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('central_user_id')->nullable()->index();
            $table->string('name')->nullable();
            $table->string('mobile', 20)->unique();
            $table->string('gender', 16)->nullable();
            $table->string('national_code', 20)->nullable();
            $table->date('birth_date')->nullable();
            $table->unsignedInteger('province_id')->nullable();
            $table->string('province_name')->nullable();
            $table->unsignedInteger('city_id')->nullable();
            $table->string('city_name')->nullable();
            $table->string('job_title')->nullable();
            $table->string('email')->nullable()->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password')->nullable();
            $table->string('role', 32)->default('customer');
            $table->boolean('is_active')->default(true);
            $table->boolean('can_book')->default(true);
            $table->boolean('is_vip')->default(false);
            $table->rememberToken();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
