<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Tenant\Models\NutritionDietPrescription;
use App\Domain\Tenant\Models\NutritionDietRequest;
use App\Domain\Tenant\Models\Tenant;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

class ExpireOfflineNutritionDiets extends Command
{
    protected $signature = 'nutrition:expire-offline-diets';

    protected $description = 'Mark expired offline nutrition diets as completed for all tenant nutrition audiences.';

    public function handle(): int
    {
        $today = now()->toDateString();
        $updatedPrescriptions = 0;
        $updatedRequests = 0;

        Tenant::query()->orderBy('id')->chunk(100, function ($tenants) use ($today, &$updatedPrescriptions, &$updatedRequests): void {
            foreach ($tenants as $tenant) {
                $tenant->run(function () use ($today, &$updatedPrescriptions, &$updatedRequests): void {
                    if (! Schema::hasTable('nutrition_diet_prescriptions') || ! Schema::hasTable('nutrition_diet_requests')) {
                        return;
                    }

                    NutritionDietPrescription::query()
                        ->with(['request:id,request_type,status'])
                        ->where('is_current', true)
                        ->where('status', 'active')
                        ->whereDate('ends_at', '<', $today)
                        ->whereHas('request', function ($query): void {
                            $query->where('request_type', 'expert');
                        })
                        ->chunkById(100, function ($items) use (&$updatedPrescriptions, &$updatedRequests): void {
                            foreach ($items as $prescription) {
                                $prescription->forceFill([
                                    'status' => 'completed',
                                    'is_current' => false,
                                ])->save();
                                $updatedPrescriptions++;

                                if ($prescription->request instanceof NutritionDietRequest && $prescription->request->status !== 'finished') {
                                    $prescription->request->forceFill([
                                        'status' => 'finished',
                                    ])->save();
                                    $updatedRequests++;
                                }
                            }
                        });
                });
            }
        });

        $this->info("Expired offline nutrition diets processed. Prescriptions: {$updatedPrescriptions}, Requests: {$updatedRequests}");

        return self::SUCCESS;
    }
}
