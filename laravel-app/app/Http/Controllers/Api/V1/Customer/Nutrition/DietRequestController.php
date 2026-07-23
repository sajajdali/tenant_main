<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Customer\Nutrition;

use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\NutritionDietRequestController as LegacyNutritionDietRequestController;
use App\Services\Api\CustomerDietRequestFlowService;
use App\Support\NutritionMedicalConditionSupport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DietRequestController extends Controller
{
    public function __construct(
        private readonly LegacyNutritionDietRequestController $dietRequests,
        private readonly CustomerDietRequestFlowService $flow,
    ) {}

    public function options(Request $request): JsonResponse
    {
        $user = $this->ensureNutritionAccess($request);

        return response()->json([
            'success' => true,
            'message' => null,
            'data' => $this->flow->options($user),
            'meta' => (object) [],
        ]);
    }

    public function preview(Request $request): JsonResponse
    {
        $user = $this->ensureNutritionAccess($request);
        $validated = $this->validateRequestPayload($request);

        return response()->json([
            'success' => true,
            'message' => __('api.nutrition.diet_request.preview_ready'),
            'data' => $this->flow->preview($user, $validated),
            'meta' => (object) [],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $this->ensureNutritionAccess($request);

        $legacyResponse = $this->dietRequests->index($request);
        $body = $legacyResponse->getData(true);

        if (is_array($body['data']['items'] ?? null)) {
            $body['data']['items'] = collect($body['data']['items'])
                ->filter(fn (mixed $item): bool => is_array($item))
                ->map(fn (array $item): array => $this->requestSummary($item))
                ->values()
                ->all();
        }

        return $this->appResponse($body, $legacyResponse->getStatusCode());
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->ensureNutritionAccess($request);
        $validated = $this->validateRequestPayload($request);

        // Run the same read-only eligibility checks shown by preview immediately
        // before the transactional legacy command performs its locked recheck.
        $preview = $this->flow->preview($user, $validated);

        if (($preview['flowType'] ?? null) === 'first_diet') {
            unset(
                $validated['currentWeightKg'],
                $validated['repeatDietFeedback'],
                $validated['repeatDietMedicalNotes'],
                $validated['repeatDietMedicalConditionsItems'],
            );
        }

        $request->merge([
            'nutrition_diet_template_id' => $validated['nutritionDietTemplateId'] ?? null,
            'request_type' => $validated['requestType'],
            'expert_description' => $validated['expertDescription'] ?? null,
            'current_weight_kg' => $validated['currentWeightKg'] ?? null,
            'repeat_diet_feedback' => $validated['repeatDietFeedback'] ?? null,
            'repeat_diet_medical_notes' => $validated['repeatDietMedicalNotes'] ?? null,
            'repeat_diet_medical_conditions_items' => $validated['repeatDietMedicalConditionsItems'] ?? null,
        ]);

        $legacyResponse = $this->dietRequests->store($request);
        $body = $legacyResponse->getData(true);

        if (is_array($body['data']['request'] ?? null)) {
            $body['data']['request'] = $this->requestSummary($body['data']['request']);
        }

        return $this->appResponse($body, $legacyResponse->getStatusCode());
    }

    /**
     * @return array<string, mixed>
     */
    private function validateRequestPayload(Request $request): array
    {
        $validated = $request->validate([
            'requestType' => ['required', Rule::in(['ai', 'expert'])],
            'nutritionDietTemplateId' => ['nullable', 'integer'],
            'expertDescription' => ['nullable', 'string'],
            'currentWeightKg' => ['nullable', 'numeric', 'min:20', 'max:350'],
            'repeatDietFeedback' => ['nullable', 'array'],
            'repeatDietFeedback.*' => ['nullable', 'string', 'max:255'],
            'repeatDietMedicalNotes' => ['nullable', 'string'],
            'repeatDietMedicalConditionsItems' => ['nullable', 'array'],
            'repeatDietMedicalConditionsItems.*.id' => ['nullable', 'string', 'max:120'],
            'repeatDietMedicalConditionsItems.*.title' => ['required_with:repeatDietMedicalConditionsItems', 'string', 'max:255'],
            'repeatDietMedicalConditionsItems.*.status' => ['nullable', Rule::in(['current', 'past', 'temporary'])],
            'repeatDietMedicalConditionsItems.*.startedAt' => ['nullable', 'date'],
            'repeatDietMedicalConditionsItems.*.endedAt' => ['nullable', 'date'],
            'repeatDietMedicalConditionsItems.*.ongoing' => ['nullable', 'boolean'],
            'repeatDietMedicalConditionsItems.*.notes' => ['nullable', 'string', 'max:1000'],
        ]);

        if (array_key_exists('repeatDietMedicalConditionsItems', $validated)) {
            $items = NutritionMedicalConditionSupport::normalizeEntries($validated['repeatDietMedicalConditionsItems'] ?? []);
            $validated['repeatDietMedicalConditionsItems'] = $items;
            $validated['repeatDietMedicalNotes'] = NutritionMedicalConditionSupport::summarizeEntries($items) ?? ($validated['repeatDietMedicalNotes'] ?? null);
        }

        if ($validated['requestType'] === 'ai') {
            unset($validated['expertDescription']);
        } else {
            unset($validated['nutritionDietTemplateId']);
        }

        return $validated;
    }

    private function ensureNutritionAccess(Request $request): TenantUser
    {
        /** @var TenantUser|null $user */
        $user = $request->user();
        abort_unless($user, 401);

        if (! $user->can_book) {
            abort(423, __('api.nutrition.access_locked'));
        }

        return $user;
    }

    /**
     * @param  array<string, mixed>  $body
     */
    private function appResponse(array $body, int $status): JsonResponse
    {
        return response()->json([
            'success' => (bool) ($body['success'] ?? false),
            'message' => $body['message'] ?? null,
            'data' => is_array($body['data'] ?? null) ? $body['data'] : [],
            'meta' => ! empty($body['meta']) && is_array($body['meta']) ? $body['meta'] : (object) [],
        ], $status);
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array<string, mixed>
     */
    private function requestSummary(array $item): array
    {
        return [
            'id' => isset($item['id']) ? (string) $item['id'] : null,
            'requestType' => $item['requestType'] ?? null,
            'requestTypeLabel' => $item['requestTypeLabel'] ?? null,
            'status' => $item['status'] ?? null,
            'statusLabel' => $item['statusLabel'] ?? null,
            'dietTemplateId' => isset($item['dietTemplateId']) ? (string) $item['dietTemplateId'] : null,
            'dietTemplateName' => $item['dietTemplateName'] ?? null,
            'currentWeightKg' => isset($item['currentWeightKg']) ? (float) $item['currentWeightKg'] : null,
            'startedAt' => $item['startedAt'] ?? null,
            'endsAt' => $item['endsAt'] ?? null,
            'createdAt' => $item['createdAt'] ?? null,
            'aiGenerationStatus' => $item['aiGenerationStatus'] ?? null,
        ];
    }
}
