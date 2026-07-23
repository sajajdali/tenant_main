<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('manual_finance_entries', function (Blueprint $table): void {
            $table->unsignedBigInteger('material_cost_amount')
                ->default(0)
                ->after('balance_amount');
        });
    }

    public function down(): void
    {
        Schema::table('manual_finance_entries', function (Blueprint $table): void {
            $table->dropColumn('material_cost_amount');
        });
    }
};
