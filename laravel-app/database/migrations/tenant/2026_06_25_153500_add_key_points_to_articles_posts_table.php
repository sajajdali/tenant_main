<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('articles_posts') || Schema::hasColumn('articles_posts', 'key_points')) {
            return;
        }

        Schema::table('articles_posts', function (Blueprint $table): void {
            $table->json('key_points')->nullable()->after('content');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('articles_posts') || ! Schema::hasColumn('articles_posts', 'key_points')) {
            return;
        }

        Schema::table('articles_posts', function (Blueprint $table): void {
            $table->dropColumn('key_points');
        });
    }
};
