<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table): void {
            $table->string('duration_display_text')->nullable()->after('duration_minutes');
        });

        DB::table('services')
            ->whereNotNull('settings')
            ->get(['id', 'settings'])
            ->each(function (object $service): void {
                $settings = json_decode((string) $service->settings, true);
                $durationDisplayText = is_array($settings)
                    ? trim((string) ($settings['duration_display_text'] ?? ''))
                    : '';

                if ($durationDisplayText === '') {
                    return;
                }

                DB::table('services')
                    ->where('id', $service->id)
                    ->update(['duration_display_text' => $durationDisplayText]);
            });
    }

    public function down(): void
    {
        Schema::table('services', function (Blueprint $table): void {
            $table->dropColumn('duration_display_text');
        });
    }
};
