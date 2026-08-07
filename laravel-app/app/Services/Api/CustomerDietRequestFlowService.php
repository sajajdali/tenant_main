<?php

declare(strict_types=1);

namespace App\Services\Api;

use App\Domain\Tenant\Models\NutritionDietPrescription;
use App\Domain\Tenant\Models\NutritionDietRequest;
use App\Domain\Tenant\Models\NutritionDietTemplate;
use App\Domain\Tenant\Models\NutritionPackage;
use App\Domain\Tenant\Models\NutritionPackageSubscription;
use App\Domain\Tenant\Models\NutritionProfile;
use App\Domain\Tenant\Models\TenantUser;
use App\Services\NutritionDietRequestSettingsService;
use App\Services\NutritionPackagePaymentService;
use App\Support\NutritionMedicalConditionSupport;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

class CustomerDietRequestFlowService
{
    private const ACTIVE_REQUEST_STATUSES = ['sent', 'in_progress', 'not_sent'];

    private const FOLLOW_UP_ANSWER_KEYS = [
        'adherenceLevel',
        'weightOutcome',
        'sizeChange',
        'energyLevel',
        'satietyLevel',
        'cravingsLevel',
        'sleepQuality',
        'activityLevel',
        'dietDifficulty',
        'overallSatisfaction',
        'newDietPreference',
        'experiencedIssue',
        'foodPreference',
    ];

