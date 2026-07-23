<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\NutritionDietRequest;
use App\Events\NutritionDietRequestUpdated;
use App\Http\Controllers\Controller;
use App\Jobs\GenerateNutritionAiPrescriptionJob;
use App\Services\NutritionAiDietGenerationService;
use App\Support\TenantAudienceScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NutritionAiDietRequestController extends Controller
{
    public function __construct(
        private readonly NutritionAiDietGenerationService $generation,
    ) {
    }

    public function queue(Request $request, NutritionDietRequest $nutritionDietRequest): JsonResponse
    {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);

        $actor = $request->user('tenant_web');
        abort_unless($actor?->role === 'admin', 403, __('authorization.nutrition_admin_section'));

        $validated = $request->validate([
            'expertNotes' => ['nullable', 'string', 'max:5000'],
            'clinicalNotes' => ['nullable', 'string', 'max:5000'],
            'generationInstructions' => ['nullable', 'string', 'max:12000'],
            'mustInclude' => ['nullable', 'string', 'max:5000'],
            'mustAvoid' => ['nullable', 'string', 'max:5000'],
        ]);

        $dietRequest = $this->generation->queue($nutritionDietRequest, $actor, $validated);
        GenerateNutritionAiPrescriptionJob::dispatch((string) tenant('id'), (int) $dietRequest->id);

        return response()->json([
            'success' => true,
            'message' => __('tenant.nutrition.ai_request_queued'),
            'data' => [
                'requestId' => (string) $dietRequest->id,
                'aiGenerationStatus' => $dietRequest->ai_generation_status,
            ],
        ]);
    }

    public function cancel(Request $request, NutritionDietRequest $nutritionDietRequest): JsonResponse
    {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);

        $actor = $request->user('tenant_web');
        abort_unless($actor?->role === 'admin', 403, __('authorization.nutrition_admin_section'));

        $hasCurrentPrescription = $nutritionDietRequest->prescriptions()
            ->where('is_current', true)
            ->exists();

        $nutritionDietRequest->forceFill([
            'ai_generation_status' => 'cancelled',
            'ai_generation_error' => null,
            'status' => $hasCurrentPrescription ? 'finished' : 'sent',
        ])->save();

        event(NutritionDietRequestUpdated::fromRequest((string) tenant('id'), $nutritionDietRequest->fresh()));

        return response()->json([
            'success' => true,
            'message' => __('tenant.nutrition.ai_revision_cancelled'),
            'data' => [
                'requestId' => (string) $nutritionDietRequest->id,
                'aiGenerationStatus' => $nutritionDietRequest->ai_generation_status,
            ],
        ]);
    }
}
