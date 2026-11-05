<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Tenant\Models\NutritionDietPrescription;
use App\Domain\Tenant\Models\NutritionDietRequest;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantUser;
use App\Services\CustomerClubRewardRuleEngine;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

class ExpireOfflineNutritionDiets extends Command
{
    protected $signature = 'nutrition:expire-offline-diets';

    protected $description = 'Mark expired offline nutrition diets as completed for all tenant nutrition audiences.';

    public function __construct(private readonly CustomerClubRewardRuleEngine $rewardRules)
    {
        parent::__construct();
    }

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

                                // Completing a diet is a real customer event.
                                // It is evaluated after the status transition so
                                // a retried scheduler run cannot create another
                                // award for the same prescription.
                                $customer = TenantUser::query()->find($prescription->user_id);
                                if ($customer) {
                                    $this->rewardRules->handle(
                                        'nutrition.diet.completed',
                                        $customer,
                                        'nutrition_diet_prescription',
                                        (string) $prescription->id,
                                        [
                                            'nutrition_diet_prescription_id' => $prescription->id,
                                            'nutrition_diet_request_id' => $prescription->nutrition_diet_request_id,
                                        ],
                                    );
                                }

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
