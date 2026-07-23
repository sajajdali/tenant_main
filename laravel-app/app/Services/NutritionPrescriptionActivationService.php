<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\NutritionDietPrescription;

class NutritionPrescriptionActivationService
{
    public function archiveOtherCurrentPrescriptions(int $userId, ?int $exceptPrescriptionId = null): void
    {
        NutritionDietPrescription::query()
            ->where('user_id', $userId)
            ->where('is_current', true)
            ->when(
                $exceptPrescriptionId !== null,
                fn ($query) => $query->where('id', '!=', $exceptPrescriptionId),
            )
            ->lockForUpdate()
            ->get()
            ->each(function (NutritionDietPrescription $prescription): void {
                $prescription->forceFill([
                    'is_current' => false,
                    'status' => 'archived',
                ])->save();
            });
    }
}
