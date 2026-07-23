<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audience_types', function (Blueprint $table) {
            if (! Schema::hasColumn('audience_types', 'nutrition_features')) {
                $table->json('nutrition_features')->nullable()->after('future_features');
            }
        });
    }

    public function down(): void
    {
        Schema::table('audience_types', function (Blueprint $table) {
            if (Schema::hasColumn('audience_types', 'nutrition_features')) {
                $table->dropColumn('nutrition_features');
            }
        });
    }
};
