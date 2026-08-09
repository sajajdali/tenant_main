<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Tenant\Models\Tenant;
use App\Services\NutritionMealLogReminderService;
use Illuminate\Console\Command;

class QueueNutritionMealLogReminders extends Command
{
    protected $signature = 'nutrition:queue-meal-log-reminders {--chunk=100} {--limit=200}';

    protected $description = 'Queue approved SMS reminders for active diet users with no meal logs for three days.';

    public function handle(NutritionMealLogReminderService $service): int
    {
        $chunkSize = max(1, (int) $this->option('chunk'));
        $limit = max(1, (int) $this->option('limit'));
        $queued = 0;
        $tenantsChecked = 0;

        Tenant::query()
            ->where('status', 'active')
            ->orderBy('id')
            ->chunkById($chunkSize, function ($tenants) use ($service, $limit, &$queued, &$tenantsChecked): void {
                foreach ($tenants as $tenant) {
                    $tenant->run(function () use ($service, $limit, &$queued): void {
                        $queued += $service->queueDueReminders($limit);
                    });
                    $tenantsChecked++;
                }
            });

        $this->info("Nutrition meal-log reminder SMS queued: {$queued}; tenants checked: {$tenantsChecked}");

        return self::SUCCESS;
    }
}
