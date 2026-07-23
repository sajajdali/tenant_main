<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::connection('central')->table('subscription_package_audience_prices', function (Blueprint $table) {
            $table->boolean('show_on_landing_home')->default(false)->after('discounted_price_amount');
            $table->boolean('is_landing_recommended')->default(false)->after('show_on_landing_home');
            $table->unsignedInteger('landing_sort_order')->default(0)->after('is_landing_recommended');
        });
    }
    public function down(): void
    {
        Schema::connection('central')->table('subscription_package_audience_prices', fn (Blueprint $table) => $table->dropColumn(['show_on_landing_home', 'is_landing_recommended', 'landing_sort_order']));
    }
};
