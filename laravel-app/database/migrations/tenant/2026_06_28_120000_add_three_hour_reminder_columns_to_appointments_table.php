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
        Schema::table('appointments', function (Blueprint $table): void {
            $table->dateTime('reminder_3h_due_at')->nullable()->after('reminder_locked_at');
            $table->dateTime('reminder_3h_sent_at')->nullable()->after('reminder_3h_due_at');
            $table->dateTime('reminder_3h_locked_at')->nullable()->after('reminder_3h_sent_at');
        });

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement('UPDATE appointments SET reminder_3h_due_at = DATE_SUB(starts_at, INTERVAL 3 HOUR) WHERE reminder_3h_due_at IS NULL AND starts_at IS NOT NULL');
        } elseif ($driver === 'sqlite') {
            DB::statement("UPDATE appointments SET reminder_3h_due_at = datetime(starts_at, '-3 hours') WHERE reminder_3h_due_at IS NULL AND starts_at IS NOT NULL");
        }

        Schema::table('appointments', function (Blueprint $table): void {
            $table->index(['reminder_3h_due_at', 'reminder_3h_sent_at', 'status'], 'appointments_reminder_3h_due_sent_idx');
            $table->index(['reminder_3h_locked_at'], 'appointments_reminder_3h_lock_idx');
        });
    }

    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table): void {
            $table->dropIndex('appointments_reminder_3h_due_sent_idx');
            $table->dropIndex('appointments_reminder_3h_lock_idx');
            $table->dropColumn(['reminder_3h_due_at', 'reminder_3h_sent_at', 'reminder_3h_locked_at']);
        });
    }
};
