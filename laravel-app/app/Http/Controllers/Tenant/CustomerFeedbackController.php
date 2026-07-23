<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\CustomerFeedback\Models\CustomerFeedbackQuestion;
use App\Domain\CustomerFeedback\Models\CustomerFeedbackResponse;
use App\Http\Controllers\Controller;
use App\Services\CustomerFeedbackService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerFeedbackController extends Controller
{
    public function __construct(
        private readonly CustomerFeedbackService $service,
    ) {
    }

    public function show(Request $request): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);

        return response()->json([
            'success' => true,
            'data' => $this->service->settingsPayload(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);

        if (! $this->service->isModuleActive()) {
            return response()->json([
                'success' => false,
                'message' => __('tenant.customer_feedback.module_inactive'),
                'data' => $this->service->settingsPayload(),
            ], 422);
        }

        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'emojiLabels' => ['required', 'array'],
            'emojiLabels.excellent' => ['required', 'string', 'max:80'],
            'emojiLabels.good' => ['required', 'string', 'max:80'],
            'emojiLabels.average' => ['required', 'string', 'max:80'],
            'emojiLabels.bad' => ['required', 'string', 'max:80'],
            'audienceScope' => ['required', 'in:all,professional'],
            'professionalIds' => ['nullable', 'array'],
            'professionalIds.*' => ['integer', 'exists:professionals,id'],
            'firstSendDelayDays' => ['required', 'integer', 'min:1', 'max:365'],
            'triggerAfterCompletedCount' => ['required', 'integer', 'min:1', 'max:10'],
            'maxResponsesPerCustomer' => ['required', 'integer', 'min:1', 'max:20'],
            'surveyTitle' => ['required', 'string', 'max:255'],
            'introText' => ['required', 'string', 'max:2000'],
            'successText' => ['required', 'string', 'max:2000'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->service->updateSettings($validated),
            'message' => __('tenant.customer_feedback.settings_saved'),
        ]);
    }

    public function storeQuestion(Request $request): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'displayType' => ['required', 'in:emoji,star'],
            'sortOrder' => ['nullable', 'integer', 'min:0', 'max:999'],
            'isActive' => ['nullable', 'boolean'],
        ]);

        $question = CustomerFeedbackQuestion::query()->create([
            'title' => $validated['title'],
            'display_type' => $validated['displayType'],
            'sort_order' => (int) ($validated['sortOrder'] ?? 0),
            'is_active' => (bool) ($validated['isActive'] ?? true),
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => (string) $question->id,
                'title' => $question->title,
                'displayType' => $question->display_type ?: 'emoji',
                'sortOrder' => (int) $question->sort_order,
                'isActive' => (bool) $question->is_active,
            ],
            'message' => __('tenant.customer_feedback.question_created'),
        ]);
    }

    public function updateQuestion(Request $request, CustomerFeedbackQuestion $question): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'displayType' => ['required', 'in:emoji,star'],
            'sortOrder' => ['nullable', 'integer', 'min:0', 'max:999'],
            'isActive' => ['nullable', 'boolean'],
        ]);

        $question->update([
            'title' => $validated['title'],
            'display_type' => $validated['displayType'],
            'sort_order' => (int) ($validated['sortOrder'] ?? 0),
            'is_active' => (bool) ($validated['isActive'] ?? true),
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => (string) $question->id,
                'title' => $question->title,
                'displayType' => $question->display_type ?: 'emoji',
                'sortOrder' => (int) $question->sort_order,
                'isActive' => (bool) $question->is_active,
            ],
            'message' => __('tenant.customer_feedback.question_updated'),
        ]);
    }

    public function destroyQuestion(Request $request, CustomerFeedbackQuestion $question): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);
        $question->delete();

        return response()->json([
            'success' => true,
            'data' => true,
            'message' => __('tenant.customer_feedback.question_deleted'),
        ]);
    }

    public function publicShow(string $token): JsonResponse
    {
        $payload = $this->service->publicPayload($token);
        abort_unless($payload !== null, 404);

        return response()->json([
            'success' => true,
            'data' => $payload,
        ]);
    }

    public function publicSubmit(Request $request, string $token): JsonResponse
    {
        $validated = $request->validate([
            'answers' => ['required', 'array', 'min:1'],
            'answers.*.questionId' => ['required', 'integer'],
            'answers.*.choiceKey' => ['nullable', 'string', 'max:32'],
            'answers.*.value' => ['required', 'integer', 'min:1', 'max:5'],
        ]);

        return response()->json(
            $this->service->submitPublicResponse($token, $validated['answers'])
        );
    }

    public function report(Request $request): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);

        return response()->json([
            'success' => true,
            'data' => $this->service->reportPayload(),
        ]);
    }

    public function reportResponse(Request $request, CustomerFeedbackResponse $response): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);

        return response()->json([
            'success' => true,
            'data' => $this->service->reportResponsePayload($response),
        ]);
    }

    private function abortUnlessTenantAdmin(Request $request)
    {
        $user = $request->user('tenant_web');
        abort_unless($user?->role === 'admin', 403, __('authorization.primary_admin_section'));

        return $user;
    }
}
