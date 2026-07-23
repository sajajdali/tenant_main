<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Tenant\Models\Tenant;
use App\Services\Sms\SupportExpiryReminderService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class SendSupportExpiryReminders extends Command
{
    protected $signature = 'support:send-expiry-reminders';

    protected $description = 'Send support package expiry reminder SMS messages for due tenants after 10 AM.';

    public function handle(SupportExpiryReminderService $service): int
    {
        $now = now()->timezone('Asia/Tehran');

        if ((int) $now->format('H') < 10) {
            $this->info('It is too early to send support expiry reminders.');

            return self::SUCCESS;
        }

        $today = Carbon::parse($now->toDateString(), 'Asia/Tehran');
        $sent = 0;

        Tenant::query()
            ->whereNotNull('support_ends_at')
            ->where('status', 'active')
            ->orderBy('id')
            ->chunkById(100, function ($tenants) use ($service, $today, &$sent): void {
                foreach ($tenants as $tenant) {
                    $sent += $service->sendDueReminders($tenant, $today);
                }
            });

        $this->info("Support expiry reminders processed. Sent: {$sent}");

        return self::SUCCESS;
    }
}
