<?php

declare(strict_types=1);

namespace App\Services\Api;

use App\Domain\Tenant\Models\NutritionDietPrescription;
use App\Domain\Tenant\Models\NutritionDietRequest;
use App\Domain\Tenant\Models\NutritionPackageSubscription;
use App\Domain\Tenant\Models\NutritionProfile;
use App\Domain\Tenant\Models\TenantUser;
use App\Services\NutritionDietRequestSettingsService;
use App\Services\NutritionPackagePaymentService;
use App\Support\NutritionMedicalConditionSupport;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CustomerNutritionProfileDataService
{
    public function __construct(
        private readonly NutritionPackagePaymentService $packages,
        private readonly NutritionDietRequestSettingsService $settings,
    ) {}

    public function payload(TenantUser $user): array
    {
        $profile = NutritionProfile::query()
            ->with('selectedPackage')
            ->where('user_id', $user->id)
            ->first();
        $currentPrescription = $this->currentPrescription($user);
        $renewalPrescription = $currentPrescription ?? $this->activePrescriptionForRenewal($user);
        $dietRequests = $this->dietRequests($user);
        $activeDietRequest = $dietRequests
            ->first(fn (NutritionDietRequest $item): bool => $this->isActiveDietRequestForCustomer($item));
        $latestDietRequest = $dietRequests->first();
        $historyCount = Schema::hasTable('nutrition_diet_prescriptions')
            ? NutritionDietPrescription::query()
                ->where('user_id', $user->id)
                ->whereNotNull('published_at')
                ->count()
            : 0;
        $subscription = $this->packages->activeSubscriptionForUser($user);
        $hasUsableSubscription = $this->hasUsableSubscription($subscription);
        $activeDate = $this->activeDate($currentPrescription);
        $dailySummary = $currentPrescription
            ? $this->dailySummary($currentPrescription, $activeDate)
            : null;

        return [
            'profile' => $profile ? $this->serializeProfile($profile) : null,
            'managerMessage' => $this->supportsNutritionFixedMessage()
                ? (trim((string) ($user->nutrition_profile_fixed_message ?? '')) ?: null)
                : null,
            'subscription' => $this->packages->serializeSubscription($subscription),
            'dietRequest' => [
                'active' => $activeDietRequest ? $this->serializeDietRequest($activeDietRequest) : null,
                'latest' => $latestDietRequest ? $this->serializeDietRequest($latestDietRequest) : null,
                'isPrescribing' => $activeDietRequest !== null && $currentPrescription === null,
            ],
            'prescription' => [
                'current' => $currentPrescription ? $this->serializePrescription($currentPrescription, $activeDate) : null,
                'hasHistory' => $historyCount > 0,
            ],
            'dashboard' => [
                'state' => $this->dashboardState($profile, $hasUsableSubscription, $activeDietRequest, $currentPrescription, $historyCount),
                'banner' => $this->banner($profile, $hasUsableSubscription, $activeDietRequest, $currentPrescription, $historyCount),
                'dietAction' => $this->dietAction($profile, $hasUsableSubscription, $activeDietRequest, $currentPrescription, $historyCount),
                'activeDate' => $activeDate,
                'days' => $currentPrescription ? $this->prescriptionDays($currentPrescription, $activeDate) : null,
                'dietRenewal' => $this->dietRenewal($renewalPrescription),
                'dailyCalories' => $dailySummary,
                'exercise' => $currentPrescription ? $this->exerciseSummary($currentPrescription, $activeDate, $dailySummary) : null,
            ],
            'nullables' => [
                'profile' => $profile !== null ? null : 'no_profile',
                'subscription' => $subscription !== null ? null : 'no_active_subscription',
                'activeDietRequest' => $activeDietRequest !== null ? null : 'no_active_diet_request',
                'currentPrescription' => $currentPrescription !== null ? null : 'no_current_prescription',
                'days' => $currentPrescription !== null && $this->prescriptionDays($currentPrescription, $activeDate) !== null ? null : 'no_prescription_days',
                'dailyCalories' => $dailySummary !== null ? null : 'no_daily_calories',
                'exercise' => $currentPrescription !== null ? null : 'no_exercise_context',
            ],
        ];
    }

    private function currentPrescription(TenantUser $user): ?NutritionDietPrescription
    {
        if (! Schema::hasTable('nutrition_diet_prescriptions')) {
            return null;
        }

        $prescription = NutritionDietPrescription::query()
            ->with('request:id,request_type')
            ->where('user_id', $user->id)
            ->where('is_current', true)
            ->whereNotNull('published_at')
            ->latest('id')
            ->first();

        $today = Carbon::now('Asia/Tehran')->toDateString();

        if ($prescription && $prescription->ends_at && $prescription->ends_at->toDateString() < $today) {
            return null;
        }

        return $prescription;
    }

    private function activePrescriptionForRenewal(TenantUser $user): ?NutritionDietPrescription
    {
        if (! Schema::hasTable('nutrition_diet_prescriptions')) {
            return null;
        }

        $today = Carbon::now('Asia/Tehran')->toDateString();

        return NutritionDietPrescription::query()
            ->where('user_id', $user->id)
            ->whereNotNull('published_at')
            ->whereDate('started_at', '<=', $today)
            ->whereDate('ends_at', '>=', $today)
            ->latest('id')
            ->first();
    }

    private function dietRenewal(?NutritionDietPrescription $prescription): array
    {
        if (! $prescription || ! $prescription->ends_at) {
            return [
                'hasActiveDiet' => false,
                'blocked' => false,
                'daysRemaining' => 0,
                'endsAt' => null,
                'prescriptionId' => null,
            ];
        }

        $today = Carbon::now('Asia/Tehran')->startOfDay();
        $endsAt = $prescription->ends_at->copy()->timezone('Asia/Tehran')->startOfDay();
        $daysRemaining = max(0, (int) $today->diffInDays($endsAt, false));

        return [
            'hasActiveDiet' => true,
            'blocked' => $daysRemaining > 2,
            'daysRemaining' => $daysRemaining,
            'endsAt' => $prescription->ends_at->toDateString(),
            'prescriptionId' => (string) $prescription->id,
        ];
    }

    private function dietRequests(TenantUser $user)
    {
        if (! Schema::hasTable('nutrition_diet_requests')) {
            return collect();
        }

        return NutritionDietRequest::query()
            ->with('prescriptions:id,nutrition_diet_request_id,published_at')
            ->where('user_id', $user->id)
            ->latest('id')
            ->get();
    }

    private function isActiveDietRequestForCustomer(NutritionDietRequest $request): bool
    {
        if (in_array($request->status, ['sent', 'in_progress', 'not_sent'], true)) {
            return true;
        }

        if ($request->status === 'cancelled') {
            return false;
        }

        return $this->hasPendingUnpublishedPrescription($request);
    }

    private function hasPendingUnpublishedPrescription(NutritionDietRequest $request): bool
    {
        if (! Schema::hasTable('nutrition_diet_prescriptions')) {
            return false;
        }

        if ($request->relationLoaded('prescriptions')) {
            return $request->prescriptions->contains(
                fn (NutritionDietPrescription $prescription): bool => $prescription->published_at === null,
            );
        }

        return NutritionDietPrescription::query()
            ->where('nutrition_diet_request_id', $request->id)
            ->whereNull('published_at')
            ->exists();
    }

    private function serializeProfile(NutritionProfile $profile): array
    {
        $medicalConditionItems = NutritionMedicalConditionSupport::parseEntries($profile->medical_conditions);

        return [
            'id' => (string) $profile->id,
            'dietGoal' => $profile->diet_goal,
            'gender' => $profile->gender,
            'athleteMode' => $profile->athlete_mode,
            'activityLevel' => $profile->activity_level,
            'birthDate' => $profile->birth_date?->format('Y-m-d'),
            'heightCm' => $profile->height_cm,
            'weightKg' => $profile->weight_kg !== null ? (float) $profile->weight_kg : null,
            'idealWeightKg' => $profile->ideal_weight_kg !== null ? (float) $profile->ideal_weight_kg : null,
            'recommendedTargetWeightKg' => $profile->recommended_target_weight_kg !== null ? (float) $profile->recommended_target_weight_kg : null,
            'targetWeightKg' => $profile->target_weight_kg !== null ? (float) $profile->target_weight_kg : null,
            'weeklyWeightChangeKg' => $profile->weekly_weight_change_kg !== null ? (float) $profile->weekly_weight_change_kg : null,
            'medicalConditions' => NutritionMedicalConditionSupport::summarizeEntries($medicalConditionItems),
            'medicalConditionsItems' => $medicalConditionItems,
            'medicationsAndSupplements' => $profile->medications_and_supplements,
            'dislikedFoods' => $profile->disliked_foods,
            'foodAllergies' => $profile->food_allergies,
            'mindsetAnswers' => $profile->mindset_answers,
            'selectedNutritionPackageId' => $profile->selected_nutrition_package_id ? (string) $profile->selected_nutrition_package_id : null,
            'selectedNutritionPackageName' => $profile->selectedPackage?->name,
            'preferencesCompletedAt' => $profile->preferences_completed_at?->toIso8601String(),
            'mindsetCompletedAt' => $profile->mindset_completed_at?->toIso8601String(),
            'packageSelectedAt' => $profile->package_selected_at?->toIso8601String(),
            'onboardingCompletedAt' => $profile->onboarding_completed_at?->toIso8601String(),
        ];
    }

    private function serializeDietRequest(NutritionDietRequest $request): array
    {
        $hasPendingUnpublishedPrescription = $this->hasPendingUnpublishedPrescription($request);

        return [
            'id' => (string) $request->id,
            'requestType' => $request->request_type,
            'requestTypeLabel' => $request->request_type === 'expert' ? 'تجویز توسط کارشناس' : 'تجویز هوشمند',
            'status' => $request->status,
            'statusLabel' => $hasPendingUnpublishedPrescription ? 'در حال تجویز' : $this->dietRequestStatusLabel((string) $request->status),
            'prescriptionMode' => $request->prescription_mode,
            'dietTemplateId' => $request->nutrition_diet_template_id ? (string) $request->nutrition_diet_template_id : null,
            'dietTemplateName' => $request->diet_template_name,
            'currentWeightKg' => $request->current_weight_kg !== null ? (float) $request->current_weight_kg : null,
            'targetWeightKg' => $request->target_weight_kg !== null ? (float) $request->target_weight_kg : null,
            'weeklyWeightChangeKg' => $request->weekly_weight_change_kg !== null ? (float) $request->weekly_weight_change_kg : null,
            'startedAt' => $request->started_at?->toDateString(),
            'endsAt' => $request->ends_at?->toDateString(),
            'createdAt' => $request->created_at?->toIso8601String(),
            'aiGenerationStatus' => $request->ai_generation_status,
            'aiGenerationStatusLabel' => $this->aiStatusLabel((string) ($request->ai_generation_status ?? 'not_requested')),
            'manualApprovalPending' => (bool) $request->requires_manual_delivery_approval
                && $request->request_type === 'ai'
                && $request->ai_generation_status === 'generated'
                && $hasPendingUnpublishedPrescription
                && $request->manual_delivery_approved_at === null,
        ];
    }

    private function serializePrescription(NutritionDietPrescription $prescription, string $activeDate): array
    {
        $expired = $prescription->ends_at ? ! $prescription->ends_at->isFuture() : false;
        $content = is_array($prescription->content_snapshot) ? $prescription->content_snapshot : [];

        return [
            'id' => (string) $prescription->id,
            'requestId' => $prescription->nutrition_diet_request_id ? (string) $prescription->nutrition_diet_request_id : null,
            'nutritionDietTemplateId' => $prescription->nutrition_diet_template_id ? (string) $prescription->nutrition_diet_template_id : null,
            'deliveryChannel' => $prescription->delivery_channel,
            'prescriptionMode' => $prescription->prescription_mode,
            'status' => $prescription->status,
            'expired' => $expired,
            'allowFoodReplacement' => (bool) $prescription->allow_food_replacement,
            'suggestDailyReplacements' => (bool) $prescription->suggest_daily_replacements,
            'exerciseLoggingEnabled' => $this->settings->exerciseLoggingEnabled(),
            'outOfPlanMealLoggingEnabled' => $this->settings->outOfPlanMealLoggingEnabled(),
            'mealPhotoAnalysisEnabled' => $this->settings->mealPhotoAnalysisEnabled(),
            'currentWeightKg' => $prescription->current_weight_kg !== null ? (float) $prescription->current_weight_kg : null,
            'targetWeightKg' => $prescription->target_weight_kg !== null ? (float) $prescription->target_weight_kg : null,
            'weeklyWeightChangeKg' => $prescription->weekly_weight_change_kg !== null ? (float) $prescription->weekly_weight_change_kg : null,
            'startedAt' => $prescription->started_at?->toDateString(),
            'endsAt' => $prescription->ends_at?->toDateString(),
            'version' => (int) $prescription->version,
            'isCurrent' => (bool) $prescription->is_current && ! $expired,
            'summaryText' => $prescription->summary_text,
            'notes' => $prescription->notes,
            'durationDays' => $this->durationDays($prescription, $content),
            'contentSnapshot' => $content,
            'mealLogs' => $this->mealLogs($prescription),
            'waterLogs' => $this->waterLogs($prescription),
            'exerciseLogs' => $this->exerciseLogs($prescription),
            'activeDate' => $activeDate,
            'publishedAt' => $prescription->published_at?->toIso8601String(),
        ];
    }

    private function activeDate(?NutritionDietPrescription $prescription): string
    {
        $today = Carbon::now('Asia/Tehran')->toDateString();

        if (! $prescription) {
            return $today;
        }

        $start = $prescription->started_at?->toDateString();
        $end = $prescription->ends_at?->toDateString();

        if ($start && $today < $start) {
            return $start;
        }

        if ($end && $today > $end) {
            return $end;
        }

        return $today;
    }

    private function dailySummary(NutritionDietPrescription $prescription, string $activeDate): array
    {
        $mealLogs = collect($this->mealLogs($prescription))
            ->filter(fn (array $log): bool => ($log['consumedDate'] ?? null) === $activeDate);
        $exerciseLogs = collect($this->exerciseLogs($prescription))
            ->filter(fn (array $log): bool => ($log['consumedDate'] ?? null) === $activeDate);
        $calories = (int) $mealLogs->sum('calories');
        $burned = (int) $exerciseLogs->sum('caloriesBurned');
        $target = $this->dailyCalorieTarget($prescription);

        return [
            'date' => $activeDate,
            'targetCalories' => $target,
            'loggedMeals' => $mealLogs->count(),
            'loggedExercises' => $exerciseLogs->count(),
            'consumedCalories' => $calories,
            'burnedCalories' => $burned,
            'netCalories' => $calories - $burned,
            'remainingCalories' => $target !== null ? max(0, $target - $calories) : null,
            'macros' => [
                'carbohydrateGrams' => (float) $mealLogs->sum('carbohydrateGrams'),
                'proteinGrams' => (float) $mealLogs->sum('proteinGrams'),
                'fatGrams' => (float) $mealLogs->sum('fatGrams'),
                'fiberGrams' => (float) $mealLogs->sum('fiberGrams'),
            ],
        ];
    }

    private function prescriptionDays(NutritionDietPrescription $prescription, string $activeDate): ?array
    {
        $content = is_array($prescription->content_snapshot) ? $prescription->content_snapshot : [];
        $plans = collect(is_array($content['day_plans'] ?? null) ? $content['day_plans'] : [])
            ->filter(fn ($plan): bool => is_array($plan))
            ->values();

        if ($plans->isEmpty()) {
            return null;
        }

        $start = $prescription->started_at;

        return $plans->map(function (array $plan, int $index) use ($start, $activeDate): array {
            $dayNumber = (int) ($plan['day_number'] ?? ($index + 1));
            $date = $start ? $start->copy()->addDays(max(0, $dayNumber - 1))->toDateString() : null;

            return [
                'dayNumber' => $dayNumber,
                'date' => $date,
                'label' => $plan['day_label'] ?? ('روز ' . $dayNumber),
                'notes' => $plan['notes'] ?? null,
                'totalCalories' => isset($plan['day_total_calories']) ? (int) $plan['day_total_calories'] : null,
                'mealsCount' => is_array($plan['meals'] ?? null) ? count($plan['meals']) : 0,
                'isActive' => $date !== null && $date === $activeDate,
            ];
        })->all();
    }

    private function exerciseSummary(NutritionDietPrescription $prescription, string $activeDate, ?array $dailySummary): array
    {
        $logs = collect($this->exerciseLogs($prescription))
            ->filter(fn (array $log): bool => ($log['consumedDate'] ?? null) === $activeDate)
            ->values();

        return [
            'enabled' => $this->settings->exerciseLoggingEnabled(),
            'date' => $activeDate,
            'href' => '/nutrition/my-diet/exercises?date=' . rawurlencode($activeDate),
            'loggedCount' => $logs->count(),
            'burnedCalories' => (int) $logs->sum('caloriesBurned'),
            'netCalories' => $dailySummary['netCalories'] ?? null,
            'items' => $logs->all(),
        ];
    }

    private function mealLogs(NutritionDietPrescription $prescription): array
    {
        if (! Schema::hasTable('nutrition_meal_logs')) {
            return [];
        }

        return DB::table('nutrition_meal_logs')
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
                'photoUrl' => null,
            ])
            ->values()
            ->all();
    }

    private function waterLogs(NutritionDietPrescription $prescription): array
    {
        if (! Schema::hasTable('nutrition_water_logs')) {
            return [];
        }

        return DB::table('nutrition_water_logs')
            ->where('nutrition_diet_prescription_id', $prescription->id)
            ->orderBy('consumed_date')
            ->orderBy('id')
            ->get()
            ->map(fn ($log): array => [
                'id' => (string) $log->id,
                'consumedDate' => $log->consumed_date,
                'amountMl' => (int) $log->amount_ml,
                'glasses' => $this->extractGlasses((string) ($log->notes ?? ''), (int) $log->amount_ml),
            ])
            ->values()
            ->all();
    }

    private function exerciseLogs(NutritionDietPrescription $prescription): array
    {
        if (! Schema::hasTable('exercise_logs')) {
            return [];
        }

        $query = DB::table('exercise_logs')
            ->where('user_id', $prescription->user_id)
            ->orderBy('consumed_date')
            ->orderBy('id');

        if ($prescription->started_at && $prescription->ends_at) {
            $query->whereBetween('consumed_date', [
                $prescription->started_at->toDateString(),
                $prescription->ends_at->toDateString(),
            ]);
        }

        $query->where(function ($inner) use ($prescription): void {
            $inner->where('nutrition_diet_prescription_id', $prescription->id)
                ->orWhereNull('nutrition_diet_prescription_id');
        });

        return $query->get()
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

    private function dashboardState(?NutritionProfile $profile, bool $hasSubscription, ?NutritionDietRequest $activeRequest, ?NutritionDietPrescription $prescription, int $historyCount): string
    {
        return match (true) {
            $prescription !== null => 'has_current_prescription',
            $activeRequest !== null => 'prescribing',
            $profile === null || ! $this->profileCompleted($profile) => 'profile_incomplete',
            ! $hasSubscription => 'needs_package',
            $historyCount === 0 && $profile->mindset_completed_at === null => 'needs_mindset',
            $historyCount > 0 => 'ready_for_repeat_diet',
            default => 'ready_for_first_diet',
        };
    }

    private function hasUsableSubscription(?NutritionPackageSubscription $subscription): bool
    {
        return $subscription !== null
            && ((int) ($subscription->online_diet_remaining ?? 0) > 0
                || (int) ($subscription->offline_diet_remaining ?? 0) > 0);
    }

    private function banner(?NutritionProfile $profile, bool $hasSubscription, ?NutritionDietRequest $activeRequest, ?NutritionDietPrescription $prescription, int $historyCount): ?array
    {
        if ($prescription !== null) {
            return null;
        }

        if ($activeRequest !== null) {
            return [
                'type' => 'prescribing',
                'title' => 'رژیم شما در حال تجویز است',
                'description' => 'پس از آماده شدن رژیم، پیامک اطلاع رسانی برای شما ارسال می شود.',
                'actionLabel' => null,
                'actionHref' => null,
            ];
        }

        if ($profile === null || ! $this->profileCompleted($profile)) {
            return [
                'type' => 'membership_incomplete',
                'title' => 'عضویت کامل نیست',
                'description' => 'برای دریافت رژیم، ابتدا اولین مرحله ناقص عضویت را تکمیل کنید.',
                'actionLabel' => 'ادامه مراحل',
                'actionHref' => $this->firstIncompleteMembershipHref($profile),
            ];
        }

        return [
            'type' => $hasSubscription ? ($historyCount > 0 ? 'get_repeat_diet' : 'get_first_diet') : 'needs_package',
            'title' => 'دریافت رژیم',
            'description' => ! $hasSubscription
                ? 'برای دریافت رژیم، ابتدا یک بسته فعال تهیه کنید.'
                : ($historyCount > 0
                    ? 'برای دریافت رژیم دوم، ابتدا به ۱۵ سؤال پیگیری پاسخ دهید.'
                    : 'بسته شما فعال است؛ اکنون می‌توانید نوع رژیم را انتخاب و درخواست خود را ثبت کنید.'),
            'actionLabel' => 'دریافت رژیم',
            'actionHref' => $this->dietStartHref($profile, $hasSubscription, $historyCount),
        ];
    }

    private function dietAction(?NutritionProfile $profile, bool $hasSubscription, ?NutritionDietRequest $activeRequest, ?NutritionDietPrescription $prescription, int $historyCount): array
    {
        if ($prescription !== null) {
            return [
                'type' => 'view_current_diet',
                'title' => 'مشاهده رژیم',
                'href' => '/nutrition/my-diet',
                'disabled' => false,
            ];
        }

        if ($activeRequest !== null) {
            return [
                'type' => 'prescribing',
                'title' => 'رژیم در حال تجویز',
                'href' => null,
                'disabled' => true,
            ];
        }

        return [
            'type' => 'get_diet',
            'title' => 'دریافت رژیم',
            'href' => $this->dietStartHref($profile, $hasSubscription, $historyCount),
            'disabled' => false,
        ];
    }

    private function dietStartHref(?NutritionProfile $profile, bool $hasSubscription, int $historyCount): string
    {
        if ($profile === null || ! $this->profileCompleted($profile)) {
            return $this->firstIncompleteMembershipHref($profile);
        }

        if (! $hasSubscription) {
            return '/nutrition/membership/packages?direct_buy=1';
        }

        if ($historyCount === 0 && $profile->mindset_completed_at === null) {
            return '/nutrition/membership/mindset/1';
        }

        return $historyCount > 0 ? '/nutrition/diet-followup/1' : '/nutrition/diet-type';
    }

    private function firstIncompleteMembershipHref(?NutritionProfile $profile): string
    {
        return match (true) {
            $profile === null, $profile->diet_goal === null => '/nutrition/membership/goal',
            $profile->gender === null => '/nutrition/membership/gender',
            $profile->athlete_mode === null, $profile->activity_level === null => '/nutrition/membership/activity',
            $profile->birth_date === null => '/nutrition/membership/birth-date',
            $profile->height_cm === null => '/nutrition/membership/height',
            $profile->weight_kg === null => '/nutrition/membership/weight',
            $profile->target_weight_kg === null => '/nutrition/membership/target-weight',
            $profile->weekly_weight_change_kg === null => '/nutrition/membership/result',
            $profile->preferences_completed_at === null => '/nutrition/membership/medical-conditions',
            default => '/nutrition/profile',
        };
    }

    public function profileCompleted(NutritionProfile $profile): bool
    {
        return $profile->diet_goal !== null
            && $profile->gender !== null
            && $profile->athlete_mode !== null
            && $profile->activity_level !== null
            && $profile->birth_date !== null
            && $profile->height_cm !== null
            && $profile->weight_kg !== null
            && $profile->target_weight_kg !== null
            && $profile->weekly_weight_change_kg !== null
            && $profile->preferences_completed_at !== null;
    }

    private function dailyCalorieTarget(NutritionDietPrescription $prescription): ?int
    {
        $content = is_array($prescription->content_snapshot) ? $prescription->content_snapshot : [];
        $plan = is_array($content['calorie_plan'] ?? null) ? $content['calorie_plan'] : [];
        $target = (int) ($plan['prescribed_calories'] ?? $plan['base_calories'] ?? 0);

        return $target > 0 ? $target : null;
    }

    private function durationDays(NutritionDietPrescription $prescription, array $content): ?int
    {
        if ($prescription->started_at && $prescription->ends_at) {
            return max(1, $prescription->ends_at->diffInDays($prescription->started_at) + 1);
        }

        $plans = is_array($content['day_plans'] ?? null) ? $content['day_plans'] : [];

        return $plans !== [] ? count($plans) : null;
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

    private function extractGlasses(string $notes, int $amountMl): int
    {
        if (preg_match('/glasses:(\d+)/', $notes, $matches) === 1) {
            return (int) $matches[1];
        }

        return (int) floor($amountMl / 250);
    }

    private function supportsNutritionFixedMessage(): bool
    {
        $tenant = tenant();
        $tenant?->loadMissing('audienceType');

        return in_array((string) ($tenant?->audienceType?->slug ?? ''), ['nutritionists', 'nutrition-doctors'], true);
    }

    private function dietRequestStatusLabel(string $status): string
    {
        return match ($status) {
            'not_sent' => 'ارسال نشده',
            'sent' => 'ارسال شده',
            'in_progress' => 'در حال تجویز',
            'finished' => 'تکمیل شده',
            'cancelled' => 'لغو شده',
            default => $status,
        };
    }

    private function aiStatusLabel(string $status): string
    {
        return match ($status) {
            'queued' => 'در صف تولید',
            'processing' => 'در حال تولید',
            'generated' => 'تولید شده',
            'failed' => 'ناموفق',
            'cancelled' => 'لغو شده',
            default => 'درخواست نشده',
        };
    }
}
