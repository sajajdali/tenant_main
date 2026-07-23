<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Events\NutritionDietRequestUpdated;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\NutritionDietRequest;
use App\Services\NutritionAiDietGenerationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class GenerateNutritionAiPrescriptionJob implements ShouldQueue
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
        public readonly int $dietRequestId,
    ) {
        $this->onQueue('nutrition-ai');
    }

    public function handle(NutritionAiDietGenerationService $service): void
    {
        $tenant = Tenant::query()->find($this->tenantId);

        if (! $tenant) {
            return;
        }

        $tenant->run(function () use ($service): void {
            $service->handle($this->dietRequestId);
        });
    }

    public function failed(Throwable $exception): void
    {
        $tenant = Tenant::query()->find($this->tenantId);

        if (! $tenant) {
            return;
        }

        $tenant->run(function () use ($exception): void {
            $request = NutritionDietRequest::query()->find($this->dietRequestId);

            if (! $request) {
                return;
            }

            $request->forceFill([
                'ai_generation_status' => 'failed',
                'ai_generation_error' => $exception->getMessage() !== ''
                    ? $exception->getMessage()
                    : 'زمان پردازش job رژیم AI به پایان رسید یا worker متوقف شد.',
                'status' => $request->prescriptions()->where('is_current', true)->exists() ? 'finished' : 'sent',
            ])->save();

            event(NutritionDietRequestUpdated::fromRequest((string) $this->tenantId, $request->fresh()));
        });
    }
}
