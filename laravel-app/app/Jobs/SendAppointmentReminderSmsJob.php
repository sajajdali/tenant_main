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

class SendAppointmentReminderSmsJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public string $reminderType = AppointmentReminderService::TYPE_24_HOURS;

    public function __construct(
        public readonly string $tenantId,
        public readonly int $appointmentId,
        ?string $reminderType = null,
    ) {
        $this->reminderType = $reminderType ?? AppointmentReminderService::TYPE_24_HOURS;
        $this->onQueue(SmsQueue::TRANSACTIONAL);
    }

    public function handle(AppointmentReminderService $reminders): void
    {
        $tenant = Tenant::query()->find($this->tenantId);

        if (! $tenant) {
            return;
        }

        $tenant->run(function () use ($reminders): void {
            $reminders->sendDueReminder($this->appointmentId, $this->reminderType);
        });
    }
}
