<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('store_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_order_id')->constrained('store_orders')->cascadeOnDelete();
            $table->string('product_id')->nullable();
            $table->string('title');
            $table->string('subtitle')->nullable();
            $table->string('image_label')->nullable();
            $table->unsignedBigInteger('unit_amount')->default(0);
            $table->unsignedInteger('quantity')->default(1);
            $table->unsignedBigInteger('total_amount')->default(0);
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('store_order_items');
    }
};
