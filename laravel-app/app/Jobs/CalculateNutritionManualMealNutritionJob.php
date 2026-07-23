<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Tenant\Models\Tenant;
use App\Services\NutritionAiManualMealNutritionService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Throwable;

class CalculateNutritionManualMealNutritionJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $timeout = 900;
    public bool $failOnTimeout = true;
    public int $tries = 1;

    public function __construct(
        public readonly string $tenantId,
        public readonly int $mealLogId,
    ) {
        $this->onQueue('nutrition-ai');
    }

    public function handle(NutritionAiManualMealNutritionService $service): void
    {
        $tenant = Tenant::query()->find($this->tenantId);

        if (! $tenant) {
            return;
        }

        $tenant->run(function () use ($service): void {
            $service->handle($this->mealLogId);
        });
    }

    public function failed(Throwable $exception): void
    {
        $tenant = Tenant::query()->find($this->tenantId);

        if (! $tenant) {
            return;
        }

        $tenant->run(function () use ($exception): void {
            DB::table('nutrition_meal_logs')
                ->where('id', $this->mealLogId)
                ->where('consumption_type', 'manual')
                ->whereIn('ai_nutrition_status', ['queued', 'processing'])
                ->update([
                    'ai_nutrition_status' => 'failed',
                    'ai_nutrition_error' => $exception->getMessage() !== ''
                        ? $exception->getMessage()
                        : 'زمان محاسبه ارزش غذایی با AI به پایان رسید یا worker متوقف شد.',
                    'updated_at' => now(),
                ]);
        });
    }
}
