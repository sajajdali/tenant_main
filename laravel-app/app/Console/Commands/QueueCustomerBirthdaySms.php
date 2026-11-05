<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Tenant\Models\Tenant;
use App\Services\CustomerBirthdaySmsService;
use Illuminate\Console\Command;

class QueueCustomerBirthdaySms extends Command
{
    protected $signature = 'customer-club:queue-birthday-sms {--chunk=100}';

    protected $description = 'Queue SHSMS birthday templates for all active customers whose birthday is today.';

    public function handle(CustomerBirthdaySmsService $service): int
    {
        $chunkSize = max(1, (int) $this->option('chunk'));
        $queued = 0;
        $tenantsChecked = 0;

        Tenant::query()
            ->where('status', 'active')
            ->orderBy('id')
            ->chunkById($chunkSize, function ($tenants) use ($service, $chunkSize, &$queued, &$tenantsChecked): void {
                foreach ($tenants as $tenant) {
                    $tenant->run(function () use ($service, $chunkSize, &$queued): void {
                        $queued += $service->queueTodaysMessages($chunkSize);
                    });
                    $tenantsChecked++;
                }
            });

        $this->info("Customer birthday SMS queued: {$queued}; tenants checked: {$tenantsChecked}");

        return self::SUCCESS;
    }
}
