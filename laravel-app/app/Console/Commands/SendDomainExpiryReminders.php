<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Tenant\Models\Tenant;
use App\Services\Sms\DomainExpiryReminderService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class SendDomainExpiryReminders extends Command
{
    protected $signature = 'domain:send-expiry-reminders';

    protected $description = 'Send managed-domain expiry reminder SMS messages for due tenants after 10 AM.';

    public function handle(DomainExpiryReminderService $service): int
    {
        $now = now()->timezone('Asia/Tehran');

        if ((int) $now->format('H') < 10) {
            $this->info('It is too early to send domain expiry reminders.');

            return self::SUCCESS;
        }

        $today = Carbon::parse($now->toDateString(), 'Asia/Tehran');
        $sent = 0;

        Tenant::query()
            ->where('status', 'active')
            ->where('domain_management_mode', 'platform_managed')
            ->where('managed_domain_registered', true)
            ->whereNotNull('managed_domain_renews_at')
            ->orderBy('id')
            ->chunkById(100, function ($tenants) use ($service, $today, &$sent): void {
                foreach ($tenants as $tenant) {
                    $sent += $service->sendDueReminders($tenant, $today);
                }
            });

        $this->info("Domain expiry reminders processed. Sent: {$sent}");

        return self::SUCCESS;
    }
}
