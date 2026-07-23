<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('store_categories') || Schema::hasColumn('store_categories', 'show_on_home')) {
            return;
        }

        Schema::table('store_categories', function (Blueprint $table): void {
            $table->boolean('show_on_home')->default(true)->after('is_active');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('store_categories') || ! Schema::hasColumn('store_categories', 'show_on_home')) {
            return;
        }

        Schema::table('store_categories', function (Blueprint $table): void {
            $table->dropColumn('show_on_home');
        });
    }
};
