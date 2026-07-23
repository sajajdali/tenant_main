<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Tenant\Models\Tenant;
use App\Jobs\QueueTenantAppointmentRemindersJob;
use Illuminate\Console\Command;

class QueueAppointmentReminders extends Command
{
    protected $signature = 'appointments:queue-reminders {--chunk=100} {--limit=500}';

    protected $description = 'Queue tenant-aware appointment reminder SMS jobs for due appointments.';

    public function handle(): int
    {
        $chunkSize = max(1, (int) $this->option('chunk'));
        $limit = max(1, (int) $this->option('limit'));
        $now = now()->timezone('Asia/Tehran')->toIso8601String();
        $queuedTenants = 0;

        Tenant::query()
            ->where('status', 'active')
            ->orderBy('id')
            ->chunkById($chunkSize, function ($tenants) use ($now, $limit, &$queuedTenants): void {
                foreach ($tenants as $tenant) {
                    QueueTenantAppointmentRemindersJob::dispatch((string) $tenant->id, $now, $limit);
                    $queuedTenants++;
                }
            });

        $this->info("Appointment reminder tenant jobs queued: {$queuedTenants}");

        return self::SUCCESS;
    }
}
