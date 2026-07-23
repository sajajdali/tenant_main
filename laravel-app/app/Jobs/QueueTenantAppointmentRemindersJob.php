<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Tenant\Models\Tenant;
use App\Services\AppointmentReminderService;
use App\Support\SmsQueue;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;

class QueueTenantAppointmentRemindersJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly string $tenantId,
        public readonly string $now,
        public readonly int $limit = 500,
    ) {
        $this->onQueue(SmsQueue::TRANSACTIONAL);
    }

    public function handle(AppointmentReminderService $reminders): void
    {
        $tenant = Tenant::query()->find($this->tenantId);

        if (! $tenant) {
            return;
        }

        $tenant->run(function () use ($reminders): void {
            $reminders->queueDueReminderJobs(
                $this->tenantId,
                Carbon::parse($this->now),
                $this->limit,
            );
        });
    }
}
