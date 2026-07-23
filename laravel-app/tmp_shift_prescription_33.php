<?php

declare(strict_types=1);

use App\Domain\Tenant\Models\NutritionDietPrescription;
use App\Domain\Tenant\Models\NutritionDietRequest;
use App\Domain\Tenant\Models\Tenant;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

$tenantId = '9c30b886-534c-44c5-859e-15512eefb637';
$shift = 8;

$shiftDate = static function ($value) use ($shift) {
    if (! $value) {
        return null;
    }

    return Carbon::parse($value)->subDays($shift);
};

$tenant = Tenant::query()->findOrFail($tenantId);

$tenant->run(function () use ($shiftDate): void {
    DB::transaction(function () use ($shiftDate): void {
        $prescription = NutritionDietPrescription::query()->findOrFail(33);
        $request = NutritionDietRequest::query()->findOrFail($prescription->nutrition_diet_request_id);

        $prescription->forceFill([
            'started_at' => $shiftDate($prescription->started_at)?->toDateString(),
            'ends_at' => $shiftDate($prescription->ends_at)?->toDateString(),
            'published_at' => $shiftDate($prescription->published_at),
            'created_at' => $shiftDate($prescription->created_at),
            'updated_at' => $shiftDate($prescription->updated_at),
        ])->save();

        $request->forceFill([
            'started_at' => $shiftDate($request->started_at),
            'ends_at' => $shiftDate($request->ends_at),
            'ai_requested_at' => $shiftDate($request->ai_requested_at),
            'ai_generated_at' => $shiftDate($request->ai_generated_at),
            'created_at' => $shiftDate($request->created_at),
            'updated_at' => $shiftDate($request->updated_at),
        ])->save();

        DB::table('nutrition_meal_logs')
            ->where('nutrition_diet_prescription_id', $prescription->id)
            ->orderBy('id')
            ->get()
            ->each(function (object $log) use ($shiftDate): void {
                DB::table('nutrition_meal_logs')
                    ->where('id', $log->id)
                    ->update([
                        'consumed_date' => $shiftDate($log->consumed_date)?->toDateString(),
                        'consumed_at' => $shiftDate($log->consumed_at),
                        'created_at' => $shiftDate($log->created_at),
                        'updated_at' => $shiftDate($log->updated_at),
                    ]);
            });

        DB::table('nutrition_water_logs')
            ->where('nutrition_diet_prescription_id', $prescription->id)
            ->orderBy('id')
            ->get()
            ->each(function (object $log) use ($shiftDate): void {
                DB::table('nutrition_water_logs')
                    ->where('id', $log->id)
                    ->update([
                        'consumed_date' => $shiftDate($log->consumed_date)?->toDateString(),
                        'consumed_at' => $shiftDate($log->consumed_at),
                        'created_at' => $shiftDate($log->created_at),
                        'updated_at' => $shiftDate($log->updated_at),
                    ]);
            });

        dump([
            'prescription_id' => $prescription->id,
            'request_id' => $request->id,
            'started_at' => optional($prescription->fresh()->started_at)->toDateString(),
            'ends_at' => optional($prescription->fresh()->ends_at)->toDateString(),
            'meal_logs' => DB::table('nutrition_meal_logs')->where('nutrition_diet_prescription_id', $prescription->id)->count(),
            'water_logs' => DB::table('nutrition_water_logs')->where('nutrition_diet_prescription_id', $prescription->id)->count(),
        ]);
    });
});
