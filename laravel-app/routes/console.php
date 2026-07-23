<?php

use App\Domain\Tenant\Models\DiscountCodeRedemption;
use App\Services\SalesTrackingService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('sales:backfill-tracking', function (SalesTrackingService $salesTracking) {
    $count = 0;

    DiscountCodeRedemption::query()
        ->with([
            'discountCode.salesUser',
            'landingCustomer',
            'landingOrder',
            'landingOrderPayment',
            'tenantSubscriptionPayment.tenant',
        ])
        ->orderBy('id')
        ->chunk(100, function ($items) use ($salesTracking, &$count): void {
            foreach ($items as $item) {
                $salesTracking->backfillFromRedemption($item);
                $count++;
            }
        });

    $this->info("Sales tracking backfilled for {$count} redemptions.");
})->purpose('Backfill sales assignments and commission ledger from existing discount code redemptions');

Schedule::command('support:send-expiry-reminders')
    ->timezone('Asia/Tehran')
    ->dailyAt('10:05')
    ->withoutOverlapping();

Schedule::command('domain:send-expiry-reminders')
    ->timezone('Asia/Tehran')
    ->dailyAt('10:10')
    ->withoutOverlapping();

Schedule::command('feedback:send-invitations')
    ->timezone('Asia/Tehran')
    ->everyTenMinutes()
    ->withoutOverlapping();

Schedule::command('appointments:queue-reminders')
    ->timezone('Asia/Tehran')
    ->everyFiveMinutes()
    ->withoutOverlapping();

Schedule::command('nutrition:expire-offline-diets')
    ->timezone('Asia/Tehran')
    ->dailyAt('00:10')
    ->withoutOverlapping();
