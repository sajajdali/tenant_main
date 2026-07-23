<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('feature_module_audience_prices');

        Schema::create('feature_module_audience_prices', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('feature_module_id')->constrained('feature_modules')->cascadeOnDelete();
            $table->foreignId('audience_type_id')->constrained('audience_types')->cascadeOnDelete();
            $table->unsignedBigInteger('monthly_price_amount');
            $table->timestamps();

            $table->unique(['feature_module_id', 'audience_type_id'], 'feature_module_audience_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feature_module_audience_prices');
    }
};
