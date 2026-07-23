<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_package_audience_prices', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('subscription_package_id');
            $table->unsignedBigInteger('audience_type_id');
            $table->unsignedBigInteger('price_amount');
            $table->unsignedBigInteger('discounted_price_amount')->nullable();
            $table->timestamps();
            $table->unique(['subscription_package_id', 'audience_type_id'], 'subscription_package_audience_unique');
            $table->foreign('subscription_package_id', 'spap_package_fk')->references('id')->on('subscription_packages')->cascadeOnDelete();
            $table->foreign('audience_type_id', 'spap_audience_fk')->references('id')->on('audience_types')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_package_audience_prices');
    }
};