    public function __construct(
        private readonly NutritionPackagePaymentService $packages,
        private readonly CustomerNutritionProfileDataService $profileData,
        private readonly NutritionDietRequestSettingsService $settings,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function options(TenantUser $user): array
    {
        $context = $this->context($user);
        $subscription = $context['subscription'];
        $hasHistory = $context['hasHistory'];
        $profile = $context['profile'];
        $activeRequest = $context['activeRequest'];
        $profileCompleted = $profile !== null && $this->profileData->profileCompleted($profile);
        $baseReady = $profileCompleted
            && $subscription !== null
            && $activeRequest === null
            && ($hasHistory || $profile->mindset_completed_at !== null);

        return [
            'flowType' => $hasHistory ? 'follow_up' : 'first_diet',
            'hasDietHistory' => $hasHistory,
            'requiresFollowUpQuestions' => $hasHistory,
            'requirements' => [
                'profileCompleted' => $profileCompleted,
                'activePackage' => $subscription !== null,
                'mindsetCompleted' => $profile?->mindset_completed_at !== null,
                'hasActiveDietRequest' => $activeRequest !== null,
            ],
            'subscription' => $this->packages->serializeSubscription($subscription),
            'modes' => [
                $this->modeOption('ai', $subscription, $baseReady, $hasHistory),
                $this->modeOption('expert', $subscription, $baseReady, $hasHistory),
            ],
            'activeRequest' => $activeRequest ? $this->serializeActiveRequest($activeRequest) : null,
            'canChooseMode' => $baseReady,
            'nextStep' => $this->nextStep($profile, $profileCompleted, $subscription, $activeRequest, $hasHistory),
            'previewEndpoint' => '/api/v1/app/nutrition/diet-requests/preview',
            'confirmEndpoint' => '/api/v1/app/nutrition/diet-requests',
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function preview(TenantUser $user, array $payload): array
    {
        $context = $this->context($user);
        $profile = $context['profile'];
        $subscription = $context['subscription'];
        $hasHistory = $context['hasHistory'];
        $requestType = (string) $payload['requestType'];

        if (! $profile || ! $this->profileData->profileCompleted($profile)) {
            $this->fail('profile', __('api.nutrition.diet_request.profile_required'));
        }

        if ($context['activeRequest']) {
            $this->fail('request', __('api.nutrition.diet_request.active_request'));
        }

        if (! $hasHistory && ! $profile->mindset_completed_at) {
            $this->fail('mindset', __('api.nutrition.diet_request.mindset_required'));
        }

        if (! $subscription) {
            $this->fail('subscription', __('api.nutrition.diet_request.subscription_required'));
        }

        $remaining = $this->remainingForMode($subscription, $requestType);
        if ($remaining <= 0) {
            $this->fail(
                'subscription',
                $requestType === 'ai'
                    ? __('api.nutrition.diet_request.online_quota_exhausted')
                    : __('api.nutrition.diet_request.expert_quota_exhausted'),
            );
        }

        $template = $requestType === 'ai'
            ? $this->resolveTemplate($payload['nutritionDietTemplateId'] ?? null, ! $hasHistory, $profile)
            : null;

        if ($requestType === 'expert' && $this->hasActiveExpertPrescription($user)) {
            $this->fail('request', __('api.nutrition.diet_request.expert_prescription_active'));
        }

        $followUp = $hasHistory ? $this->followUpPayload($payload) : null;
        $effectiveWeight = $hasHistory
            ? (float) $followUp['currentWeightKg']
            : ($profile->weight_kg !== null ? (float) $profile->weight_kg : null);

        return [
            'flowType' => $hasHistory ? 'follow_up' : 'first_diet',
            'request' => [
                'requestType' => $requestType,
                'dietTemplate' => $template ? $this->serializeTemplate($template) : null,
                'expertDescription' => $this->nullableTrim($payload['expertDescription'] ?? null),
                'currentWeightKg' => $effectiveWeight,
                'dietGoal' => $profile->diet_goal,
                'followUp' => $followUp,
            ],
            'balance' => [
                'mode' => $requestType,
                'total' => $requestType === 'ai'
                    ? (int) $subscription->online_diet_total
                    : (int) $subscription->offline_diet_total,
                'used' => $requestType === 'ai'
                    ? (int) $subscription->online_diet_used
                    : (int) $subscription->offline_diet_used,
                'remaining' => $remaining,
                'remainingAfterConfirmation' => max(0, $remaining - 1),
            ],
            'subscription' => $this->packages->serializeSubscription($subscription),
            'canConfirm' => true,
            'confirmEndpoint' => '/api/v1/app/nutrition/diet-requests',
        ];
    }

    /**
     * @return array{
     *     profile: NutritionProfile|null,
     *     subscription: NutritionPackageSubscription|null,
     *     activeRequest: NutritionDietRequest|null,
     *     hasHistory: bool
     * }
     */
    private function context(TenantUser $user): array
    {
        return [
            'profile' => NutritionProfile::query()->where('user_id', $user->id)->first(),
            'subscription' => $this->packages->activeSubscriptionForUser($user),
            'activeRequest' => NutritionDietRequest::query()
                ->where('user_id', $user->id)
                ->whereIn('status', self::ACTIVE_REQUEST_STATUSES)
                ->latest('id')
                ->first(),
            'hasHistory' => NutritionDietPrescription::query()
                ->where('user_id', $user->id)
                ->exists(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function modeOption(
        string $mode,
        ?NutritionPackageSubscription $subscription,
        bool $baseReady,
        bool $hasHistory,
    ): array {
        $total = $subscription
            ? ($mode === 'ai' ? (int) $subscription->online_diet_total : (int) $subscription->offline_diet_total)
            : 0;
        $used = $subscription
            ? ($mode === 'ai' ? (int) $subscription->online_diet_used : (int) $subscription->offline_diet_used)
            : 0;
        $remaining = max(0, $total - $used);

        return [
            'key' => $mode,
            'included' => $total > 0,
            'total' => $total,
            'used' => $used,
            'remaining' => $remaining,
            'available' => $baseReady && $total > 0 && $remaining > 0,
            'nextStep' => $hasHistory
                ? '/nutrition/diet-followup/1'
                : ($mode === 'ai' && $this->autoFirstDietTemplateId($subscription) !== null
                    ? '/nutrition/diet-request/confirm'
                    : ($mode === 'ai' ? '/nutrition/select-diet' : '/nutrition/diet-request/expert')),
        ];
    }

    private function nextStep(
        ?NutritionProfile $profile,
        bool $profileCompleted,
        ?NutritionPackageSubscription $subscription,
        ?NutritionDietRequest $activeRequest,
        bool $hasHistory,
    ): ?string {
        return match (true) {
            $profile === null || ! $profileCompleted => '/nutrition/membership/goal',
            $subscription === null => '/nutrition/membership/packages?direct_buy=1',
            $activeRequest !== null => '/nutrition/profile',
            ! $hasHistory && $profile->mindset_completed_at === null => '/nutrition/membership/mindset/1',
            default => $this->autoFirstDietTemplateId($subscription) !== null
                ? '/nutrition/diet-request/confirm'
                : '/nutrition/diet-type',
        };
    }

    private function remainingForMode(NutritionPackageSubscription $subscription, string $mode): int
    {
        return $mode === 'ai'
            ? max(0, (int) $subscription->online_diet_total - (int) $subscription->online_diet_used)
            : max(0, (int) $subscription->offline_diet_total - (int) $subscription->offline_diet_used);
    }

    private function resolveTemplate(mixed $templateId, bool $isFirstDiet = false, ?NutritionProfile $profile = null): ?NutritionDietTemplate
    {
        if (! is_numeric($templateId) && $isFirstDiet) {
            $templateId = $this->autoFirstDietTemplateId(null, $profile);
        }

        if (! is_numeric($templateId)) {
            $this->fail('nutritionDietTemplateId', __('api.nutrition.diet_request.template_required'));
        }

        $template = NutritionDietTemplate::query()
            ->withCount('children')
            ->find((int) $templateId);

        if (! $template || ! $template->is_active || $template->children_count > 0) {
            $this->fail('nutritionDietTemplateId', __('api.nutrition.diet_request.template_invalid'));
        }

        return $template;
    }

    private function autoFirstDietTemplateId(?NutritionPackageSubscription $subscription = null, ?NutritionProfile $profile = null): ?int
    {
        if (! $this->settings->autoFirstDietEnabled()) {
            return null;
        }

        if ($subscription !== null && $this->remainingForMode($subscription, 'ai') <= 0) {
            return null;
        }

        $packageId = $subscription?->nutrition_package_id
            ?? ($profile?->selected_nutrition_package_id ? (int) $profile->selected_nutrition_package_id : null);
        $package = $packageId ? NutritionPackage::query()->find($packageId) : null;

        if ($package !== null && (int) $package->online_diet_count <= 0) {
            return null;
        }

        $mode = (string) ($package?->first_diet_template_mode ?? 'default');

        if ($mode === 'disabled') {
            return null;
        }

        $goal = in_array($profile?->diet_goal, ['lose-weight', 'gain-weight', 'maintain-weight'], true)
            ? (string) $profile->diet_goal
            : 'lose-weight';

        if ($mode === 'custom') {
            $templateIds = is_array($package?->first_diet_template_ids) ? $package->first_diet_template_ids : [];
            $templateId = $templateIds[$goal] ?? $package?->first_diet_template_id;

            return is_numeric($templateId) && (int) $templateId > 0 ? (int) $templateId : null;
        }

        return $this->settings->autoFirstDietTemplateIdForGoal($goal);
    }

    private function hasActiveExpertPrescription(TenantUser $user): bool
    {
        return NutritionDietPrescription::query()
            ->where('user_id', $user->id)
            ->where('is_current', true)
            ->where('status', 'active')
            ->where(function (Builder $query): void {
                $query->whereNull('ends_at')
                    ->orWhereDate('ends_at', '>', now()->toDateString());
            })
            ->whereHas('request', fn (Builder $query): Builder => $query->where('request_type', 'expert'))
            ->exists();
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function followUpPayload(array $payload): array
    {
        if (! isset($payload['currentWeightKg']) || ! is_numeric($payload['currentWeightKg'])) {
            $this->fail('currentWeightKg', __('api.nutrition.diet_request.current_weight_required'));
        }

        $medicalConditionItems = is_array($payload['repeatDietMedicalConditionsItems'] ?? null)
            ? NutritionMedicalConditionSupport::normalizeEntries($payload['repeatDietMedicalConditionsItems'])
            : [];
        $medicalNotes = $medicalConditionItems !== []
            ? NutritionMedicalConditionSupport::summarizeEntries($medicalConditionItems)
            : $this->nullableTrim($payload['repeatDietMedicalNotes'] ?? null);
        if ($medicalNotes === null) {
            $this->fail('repeatDietMedicalNotes', __('api.nutrition.diet_request.medical_notes_required'));
        }

        $answers = collect(is_array($payload['repeatDietFeedback'] ?? null) ? $payload['repeatDietFeedback'] : [])
            ->only(self::FOLLOW_UP_ANSWER_KEYS)
            ->map(fn (mixed $value): string => trim((string) $value))
            ->filter(fn (string $value): bool => $value !== '')
            ->all();

        if (count($answers) !== count(self::FOLLOW_UP_ANSWER_KEYS)) {
            $this->fail('repeatDietFeedback', __('api.nutrition.diet_request.feedback_required'));
        }

        return [
            'currentWeightKg' => round((float) $payload['currentWeightKg'], 2),
            'medicalNotes' => $medicalNotes,
            'medicalConditionsItems' => $medicalConditionItems,
            'answers' => $answers,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeTemplate(NutritionDietTemplate $template): array
    {
        return [
            'id' => (string) $template->id,
            'name' => $template->name,
            'prescriptionMode' => $template->prescription_mode,
            'durationDays' => (int) $template->duration_days,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeActiveRequest(NutritionDietRequest $request): array
    {
        return [
            'id' => (string) $request->id,
            'requestType' => $request->request_type,
            'status' => $request->status,
            'createdAt' => $request->created_at?->toIso8601String(),
        ];
    }

    private function nullableTrim(mixed $value): ?string
    {
        $trimmed = trim((string) $value);

        return $trimmed === '' ? null : $trimmed;
    }

    private function fail(string $field, string $message): never
    {
        throw ValidationException::withMessages([
            $field => [$message],
        ]);
    }
}
