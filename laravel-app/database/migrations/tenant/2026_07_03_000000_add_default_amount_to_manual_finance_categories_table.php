<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('manual_finance_categories', function (Blueprint $table): void {
            $table->unsignedBigInteger('default_amount')->nullable()->after('default_share_percent');
        });
    }

    public function down(): void
    {
        Schema::table('manual_finance_categories', function (Blueprint $table): void {
            $table->dropColumn('default_amount');
        });
    }
};
