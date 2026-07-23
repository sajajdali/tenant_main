<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateTenantsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up(): void
    {
        Schema::create('tenants', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('database')->unique();
            $table->string('status')->default('active');
            $table->foreignId('owner_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedBigInteger('subscription_package_id')->nullable();
            $table->unsignedBigInteger('audience_type_id')->nullable();
            $table->date('support_ends_at')->nullable();
            $table->boolean('ir_domain_registered')->default(false);
            $table->date('ir_domain_registered_at')->nullable();
            $table->date('ir_domain_last_paid_at')->nullable();
            $table->date('ir_domain_renews_at')->nullable();
            $table->unsignedInteger('ir_domain_amount')->nullable();

            $table->timestamps();
            $table->json('data')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down(): void
    {
        Schema::dropIfExists('tenants');
    }
}
