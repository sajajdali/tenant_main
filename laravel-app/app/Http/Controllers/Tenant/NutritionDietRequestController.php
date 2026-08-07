<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\NutritionDietRequest;
use App\Domain\Tenant\Models\NutritionDietPrescription;
use App\Domain\Tenant\Models\NutritionDietTemplate;
use App\Domain\Tenant\Models\NutritionMealReplacementSuggestion;
use App\Domain\Tenant\Models\NutritionPackage;
use App\Domain\Tenant\Models\NutritionPackageSubscription;
use App\Domain\Tenant\Models\NutritionProfile;
use App\Domain\Tenant\Models\TenantUser;
use App\Events\NutritionDietRequestUpdated;
use App\Http\Controllers\Controller;
use App\Jobs\GenerateNutritionAiPrescriptionJob;
use App\Services\NutritionAiDietGenerationService;
use App\Services\NutritionAiMealReplacementGenerationService;
use App\Services\NutritionCustomerClubRewardService;
use App\Services\NutritionDietNotificationService;
use App\Services\NutritionDietRequestSettingsService;
use App\Services\NutritionPrescriptionCompletenessService;
use App\Services\NutritionPrescriptionActivationService;
use App\Services\NutritionTokenService;
use App\Support\NutritionMedicalConditionSupport;
use App\Support\TenantAudienceScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class NutritionDietRequestController extends Controller
{
    private const DIET_BASIS_LABELS = [
        'general' => 'عمومی',
        'medical' => 'درمانی',
        'sport' => 'ورزشی',
        'pregnancy' => 'بارداری',
        'exchange' => 'واحدی (Exchange)',
        'calorie' => 'مبتنی بر کالری',
        'macros' => 'مبتنی بر ماکرو',
        'fasting' => 'فستینگ',
        'food-based' => 'مبتنی بر نوع غذا',
        'glycemic-index' => 'شاخص گلایسمی',
    ];

    private const ACTIVE_REQUEST_STATUSES = ['sent', 'in_progress', 'not_sent'];

    public function __construct(
        private readonly NutritionAiDietGenerationService $aiGeneration,
        private readonly NutritionAiMealReplacementGenerationService $mealReplacementGeneration,
        private readonly NutritionCustomerClubRewardService $customerClubRewards,
        private readonly NutritionDietRequestSettingsService $settings,
        private readonly NutritionPrescriptionCompletenessService $completeness,
        private readonly NutritionPrescriptionActivationService $prescriptionActivation,
        private readonly NutritionDietNotificationService $notifications,
        private readonly NutritionTokenService $tokens,
    ) {
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->user();
        abort_unless($user, 401);

        $validated = $request->validate([
            'nutrition_diet_template_id' => ['nullable', 'integer', 'exists:nutrition_diet_templates,id'],
            'request_type' => ['required', 'in:ai,expert'],
            'expert_description' => ['nullable', 'string'],
            'current_weight_kg' => ['nullable', 'numeric', 'min:20', 'max:400'],
            'repeat_diet_feedback' => ['nullable', 'array'],
            'repeat_diet_medical_notes' => ['nullable', 'string'],
            'repeat_diet_medical_conditions_items' => ['nullable', 'array'],
            'repeat_diet_medical_conditions_items.*.id' => ['nullable', 'string', 'max:120'],
            'repeat_diet_medical_conditions_items.*.title' => ['required_with:repeat_diet_medical_conditions_items', 'string', 'max:255'],
            'repeat_diet_medical_conditions_items.*.status' => ['nullable', 'in:current,past,temporary'],
            'repeat_diet_medical_conditions_items.*.startedAt' => ['nullable', 'date'],
            'repeat_diet_medical_conditions_items.*.endedAt' => ['nullable', 'date'],
            'repeat_diet_medical_conditions_items.*.ongoing' => ['nullable', 'boolean'],
            'repeat_diet_medical_conditions_items.*.notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $templateId = isset($validated['nutrition_diet_template_id']) ? (int) $validated['nutrition_diet_template_id'] : null;
        $requestType = (string) $validated['request_type'];
        $expertDescription = $this->nullableTrim($validated['expert_description'] ?? null);
        $repeatDietMedicalConditionItems = array_key_exists('repeat_diet_medical_conditions_items', $validated)
            ? NutritionMedicalConditionSupport::normalizeEntries($validated['repeat_diet_medical_conditions_items'] ?? [])
            : [];
        $repeatDietMedicalNotes = $repeatDietMedicalConditionItems !== []
            ? NutritionMedicalConditionSupport::summarizeEntries($repeatDietMedicalConditionItems)
            : $this->nullableTrim($validated['repeat_diet_medical_notes'] ?? null);
        $repeatDietFeedback = $this->normalizeRepeatDietFeedback($validated['repeat_diet_feedback'] ?? null);
        $requestedCurrentWeightKg = isset($validated['current_weight_kg']) ? round((float) $validated['current_weight_kg'], 2) : null;

        $rewardContext = null;

        $payload = DB::transaction(function () use ($requestType, $templateId, $user, $expertDescription, $repeatDietFeedback, $repeatDietMedicalNotes, $repeatDietMedicalConditionItems, $requestedCurrentWeightKg, &$rewardContext): array {
            $profile = NutritionProfile::query()->where('user_id', $user->id)->lockForUpdate()->first();
            if (! $profile) {
                throw ValidationException::withMessages([
                    'profile' => 'ابتدا اطلاعات پروفایل تغذیه را کامل کنید.',
                ]);
            }

            $activeRequest = NutritionDietRequest::query()
                ->where('user_id', $user->id)
                ->whereIn('status', self::ACTIVE_REQUEST_STATUSES)
                ->lockForUpdate()
                ->latest('id')
                ->first();

            if ($activeRequest) {
                throw ValidationException::withMessages([
                    'request' => 'شما یک رژیم در حال تجویز دارید. پس از آماده شدن رژیم، برای شما پیامک ارسال می‌شود.',
                ]);
            }

            $latestPreviousPrescription = NutritionDietPrescription::query()
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->latest('id')
                ->first();

            $hasPreviousPrescription = $latestPreviousPrescription !== null;

            if (! $hasPreviousPrescription && ! $profile->mindset_completed_at) {
                throw ValidationException::withMessages([
                    'mindset' => 'برای ثبت اولین رژیم، ابتدا سوالات تکمیلی قبل از دریافت رژیم را پاسخ دهید.',
                ]);
            }

            if ($hasPreviousPrescription) {
                if ($requestedCurrentWeightKg === null) {
                    throw ValidationException::withMessages([
                        'current_weight_kg' => 'برای ثبت رژیم جدید، وزن فعلی جدید خودتان را وارد کنید.',
                    ]);
                }

                if ($repeatDietMedicalNotes === null) {
                    throw ValidationException::withMessages([
                        'repeat_diet_medical_notes' => 'وضعیت بیماری یا داروهای مصرفی را برای رژیم جدید ثبت کنید. اگر موردی ندارید، بنویسید ندارم.',
                    ]);
                }

                if (count($repeatDietFeedback) < 13) {
                    throw ValidationException::withMessages([
                        'repeat_diet_feedback' => 'پاسخ‌های مربوط به رژیم قبلی کامل نشده است. لطفاً همه سوالات را پاسخ دهید.',
                    ]);
                }
            }

            if ($requestType === 'expert') {
                $activeOfflinePrescription = NutritionDietPrescription::query()
                    ->where('user_id', $user->id)
                    ->where('is_current', true)
                    ->where('status', 'active')
                    ->where(function (Builder $query): void {
                        $query->whereNull('ends_at')
                            ->orWhereDate('ends_at', '>', now()->toDateString());
                    })
                    ->whereHas('request', function (Builder $query): void {
                        $query->where('request_type', 'expert');
                    })
                    ->latest('id')
                    ->first();

                if ($activeOfflinePrescription) {
                    throw ValidationException::withMessages([
                        'request' => 'رژیم اختصاصی فعلی شما هنوز به پایان نرسیده است. بعد از اتمام این رژیم می‌توانید درخواست جدید ثبت کنید.',
                    ]);
                }
            }

            $templateId = $this->resolveFirstDietTemplateId($profile, $hasPreviousPrescription, $templateId);

            if ($requestType === 'ai' && ! $templateId) {
                throw ValidationException::withMessages([
                    'nutrition_diet_template_id' => 'برای رژیم آنلاین باید الگوی رژیم انتخاب شود یا تنظیم رژیم اول خودکار کامل باشد.',
                ]);
            }

            $template = null;
            if ($templateId) {
                $template = NutritionDietTemplate::query()->withCount('children')->lockForUpdate()->findOrFail($templateId);
                if (! $template->is_active || $template->children_count > 0) {
                    throw ValidationException::withMessages([
                        'template' => 'لطفاً یک رژیم نهایی و فعال را انتخاب کنید.',
                    ]);
                }
            }

            $startedAt = now()->toDateString();
            $endsAt = $template
                ? now()->addDays(max(1, (int) $template->duration_days) - 1)->toDateString()
                : null;

            $effectiveCurrentWeightKg = $hasPreviousPrescription && $requestedCurrentWeightKg !== null
                ? $requestedCurrentWeightKg
                : ($profile->weight_kg !== null ? (float) $profile->weight_kg : null);
            $repeatDietContext = $hasPreviousPrescription
                ? [
                    'isFollowupRequest' => true,
                    'currentWeightKg' => $effectiveCurrentWeightKg,
                    'medicalNotes' => $repeatDietMedicalNotes,
                    'medicalConditionsItems' => $repeatDietMedicalConditionItems,
                    'answers' => $repeatDietFeedback,
                    'submittedAt' => now()->toIso8601String(),
                ]
                : null;

            if ($hasPreviousPrescription && $effectiveCurrentWeightKg !== null) {
                $profile->forceFill([
                    'weight_kg' => $effectiveCurrentWeightKg,
                ])->save();
            }

            $profileSnapshot = [
                'dietGoal' => $profile->diet_goal,
                'gender' => $profile->gender,
                'athleteMode' => $profile->athlete_mode,
                'activityLevel' => $profile->activity_level,
                'birthDate' => $profile->birth_date?->toDateString(),
                'heightCm' => $profile->height_cm,
                'weightKg' => $effectiveCurrentWeightKg,
                'targetWeightKg' => $profile->target_weight_kg !== null ? (float) $profile->target_weight_kg : null,
                'weeklyWeightChangeKg' => $profile->weekly_weight_change_kg !== null ? (float) $profile->weekly_weight_change_kg : null,
                'medicalConditions' => NutritionMedicalConditionSupport::summarizeEntries(NutritionMedicalConditionSupport::parseEntries($profile->medical_conditions)),
                'medicalConditionsItems' => NutritionMedicalConditionSupport::parseEntries($profile->medical_conditions),
                'medicationsAndSupplements' => $profile->medications_and_supplements,
                'idealWeightKg' => $profile->ideal_weight_kg !== null ? (float) $profile->ideal_weight_kg : null,
                'recommendedTargetWeightKg' => $profile->recommended_target_weight_kg !== null ? (float) $profile->recommended_target_weight_kg : null,
                'dislikedFoods' => $profile->disliked_foods,
                'foodAllergies' => $profile->food_allergies,
                'mindsetAnswers' => $profile->mindset_answers,
                'repeatDietFeedback' => $repeatDietContext,
                'selectedNutritionPackageId' => $profile->selected_nutrition_package_id,
                'selectedNutritionPackageName' => $profile->selectedPackage?->name,
                'preferencesCompletedAt' => $profile->preferences_completed_at?->toIso8601String(),
                'mindsetCompletedAt' => $profile->mindset_completed_at?->toIso8601String(),
                'packageSelectedAt' => $profile->package_selected_at?->toIso8601String(),
                'onboardingCompletedAt' => $profile->onboarding_completed_at?->toIso8601String(),
            ];

            $templateSnapshot = $template ? [
                'id' => $template->id,
                'name' => $template->name,
                'slug' => $template->slug,
                'prescriptionMode' => $template->prescription_mode,
                'allowFoodReplacement' => (bool) $template->allow_food_replacement,
                'suggestDailyReplacements' => (bool) $template->suggest_daily_replacements,
                'showDietExplanations' => (bool) $template->show_diet_explanations,
                'dietExplanationPrompt' => $template->diet_explanation_prompt,
                'dietBasis' => $template->diet_basis,
                'dietBasisLabel' => self::DIET_BASIS_LABELS[$template->diet_basis] ?? $template->diet_basis,
                'durationDays' => (int) $template->duration_days,
                'mealSlots' => $template->meal_slots,
                'conditionsText' => $template->conditions_text,
                'description' => $template->description,
                'supplementsEnabled' => (bool) $template->supplements_enabled,
                'supplementNotes' => $template->supplement_notes,
                'imageUrl' => $template->image_path ? asset('/storage/' . ltrim((string) $template->image_path, '/')) : null,
            ] : null;

            /** @var NutritionPackageSubscription|null $subscription */
            $subscription = NutritionPackageSubscription::query()
                ->with('package')
                ->where('user_id', $user->id)
                ->where('status', 'active')
                ->where(function ($query): void {
                    $query->whereNull('ends_at')
                        ->orWhereDate('ends_at', '>=', now()->toDateString());
                })
                ->latest('id')
                ->lockForUpdate()
                ->first();

            if (! $subscription) {
                throw ValidationException::withMessages([
                    'subscription' => 'برای ثبت درخواست رژیم، ابتدا باید یک پکیج فعال داشته باشید.',
                ]);
            }

            $remaining = $requestType === 'ai'
                ? max(0, (int) $subscription->online_diet_total - (int) $subscription->online_diet_used)
                : max(0, (int) $subscription->offline_diet_total - (int) $subscription->offline_diet_used);

            if ($remaining <= 0) {
                throw ValidationException::withMessages([
                    'subscription' => $requestType === 'ai'
                        ? 'سهم رژیم آنلاین شما تمام شده است.'
                        : 'سهم رژیم اختصاصی توسط کارشناس شما تمام شده است.',
                ]);
            }

            $profileSnapshotId = DB::table('nutrition_profile_snapshots')->insertGetId([
                'user_id' => $user->id,
                'nutrition_profile_id' => $profile->id,
                'selected_nutrition_package_id' => $profile->selected_nutrition_package_id,
                'snapshot_source' => 'diet_request',
                'diet_goal' => $profile->diet_goal,
                'gender' => $profile->gender,
                'athlete_mode' => $profile->athlete_mode,
                'activity_level' => $profile->activity_level,
                'birth_date' => $profile->birth_date,
                'height_cm' => $profile->height_cm,
                'weight_kg' => $effectiveCurrentWeightKg,
                'ideal_weight_kg' => $profile->ideal_weight_kg,
                'recommended_target_weight_kg' => $profile->recommended_target_weight_kg,
                'target_weight_kg' => $profile->target_weight_kg,
                'weekly_weight_change_kg' => $profile->weekly_weight_change_kg,
                'medical_conditions' => $profile->medical_conditions,
                'medications_and_supplements' => $profile->medications_and_supplements,
                'disliked_foods' => $profile->disliked_foods,
                'food_allergies' => $profile->food_allergies,
                'mindset_answers' => $profile->mindset_answers !== null
                    ? json_encode($profile->mindset_answers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                    : null,
                'collected_payload' => json_encode($profileSnapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'captured_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $subscription->forceFill([
                'online_diet_used' => $requestType === 'ai'
                    ? ((int) $subscription->online_diet_used + 1)
                    : (int) $subscription->online_diet_used,
                'offline_diet_used' => $requestType === 'expert'
                    ? ((int) $subscription->offline_diet_used + 1)
                    : (int) $subscription->offline_diet_used,
            ])->save();

            $requestPrescriptionMode = $template?->prescription_mode ?? 'fixed_text';
            $requestAllowFoodReplacement = (bool) ($template?->allow_food_replacement ?? false);
            $requestSuggestDailyReplacements = (bool) ($template?->suggest_daily_replacements ?? false);
            $requiresManualDeliveryApproval = $requestType === 'ai'
                && ($this->settings->manualAiApprovalRequired() || (! $hasPreviousPrescription && $this->settings->autoFirstDietRequiresApproval()));

            $dietRequestAttributes = [
                'user_id' => $user->id,
                'nutrition_profile_id' => $profile->id,
                'nutrition_profile_snapshot_id' => $profileSnapshotId,
                'nutrition_package_subscription_id' => $subscription->id,
                'nutrition_diet_template_id' => $template?->id,
                'request_type' => $requestType,
                'prescription_mode' => $requestPrescriptionMode,
                'status' => 'sent',
                'ask_ai_enabled' => $requestType === 'ai',
                'allow_food_replacement' => $requestAllowFoodReplacement,
                'requires_manual_delivery_approval' => $requiresManualDeliveryApproval,
                'diet_template_name' => $template?->name ?? 'رژیم اختصاصی توسط کارشناس',
                'diet_goal' => $profile->diet_goal,
                'gender' => $profile->gender,
                'athlete_mode' => $profile->athlete_mode,
                'activity_level' => $profile->activity_level,
                'birth_date' => $profile->birth_date,
                'height_cm' => $profile->height_cm,
                'current_weight_kg' => $effectiveCurrentWeightKg,
                'target_weight_kg' => $profile->target_weight_kg,
                'weekly_weight_change_kg' => $profile->weekly_weight_change_kg,
                'started_at' => $startedAt,
                'ends_at' => $endsAt,
                'expert_notes' => $requestType === 'expert' ? $expertDescription : null,
                'profile_snapshot' => [
                    ...$profileSnapshot,
                    'requestType' => $requestType,
                    'requestTypeLabel' => $requestType === 'ai' ? 'رژیم آنلاین' : 'رژیم اختصاصی توسط کارشناس',
                    'selectedDietTemplateId' => $template?->id,
                    'selectedDietTemplateName' => $template?->name,
                    'prescriptionMode' => $requestPrescriptionMode,
                    'allowFoodReplacement' => $requestAllowFoodReplacement,
                    'suggestDailyReplacements' => $requestSuggestDailyReplacements,
                    'dietTemplateImageUrl' => is_array($templateSnapshot) ? ($templateSnapshot['imageUrl'] ?? null) : null,
                    'dietTemplateDescription' => $template?->description,
                    'dietTemplateConditionsText' => $template?->conditions_text,
                    'dietBasis' => $template?->diet_basis,
                    'dietBasisLabel' => $template ? (self::DIET_BASIS_LABELS[$template->diet_basis] ?? $template->diet_basis) : null,
                    'durationDays' => $template ? (int) $template->duration_days : null,
                    'customerExpertDescription' => $expertDescription,
                    'repeatDietFeedback' => $repeatDietContext,
                    'requestStartedAt' => $startedAt,
                    'requestEndsAt' => $endsAt,
                    'requiresManualDeliveryApproval' => $requiresManualDeliveryApproval,
                    'subscription' => [
                        'id' => $subscription->id,
                        'startsAt' => $subscription->starts_at?->toDateString(),
                        'endsAt' => $subscription->ends_at?->toDateString(),
                        'onlineDietTotal' => (int) $subscription->online_diet_total,
                        'onlineDietUsed' => (int) $subscription->online_diet_used,
                        'offlineDietTotal' => (int) $subscription->offline_diet_total,
                        'offlineDietUsed' => (int) $subscription->offline_diet_used,
                        'packageName' => $subscription->package?->name,
                    ],
                ],
                'template_snapshot' => $templateSnapshot,
                'request_payload_snapshot' => [
                    'requestType' => $requestType,
                    'requestTypeLabel' => $requestType === 'ai' ? 'رژیم آنلاین' : 'رژیم اختصاصی توسط کارشناس',
                    'selectedDietTemplateId' => $template?->id,
                    'selectedDietTemplateName' => $template?->name,
                    'customerExpertDescription' => $expertDescription,
                    'repeatDietFeedback' => $repeatDietContext,
                    'startedAt' => $startedAt,
                    'endsAt' => $endsAt,
                    'requiresManualDeliveryApproval' => $requiresManualDeliveryApproval,
                    'remainingBeforeConsume' => $remaining,
                ],
            ];

            if (Schema::hasColumn('nutrition_diet_requests', 'suggest_daily_replacements')) {
                $dietRequestAttributes['suggest_daily_replacements'] = $requestSuggestDailyReplacements;
            }

            $dietRequest = NutritionDietRequest::query()->create($dietRequestAttributes);

            if ($requestType === 'ai') {
                $dietRequest = $this->aiGeneration->queue($dietRequest, $user, []);

                DB::afterCommit(function () use ($dietRequest): void {
                    GenerateNutritionAiPrescriptionJob::dispatch((string) tenant('id'), (int) $dietRequest->id);
                });
            }

            DB::table('nutrition_weight_logs')->insert([
                'user_id' => $user->id,
                'logged_by_user_id' => $user->id,
                'source' => 'diet_request',
                'recorded_on' => $startedAt,
                'recorded_at' => now(),
                'weight_kg' => $effectiveCurrentWeightKg,
                'notes' => $hasPreviousPrescription ? 'ثبت وزن جدید برای درخواست رژیم بعدی' : 'ثبت وزن هنگام ایجاد درخواست رژیم',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $dietRequest->load(['user', 'subscription.package', 'dietTemplate']);

            $rewardContext = [
                'user' => $user,
                'request' => $dietRequest,
                'requestType' => $requestType,
                'previousWeightKg' => $latestPreviousPrescription?->current_weight_kg !== null
                    ? (float) $latestPreviousPrescription->current_weight_kg
                    : null,
                'currentWeightKg' => $effectiveCurrentWeightKg,
            ];

            return [
                'request' => $this->serializeRequest($dietRequest),
                'subscription' => [
                    'onlineDietUsed' => (int) $subscription->online_diet_used,
                    'offlineDietUsed' => (int) $subscription->offline_diet_used,
                    'onlineDietRemaining' => max(0, (int) $subscription->online_diet_total - (int) $subscription->online_diet_used),
                    'offlineDietRemaining' => max(0, (int) $subscription->offline_diet_total - (int) $subscription->offline_diet_used),
                ],
            ];
        });

        if (is_array($rewardContext) && ($rewardContext['request'] ?? null) instanceof NutritionDietRequest) {
            /** @var NutritionDietRequest $rewardRequest */
            $rewardRequest = $rewardContext['request'];

            if ((bool) $rewardRequest->requires_manual_delivery_approval) {
                $this->notifications->notifyExpertsDietRequestNeedsManualApproval($rewardRequest);
            }

            if (($rewardContext['requestType'] ?? null) === 'ai') {
                $this->customerClubRewards->awardForOnlineDietRequest($user, $rewardRequest);
            }

            $this->customerClubRewards->awardForWeightLossFollowup(
                $user,
                $rewardRequest,
                isset($rewardContext['previousWeightKg']) ? (is_numeric($rewardContext['previousWeightKg']) ? (float) $rewardContext['previousWeightKg'] : null) : null,
                isset($rewardContext['currentWeightKg']) ? (is_numeric($rewardContext['currentWeightKg']) ? (float) $rewardContext['currentWeightKg'] : null) : null,
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'درخواست رژیم شما با موفقیت ثبت شد.',
            'data' => $payload,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $this->user();
        abort_unless($user, 401);

        $items = NutritionDietRequest::query()
            ->with(['subscription.package', 'dietTemplate'])
            ->where('user_id', $user->id)
            ->latest('id')
            ->paginate((int) $request->integer('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $items->getCollection()->map(fn (NutritionDietRequest $item): array => $this->serializeRequest($item))->values()->all(),
                'page' => $items->currentPage(),
                'perPage' => $items->perPage(),
                'total' => $items->total(),
                'lastPage' => $items->lastPage(),
            ],
        ]);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));

        $baseQuery = $this->adminRequestsQuery($request);

        $quickFilter = trim((string) $request->query('quick_filter', 'all'));
        $itemsQuery = $this->applyAdminQuickFilter(clone $baseQuery, $quickFilter);

        $items = $itemsQuery
            ->with(['user', 'subscription.package', 'dietTemplate', 'prescriptions'])
            ->latest('id')
            ->paginate((int) $request->integer('per_page', 20));

        $statsQuery = (clone $baseQuery)
            ->toBase()
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN request_type = 'ai' THEN 1 ELSE 0 END) as ai_requests")
            ->selectRaw("SUM(CASE WHEN request_type = 'expert' THEN 1 ELSE 0 END) as expert_requests")
            ->selectRaw("SUM(CASE WHEN status IN ('sent', 'in_progress', 'not_sent') THEN 1 ELSE 0 END) as active_requests")
            ->selectRaw("SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) as finished_requests")
            ->selectRaw("SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_requests");

        if ($this->hasAiGenerationColumns()) {
            $statsQuery
                ->selectRaw("SUM(CASE WHEN ai_generation_status = 'queued' THEN 1 ELSE 0 END) as queued_ai")
                ->selectRaw("SUM(CASE WHEN ai_generation_status = 'processing' THEN 1 ELSE 0 END) as processing_ai")
                ->selectRaw("SUM(CASE WHEN ai_generation_status = 'generated' THEN 1 ELSE 0 END) as generated_ai")
                ->selectRaw("SUM(CASE WHEN ai_generation_status = 'failed' THEN 1 ELSE 0 END) as failed_ai");
        } else {
            $statsQuery
                ->selectRaw('0 as queued_ai')
                ->selectRaw('0 as processing_ai')
                ->selectRaw('0 as generated_ai')
                ->selectRaw('0 as failed_ai');
        }

        $stats = $statsQuery->first();
        $notGeneratedAi = (clone $baseQuery)
            ->where('request_type', 'ai')
            ->where(function (Builder $query): void {
                $query->where('ai_generation_status', '!=', 'generated')
                    ->orWhereNull('ai_generation_status');
            })
            ->count();
        $pendingManualApprovals = (clone $baseQuery)
            ->where('request_type', 'ai')
            ->where('requires_manual_delivery_approval', true)
            ->where('ai_generation_status', 'generated')
            ->whereHas('prescriptions', fn (Builder $query): Builder => $query->whereNull('published_at'))
            ->count();
        $expertManualDelivery = (clone $baseQuery)
            ->where('request_type', 'expert')
            ->whereDoesntHave('prescriptions')
            ->count();

        return response()->json([
            'success' => true,
            'data' => [
                'stats' => [
                    'total' => (int) ($stats->total ?? 0),
                    'aiRequests' => (int) ($stats->ai_requests ?? 0),
                    'expertRequests' => (int) ($stats->expert_requests ?? 0),
                    'activeRequests' => (int) ($stats->active_requests ?? 0),
                    'finishedRequests' => (int) ($stats->finished_requests ?? 0),
                    'cancelledRequests' => (int) ($stats->cancelled_requests ?? 0),
                    'queuedAi' => (int) ($stats->queued_ai ?? 0),
                    'processingAi' => (int) ($stats->processing_ai ?? 0),
                    'generatedAi' => (int) ($stats->generated_ai ?? 0),
                    'failedAi' => (int) ($stats->failed_ai ?? 0),
                    'notGeneratedAi' => $notGeneratedAi,
                    'pendingManualApprovals' => $pendingManualApprovals,
                    'expertManualDelivery' => $expertManualDelivery,
                ],
                'filters' => [
                    'q' => trim((string) $request->query('q', '')),
                    'quickFilter' => in_array($quickFilter, ['not_generated', 'pending_approval', 'expert_manual_delivery', 'failed_ai'], true) ? $quickFilter : 'all',
                ],
                'items' => $items->getCollection()->map(fn (NutritionDietRequest $item): array => $this->serializeRequest($item))->values()->all(),
                'page' => $items->currentPage(),
                'perPage' => $items->perPage(),
                'total' => $items->total(),
                'lastPage' => $items->lastPage(),
            ],
        ]);
    }

    public function adminShow(Request $request, NutritionDietRequest $nutritionDietRequest): JsonResponse
    {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));

        $nutritionDietRequest->load(['user', 'subscription.package', 'dietTemplate', 'prescriptions']);

        return response()->json([
            'success' => true,
            'data' => [
                'item' => $this->serializeRequest($nutritionDietRequest),
            ],
        ]);
    }

    public function adminUpdateAiUsageLimits(Request $request, NutritionDietRequest $nutritionDietRequest): JsonResponse
    {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));
        abort_unless(Schema::hasColumn('nutrition_diet_requests', 'ai_usage_limits'), 503, 'زیرساخت محدودیت اختصاصی AI هنوز برای این دیتابیس فعال نشده است.');

        $validated = $request->validate([
            'mealPhotoAnalysisDietLimit' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'mealPhotoAnalysisHourlyLimit' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'manualMealNutritionDietLimit' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'manualMealNutritionHourlyLimit' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'mealReplacementDietLimit' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'mealReplacementHourlyLimit' => ['nullable', 'integer', 'min:1', 'max:100000'],
        ]);

        $limits = is_array($nutritionDietRequest->ai_usage_limits) ? $nutritionDietRequest->ai_usage_limits : [];
        $map = [
            'mealPhotoAnalysisDietLimit' => ['operation' => 'meal_photo_analysis', 'key' => 'diet_limit'],
            'mealPhotoAnalysisHourlyLimit' => ['operation' => 'meal_photo_analysis', 'key' => 'hourly_limit'],
            'manualMealNutritionDietLimit' => ['operation' => 'manual_meal_nutrition', 'key' => 'diet_limit'],
            'manualMealNutritionHourlyLimit' => ['operation' => 'manual_meal_nutrition', 'key' => 'hourly_limit'],
            'mealReplacementDietLimit' => ['operation' => 'meal_replacement', 'key' => 'diet_limit'],
            'mealReplacementHourlyLimit' => ['operation' => 'meal_replacement', 'key' => 'hourly_limit'],
        ];

        foreach ($map as $inputKey => $target) {
            if (! array_key_exists($inputKey, $validated)) {
                continue;
            }

            $operationType = $target['operation'];
            $limitKey = $target['key'];

            if ($validated[$inputKey] === null || $validated[$inputKey] === '') {
                unset($limits[$operationType][$limitKey]);
            } else {
                $limits[$operationType][$limitKey] = (int) $validated[$inputKey];
            }

            if (($limits[$operationType] ?? []) === []) {
                unset($limits[$operationType]);
            }
        }

        $nutritionDietRequest->forceFill([
            'ai_usage_limits' => $limits !== [] ? $limits : null,
        ])->save();

        $nutritionDietRequest->load(['user', 'subscription.package', 'dietTemplate', 'prescriptions']);

        return response()->json([
            'success' => true,
            'message' => 'محدودیت AI همین رژیم ذخیره شد.',
            'data' => [
                'item' => $this->serializeRequest($nutritionDietRequest),
            ],
        ]);
    }

    public function adminSettings(Request $request): JsonResponse
    {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));

        return response()->json([
            'success' => true,
            'data' => $this->settings->payload(),
        ]);
    }

    public function updateAdminSettings(Request $request): JsonResponse
    {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));

        $validated = $request->validate([
            'manualAiApprovalRequired' => ['required', 'boolean'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تنظیمات درخواست‌های رژیم ذخیره شد.',
            'data' => $this->settings->update($validated),
        ]);
    }

    public function adminDestroy(Request $request, NutritionDietRequest $nutritionDietRequest): JsonResponse
    {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));

        $validated = $request->validate([
            'refund_balance' => ['nullable', 'boolean'],
        ]);

        $refundBalance = (bool) ($validated['refund_balance'] ?? false);

        $result = DB::transaction(function () use ($nutritionDietRequest, $refundBalance): array {
            /** @var NutritionDietRequest $requestModel */
            $requestModel = NutritionDietRequest::query()
                ->with(['subscription', 'prescriptions'])
                ->lockForUpdate()
                ->findOrFail($nutritionDietRequest->id);

            $refunded = false;

            if ($refundBalance && $requestModel->nutrition_package_subscription_id) {
                /** @var NutritionPackageSubscription|null $subscription */
                $subscription = NutritionPackageSubscription::query()
                    ->lockForUpdate()
                    ->find($requestModel->nutrition_package_subscription_id);

                if ($subscription) {
                    if ($requestModel->request_type === 'ai') {
                        $subscription->online_diet_used = max(0, (int) $subscription->online_diet_used - 1);
                    } else {
                        $subscription->offline_diet_used = max(0, (int) $subscription->offline_diet_used - 1);
                    }

                    $subscription->save();
                    $refunded = true;
                }
            }

            NutritionDietPrescription::query()
                ->where('nutrition_diet_request_id', $requestModel->id)
                ->delete();

            if ($requestModel->nutrition_profile_snapshot_id) {
                DB::table('nutrition_profile_snapshots')
                    ->where('id', $requestModel->nutrition_profile_snapshot_id)
                    ->delete();
            }

            $requestType = $requestModel->request_type;
            $userId = $requestModel->user_id;
            $requestModel->delete();

            return [
                'refunded' => $refunded,
                'requestType' => $requestType,
                'userId' => $userId,
            ];
        });

        return response()->json([
            'success' => true,
            'message' => $result['refunded']
                ? 'درخواست رژیم حذف شد و سهم رژیم به حساب کاربر برگشت.'
                : 'درخواست رژیم حذف شد.',
            'data' => $result,
        ]);
    }

    public function adminManualEditPrescriptionItem(Request $request, NutritionDietRequest $nutritionDietRequest): JsonResponse
    {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        abort_unless($this->canManageDietWorkflow($request), 403, __('authorization.nutrition_allowed_section'));

        $validated = $request->validate([
            'prescription_id' => ['required', 'integer'],
            'section_type' => ['required', 'in:user_choice_option,daily_meal,daily_replacement,fixed_text_section,viewer_message'],
            'slot_key' => ['nullable', 'string', 'max:64'],
            'option_index' => ['nullable', 'integer', 'min:0', 'max:200'],
            'day_number' => ['nullable', 'integer', 'min:1', 'max:365'],
            'meal_index' => ['nullable', 'integer', 'min:0', 'max:200'],
            'replacement_index' => ['nullable', 'integer', 'min:0', 'max:200'],
            'section_index' => ['nullable', 'integer', 'min:0', 'max:200'],
            'title' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'quantity_text' => ['nullable', 'string', 'max:255'],
            'grams' => ['nullable', 'integer', 'min:0', 'max:5000'],
            'calories' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'protein_grams' => ['nullable', 'numeric', 'min:0', 'max:500'],
            'fat_grams' => ['nullable', 'numeric', 'min:0', 'max:500'],
            'carbohydrate_grams' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'fiber_grams' => ['nullable', 'numeric', 'min:0', 'max:300'],
            'meal_text' => ['nullable', 'string'],
            'body' => ['nullable', 'string'],
        ]);

        /** @var NutritionDietPrescription|null $prescription */
        $prescription = NutritionDietPrescription::query()
            ->where('nutrition_diet_request_id', $nutritionDietRequest->id)
            ->where('id', (int) $validated['prescription_id'])
            ->first();

        abort_unless($prescription, 404, 'نسخه موردنظر پیدا نشد.');

        $content = is_array($prescription->content_snapshot) ? $prescription->content_snapshot : [];
        $updated = match ($validated['section_type']) {
            'user_choice_option' => $this->applyUserChoiceOptionEdit($content, $validated),
            'daily_meal' => $this->applyDailyMealEdit($content, $validated),
            'daily_replacement' => $this->applyDailyReplacementEdit($content, $validated),
            'fixed_text_section' => $this->applyFixedTextSectionEdit($content, $validated),
            'viewer_message' => $this->applyViewerMessageEdit($content, $validated),
            default => false,
        };

        abort_unless($updated, 422, 'ردیف موردنظر برای ویرایش پیدا نشد.');

        $prescription->forceFill([
            'content_snapshot' => $content,
            'published_at' => $prescription->published_at,
        ])->save();

        $nutritionDietRequest->load(['user', 'subscription.package', 'dietTemplate', 'prescriptions']);

        return response()->json([
            'success' => true,
            'message' => 'ردیف انتخاب‌شده با موفقیت ویرایش شد.',
            'data' => [
                'item' => $this->serializeRequest($nutritionDietRequest),
            ],
        ]);
    }

    public function adminDeleteMealReplacementSuggestion(
        Request $request,
        NutritionDietRequest $nutritionDietRequest,
        NutritionMealReplacementSuggestion $mealSuggestion,
    ): JsonResponse {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        abort_unless($this->canManageDietWorkflow($request), 403, __('authorization.nutrition_allowed_section'));
        abort_if(! Schema::hasTable('nutrition_meal_replacement_suggestions'), 503, 'قابلیت جایگزینی غذا هنوز برای این دیتابیس فعال نشده است.');

        $nutritionDietRequest->loadMissing('prescriptions');
        $prescriptionIds = $nutritionDietRequest->prescriptions->pluck('id')->map(fn ($id): int => (int) $id)->all();

        abort_unless(in_array((int) $mealSuggestion->nutrition_diet_prescription_id, $prescriptionIds, true), 404, 'درخواست جایگزینی برای این رژیم پیدا نشد.');

        $mealSuggestion->delete();

        $nutritionDietRequest->load(['user', 'subscription.package', 'dietTemplate', 'prescriptions']);

        return response()->json([
            'success' => true,
            'message' => 'لیست جایگزین این وعده حذف شد. در درخواست بعدی کاربر، لیست جدید ساخته می‌شود.',
            'data' => [
                'item' => $this->serializeRequest($nutritionDietRequest),
            ],
        ]);
    }

    public function adminRegenerateMealReplacementSuggestion(
        Request $request,
        NutritionDietRequest $nutritionDietRequest,
        NutritionMealReplacementSuggestion $mealSuggestion,
    ): JsonResponse {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        abort_unless($this->canManageDietWorkflow($request), 403, __('authorization.nutrition_allowed_section'));
        abort_if(! Schema::hasTable('nutrition_meal_replacement_suggestions'), 503, 'قابلیت جایگزینی غذا هنوز برای این دیتابیس فعال نشده است.');

        $validated = $request->validate([
            'prompt_mode' => ['required', 'in:tenant,default,custom'],
            'custom_prompt' => ['nullable', 'string'],
        ]);

        if (($validated['prompt_mode'] ?? null) === 'custom' && trim((string) ($validated['custom_prompt'] ?? '')) === '') {
            throw ValidationException::withMessages([
                'custom_prompt' => 'برای بازتولید با پرامپت سفارشی، متن پرامپت را وارد کنید.',
            ]);
        }

        /** @var NutritionDietPrescription|null $prescription */
        $prescription = NutritionDietPrescription::query()
            ->where('nutrition_diet_request_id', $nutritionDietRequest->id)
            ->where('id', $mealSuggestion->nutrition_diet_prescription_id)
            ->first();

        abort_unless($prescription, 404, 'نسخه مربوط به این لیست جایگزین پیدا نشد.');

        $payload = [
            'source_type' => $mealSuggestion->source_type,
            'meal_slot_key' => $mealSuggestion->meal_slot_key,
            'slot_title' => $mealSuggestion->slot_title,
            'day_number' => $mealSuggestion->day_number,
            'meal_index' => $mealSuggestion->meal_index,
            'prompt_mode' => $validated['prompt_mode'],
            'custom_prompt' => $validated['custom_prompt'] ?? null,
            'force_regenerate' => true,
        ];

        $this->mealReplacementGeneration->queueForAdmin($prescription, $payload);

        $nutritionDietRequest->load(['user', 'subscription.package', 'dietTemplate', 'prescriptions']);

        return response()->json([
            'success' => true,
            'message' => 'بازتولید لیست جایگزین این وعده ثبت شد.',
            'data' => [
                'item' => $this->serializeRequest($nutritionDietRequest),
            ],
        ]);
    }

    public function adminCancelMealReplacementSuggestion(
        Request $request,
        NutritionDietRequest $nutritionDietRequest,
        NutritionMealReplacementSuggestion $mealSuggestion,
    ): JsonResponse {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        abort_unless($this->canManageDietWorkflow($request), 403, __('authorization.nutrition_allowed_section'));
        abort_if(! Schema::hasTable('nutrition_meal_replacement_suggestions'), 503, 'قابلیت جایگزینی غذا هنوز برای این دیتابیس فعال نشده است.');

        $nutritionDietRequest->loadMissing('prescriptions');
        $prescriptionIds = $nutritionDietRequest->prescriptions->pluck('id')->map(fn ($id): int => (int) $id)->all();

        abort_unless(in_array((int) $mealSuggestion->nutrition_diet_prescription_id, $prescriptionIds, true), 404, 'درخواست جایگزینی برای این رژیم پیدا نشد.');

        $this->mealReplacementGeneration->cancel($mealSuggestion);

        $nutritionDietRequest->load(['user', 'subscription.package', 'dietTemplate', 'prescriptions']);

        return response()->json([
            'success' => true,
            'message' => 'درخواست ساخت لیست جایگزین این وعده لغو شد.',
            'data' => [
                'item' => $this->serializeRequest($nutritionDietRequest),
            ],
        ]);
    }

    public function adminGenerateMealReplacementSuggestion(
        Request $request,
        NutritionDietRequest $nutritionDietRequest,
    ): JsonResponse {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        abort_unless($this->canManageDietWorkflow($request), 403, __('authorization.nutrition_allowed_section'));
        abort_if(! Schema::hasTable('nutrition_meal_replacement_suggestions'), 503, 'قابلیت جایگزینی غذا هنوز برای این دیتابیس فعال نشده است.');

        $validated = $request->validate([
            'prescription_id' => ['required', 'integer'],
            'source_type' => ['required', 'in:meal_slot,daily_meal'],
            'meal_slot_key' => ['required', 'string', 'max:64'],
            'slot_title' => ['nullable', 'string', 'max:255'],
            'day_number' => ['nullable', 'integer', 'min:1', 'max:365'],
            'meal_index' => ['nullable', 'integer', 'min:0', 'max:200'],
            'prompt_mode' => ['required', 'in:tenant,default,custom'],
            'custom_prompt' => ['nullable', 'string'],
        ]);

        if (($validated['prompt_mode'] ?? null) === 'custom' && trim((string) ($validated['custom_prompt'] ?? '')) === '') {
            throw ValidationException::withMessages([
                'custom_prompt' => 'برای ساخت با پرامپت سفارشی، متن پرامپت را وارد کنید.',
            ]);
        }

        /** @var NutritionDietPrescription|null $prescription */
        $prescription = NutritionDietPrescription::query()
            ->where('nutrition_diet_request_id', $nutritionDietRequest->id)
            ->where('id', (int) $validated['prescription_id'])
            ->first();

        abort_unless($prescription, 404, 'نسخه مربوط به این درخواست پیدا نشد.');

        $this->mealReplacementGeneration->queueForAdmin($prescription, [
            'source_type' => $validated['source_type'],
            'meal_slot_key' => $validated['meal_slot_key'],
            'slot_title' => $validated['slot_title'] ?? null,
            'day_number' => $validated['day_number'] ?? null,
            'meal_index' => $validated['meal_index'] ?? null,
            'prompt_mode' => $validated['prompt_mode'],
            'custom_prompt' => $validated['custom_prompt'] ?? null,
            'force_regenerate' => true,
        ]);

        $nutritionDietRequest->load(['user', 'subscription.package', 'dietTemplate', 'prescriptions']);

        return response()->json([
            'success' => true,
            'message' => 'درخواست ساخت لیست جایگزین برای این وعده ثبت شد.',
            'data' => [
                'item' => $this->serializeRequest($nutritionDietRequest),
            ],
        ]);
    }

    public function adminUpdateMealReplacementSuggestionOption(
        Request $request,
        NutritionDietRequest $nutritionDietRequest,
        NutritionMealReplacementSuggestion $mealSuggestion,
    ): JsonResponse {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        abort_unless($this->canManageDietWorkflow($request), 403, __('authorization.nutrition_allowed_section'));
        abort_if(! Schema::hasTable('nutrition_meal_replacement_suggestions'), 503, 'قابلیت جایگزینی غذا هنوز برای این دیتابیس فعال نشده است.');

        $nutritionDietRequest->loadMissing('prescriptions');
        $prescriptionIds = $nutritionDietRequest->prescriptions->pluck('id')->map(fn ($id): int => (int) $id)->all();

        abort_unless(in_array((int) $mealSuggestion->nutrition_diet_prescription_id, $prescriptionIds, true), 404, 'درخواست جایگزینی برای این رژیم پیدا نشد.');

        $validated = $request->validate([
            'option_id' => ['required', 'string', 'max:191'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'preparation_text' => ['nullable', 'string'],
            'quantity_text' => ['nullable', 'string', 'max:255'],
            'grams' => ['nullable', 'integer', 'min:0', 'max:5000'],
            'calories' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'match_reason' => ['nullable', 'string'],
        ]);

        $options = collect(is_array($mealSuggestion->options) ? $mealSuggestion->options : [])
            ->map(function ($item): array {
                return is_array($item) ? $item : [];
            })
            ->values()
            ->all();

        $updated = false;

        foreach ($options as $index => $option) {
            if ((string) ($option['id'] ?? '') !== (string) $validated['option_id']) {
                continue;
            }

            $options[$index] = [
                ...$option,
                'title' => trim((string) $validated['title']),
                'description' => trim((string) ($validated['description'] ?? '')),
                'preparation_text' => trim((string) ($validated['preparation_text'] ?? '')),
                'quantity_text' => trim((string) ($validated['quantity_text'] ?? '')),
                'grams' => isset($validated['grams']) ? max(0, (int) $validated['grams']) : (int) ($option['grams'] ?? 0),
                'calories' => isset($validated['calories']) ? max(0, (int) $validated['calories']) : (int) ($option['calories'] ?? 0),
                'match_reason' => trim((string) ($validated['match_reason'] ?? '')),
            ];
            $updated = true;
            break;
        }

        abort_unless($updated, 404, 'آیتم موردنظر برای ویرایش پیدا نشد.');

        $mealSuggestion->forceFill([
            'options' => $options,
        ])->save();

        $nutritionDietRequest->load(['user', 'subscription.package', 'dietTemplate', 'prescriptions']);

        return response()->json([
            'success' => true,
            'message' => 'آیتم لیست جایگزین با موفقیت ویرایش شد.',
            'data' => [
                'item' => $this->serializeRequest($nutritionDietRequest),
            ],
        ]);
    }

    public function adminUpdatePrescriptionDates(Request $request, NutritionDietRequest $nutritionDietRequest, NutritionDietPrescription $nutritionDietPrescription): JsonResponse
    {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        abort_unless($this->canManageDietWorkflow($request), 403, __('authorization.nutrition_allowed_section'));
        abort_unless((int) $nutritionDietPrescription->nutrition_diet_request_id === (int) $nutritionDietRequest->id, 404);

        $validated = $request->validate([
            'started_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after_or_equal:started_at'],
        ]);

        $startedAt = Carbon::parse((string) $validated['started_at'])->toDateString();
        $endsAt = Carbon::parse((string) $validated['ends_at'])->toDateString();

        DB::transaction(function () use ($endsAt, $nutritionDietPrescription, $nutritionDietRequest, $startedAt): void {
            /** @var NutritionDietPrescription $prescription */
            $prescription = NutritionDietPrescription::query()
                ->lockForUpdate()
                ->findOrFail($nutritionDietPrescription->id);

            abort_unless((int) $prescription->nutrition_diet_request_id === (int) $nutritionDietRequest->id, 404);

            $prescription->forceFill([
                'started_at' => $startedAt,
                'ends_at' => $endsAt,
                'is_current' => (bool) $prescription->is_current && $endsAt >= now()->toDateString(),
            ])->save();

            $payloadSnapshot = is_array($nutritionDietRequest->request_payload_snapshot)
                ? $nutritionDietRequest->request_payload_snapshot
                : [];

            $nutritionDietRequest->forceFill([
                'started_at' => $startedAt,
                'ends_at' => $endsAt,
                'request_payload_snapshot' => array_merge($payloadSnapshot, [
                    'datesEditedAt' => now()->toIso8601String(),
                    'editedStartedAt' => $startedAt,
                    'editedEndsAt' => $endsAt,
                ]),
            ])->save();
        });

        $nutritionDietRequest->load(['user', 'subscription.package', 'dietTemplate', 'prescriptions']);
        event(NutritionDietRequestUpdated::fromRequest((string) tenant('id'), $nutritionDietRequest));

        return response()->json([
            'success' => true,
            'message' => 'تاریخ شروع و پایان رژیم با موفقیت ویرایش شد.',
            'data' => [
                'item' => $this->serializeRequest($nutritionDietRequest),
            ],
        ]);
    }

    public function adminApproveGeneratedPrescription(Request $request, NutritionDietRequest $nutritionDietRequest): JsonResponse
    {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        $actor = $request->user('tenant_web');
        abort_unless($this->canManageDietWorkflow($request), 403, __('authorization.nutrition_allowed_section'));

        $validated = $request->validate([
            'confirm' => ['required', 'accepted'],
        ]);
        unset($validated);

        $result = DB::transaction(function () use ($actor, $nutritionDietRequest): array {
            /** @var NutritionDietRequest $dietRequest */
            $dietRequest = NutritionDietRequest::query()
                ->with(['user', 'subscription.package', 'dietTemplate', 'prescriptions'])
                ->lockForUpdate()
                ->findOrFail($nutritionDietRequest->id);

            abort_if($dietRequest->request_type !== 'ai', 422, 'تایید دستی فقط برای رژیم‌های اتوماتیک فعال است.');
            abort_if(! $dietRequest->requires_manual_delivery_approval, 422, 'برای این درخواست نیازی به تایید دستی تعریف نشده است.');
            abort_if($dietRequest->ai_generation_status !== 'generated', 422, 'تا زمانی که رژیم توسط AI تولید نشده باشد، امکان تایید ارسال وجود ندارد.');

            /** @var NutritionDietPrescription|null $pendingPrescription */
            $pendingPrescription = NutritionDietPrescription::query()
                ->where('nutrition_diet_request_id', $dietRequest->id)
                ->whereNull('published_at')
                ->latest('id')
                ->lockForUpdate()
                ->first();

            abort_unless($pendingPrescription, 422, 'نسخه آماده‌ای برای تایید ارسال پیدا نشد.');

            $completeness = $this->completeness->evaluatePrescription($pendingPrescription->loadMissing('request'));
            abort_if(! $completeness['complete'], 422, 'این رژیم هنوز کامل نشده است و قبل از ارسال باید توسط کارشناس تکمیل شود.');

            $durationDays = $this->resolveDietDurationDays($dietRequest, $pendingPrescription);
            $approvedStartedAt = now()->toDateString();
            $approvedEndsAt = Carbon::parse($approvedStartedAt)
                ->addDays(max(1, $durationDays) - 1)
                ->toDateString();

            $this->prescriptionActivation->archiveOtherCurrentPrescriptions(
                (int) $dietRequest->user_id,
                (int) $pendingPrescription->id,
            );

            $pendingPrescription->forceFill([
                'approved_by_user_id' => $actor->id,
                'status' => 'active',
                'started_at' => $approvedStartedAt,
                'ends_at' => $approvedEndsAt,
                'is_current' => true,
                'published_at' => now(),
            ])->save();

            $payloadSnapshot = is_array($dietRequest->request_payload_snapshot) ? $dietRequest->request_payload_snapshot : [];

            $dietRequest->forceFill([
                'status' => 'finished',
                'started_at' => $approvedStartedAt,
                'ends_at' => $approvedEndsAt,
                'manual_delivery_approved_at' => now(),
                'manual_delivery_approved_by_user_id' => $actor->id,
                'request_payload_snapshot' => array_merge($payloadSnapshot, [
                    'approvalDeliveredAt' => now()->toIso8601String(),
                    'approvedStartedAt' => $approvedStartedAt,
                    'approvedEndsAt' => $approvedEndsAt,
                ]),
            ])->save();

            $dietRequest->load(['user', 'subscription.package', 'dietTemplate', 'prescriptions']);

            return [
                'request' => $dietRequest,
                'prescription' => $pendingPrescription,
            ];
        });

        $this->notifications->notifyUserPrescriptionReady($result['request'], $result['prescription'], true);

        return response()->json([
            'success' => true,
            'message' => 'ارسال رژیم برای کاربر تایید شد و تاریخ شروع و پایان نسخه بر اساس امروز تنظیم شد.',
            'data' => [
                'item' => $this->serializeRequest($result['request']),
            ],
        ]);
    }

    public function adminSendExpertFilePrescription(Request $request, NutritionDietRequest $nutritionDietRequest): JsonResponse
    {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));
        abort_if($nutritionDietRequest->request_type !== 'expert', 422, 'ارسال فایل فقط برای رژیم اختصاصی کارشناس فعال است.');

        $validated = $request->validate([
            'source' => ['required', 'in:library,upload'],
            'nutrition_diet_file_id' => ['nullable', 'integer', 'exists:nutrition_diet_files,id'],
            'nutrition_diet_file_group_id' => ['nullable', 'integer', 'exists:nutrition_diet_file_groups,id'],
            'started_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:started_at'],
            'title' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'calories' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'viewer_message' => ['nullable', 'string'],
            'file' => ['nullable', 'file', 'mimes:pdf,png,jpg,jpeg,webp,doc,docx', 'max:30720'],
        ]);

        $actorId = $request->user('tenant_web')?->id;

        $result = DB::transaction(function () use ($actorId, $nutritionDietRequest, $validated): array {
            /** @var NutritionDietRequest $dietRequest */
            $dietRequest = NutritionDietRequest::query()
                ->with(['user', 'subscription.package', 'dietTemplate', 'prescriptions'])
                ->lockForUpdate()
                ->findOrFail($nutritionDietRequest->id);

            $previous = NutritionDietPrescription::query()
                ->where('nutrition_diet_request_id', $dietRequest->id)
                ->latest('id')
                ->first();

            $this->prescriptionActivation->archiveOtherCurrentPrescriptions((int) $dietRequest->user_id);

            if ($previous) {
                $previous->forceFill([
                    'is_current' => false,
                    'status' => 'archived',
                ])->save();
            }

            $expertFile = $validated['source'] === 'library'
                ? $this->resolveLibraryDietFile((int) ($validated['nutrition_diet_file_id'] ?? 0))
                : $this->storeUploadedExpertDietFile($validated);

            $startedAt = isset($validated['started_at'])
                ? Carbon::parse((string) $validated['started_at'])->toDateString()
                : now()->toDateString();
            $endsAt = isset($validated['ends_at'])
                ? Carbon::parse((string) $validated['ends_at'])->toDateString()
                : Carbon::parse($startedAt)->addDays(14)->toDateString();

            $content = [
                'mode' => 'expert_file',
                'summary_text' => $expertFile['title'],
                'notes' => $expertFile['description'],
                'expert_file' => [
                    ...$expertFile,
                    'group' => $expertFile['group'] ?? null,
                    'calories' => $expertFile['calories'] ?? null,
                ],
                'viewer_message' => [
                    'title' => 'پیام کارشناس شما',
                    'body' => trim((string) ($validated['viewer_message'] ?? '')),
                ],
            ];

            $prescriptionAttributes = [
                'nutrition_diet_request_id' => $dietRequest->id,
                'user_id' => $dietRequest->user_id,
                'nutrition_profile_snapshot_id' => $dietRequest->nutrition_profile_snapshot_id,
                'nutrition_diet_template_id' => $dietRequest->nutrition_diet_template_id,
                'issued_by_user_id' => $actorId,
                'approved_by_user_id' => $actorId,
                'supersedes_prescription_id' => $previous?->id,
                'delivery_channel' => 'expert_file',
                'prescription_mode' => 'fixed_text',
                'status' => 'active',
                'allow_food_replacement' => false,
                'current_weight_kg' => $dietRequest->current_weight_kg,
                'target_weight_kg' => $dietRequest->target_weight_kg,
                'weekly_weight_change_kg' => $dietRequest->weekly_weight_change_kg,
                'started_at' => $startedAt,
                'ends_at' => $endsAt,
                'version' => $previous ? ((int) $previous->version + 1) : 1,
                'is_current' => true,
                'summary_text' => $expertFile['title'],
                'notes' => $expertFile['description'],
                'template_snapshot' => $dietRequest->template_snapshot,
                'profile_snapshot' => $dietRequest->profile_snapshot,
                'content_snapshot' => $content,
                'published_at' => now(),
            ];

            if (Schema::hasColumn('nutrition_prescriptions', 'suggest_daily_replacements')) {
                $prescriptionAttributes['suggest_daily_replacements'] = false;
            }

            $prescription = NutritionDietPrescription::query()->create($prescriptionAttributes);

            $dietRequest->forceFill([
                'status' => 'finished',
                'started_at' => $startedAt,
                'ends_at' => $endsAt,
                'ai_generation_status' => 'not_requested',
                'ai_generation_error' => null,
            ])->save();

            $dietRequest->load(['user', 'subscription.package', 'dietTemplate', 'prescriptions']);

            return [
                'prescription' => $prescription,
                'request' => $dietRequest,
            ];
        });

        $tenantId = tenant('id');
        if ($tenantId) {
            event(NutritionDietRequestUpdated::fromRequest((string) $tenantId, $result['request']));
        }
        $this->notifications->notifyUserExpertPrescriptionReady($result['request'], $result['prescription']);

        return response()->json([
            'success' => true,
            'message' => 'فایل رژیم برای کاربر ارسال شد.',
            'data' => [
                'item' => $this->serializeRequest($result['request']),
            ],
        ]);
    }

    public function adminDeleteExpertFilePrescription(Request $request, NutritionDietRequest $nutritionDietRequest): JsonResponse
    {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));
        abort_if($nutritionDietRequest->request_type !== 'expert', 422, 'حذف فایل فقط برای رژیم اختصاصی کارشناس فعال است.');

        $dietRequest = DB::transaction(function () use ($nutritionDietRequest): NutritionDietRequest {
            /** @var NutritionDietRequest $dietRequest */
            $dietRequest = NutritionDietRequest::query()
                ->with(['user', 'subscription.package', 'dietTemplate', 'prescriptions'])
                ->lockForUpdate()
                ->findOrFail($nutritionDietRequest->id);

            $expertFilePrescriptions = NutritionDietPrescription::query()
                ->where('nutrition_diet_request_id', $dietRequest->id)
                ->where(function ($query): void {
                    $query->where('delivery_channel', 'expert_file')
                        ->orWhere('content_snapshot->mode', 'expert_file');
                })
                ->get();

            abort_if($expertFilePrescriptions->isEmpty(), 404, 'نسخه فایل‌محور برای حذف پیدا نشد.');

            foreach ($expertFilePrescriptions as $prescription) {
                $prescription->delete();
            }

            $dietRequest->forceFill([
                'status' => 'sent',
                'started_at' => null,
                'ends_at' => null,
                'ai_generation_status' => 'not_requested',
                'ai_generation_error' => null,
            ])->save();

            $dietRequest->load(['user', 'subscription.package', 'dietTemplate', 'prescriptions']);

            return $dietRequest;
        });

        return response()->json([
            'success' => true,
            'message' => 'فایل رژیم ارسالی حذف شد و درخواست دوباره آماده ارسال فایل است.',
            'data' => [
                'item' => $this->serializeRequest($dietRequest),
            ],
        ]);
    }

    private function serializeRequest(NutritionDietRequest $item): array
    {
        $prescriptions = $item->relationLoaded('prescriptions')
            ? $item->prescriptions->map(fn (NutritionDietPrescription $prescription): array => $this->serializePrescriptionSummary($prescription))->values()->all()
            : [];
        $mealReplacementSuggestions = collect($prescriptions)
            ->flatMap(fn (array $prescription): array => is_array($prescription['mealReplacementSuggestions'] ?? null) ? $prescription['mealReplacementSuggestions'] : [])
            ->sortByDesc(fn (array $suggestion): string => (string) ($suggestion['requestedAt'] ?? ''))
            ->values()
            ->all();
        $tokenBreakdown = $this->tokenBreakdownPayload($item);
        $hasPendingUnpublishedPrescription = $item->relationLoaded('prescriptions')
            ? $item->prescriptions->contains(fn (NutritionDietPrescription $prescription): bool => $prescription->published_at === null)
            : NutritionDietPrescription::query()
                ->where('nutrition_diet_request_id', $item->id)
                ->whereNull('published_at')
                ->exists();

        $currentPrescription = collect($prescriptions)->firstWhere('isCurrent', true)
            ?? collect($prescriptions)->sortByDesc(fn (array $prescription): int => (int) ($prescription['version'] ?? 0))->first();
        $manualApprovalPending = (bool) $item->requires_manual_delivery_approval
            && $item->request_type === 'ai'
            && $item->ai_generation_status === 'generated'
            && $hasPendingUnpublishedPrescription;

        return [
            'id' => (string) $item->id,
            'requestType' => $item->request_type,
            'requestTypeLabel' => $item->request_type === 'ai' ? 'آنلاین' : 'اختصاصی توسط کارشناس',
            'status' => $item->status,
            'statusLabel' => match ($item->status) {
                'sent' => 'ارسال شده',
                'not_sent' => 'ارسال نشده',
                'finished' => 'تمام شده',
                'in_progress' => 'در حال انجام',
                'cancelled' => 'کنسل شده',
                default => $item->status,
            },
            'askAiEnabled' => (bool) $item->ask_ai_enabled,
            'prescriptionMode' => $item->prescription_mode,
            'allowFoodReplacement' => (bool) $item->allow_food_replacement,
            'suggestDailyReplacements' => (bool) $item->suggest_daily_replacements,
            'requiresManualApproval' => (bool) $item->requires_manual_delivery_approval,
            'manualApprovalPending' => $manualApprovalPending,
            'manualApprovedAt' => $item->manual_delivery_approved_at?->toIso8601String(),
            'dietTemplateId' => $item->nutrition_diet_template_id ? (string) $item->nutrition_diet_template_id : null,
            'dietTemplateName' => $item->diet_template_name,
            'dietGoal' => $item->diet_goal,
            'gender' => $item->gender,
            'athleteMode' => $item->athlete_mode,
            'activityLevel' => $item->activity_level,
            'birthDate' => $item->birth_date?->toDateString(),
            'heightCm' => $item->height_cm,
            'currentWeightKg' => $item->current_weight_kg !== null ? (float) $item->current_weight_kg : null,
            'targetWeightKg' => $item->target_weight_kg !== null ? (float) $item->target_weight_kg : null,
            'weeklyWeightChangeKg' => $item->weekly_weight_change_kg !== null ? (float) $item->weekly_weight_change_kg : null,
            'startedAt' => $item->started_at?->toDateString(),
            'endsAt' => $item->ends_at?->toDateString(),
            'createdAt' => $item->created_at?->toIso8601String(),
            'aiGenerationStatus' => $item->ai_generation_status,
            'aiGenerationStatusLabel' => match ($item->ai_generation_status) {
                'queued' => 'در صف',
                'processing' => 'در حال تولید',
                'generated' => 'تولید شده',
                'cancelled' => 'لغو شده',
                'failed' => 'ناموفق',
                default => 'ثبت نشده',
            },
            'expertNotes' => $item->expert_notes,
            'clinicalNotes' => $item->clinical_notes,
            'generationInstructions' => $item->generation_instructions,
            'mustInclude' => $item->must_include,
            'mustAvoid' => $item->must_avoid,
            'aiJobDispatchedAt' => $item->ai_job_dispatched_at?->toIso8601String(),
            'aiGeneratedAt' => $item->ai_generated_at?->toIso8601String(),
            'aiGenerationError' => $item->ai_generation_error,
            'profileSnapshot' => $item->profile_snapshot,
            'templateSnapshot' => $item->template_snapshot,
            'requestPayloadSnapshot' => $item->request_payload_snapshot,
            'aiPromptSnapshot' => $item->ai_prompt_snapshot,
            'aiResponseSnapshot' => $item->ai_response_snapshot,
            'user' => $item->relationLoaded('user') && $item->user ? [
                'id' => (string) $item->user->id,
                'name' => $item->user->name,
                'mobile' => $item->user->mobile,
            ] : null,
            'subscription' => $item->relationLoaded('subscription') && $item->subscription ? [
                'id' => (string) $item->subscription->id,
                'packageName' => $item->subscription->relationLoaded('package') ? $item->subscription->package?->name : null,
                'endsAt' => $item->subscription->ends_at?->toDateString(),
                'onlineDietTotal' => (int) $item->subscription->online_diet_total,
                'onlineDietUsed' => (int) $item->subscription->online_diet_used,
                'offlineDietTotal' => (int) $item->subscription->offline_diet_total,
                'offlineDietUsed' => (int) $item->subscription->offline_diet_used,
            ] : null,
            'prescriptions' => $prescriptions,
            'currentPrescription' => $currentPrescription,
            'mealReplacementSuggestions' => $mealReplacementSuggestions,
            'tokenBreakdown' => $tokenBreakdown,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function tokenBreakdownPayload(NutritionDietRequest $item): array
    {
        $entries = \App\Domain\Tenant\Models\NutritionTokenLedger::query()
            ->with(['subject', 'actor', 'dietRequest'])
            ->where('nutrition_diet_request_id', $item->id)
            ->where('direction', 'debit')
            ->orderByDesc('occurred_at')
            ->orderByDesc('id')
            ->get();

        $totalConsumedTokens = 0;
        $dietGenerationTokens = 0;
        $dietRevisionTokens = 0;
        $mealReplacementTokens = 0;
        $manualMealNutritionTokens = 0;
        $mealPhotoAnalysisTokens = 0;
        $operationUsageCounts = [
            'meal_photo_analysis' => 0,
            'manual_meal_nutrition' => 0,
            'meal_replacement' => 0,
        ];

        foreach ($entries as $entry) {
            $amount = max(0, (int) $entry->tokens_amount);
            $operationType = (string) data_get($entry->meta_json, 'operation_type', '');

            $totalConsumedTokens += $amount;

            if ($operationType === 'diet_revision') {
                $dietRevisionTokens += $amount;
                continue;
            }

            if ($operationType === 'meal_photo_analysis') {
                $mealPhotoAnalysisTokens += $amount;
                $operationUsageCounts['meal_photo_analysis']++;
                continue;
            }

            if ($operationType === 'meal_replacement' || (string) $entry->reason_code === 'meal_replacement_ai') {
                $mealReplacementTokens += $amount;
                $operationUsageCounts['meal_replacement']++;
                continue;
            }

            if ($operationType === 'manual_meal_nutrition' || (string) $entry->reason_code === 'manual_meal_nutrition_ai') {
                $manualMealNutritionTokens += $amount;
                $operationUsageCounts['manual_meal_nutrition']++;
                continue;
            }

            if ($entry->event_type === 'diet_request_ai') {
                $dietGenerationTokens += $amount;
            }
        }

        return [
            'totalConsumedTokens' => $totalConsumedTokens,
            'dietGenerationTokens' => $dietGenerationTokens,
            'dietRevisionTokens' => $dietRevisionTokens,
            'mealReplacementTokens' => $mealReplacementTokens,
            'manualMealNutritionTokens' => $manualMealNutritionTokens,
            'mealPhotoAnalysisTokens' => $mealPhotoAnalysisTokens,
            'aiUsageLimits' => $this->aiUsageLimitsPayload($item, $operationUsageCounts),
            'entriesCount' => $entries->count(),
            'entries' => $entries
                ->map(fn (\App\Domain\Tenant\Models\NutritionTokenLedger $entry): array => $this->tokens->serializeLedger($entry))
                ->values()
                ->all(),
        ];
    }

    /**
     * @param array<string, int> $operationUsageCounts
     * @return array<string, array<string, mixed>>
     */
    private function aiUsageLimitsPayload(NutritionDietRequest $item, array $operationUsageCounts): array
    {
        $overrides = is_array($item->ai_usage_limits) ? $item->ai_usage_limits : [];

        $items = [
            'mealPhotoAnalysis' => [
                'operationType' => 'meal_photo_analysis',
                'label' => 'تحلیل عکس غذا',
                'globalDietLimit' => $this->settings->mealPhotoAnalysisDietLimit(),
                'globalHourlyLimit' => $this->settings->mealPhotoAnalysisHourlyLimit(),
            ],
            'manualMealNutrition' => [
                'operationType' => 'manual_meal_nutrition',
                'label' => 'محاسبه کالری غذای دستی',
                'globalDietLimit' => $this->settings->manualMealNutritionDietLimit(),
                'globalHourlyLimit' => $this->settings->manualMealNutritionHourlyLimit(),
            ],
            'mealReplacement' => [
                'operationType' => 'meal_replacement',
                'label' => 'جایگزین غذا',
                'globalDietLimit' => $this->settings->mealReplacementDietLimit(),
                'globalHourlyLimit' => $this->settings->mealReplacementHourlyLimit(),
            ],
        ];

        foreach ($items as $key => $payload) {
            $operationType = $payload['operationType'];
            $overrideLimit = data_get($overrides, "{$operationType}.diet_limit");
            $overrideLimit = $overrideLimit !== null && $overrideLimit !== '' ? max(1, (int) $overrideLimit) : null;
            $overrideHourlyLimit = data_get($overrides, "{$operationType}.hourly_limit");
            $overrideHourlyLimit = $overrideHourlyLimit !== null && $overrideHourlyLimit !== '' ? max(1, (int) $overrideHourlyLimit) : null;
            $effectiveLimit = $overrideLimit ?? $payload['globalDietLimit'];
            $effectiveHourlyLimit = $overrideHourlyLimit ?? $payload['globalHourlyLimit'];
            $usedCount = (int) ($operationUsageCounts[$operationType] ?? 0);

            $items[$key]['overrideDietLimit'] = $overrideLimit;
            $items[$key]['overrideHourlyLimit'] = $overrideHourlyLimit;
            $items[$key]['effectiveDietLimit'] = $effectiveLimit;
            $items[$key]['effectiveHourlyLimit'] = $effectiveHourlyLimit;
            $items[$key]['usedCount'] = $usedCount;
            $items[$key]['remainingCount'] = $effectiveLimit !== null ? max(0, (int) $effectiveLimit - $usedCount) : null;
        }

        return $items;
    }

    /**
     * @return array<string, mixed>
     */
    private function normalizePrescriptionContent(NutritionDietPrescription $prescription): array
    {
        $content = is_array($prescription->content_snapshot) ? $prescription->content_snapshot : [];
        $profile = is_array($prescription->profile_snapshot) ? $prescription->profile_snapshot : [];
        $template = is_array($prescription->template_snapshot) ? $prescription->template_snapshot : [];
        $prescription->loadMissing('request');
        $request = $prescription->request;
        $instructionText = trim(implode("\n", array_filter([
            $request?->generation_instructions,
            $request?->must_include,
            $request?->expert_notes,
            $request?->clinical_notes,
        ], fn ($value): bool => trim((string) $value) !== '')));
        $supplementRequested = preg_match('/مکمل|supplement/ui', $instructionText) === 1;

        $currentCaloriePlan = is_array($content['calorie_plan'] ?? null) ? $content['calorie_plan'] : [];
        $needsCalorieFallback = ! is_array($content['calorie_plan'] ?? null)
            || (int) ($currentCaloriePlan['base_calories'] ?? 0) <= 0
            || (int) ($currentCaloriePlan['prescribed_calories'] ?? 0) <= 0
            || trim((string) ($currentCaloriePlan['summary_text'] ?? $currentCaloriePlan['reasoning'] ?? '')) === '';

        if ($needsCalorieFallback) {
            $baseCalories = max(1200, (int) round(((float) ($prescription->current_weight_kg ?? 0)) * 24));
            $prescribedCalories = collect(is_array($content['meal_slots'] ?? null) ? $content['meal_slots'] : [])
                ->sum(fn ($slot): int => is_array($slot) ? (int) ($slot['target_calories'] ?? 0) : 0);

            if ($prescribedCalories <= 0) {
                $prescribedCalories = max(900, $baseCalories - (int) round(((float) ($prescription->weekly_weight_change_kg ?? 0)) * 250));
            }

            $content['calorie_plan'] = [
                ...$currentCaloriePlan,
                'base_calories' => $baseCalories,
                'prescribed_calories' => $prescribedCalories,
                'goal_adjustment' => sprintf('هدف این نسخه با سرعت %s کیلو در هفته تنظیم شده است.', number_format((float) ($prescription->weekly_weight_change_kg ?? 0), 1)),
                'reasoning' => 'کالری نسخه بر اساس کالری پایه، هدف کاربر و سرعت تغییر وزن تنظیم شده است.',
                'summary_text' => sprintf('کالری پایه کاربر %d و کالری نسخه %d در نظر گرفته شده است.', $baseCalories, $prescribedCalories),
            ];
        }

        if (! is_array($content['water_plan'] ?? null)) {
            $weightKg = isset($profile['weightKg']) ? (float) $profile['weightKg'] : (float) ($prescription->current_weight_kg ?? 0);
            $targetMl = max(1800, (int) round(($weightKg > 0 ? $weightKg : 60) * 35));
            $content['water_plan'] = [
                'daily_target_ml' => $targetMl,
                'daily_target_glasses' => max(6, (int) round($targetMl / 250)),
                'summary_text' => 'مقدار آب این نسخه بر اساس شرایط کاربر تنظیم شده است.',
                'timing_tips' => ['یک لیوان بعد از بیدار شدن', 'یک لیوان بین وعده‌ها', 'یک لیوان عصر'],
            ];
        }

        $templateNotes = trim((string) ($template['supplementNotes'] ?? ''));
        $fallbackSupplementUsage = trim((string) ($request?->must_include ?: $request?->generation_instructions ?: $request?->expert_notes ?: $templateNotes));
        $currentSupplementPlan = is_array($content['supplement_plan'] ?? null) ? $content['supplement_plan'] : [];
        $existingItems = array_values(array_filter(
            is_array($currentSupplementPlan['items'] ?? null) ? $currentSupplementPlan['items'] : [],
            fn ($item): bool => is_array($item) && ! empty($item),
        ));
        $enabled = (bool) ($currentSupplementPlan['enabled'] ?? false)
            || (bool) ($template['supplementsEnabled'] ?? false)
            || $supplementRequested;
        $needsSupplementFallback = ! is_array($content['supplement_plan'] ?? null)
            || ($enabled && count($existingItems) === 0)
            || ($enabled && trim((string) ($currentSupplementPlan['summary_text'] ?? '')) === '');

        if ($needsSupplementFallback) {
            $content['supplement_plan'] = [
                ...$currentSupplementPlan,
                'enabled' => $enabled,
                'summary_text' => $enabled
                    ? ($templateNotes !== '' ? $templateNotes : ($fallbackSupplementUsage !== '' ? $fallbackSupplementUsage : 'در این نسخه مکمل متناسب با شرایط کاربر در نظر گرفته شده است.'))
                    : 'در این نسخه مکمل ضروری ثبت نشده است.',
                'items' => $enabled
                    ? (count($existingItems) > 0
                        ? $existingItems
                        : [[
                            'title' => 'مکمل پیشنهادی',
                            'usage' => $fallbackSupplementUsage !== '' ? $fallbackSupplementUsage : 'مصرف مکمل طبق شرایط و هدف این نسخه پیشنهاد می‌شود.',
                            'timing' => 'طبق دستور نسخه',
                            'notes' => 'مصرف مکمل با شرایط فعلی کاربر بررسی شود.',
                        ]])
                    : [],
            ];
        }

        return $content;
    }

    private function serializePrescriptionSummary(NutritionDietPrescription $prescription): array
    {
        $effectiveExpired = $prescription->ends_at ? ! $prescription->ends_at->isFuture() : false;
        $contentSnapshot = $this->normalizePrescriptionContent($prescription);
        $mealReplacementSuggestions = Schema::hasTable('nutrition_meal_replacement_suggestions')
            ? NutritionMealReplacementSuggestion::query()
                ->where('nutrition_diet_prescription_id', $prescription->id)
                ->orderByDesc('requested_at')
                ->orderByDesc('id')
                ->get()
                ->map(fn (NutritionMealReplacementSuggestion $suggestion): array => $this->serializeMealReplacementSuggestion($suggestion))
                ->values()
                ->all()
            : [];
        $mealLogs = DB::table('nutrition_meal_logs')
            ->where('nutrition_diet_prescription_id', $prescription->id)
            ->orderBy('consumed_date')
            ->orderBy('id')
            ->get()
            ->map(fn ($log): array => [
                'id' => (string) $log->id,
                'consumedDate' => $log->consumed_date,
                'mealSlotKey' => $log->meal_slot_key,
                'foodTitle' => $log->food_title,
                'foodDescription' => $log->food_description,
                'quantityText' => $log->quantity_text,
                'calories' => property_exists($log, 'option_calories') && $log->option_calories !== null ? (int) $log->option_calories : $this->extractLoggedCalories((string) ($log->notes ?? '')),
                'proteinGrams' => property_exists($log, 'protein_grams') && $log->protein_grams !== null ? (float) $log->protein_grams : $this->extractLoggedMacro((string) ($log->notes ?? ''), 'protein_grams'),
                'fatGrams' => property_exists($log, 'fat_grams') && $log->fat_grams !== null ? (float) $log->fat_grams : $this->extractLoggedMacro((string) ($log->notes ?? ''), 'fat_grams'),
                'carbohydrateGrams' => property_exists($log, 'carbohydrate_grams') && $log->carbohydrate_grams !== null ? (float) $log->carbohydrate_grams : $this->extractLoggedMacro((string) ($log->notes ?? ''), 'carbohydrate_grams'),
                'fiberGrams' => property_exists($log, 'fiber_grams') && $log->fiber_grams !== null ? (float) $log->fiber_grams : $this->extractLoggedMacro((string) ($log->notes ?? ''), 'fiber_grams'),
                'aiNutritionStatus' => property_exists($log, 'ai_nutrition_status') ? (string) ($log->ai_nutrition_status ?? 'not_requested') : 'not_requested',
                'aiNutritionError' => property_exists($log, 'ai_nutrition_error') ? $log->ai_nutrition_error : null,
                'notes' => $log->notes,
                'status' => $log->status,
                'consumptionType' => $log->consumption_type,
                'isManual' => $log->consumption_type === 'manual',
                'manualEntryMethod' => property_exists($log, 'manual_entry_method') ? ($log->manual_entry_method ?: 'manual') : 'manual',
                'photoUrl' => property_exists($log, 'photo_path') && ! empty($log->photo_path) ? Storage::disk('media_public')->url((string) $log->photo_path) : null,
            ])
            ->values()
            ->all();

        $waterLogs = DB::table('nutrition_water_logs')
            ->where('nutrition_diet_prescription_id', $prescription->id)
            ->orderBy('consumed_date')
            ->orderBy('id')
            ->get()
            ->map(fn ($log): array => [
                'id' => (string) $log->id,
                'consumedDate' => $log->consumed_date,
                'amountMl' => (int) $log->amount_ml,
                'glasses' => $this->extractLoggedGlasses((string) ($log->notes ?? ''), (int) $log->amount_ml),
            ])
            ->values()
            ->all();
        $exerciseLogs = [];

        if (Schema::hasTable('exercise_logs')) {
            $exerciseLogsQuery = DB::table('exercise_logs')
                ->where('user_id', $prescription->user_id)
                ->orderBy('consumed_date')
                ->orderBy('id');

            if ($prescription->started_at && $prescription->ends_at) {
                $exerciseLogsQuery->whereBetween('consumed_date', [
                    $prescription->started_at->toDateString(),
                    $prescription->ends_at->toDateString(),
                ]);
            }

            $effectiveExpired = $prescription->ends_at ? ! $prescription->ends_at->isFuture() : false;
            $effectiveCurrent = (bool) $prescription->is_current && ! $effectiveExpired;

            if ($effectiveCurrent) {
                $exerciseLogsQuery->where(function ($query) use ($prescription): void {
                    $query->where('nutrition_diet_prescription_id', $prescription->id)
                        ->orWhereNull('nutrition_diet_prescription_id');
                });
            } else {
                $exerciseLogsQuery->where('nutrition_diet_prescription_id', $prescription->id);
            }

            $exerciseLogs = $exerciseLogsQuery
                ->get()
                ->map(fn ($log): array => [
                    'id' => (string) $log->id,
                    'consumedDate' => $log->consumed_date,
                    'exerciseId' => property_exists($log, 'tenant_nutrition_exercise_id') && $log->tenant_nutrition_exercise_id
                        ? ('tenant-' . $log->tenant_nutrition_exercise_id)
                        : ($log->nutrition_exercise_id ? ('central-' . $log->nutrition_exercise_id) : null),
                    'title' => $log->exercise_title,
                    'groupTitle' => $log->exercise_group_title,
                    'iconKey' => $log->exercise_icon_key,
                    'intensity' => $log->intensity,
                    'durationMinutes' => (int) ($log->duration_minutes ?? 0),
                    'distanceKm' => $log->distance_km !== null ? (float) $log->distance_km : null,
                    'speedKmh' => $log->speed_kmh !== null ? (float) $log->speed_kmh : null,
                    'weightKg' => $log->weight_kg !== null ? (float) $log->weight_kg : null,
                    'caloriesBurned' => (int) ($log->calories_burned ?? 0),
                    'notes' => $log->notes,
                ])
                ->values()
                ->all();
        }

        return [
            'id' => (string) $prescription->id,
            'status' => $prescription->status,
            'deliveryChannel' => $prescription->delivery_channel,
            'prescriptionMode' => $prescription->prescription_mode,
            'allowFoodReplacement' => (bool) $prescription->allow_food_replacement,
            'suggestDailyReplacements' => (bool) $prescription->suggest_daily_replacements,
            'isCurrent' => (bool) $prescription->is_current && ! $effectiveExpired,
            'startedAt' => $prescription->started_at?->toDateString(),
            'endsAt' => $prescription->ends_at?->toDateString(),
            'version' => (int) $prescription->version,
            'summaryText' => $prescription->summary_text,
            'notes' => $prescription->notes,
            'contentSnapshot' => $contentSnapshot,
            'expertFile' => $this->extractExpertFilePayload($contentSnapshot),
            'mealReplacementSuggestions' => $mealReplacementSuggestions,
            'mealLogs' => $mealLogs,
            'waterLogs' => $waterLogs,
            'exerciseLogs' => $exerciseLogs,
            'progress' => $this->progressSummary($contentSnapshot, $mealLogs, $waterLogs),
            'publishedAt' => $prescription->published_at?->toIso8601String(),
        ];
    }

    private function serializeMealReplacementSuggestion(NutritionMealReplacementSuggestion $suggestion): array
    {
        $context = is_array($suggestion->context_snapshot) ? $suggestion->context_snapshot : [];
        $promptPreferences = is_array($context['prompt_preferences'] ?? null) ? $context['prompt_preferences'] : [];
        $promptSnapshot = is_array($suggestion->ai_prompt_snapshot) ? $suggestion->ai_prompt_snapshot : [];
        $promptPreferenceMode = (string) ($promptPreferences['mode'] ?? 'tenant');

        return [
            'id' => (string) $suggestion->id,
            'prescriptionId' => (string) $suggestion->nutrition_diet_prescription_id,
            'sourceType' => $suggestion->source_type,
            'sourceSignature' => $suggestion->source_signature,
            'mealSlotKey' => $suggestion->meal_slot_key,
            'slotTitle' => $suggestion->slot_title,
            'dayNumber' => $suggestion->day_number !== null ? (int) $suggestion->day_number : null,
            'mealIndex' => $suggestion->meal_index !== null ? (int) $suggestion->meal_index : null,
            'cacheScope' => $context['cache_scope'] ?? null,
            'cacheScopeLabel' => $context['cache_scope_label'] ?? null,
            'suggestionCount' => (int) $suggestion->suggestion_count,
            'status' => $suggestion->status,
            'errorMessage' => $suggestion->error_message,
            'requestedAt' => $suggestion->requested_at?->toIso8601String(),
            'generatedAt' => $suggestion->generated_at?->toIso8601String(),
            'cancelledAt' => $suggestion->cancelled_at?->toIso8601String(),
            'promptMode' => $promptPreferenceMode,
            'promptModeLabel' => match ($promptPreferenceMode) {
                'default' => 'پیش فرض سیستم',
                'custom' => 'سفارشی مدیر',
                default => 'تنظیمات فعلی مدیر',
            },
            'customPrompt' => $promptPreferenceMode === 'custom' ? ($promptPreferences['custom_text'] ?? null) : null,
            'effectiveSystemPrompt' => $promptSnapshot['systemPrompt'] ?? null,
            'options' => collect(is_array($suggestion->options) ? $suggestion->options : [])
                ->map(function ($item, int $index): array {
                    $data = is_array($item) ? $item : [];

                    return [
                        'id' => (string) ($data['id'] ?? ('suggestion_' . ($index + 1))),
                        'title' => trim((string) ($data['title'] ?? '')),
                        'description' => trim((string) ($data['description'] ?? '')),
                        'preparationText' => trim((string) ($data['preparation_text'] ?? '')),
                        'quantityText' => trim((string) ($data['quantity_text'] ?? '')),
                        'grams' => max(0, (int) ($data['grams'] ?? 0)),
                        'calories' => max(0, (int) ($data['calories'] ?? 0)),
                        'matchReason' => trim((string) ($data['match_reason'] ?? '')),
                    ];
                })
                ->values()
                ->all(),
        ];
    }

    /**
     * @param array<string, mixed> $contentSnapshot
     * @param array<int, array<string, mixed>> $mealLogs
     * @param array<int, array<string, mixed>> $waterLogs
     * @return array<string, mixed>
     */
    private function progressSummary(array $contentSnapshot, array $mealLogs, array $waterLogs): array
    {
        if (($contentSnapshot['mode'] ?? null) === 'expert_file' || is_array($contentSnapshot['expert_file'] ?? null)) {
            return [
                'expectedMealsPerDay' => 0,
                'loggedMeals' => 0,
                'expectedMeals' => 0,
                'progressPercent' => 0,
                'days' => [],
            ];
        }

        $slotKeys = collect(is_array($contentSnapshot['meal_slots'] ?? null) ? $contentSnapshot['meal_slots'] : [])
            ->map(fn ($slot): string => trim((string) (is_array($slot) ? ($slot['slot_key'] ?? '') : '')))
            ->filter()
            ->values();

        if ($slotKeys->isEmpty()) {
            $slotKeys = collect(is_array($contentSnapshot['day_plans'] ?? null) ? $contentSnapshot['day_plans'] : [])
                ->flatMap(function ($plan): array {
                    if (! is_array($plan) || ! is_array($plan['meals'] ?? null)) {
                        return [];
                    }

                    return collect($plan['meals'])
                        ->map(fn ($meal): string => trim((string) (is_array($meal) ? ($meal['slot_key'] ?? '') : '')))
                        ->filter()
                        ->values()
                        ->all();
                })
                ->unique()
                ->values();
        }

        $expectedPerDay = max(1, $slotKeys->count());
        $grouped = collect($mealLogs)
            ->groupBy(fn ($log): string => (string) ($log['consumedDate'] ?? ''));

        $days = $grouped->map(function ($logs, $date) use ($expectedPerDay, $waterLogs): array {
            $loggedSlots = collect($logs)
                ->map(fn ($log): string => (string) ($log['mealSlotKey'] ?? ''))
                ->filter()
                ->unique()
                ->count();

            $water = collect($waterLogs)->firstWhere('consumedDate', $date);
            $percent = (int) min(100, round(($loggedSlots / max(1, $expectedPerDay)) * 100));

            return [
                'date' => $date,
                'loggedMeals' => $loggedSlots,
                'expectedMeals' => $expectedPerDay,
                'progressPercent' => $percent,
                'status' => $loggedSlots >= $expectedPerDay ? 'complete' : ($loggedSlots > 0 ? 'partial' : 'empty'),
                'waterGlasses' => (int) ($water['glasses'] ?? 0),
            ];
        })->values()->all();

        $totalLoggedMeals = collect($days)->sum('loggedMeals');
        $totalExpectedMeals = max($expectedPerDay, count($days) * $expectedPerDay);

        return [
            'expectedMealsPerDay' => $expectedPerDay,
            'loggedMeals' => $totalLoggedMeals,
            'expectedMeals' => $totalExpectedMeals,
            'progressPercent' => (int) min(100, round(($totalLoggedMeals / max(1, $totalExpectedMeals)) * 100)),
            'days' => $days,
        ];
    }

    private function extractLoggedGlasses(string $notes, int $amountMl): int
    {
        if (preg_match('/glasses:(\d+)/', $notes, $matches) === 1) {
            return (int) $matches[1];
        }

        return (int) floor($amountMl / 250);
    }

    private function extractLoggedCalories(string $notes): int
    {
        if (preg_match('/(?:^|\|)\s*calories:(\d+)/', $notes, $matches) === 1) {
            return (int) $matches[1];
        }

        return 0;
    }

    private function extractLoggedMacro(string $notes, string $key): float
    {
        if (preg_match('/(?:^|\|)\s*' . preg_quote($key, '/') . ':(\d+(?:\.\d+)?)/', $notes, $matches) === 1) {
            return (float) $matches[1];
        }

        return 0.0;
    }

    private function resolveDietDurationDays(NutritionDietRequest $request, ?NutritionDietPrescription $prescription = null): int
    {
        $template = is_array($request->template_snapshot) ? $request->template_snapshot : [];
        $templateDuration = (int) ($template['durationDays'] ?? 0);

        if ($templateDuration > 0) {
            return $templateDuration;
        }

        if ($request->started_at && $request->ends_at) {
            return max(1, $request->started_at->diffInDays($request->ends_at) + 1);
        }

        if ($prescription?->started_at && $prescription->ends_at) {
            return max(1, $prescription->started_at->diffInDays($prescription->ends_at) + 1);
        }

        return 14;
    }

    /**
     * @param array<string, mixed> $content
     * @param array<string, mixed> $validated
     */
    private function applyUserChoiceOptionEdit(array &$content, array $validated): bool
    {
        $slotKey = trim((string) ($validated['slot_key'] ?? ''));
        $optionIndex = (int) ($validated['option_index'] ?? -1);

        if (! is_array($content['meal_slots'] ?? null) || $slotKey === '' || $optionIndex < 0) {
            return false;
        }

        foreach ($content['meal_slots'] as &$slot) {
            if (! is_array($slot) || trim((string) ($slot['slot_key'] ?? '')) !== $slotKey || ! isset($slot['options'][$optionIndex]) || ! is_array($slot['options'][$optionIndex])) {
                continue;
            }

            $slot['options'][$optionIndex]['title'] = trim((string) ($validated['title'] ?? $slot['options'][$optionIndex]['title'] ?? ''));
            $slot['options'][$optionIndex]['description'] = trim((string) ($validated['description'] ?? $slot['options'][$optionIndex]['description'] ?? ''));
            $slot['options'][$optionIndex]['quantity_text'] = trim((string) ($validated['quantity_text'] ?? $slot['options'][$optionIndex]['quantity_text'] ?? ''));
            $slot['options'][$optionIndex]['grams'] = isset($validated['grams']) ? (int) $validated['grams'] : ($slot['options'][$optionIndex]['grams'] ?? null);
            $slot['options'][$optionIndex]['calories'] = isset($validated['calories']) ? (int) $validated['calories'] : ($slot['options'][$optionIndex]['calories'] ?? null);
            $slot['options'][$optionIndex]['protein_grams'] = isset($validated['protein_grams']) ? round((float) $validated['protein_grams'], 2) : ($slot['options'][$optionIndex]['protein_grams'] ?? null);
            $slot['options'][$optionIndex]['fat_grams'] = isset($validated['fat_grams']) ? round((float) $validated['fat_grams'], 2) : ($slot['options'][$optionIndex]['fat_grams'] ?? null);
            $slot['options'][$optionIndex]['carbohydrate_grams'] = isset($validated['carbohydrate_grams']) ? round((float) $validated['carbohydrate_grams'], 2) : ($slot['options'][$optionIndex]['carbohydrate_grams'] ?? null);
            $slot['options'][$optionIndex]['fiber_grams'] = isset($validated['fiber_grams']) ? round((float) $validated['fiber_grams'], 2) : ($slot['options'][$optionIndex]['fiber_grams'] ?? null);

            return true;
        }

        return false;
    }

    /**
     * @param array<string, mixed> $content
     * @param array<string, mixed> $validated
     */
    private function applyDailyMealEdit(array &$content, array $validated): bool
    {
        $dayNumber = (int) ($validated['day_number'] ?? 0);
        $mealIndex = (int) ($validated['meal_index'] ?? -1);

        if (! is_array($content['day_plans'] ?? null) || $dayNumber <= 0 || $mealIndex < 0) {
            return false;
        }

        foreach ($content['day_plans'] as &$plan) {
            if (! is_array($plan) || (int) ($plan['day_number'] ?? 0) !== $dayNumber || ! isset($plan['meals'][$mealIndex]) || ! is_array($plan['meals'][$mealIndex])) {
                continue;
            }

            $plan['meals'][$mealIndex]['title'] = trim((string) ($validated['title'] ?? $plan['meals'][$mealIndex]['title'] ?? ''));
            $plan['meals'][$mealIndex]['description'] = trim((string) ($validated['description'] ?? $plan['meals'][$mealIndex]['description'] ?? ''));
            $plan['meals'][$mealIndex]['meal_text'] = trim((string) ($validated['meal_text'] ?? $plan['meals'][$mealIndex]['meal_text'] ?? ''));
            $plan['meals'][$mealIndex]['grams'] = isset($validated['grams']) ? (int) $validated['grams'] : ($plan['meals'][$mealIndex]['grams'] ?? null);
            $plan['meals'][$mealIndex]['calories'] = isset($validated['calories']) ? (int) $validated['calories'] : ($plan['meals'][$mealIndex]['calories'] ?? null);
            $plan['meals'][$mealIndex]['protein_grams'] = isset($validated['protein_grams']) ? round((float) $validated['protein_grams'], 2) : ($plan['meals'][$mealIndex]['protein_grams'] ?? null);
            $plan['meals'][$mealIndex]['fat_grams'] = isset($validated['fat_grams']) ? round((float) $validated['fat_grams'], 2) : ($plan['meals'][$mealIndex]['fat_grams'] ?? null);
            $plan['meals'][$mealIndex]['carbohydrate_grams'] = isset($validated['carbohydrate_grams']) ? round((float) $validated['carbohydrate_grams'], 2) : ($plan['meals'][$mealIndex]['carbohydrate_grams'] ?? null);
            $plan['meals'][$mealIndex]['fiber_grams'] = isset($validated['fiber_grams']) ? round((float) $validated['fiber_grams'], 2) : ($plan['meals'][$mealIndex]['fiber_grams'] ?? null);

            return true;
        }

        return false;
    }

    /**
     * @param array<string, mixed> $content
     * @param array<string, mixed> $validated
     */
    private function applyDailyReplacementEdit(array &$content, array $validated): bool
    {
        $dayNumber = (int) ($validated['day_number'] ?? 0);
        $mealIndex = (int) ($validated['meal_index'] ?? -1);
        $replacementIndex = (int) ($validated['replacement_index'] ?? -1);

        if (! is_array($content['day_plans'] ?? null) || $dayNumber <= 0 || $mealIndex < 0 || $replacementIndex < 0) {
            return false;
        }

        foreach ($content['day_plans'] as &$plan) {
            if (! is_array($plan) || (int) ($plan['day_number'] ?? 0) !== $dayNumber || ! isset($plan['meals'][$mealIndex]['replacements'][$replacementIndex]) || ! is_array($plan['meals'][$mealIndex]['replacements'][$replacementIndex])) {
                continue;
            }

            $replacement = &$plan['meals'][$mealIndex]['replacements'][$replacementIndex];
            $replacement['title'] = trim((string) ($validated['title'] ?? $replacement['title'] ?? ''));
            $replacement['description'] = trim((string) ($validated['description'] ?? $replacement['description'] ?? ''));
            $replacement['quantity_text'] = trim((string) ($validated['quantity_text'] ?? $replacement['quantity_text'] ?? ''));
            $replacement['grams'] = isset($validated['grams']) ? (int) $validated['grams'] : ($replacement['grams'] ?? null);
            $replacement['calories'] = isset($validated['calories']) ? (int) $validated['calories'] : ($replacement['calories'] ?? null);
            $replacement['protein_grams'] = isset($validated['protein_grams']) ? round((float) $validated['protein_grams'], 2) : ($replacement['protein_grams'] ?? null);
            $replacement['fat_grams'] = isset($validated['fat_grams']) ? round((float) $validated['fat_grams'], 2) : ($replacement['fat_grams'] ?? null);
            $replacement['carbohydrate_grams'] = isset($validated['carbohydrate_grams']) ? round((float) $validated['carbohydrate_grams'], 2) : ($replacement['carbohydrate_grams'] ?? null);
            $replacement['fiber_grams'] = isset($validated['fiber_grams']) ? round((float) $validated['fiber_grams'], 2) : ($replacement['fiber_grams'] ?? null);

            return true;
        }

        return false;
    }

    /**
     * @param array<string, mixed> $content
     * @param array<string, mixed> $validated
     */
    private function applyFixedTextSectionEdit(array &$content, array $validated): bool
    {
        $sectionIndex = (int) ($validated['section_index'] ?? -1);

        if (! is_array($content['text_sections'] ?? null) || $sectionIndex < 0 || ! isset($content['text_sections'][$sectionIndex]) || ! is_array($content['text_sections'][$sectionIndex])) {
            return false;
        }

        $content['text_sections'][$sectionIndex]['title'] = trim((string) ($validated['title'] ?? $content['text_sections'][$sectionIndex]['title'] ?? ''));
        $content['text_sections'][$sectionIndex]['body'] = trim((string) ($validated['body'] ?? $content['text_sections'][$sectionIndex]['body'] ?? ''));

        return true;
    }

    private function applyViewerMessageEdit(array &$content, array $validated): bool
    {
        $title = trim((string) ($validated['title'] ?? ''));
        $body = trim((string) ($validated['body'] ?? ''));

        if ($title === '' && $body === '') {
            unset($content['viewer_message']);

            return true;
        }

        $content['viewer_message'] = [
            'title' => $title !== '' ? $title : 'پیام کارشناس شما',
            'body' => $body,
        ];

        return true;
    }

    private function adminRequestsQuery(Request $request): Builder
    {
        $query = NutritionDietRequest::query();
        $search = trim((string) $request->query('q', ''));

        if ($search !== '') {
            $query->where(function (Builder $builder) use ($search): void {
                $builder->where('id', $search)
                    ->orWhere('diet_template_name', 'like', '%' . $search . '%')
                    ->orWhere('status', 'like', '%' . $search . '%')
                    ->orWhere('request_type', 'like', '%' . $search . '%')
                    ->orWhereHas('user', function (Builder $userQuery) use ($search): void {
                        $userQuery->where('name', 'like', '%' . $search . '%')
                            ->orWhere('mobile', 'like', '%' . $search . '%');
                    });
            });
        }

        return $query;
    }

    private function applyAdminQuickFilter(Builder $query, string $quickFilter): Builder
    {
        return match ($quickFilter) {
            'ai' => $query->where('request_type', 'ai'),
            'expert' => $query->where('request_type', 'expert'),
            'queued_ai' => $query
                ->where('request_type', 'ai')
                ->where('ai_generation_status', 'queued'),
            'processing_ai' => $query
                ->where('request_type', 'ai')
                ->where('ai_generation_status', 'processing'),
            'generated_ai' => $query
                ->where('request_type', 'ai')
                ->where('ai_generation_status', 'generated'),
            'not_generated' => $query
                ->where('request_type', 'ai')
                ->where(function (Builder $builder): void {
                    $builder->where('ai_generation_status', '!=', 'generated')
                        ->orWhereNull('ai_generation_status');
                }),
            'failed_ai' => $query
                ->where('request_type', 'ai')
                ->where('ai_generation_status', 'failed'),
            'pending_approval' => $query
                ->where('request_type', 'ai')
                ->where('requires_manual_delivery_approval', true)
                ->where('ai_generation_status', 'generated')
                ->whereHas('prescriptions', fn (Builder $builder): Builder => $builder->whereNull('published_at')),
            'expert_manual_delivery' => $query
                ->where('request_type', 'expert')
                ->whereDoesntHave('prescriptions'),
            default => $query,
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function resolveLibraryDietFile(int $dietFileId): array
    {
        $row = DB::table('nutrition_diet_files')
            ->leftJoin('nutrition_diet_file_groups', 'nutrition_diet_file_groups.id', '=', 'nutrition_diet_files.nutrition_diet_file_group_id')
            ->select([
                'nutrition_diet_files.*',
                DB::raw('COALESCE(nutrition_diet_file_groups.name, nutrition_diet_files.group_name_snapshot) as group_name'),
            ])
            ->where('nutrition_diet_files.id', $dietFileId)
            ->where('nutrition_diet_files.is_active', true)
            ->first();

        abort_unless($row, 404, 'فایل رژیم آماده پیدا نشد.');

        return [
            'source' => 'library',
            'libraryFileId' => (string) $row->id,
            'title' => (string) $row->title,
            'description' => $row->description,
            'calories' => $row->calories !== null ? (int) $row->calories : null,
            'fileName' => (string) $row->file_name,
            'filePath' => (string) $row->file_path,
            'fileUrl' => Storage::disk('public')->url((string) $row->file_path),
            'mimeType' => $row->mime_type,
            'fileSize' => $row->file_size !== null ? (int) $row->file_size : null,
            'group' => ($row->nutrition_diet_file_group_id || $row->group_name) ? [
                'id' => $row->nutrition_diet_file_group_id ? (string) $row->nutrition_diet_file_group_id : null,
                'name' => $row->group_name,
            ] : null,
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function storeUploadedExpertDietFile(array $validated): array
    {
        abort_unless(($validated['file'] ?? null) instanceof UploadedFile, 422, 'فایل رژیم را انتخاب کنید.');

        /** @var UploadedFile $file */
        $file = $validated['file'];
        $path = $file->store('nutrition/prescription-files', 'media_public');
        $this->recordTenantMediaFile($path, (int) $file->getSize());
        $groupName = null;

        if (! empty($validated['nutrition_diet_file_group_id'])) {
            $groupName = DB::table('nutrition_diet_file_groups')
                ->where('id', (int) $validated['nutrition_diet_file_group_id'])
                ->value('name');
        }

        return [
            'source' => 'upload',
            'libraryFileId' => null,
            'title' => trim((string) ($validated['title'] ?? '')) !== ''
                ? trim((string) $validated['title'])
                : pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME),
            'description' => $this->nullableTrim($validated['description'] ?? null),
            'calories' => isset($validated['calories']) ? (int) $validated['calories'] : null,
            'fileName' => $file->getClientOriginalName(),
            'filePath' => $path,
            'fileUrl' => Storage::disk('public')->url($path),
            'mimeType' => $file->getClientMimeType(),
            'fileSize' => $file->getSize(),
            'group' => ! empty($validated['nutrition_diet_file_group_id']) ? [
                'id' => (string) $validated['nutrition_diet_file_group_id'],
                'name' => $groupName,
            ] : null,
        ];
    }

    /**
     * @param  array<string, mixed>  $contentSnapshot
     * @return array<string, mixed>|null
     */
    private function extractExpertFilePayload(array $contentSnapshot): ?array
    {
        $file = is_array($contentSnapshot['expert_file'] ?? null) ? $contentSnapshot['expert_file'] : null;

        if (! $file) {
            return null;
        }

        return [
            'source' => isset($file['source']) ? (string) $file['source'] : 'upload',
            'libraryFileId' => isset($file['libraryFileId']) && $file['libraryFileId'] !== null ? (string) $file['libraryFileId'] : null,
            'title' => trim((string) ($file['title'] ?? '')),
            'description' => $this->nullableTrim($file['description'] ?? null),
            'calories' => isset($file['calories']) && $file['calories'] !== null ? (int) $file['calories'] : null,
            'fileName' => trim((string) ($file['fileName'] ?? '')),
            'filePath' => trim((string) ($file['filePath'] ?? '')),
            'fileUrl' => trim((string) ($file['fileUrl'] ?? '')),
            'mimeType' => $this->nullableTrim($file['mimeType'] ?? null),
            'fileSize' => isset($file['fileSize']) && $file['fileSize'] !== null ? (int) $file['fileSize'] : null,
            'group' => is_array($file['group'] ?? null) ? [
                'id' => isset($file['group']['id']) ? (string) $file['group']['id'] : null,
                'name' => isset($file['group']['name']) ? (string) $file['group']['name'] : null,
            ] : null,
        ];
    }

    /**
     * @param  mixed  $value
     * @return array<string, string>
     */
    private function normalizeRepeatDietFeedback(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $allowedKeys = [
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

        $payload = [];

        foreach ($allowedKeys as $key) {
            $normalized = $this->nullableTrim($value[$key] ?? null);
            if ($normalized !== null) {
                $payload[$key] = $normalized;
            }
        }

        return $payload;
    }

    private function nullableTrim(mixed $value): ?string
    {
        $trimmed = trim((string) $value);

        return $trimmed === '' ? null : $trimmed;
    }

    private function resolveFirstDietTemplateId(NutritionProfile $profile, bool $hasPreviousPrescription, ?int $requestedTemplateId): ?int
    {
        if ($requestedTemplateId || $hasPreviousPrescription || ! $this->settings->autoFirstDietEnabled()) {
            return $requestedTemplateId;
        }

        $packageId = $profile->selected_nutrition_package_id ? (int) $profile->selected_nutrition_package_id : null;
        $package = $packageId ? NutritionPackage::query()->find($packageId) : null;
        $mode = (string) ($package?->first_diet_template_mode ?? 'default');

        if ($mode === 'disabled') {
            return null;
        }

        $goal = in_array($profile->diet_goal, ['lose-weight', 'gain-weight', 'maintain-weight'], true)
            ? (string) $profile->diet_goal
            : 'lose-weight';

        if ($mode === 'custom') {
            $templateIds = is_array($package?->first_diet_template_ids) ? $package->first_diet_template_ids : [];
            $templateId = $templateIds[$goal] ?? $package?->first_diet_template_id;

            return is_numeric($templateId) && (int) $templateId > 0 ? (int) $templateId : null;
        }

        return $this->settings->autoFirstDietTemplateIdForGoal($goal);
    }

    private function canManageDietWorkflow(Request $request): bool
    {
        $user = $request->user('tenant_web');
        $role = (string) ($user?->role ?? '');
        $allowedRoles = [
            'admin',
            'barber',
            'nutritionist',
            'nutrition_doctor',
            'nutrition-expert',
            'nutrition-doctor',
            'expert',
            'doctor',
        ];

        if (in_array($role, $allowedRoles, true)) {
            return true;
        }

        return $user && method_exists($user, 'hasAnyRole') && $user->hasAnyRole($allowedRoles);
    }

    private function hasAiGenerationColumns(): bool
    {
        static $hasColumns;

        if ($hasColumns !== null) {
            return $hasColumns;
        }

        $hasColumns = Schema::hasColumn('nutrition_diet_requests', 'ai_generation_status');

        return $hasColumns;
    }

    private function user(): ?TenantUser
    {
        /** @var TenantUser|null $user */
        $user = Auth::guard('tenant_web')->user() ?? request()->user();

        return $user;
    }
}
