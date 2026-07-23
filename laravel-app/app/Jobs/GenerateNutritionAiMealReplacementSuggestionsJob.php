<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Tenant\Models\NutritionMealReplacementSuggestion;
use App\Domain\Tenant\Models\Tenant;
use App\Events\NutritionMealReplacementSuggestionUpdated;
use App\Services\NutritionAiMealReplacementGenerationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class GenerateNutritionAiMealReplacementSuggestionsJob implements ShouldQueue
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
        public readonly int $suggestionId,
    ) {
        $this->onQueue('nutrition-ai');
    }

    public function handle(NutritionAiMealReplacementGenerationService $service): void
    {
        $tenant = Tenant::query()->find($this->tenantId);

        if (! $tenant) {
            return;
        }

        $tenant->run(function () use ($service): void {
            $service->handle($this->suggestionId);
        });
    }

    public function failed(Throwable $exception): void
    {
        $tenant = Tenant::query()->find($this->tenantId);

        if (! $tenant) {
            return;
        }

        $tenant->run(function () use ($exception): void {
            $suggestion = NutritionMealReplacementSuggestion::query()->find($this->suggestionId);

            if (! $suggestion || $suggestion->status === 'cancelled') {
                return;
            }

            $suggestion->forceFill([
                'status' => 'failed',
                'error_message' => $exception->getMessage() !== ''
                    ? $exception->getMessage()
                    : 'زمان پردازش job جایگزین‌های غذا به پایان رسید یا worker متوقف شد.',
            ])->save();

            event(NutritionMealReplacementSuggestionUpdated::fromSuggestion((string) $this->tenantId, $suggestion->fresh()));
        });
    }
}
