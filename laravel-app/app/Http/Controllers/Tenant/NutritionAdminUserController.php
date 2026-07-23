<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\NutritionDietPrescription;
use App\Domain\Tenant\Models\NutritionDietRequest;
use App\Domain\Tenant\Models\NutritionDietTemplate;
use App\Domain\Tenant\Models\NutritionPackage;
use App\Domain\Tenant\Models\NutritionPackageSubscription;
use App\Domain\Tenant\Models\NutritionProfile;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Jobs\GenerateNutritionAiPrescriptionJob;
use App\Support\NutritionWeightGoalCalculator;
use App\Services\NutritionDietRequestSettingsService;
use App\Services\NutritionPackagePaymentService;
use App\Support\InputNormalizer;
use App\Support\NutritionMedicalConditionSupport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class NutritionAdminUserController extends Controller
{
    public function __construct(
        private readonly NutritionPackagePaymentService $packageService,
        private readonly NutritionDietRequestSettingsService $settings,
    ) {
    }

    public function show(Request $request, string $mobile): JsonResponse
    {
        $this->ensureAdmin($request);

        $normalizedMobile = InputNormalizer::mobile($mobile);
        abort_unless($normalizedMobile, 404);

        /** @var TenantUser $user */
        $user = TenantUser::query()
            ->with('nutritionProfile')
            ->where('mobile', $normalizedMobile)
            ->firstOrFail();

        $profile = $user->nutritionProfile;
        $activeSubscription = $this->packageService->activeSubscriptionForUser($user);

        $prescriptions = NutritionDietPrescription::query()
            ->where('user_id', $user->id)
            ->latest('published_at')
            ->latest('id')
            ->get();
        $activeRequests = NutritionDietRequest::query()
            ->with('prescriptions')
            ->where('user_id', $user->id)
            ->whereIn('status', ['sent', 'in_progress', 'not_sent'])
            ->latest('created_at')
            ->latest('id')
            ->get();

        $firstStartedAt = NutritionDietPrescription::query()
            ->where('user_id', $user->id)
            ->orderBy('started_at')
            ->value('started_at');

        $currentWeight = $profile?->weight_kg !== null ? (float) $profile->weight_kg : null;
        $targetWeight = $profile?->target_weight_kg !== null ? (float) $profile->target_weight_kg : null;
        $weightGap = ($currentWeight !== null && $targetWeight !== null) ? round(abs($currentWeight - $targetWeight), 2) : null;
        $weightGapLabel = null;

        if ($currentWeight !== null && $targetWeight !== null) {
            if ($currentWeight > $targetWeight) {
                $weightGapLabel = 'اضافه وزن';
            } elseif ($currentWeight < $targetWeight) {
                $weightGapLabel = 'کمبود وزن';
            } else {
                $weightGapLabel = 'هم‌وزن با هدف';
            }
        }

        return response()->json([
            'success' => true,
            'data' => [
                'user' => [
                    'id' => (string) $user->id,
                    'fullName' => (string) ($user->name ?? ''),
                    'mobile' => (string) $user->mobile,
                    'email' => $user->email,
                    'gender' => $user->gender,
                    'birthDate' => $user->birth_date?->toDateString(),
                    'nationalCode' => $user->national_code,
                    'provinceId' => $user->province_id,
                    'provinceName' => $user->province_name,
                    'cityId' => $user->city_id,
                    'cityName' => $user->city_name,
                    'jobTitle' => $user->job_title,
                    'nutritionProfileFixedMessage' => (trim((string) ($user->nutrition_profile_fixed_message ?? '')) ?: null),
                    'isActive' => (bool) $user->is_active,
                    'canBook' => (bool) $user->can_book,
                ],
                'stats' => [
                    'dietsCount' => $prescriptions->count(),
                    'weightGap' => $weightGap,
                    'weightGapLabel' => $weightGapLabel,
                    'currentWeightKg' => $currentWeight,
                    'startedAt' => $firstStartedAt ? (string) $firstStartedAt : null,
                ],
                'profile' => $profile ? [
                    'dietGoal' => $profile->diet_goal,
                    'gender' => $profile->gender,
                    'athleteMode' => $profile->athlete_mode,
                    'activityLevel' => $profile->activity_level,
                    'birthDate' => $profile->birth_date?->toDateString(),
                    'heightCm' => $profile->height_cm,
                    'weightKg' => $profile->weight_kg !== null ? (float) $profile->weight_kg : null,
                    'targetWeightKg' => $profile->target_weight_kg !== null ? (float) $profile->target_weight_kg : null,
                    'weeklyWeightChangeKg' => $profile->weekly_weight_change_kg !== null ? (float) $profile->weekly_weight_change_kg : null,
                    'medicalConditions' => NutritionMedicalConditionSupport::summarizeEntries(NutritionMedicalConditionSupport::parseEntries($profile->medical_conditions)),
                    'medicalConditionsItems' => NutritionMedicalConditionSupport::parseEntries($profile->medical_conditions),
                    'medicationsAndSupplements' => $profile->medications_and_supplements,
                    'foodAllergies' => $profile->food_allergies,
                    'dislikedFoods' => $profile->disliked_foods,
                    'mindsetAnswers' => $profile->mindset_answers,
                ] : null,
                'subscription' => $this->packageService->serializeSubscription($activeSubscription),
                'activeRequests' => $activeRequests->map(function (NutritionDietRequest $dietRequest): array {
                    $hasPendingUnpublishedPrescription = $dietRequest->prescriptions->contains(
                        fn (NutritionDietPrescription $prescription): bool => $prescription->published_at === null,
                    );
                    $manualApprovalPending = (bool) $dietRequest->requires_manual_delivery_approval
                        && $dietRequest->request_type === 'ai'
                        && $dietRequest->ai_generation_status === 'generated'
                        && $hasPendingUnpublishedPrescription;

                    return [
                        'id' => (string) $dietRequest->id,
                        'requestType' => $dietRequest->request_type,
                        'requestTypeLabel' => $dietRequest->request_type === 'ai' ? 'رژیم آنلاین' : 'رژیم اختصاصی توسط کارشناس',
                        'status' => $dietRequest->status,
                        'statusLabel' => match ($dietRequest->status) {
                            'sent' => 'ارسال شده',
                            'not_sent' => 'ارسال نشده',
                            'finished' => 'تمام شده',
                            'in_progress' => 'در حال انجام',
                            'cancelled' => 'کنسل شده',
                            default => $dietRequest->status,
                        },
                        'manualApprovalPending' => $manualApprovalPending,
                        'aiGenerationStatus' => $dietRequest->ai_generation_status,
                        'aiGenerationStatusLabel' => match ($dietRequest->ai_generation_status) {
                            'queued' => 'در صف',
                            'processing' => 'در حال تولید',
                            'generated' => 'تولید شده',
                            'cancelled' => 'لغو شده',
                            'failed' => 'ناموفق',
                            default => 'ثبت نشده',
                        },
                        'dietTemplateName' => $dietRequest->diet_template_name,
                        'currentWeightKg' => $dietRequest->current_weight_kg !== null ? (float) $dietRequest->current_weight_kg : null,
                        'startedAt' => $dietRequest->started_at?->toDateString(),
                        'endsAt' => $dietRequest->ends_at?->toDateString(),
                        'createdAt' => $dietRequest->created_at?->toIso8601String(),
                    ];
                })->values()->all(),
                'prescriptions' => $prescriptions->map(fn (NutritionDietPrescription $prescription): array => [
                    'id' => (string) $prescription->id,
                    'requestId' => $prescription->nutrition_diet_request_id ? (string) $prescription->nutrition_diet_request_id : null,
                    'summaryText' => $prescription->summary_text,
                    'notes' => $prescription->notes,
                    'prescriptionMode' => $prescription->prescription_mode,
                    'status' => $prescription->status,
                    'isCurrent' => (bool) $prescription->is_current,
                    'currentWeightKg' => $prescription->current_weight_kg !== null ? (float) $prescription->current_weight_kg : null,
                    'targetWeightKg' => $prescription->target_weight_kg !== null ? (float) $prescription->target_weight_kg : null,
                    'weeklyWeightChangeKg' => $prescription->weekly_weight_change_kg !== null ? (float) $prescription->weekly_weight_change_kg : null,
                    'startedAt' => $prescription->started_at?->toDateString(),
                    'endsAt' => $prescription->ends_at?->toDateString(),
                    'publishedAt' => $prescription->published_at?->toIso8601String(),
                ])->values()->all(),
            ],
        ]);
    }

    public function grantPackage(Request $request, string $mobile): JsonResponse
    {
        $this->ensureAdmin($request);

        $normalizedMobile = InputNormalizer::mobile($mobile);
        abort_unless($normalizedMobile, 404);

        $validated = $request->validate([
            'nutrition_package_id' => ['required', 'integer', 'exists:nutrition_packages,id'],
        ]);

        /** @var TenantUser $user */
        $user = TenantUser::query()
            ->where('mobile', $normalizedMobile)
            ->firstOrFail();

        /** @var NutritionPackage $package */
        $package = NutritionPackage::query()
            ->where('is_active', true)
            ->findOrFail((int) $validated['nutrition_package_id']);

        DB::transaction(function () use ($package, $request, $user): void {
            NutritionPackageSubscription::query()
                ->where('user_id', $user->id)
                ->where('status', 'active')
                ->update(['status' => 'expired']);

            $payableAmount = (int) ($package->discounted_price_amount ?? $package->price_amount ?? 0);

            NutritionPackageSubscription::query()->create([
                'user_id' => $user->id,
                'nutrition_package_id' => $package->id,
                'nutrition_package_order_id' => null,
                'status' => 'active',
                'starts_at' => now()->toDateString(),
                'ends_at' => now()->addDays((int) $package->duration_days)->toDateString(),
                'online_diet_total' => (int) $package->online_diet_count,
                'online_diet_used' => 0,
                'offline_diet_total' => (int) $package->offline_diet_count,
                'offline_diet_used' => 0,
                'price_amount' => (int) ($package->price_amount ?? 0),
                'payable_amount' => $payableAmount,
                'meta_json' => [
                    'source' => 'admin_manual_grant',
                    'granted_by_user_id' => $request->user('tenant_web')?->id,
                ],
            ]);

            NutritionProfile::query()
                ->updateOrCreate(
                    ['user_id' => $user->id],
                    [
                        'selected_nutrition_package_id' => $package->id,
                        'package_selected_at' => now(),
                    ],
                );
        });

        return response()->json([
            'success' => true,
            'message' => 'پکیج با موفقیت به این کاربر اضافه شد.',
        ]);
    }

    public function updateSubscriptionDates(Request $request, string $mobile, NutritionPackageSubscription $subscription): JsonResponse
    {
        $this->ensureAdmin($request);

        $normalizedMobile = InputNormalizer::mobile($mobile);
        abort_unless($normalizedMobile, 404);

        /** @var TenantUser $user */
        $user = TenantUser::query()
            ->where('mobile', $normalizedMobile)
            ->firstOrFail();

        abort_unless((int) $subscription->user_id === (int) $user->id, 404);

        $validated = $request->validate([
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after_or_equal:starts_at'],
        ]);

        $startsAt = Carbon::parse((string) $validated['starts_at'])->toDateString();
        $endsAt = Carbon::parse((string) $validated['ends_at'])->toDateString();

        $meta = is_array($subscription->meta_json) ? $subscription->meta_json : [];

        $subscription->forceFill([
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'status' => $endsAt >= now()->toDateString() ? 'active' : 'expired',
            'meta_json' => array_merge($meta, [
                'dates_edited_at' => now()->toIso8601String(),
                'dates_edited_by_user_id' => $request->user('tenant_web')?->id,
            ]),
        ])->save();

        $subscription->load('package');

        return response()->json([
            'success' => true,
            'message' => 'تاریخ شروع و پایان پکیج کاربر با موفقیت ویرایش شد.',
            'data' => [
                'subscription' => $this->packageService->serializeSubscription($subscription),
            ],
        ]);
    }

    public function adjustSubscriptionCredits(Request $request, string $mobile, NutritionPackageSubscription $subscription): JsonResponse
    {
        $this->ensureAdmin($request);

        $normalizedMobile = InputNormalizer::mobile($mobile);
        abort_unless($normalizedMobile, 404);

        /** @var TenantUser $user */
        $user = TenantUser::query()
            ->where('mobile', $normalizedMobile)
            ->firstOrFail();

        abort_unless((int) $subscription->user_id === (int) $user->id, 404);
        abort_unless($subscription->status === 'active', 422, 'این کاربر پکیج فعال ندارد.');
        abort_if($subscription->ends_at && $subscription->ends_at->toDateString() < now()->toDateString(), 422, 'پکیج فعال این کاربر منقضی شده است.');

        $validated = $request->validate([
            'online_diet_delta' => ['required', 'integer', 'min:-1000', 'max:1000'],
            'offline_diet_delta' => ['required', 'integer', 'min:-1000', 'max:1000'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $onlineDelta = (int) $validated['online_diet_delta'];
        $offlineDelta = (int) $validated['offline_diet_delta'];

        if ($onlineDelta === 0 && $offlineDelta === 0) {
            throw ValidationException::withMessages([
                'credits' => 'برای ثبت تغییر، حداقل یکی از اعتبارها را کم یا زیاد کنید.',
            ]);
        }

        $actor = $request->user('tenant_web');

        $updatedSubscription = DB::transaction(function () use ($actor, $offlineDelta, $onlineDelta, $subscription, $validated, $user): NutritionPackageSubscription {
            /** @var NutritionPackageSubscription $lockedSubscription */
            $lockedSubscription = NutritionPackageSubscription::query()
                ->with('package')
                ->lockForUpdate()
                ->findOrFail($subscription->id);

            abort_unless((int) $lockedSubscription->user_id === (int) $user->id, 404);
            abort_unless($lockedSubscription->status === 'active', 422, 'این کاربر پکیج فعال ندارد.');
            abort_if($lockedSubscription->ends_at && $lockedSubscription->ends_at->toDateString() < now()->toDateString(), 422, 'پکیج فعال این کاربر منقضی شده است.');

            $onlineTotalBefore = (int) $lockedSubscription->online_diet_total;
            $offlineTotalBefore = (int) $lockedSubscription->offline_diet_total;
            $onlineUsed = (int) $lockedSubscription->online_diet_used;
            $offlineUsed = (int) $lockedSubscription->offline_diet_used;
            $onlineTotalAfter = $onlineTotalBefore + $onlineDelta;
            $offlineTotalAfter = $offlineTotalBefore + $offlineDelta;

            if ($onlineTotalAfter < $onlineUsed) {
                throw ValidationException::withMessages([
                    'online_diet_delta' => 'اعتبار آنلاین نمی‌تواند از تعداد رژیم آنلاین مصرف‌شده کمتر شود.',
                ]);
            }

            if ($offlineTotalAfter < $offlineUsed) {
                throw ValidationException::withMessages([
                    'offline_diet_delta' => 'اعتبار اختصاصی نمی‌تواند از تعداد رژیم اختصاصی مصرف‌شده کمتر شود.',
                ]);
            }

            $onlineRemainingBefore = max(0, $onlineTotalBefore - $onlineUsed);
            $offlineRemainingBefore = max(0, $offlineTotalBefore - $offlineUsed);
            $onlineRemainingAfter = max(0, $onlineTotalAfter - $onlineUsed);
            $offlineRemainingAfter = max(0, $offlineTotalAfter - $offlineUsed);

            $lockedSubscription->forceFill([
                'online_diet_total' => $onlineTotalAfter,
                'offline_diet_total' => $offlineTotalAfter,
            ])->save();

            if (Schema::hasTable('nutrition_subscription_credit_logs')) {
                DB::table('nutrition_subscription_credit_logs')->insert([
                    'user_id' => $user->id,
                    'nutrition_package_subscription_id' => $lockedSubscription->id,
                    'actor_user_id' => $actor?->id,
                    'online_diet_delta' => $onlineDelta,
                    'offline_diet_delta' => $offlineDelta,
                    'online_diet_total_before' => $onlineTotalBefore,
                    'online_diet_total_after' => $onlineTotalAfter,
                    'online_diet_remaining_before' => $onlineRemainingBefore,
                    'online_diet_remaining_after' => $onlineRemainingAfter,
                    'offline_diet_total_before' => $offlineTotalBefore,
                    'offline_diet_total_after' => $offlineTotalAfter,
                    'offline_diet_remaining_before' => $offlineRemainingBefore,
                    'offline_diet_remaining_after' => $offlineRemainingAfter,
                    'notes' => trim((string) ($validated['notes'] ?? '')) ?: null,
                    'meta_json' => json_encode([
                        'actor_name' => $actor?->name,
                        'actor_mobile' => $actor?->mobile,
                        'package_name' => $lockedSubscription->package?->name,
                    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    'occurred_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            return $lockedSubscription->fresh('package');
        });

        return response()->json([
            'success' => true,
            'message' => 'اعتبار رژیم کاربر با موفقیت ویرایش شد.',
            'data' => [
                'subscription' => $this->packageService->serializeSubscription($updatedSubscription),
            ],
        ]);
    }

    public function savePrescribeProfile(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $request->merge([
            'mobile' => InputNormalizer::mobile((string) $request->input('mobile')),
        ]);

        $validated = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'mobile' => ['required', 'regex:/^09\d{9}$/'],
            'diet_goal' => ['required', 'in:lose-weight,gain-weight,maintain-weight'],
            'gender' => ['required', 'in:male,female'],
            'athlete_mode' => ['required', 'in:athlete,non-athlete'],
            'activity_level' => ['required', 'in:very-low,medium,high,intense'],
            'birth_date' => ['required', 'date'],
            'height_cm' => ['required', 'integer', 'min:80', 'max:250'],
            'weight_kg' => ['required', 'numeric', 'min:20', 'max:350'],
            'target_weight_kg' => ['required', 'numeric', 'min:20', 'max:350'],
            'weekly_weight_change_kg' => ['nullable', 'numeric', 'min:0.25', 'max:5'],
            'medical_conditions' => ['nullable', 'string'],
            'medical_conditions_items' => ['nullable', 'array'],
            'medical_conditions_items.*.id' => ['nullable', 'string', 'max:120'],
            'medical_conditions_items.*.title' => ['required_with:medical_conditions_items', 'string', 'max:255'],
            'medical_conditions_items.*.status' => ['nullable', 'in:current,past,temporary'],
            'medical_conditions_items.*.startedAt' => ['nullable', 'date'],
            'medical_conditions_items.*.endedAt' => ['nullable', 'date'],
            'medical_conditions_items.*.ongoing' => ['nullable', 'boolean'],
            'medical_conditions_items.*.notes' => ['nullable', 'string', 'max:1000'],
            'medications_and_supplements' => ['nullable', 'string'],
            'food_allergies' => ['nullable', 'string'],
            'disliked_foods' => ['nullable', 'string'],
            'mindset_answers' => ['nullable', 'array'],
            'mindset_answers.reason' => ['nullable', 'string', 'max:255'],
            'mindset_answers.barrier' => ['nullable', 'string', 'max:255'],
            'mindset_answers.stressAppetite' => ['nullable', 'string', 'max:255'],
            'mindset_answers.hardestTime' => ['nullable', 'string', 'max:255'],
            'mindset_answers.planStyle' => ['nullable', 'string', 'max:255'],
        ]);

        $metrics = NutritionWeightGoalCalculator::metrics(
            (int) $validated['height_cm'],
            (string) $validated['gender'],
            (float) $validated['weight_kg'],
            (string) $validated['diet_goal'],
        );

        $actor = $request->user('tenant_web');

        $normalizedMindsetAnswers = collect($validated['mindset_answers'] ?? [])
            ->map(fn ($value) => is_string($value) ? trim($value) : $value)
            ->filter(fn ($value) => ! is_null($value) && $value !== '')
            ->all();
        $medicalConditionEntries = array_key_exists('medical_conditions_items', $validated)
            ? NutritionMedicalConditionSupport::normalizeEntries($validated['medical_conditions_items'] ?? [])
            : NutritionMedicalConditionSupport::parseEntries($validated['medical_conditions'] ?? null);

        [$user, $profile] = DB::transaction(function () use ($actor, $medicalConditionEntries, $metrics, $normalizedMindsetAnswers, $validated): array {
            /** @var TenantUser $user */
            $user = TenantUser::query()->firstOrNew(['mobile' => $validated['mobile']]);

            $user->forceFill([
                'name' => trim((string) $validated['full_name']),
                'mobile' => $validated['mobile'],
                'gender' => $validated['gender'],
                'birth_date' => $validated['birth_date'],
                'role' => $user->exists ? $user->role : 'customer',
                'is_active' => $user->exists ? (bool) $user->is_active : true,
                'can_book' => $user->exists ? (bool) $user->can_book : true,
                'password' => $user->exists ? $user->getAuthPassword() : Str::random(40),
            ])->save();

            /** @var NutritionProfile $profile */
            $profile = NutritionProfile::query()->updateOrCreate(
                ['user_id' => $user->id],
                [
                    'diet_goal' => $validated['diet_goal'],
                    'gender' => $validated['gender'],
                    'athlete_mode' => $validated['athlete_mode'],
                    'activity_level' => $validated['activity_level'],
                    'birth_date' => $validated['birth_date'],
                    'height_cm' => $validated['height_cm'],
                    'weight_kg' => $validated['weight_kg'],
                    'ideal_weight_kg' => $metrics['ideal_weight_kg'],
                    'recommended_target_weight_kg' => $metrics['recommended_target_weight_kg'],
                    'target_weight_kg' => $validated['target_weight_kg'],
                    'weekly_weight_change_kg' => $validated['weekly_weight_change_kg'] ?? null,
                    'medical_conditions' => NutritionMedicalConditionSupport::encodeEntries($medicalConditionEntries),
                    'medications_and_supplements' => trim((string) ($validated['medications_and_supplements'] ?? '')) ?: null,
                    'food_allergies' => trim((string) ($validated['food_allergies'] ?? '')) ?: null,
                    'disliked_foods' => trim((string) ($validated['disliked_foods'] ?? '')) ?: null,
                    'mindset_answers' => $normalizedMindsetAnswers !== [] ? $normalizedMindsetAnswers : null,
                    'preferences_completed_at' => now(),
                    'mindset_completed_at' => $normalizedMindsetAnswers !== [] ? now() : null,
                    'onboarding_completed_at' => now(),
                ],
            );

            DB::table('nutrition_weight_logs')->insert([
                'user_id' => $user->id,
                'logged_by_user_id' => $actor?->id,
                'source' => 'profile',
                'recorded_on' => now()->toDateString(),
                'recorded_at' => now(),
                'weight_kg' => $validated['weight_kg'],
                'notes' => 'ثبت یا ویرایش پرونده تغذیه توسط کارشناس',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return [$user->fresh(), $profile->fresh(['selectedPackage'])];
        });

        $medicalConditionItems = NutritionMedicalConditionSupport::parseEntries($profile->medical_conditions);

        return response()->json([
            'success' => true,
            'message' => 'پرونده کاربر با موفقیت ذخیره شد.',
            'data' => [
                'user' => [
                    'id' => (string) $user->id,
                    'fullName' => (string) ($user->name ?? ''),
                    'mobile' => (string) $user->mobile,
                ],
                'profile' => [
                    'dietGoal' => $profile->diet_goal,
                    'gender' => $profile->gender,
                    'athleteMode' => $profile->athlete_mode,
                    'activityLevel' => $profile->activity_level,
                    'birthDate' => $profile->birth_date?->toDateString(),
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
                ],
            ],
        ]);
    }

    public function createDietRequest(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $request->merge([
            'mobile' => InputNormalizer::mobile((string) $request->input('mobile')),
        ]);

        $validated = $request->validate([
            'mobile' => ['required', 'regex:/^09\d{9}$/'],
            'nutrition_diet_template_id' => ['nullable', 'integer', 'exists:nutrition_diet_templates,id'],
            'request_type' => ['required', 'in:ai,expert'],
            'expert_notes' => ['nullable', 'string'],
            'clinical_notes' => ['nullable', 'string'],
            'generation_instructions' => ['nullable', 'string'],
            'must_include' => ['nullable', 'string'],
            'must_avoid' => ['nullable', 'string'],
        ]);

        $admin = $request->user('tenant_web');

        $payload = DB::transaction(function () use ($admin, $validated): array {
            /** @var TenantUser $user */
            $user = TenantUser::query()
                ->with('nutritionProfile.selectedPackage')
                ->where('mobile', $validated['mobile'])
                ->firstOrFail();

            /** @var NutritionProfile|null $profile */
            $profile = $user->nutritionProfile;

            if (! $profile) {
                throw ValidationException::withMessages([
                    'profile' => 'ابتدا پرونده کاربر را کامل کنید.',
                ]);
            }

            $activeRequest = NutritionDietRequest::query()
                ->where('user_id', $user->id)
                ->whereIn('status', ['sent', 'in_progress', 'not_sent'])
                ->lockForUpdate()
                ->latest('id')
                ->first();

            if ($activeRequest) {
                throw ValidationException::withMessages([
                    'request' => 'این کاربر یک رژیم در حال تجویز دارد.',
                ]);
            }

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
                    'subscription' => 'برای این کاربر هنوز پکیج فعال ثبت نشده است.',
                ]);
            }

            $requestType = (string) $validated['request_type'];
            $templateId = isset($validated['nutrition_diet_template_id']) ? (int) $validated['nutrition_diet_template_id'] : null;
            $requiresManualDeliveryApproval = $requestType === 'ai' && $this->settings->manualAiApprovalRequired();
            $remaining = $requestType === 'ai'
                ? max(0, (int) $subscription->online_diet_total - (int) $subscription->online_diet_used)
                : max(0, (int) $subscription->offline_diet_total - (int) $subscription->offline_diet_used);

            if ($requestType === 'ai' && ! $templateId) {
                throw ValidationException::withMessages([
                    'nutrition_diet_template_id' => 'برای رژیم آنلاین باید الگوی رژیم انتخاب شود.',
                ]);
            }

            if ($remaining <= 0) {
                throw ValidationException::withMessages([
                    'subscription' => $requestType === 'ai'
                        ? 'سهم رژیم آنلاین این کاربر تمام شده است.'
                        : 'سهم رژیم اختصاصی این کاربر تمام شده است.',
                ]);
            }

            $template = null;
            if ($templateId) {
                /** @var NutritionDietTemplate $template */
                $template = NutritionDietTemplate::query()
                    ->withCount('children')
                    ->lockForUpdate()
                    ->findOrFail($templateId);

                if ($template->children_count > 0) {
                    throw ValidationException::withMessages([
                        'template' => 'لطفاً یک الگوی نهایی را انتخاب کنید.',
                    ]);
                }
            }

            $startedAt = now()->toDateString();
            $endsAt = $template
                ? now()->addDays(max(1, (int) $template->duration_days) - 1)->toDateString()
                : null;

            $profileSnapshot = [
                'dietGoal' => $profile->diet_goal,
                'gender' => $profile->gender,
                'athleteMode' => $profile->athlete_mode,
                'activityLevel' => $profile->activity_level,
                'birthDate' => $profile->birth_date?->toDateString(),
                'heightCm' => $profile->height_cm,
                'weightKg' => $profile->weight_kg !== null ? (float) $profile->weight_kg : null,
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
                'selectedNutritionPackageId' => $profile->selected_nutrition_package_id,
                'selectedNutritionPackageName' => $profile->selectedPackage?->name,
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
                'durationDays' => (int) $template->duration_days,
                'mealSlots' => $template->meal_slots,
                'conditionsText' => $template->conditions_text,
                'description' => $template->description,
                'supplementsEnabled' => (bool) $template->supplements_enabled,
                'supplementNotes' => $template->supplement_notes,
            ] : null;

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
                'weight_kg' => $profile->weight_kg,
                'ideal_weight_kg' => $profile->ideal_weight_kg,
                'recommended_target_weight_kg' => $profile->recommended_target_weight_kg,
                'target_weight_kg' => $profile->target_weight_kg,
                'weekly_weight_change_kg' => $profile->weekly_weight_change_kg,
                'medical_conditions' => $profile->medical_conditions,
                'medications_and_supplements' => $profile->medications_and_supplements,
                'disliked_foods' => $profile->disliked_foods,
                'food_allergies' => $profile->food_allergies,
                'mindset_answers' => $profile->mindset_answers !== null ? json_encode($profile->mindset_answers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
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
                'current_weight_kg' => $profile->weight_kg,
                'target_weight_kg' => $profile->target_weight_kg,
                'weekly_weight_change_kg' => $profile->weekly_weight_change_kg,
                'started_at' => $startedAt,
                'ends_at' => $endsAt,
                'ai_requested_by_user_id' => $admin?->id,
                'expert_notes' => trim((string) ($validated['expert_notes'] ?? '')) ?: null,
                'clinical_notes' => trim((string) ($validated['clinical_notes'] ?? '')) ?: null,
                'generation_instructions' => trim((string) ($validated['generation_instructions'] ?? '')) ?: null,
                'must_include' => trim((string) ($validated['must_include'] ?? '')) ?: null,
                'must_avoid' => trim((string) ($validated['must_avoid'] ?? '')) ?: null,
                'profile_snapshot' => $profileSnapshot,
                'template_snapshot' => $templateSnapshot,
                'request_payload_snapshot' => [
                    'requestType' => $requestType,
                    'startedAt' => $startedAt,
                    'endsAt' => $endsAt,
                    'requiresManualDeliveryApproval' => $requiresManualDeliveryApproval,
                    'remainingBeforeConsume' => $remaining,
                    'createdByAdminUserId' => $admin?->id,
                ],
                'ai_generation_status' => $requestType === 'ai' ? 'queued' : 'not_requested',
            ];

            if (Schema::hasColumn('nutrition_diet_requests', 'suggest_daily_replacements')) {
                $dietRequestAttributes['suggest_daily_replacements'] = (bool) ($template?->suggest_daily_replacements ?? false);
            }

            /** @var NutritionDietRequest $dietRequest */
            $dietRequest = NutritionDietRequest::query()->create($dietRequestAttributes);

            DB::table('nutrition_weight_logs')->insert([
                'user_id' => $user->id,
                'logged_by_user_id' => $admin?->id,
                'source' => 'diet_request',
                'recorded_on' => $startedAt,
                'recorded_at' => now(),
                'weight_kg' => $profile->weight_kg,
                'notes' => 'ثبت وزن هنگام تجویز رژیم توسط کارشناس',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            if ($requestType === 'ai') {
                DB::afterCommit(function () use ($dietRequest): void {
                    GenerateNutritionAiPrescriptionJob::dispatch((string) tenant('id'), (int) $dietRequest->id);
                });
            }

            return [
                'requestId' => (string) $dietRequest->id,
                'userId' => (string) $user->id,
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'درخواست تجویز رژیم برای کاربر ثبت شد.',
            'data' => $payload,
        ]);
    }

    public function updateAccess(Request $request, string $mobile): JsonResponse
    {
        $this->ensureAdmin($request);

        $normalizedMobile = InputNormalizer::mobile($mobile);
        abort_unless($normalizedMobile, 404);

        $validated = $request->validate([
            'can_book' => ['required', 'boolean'],
        ]);

        /** @var TenantUser $user */
        $user = TenantUser::query()
            ->where('mobile', $normalizedMobile)
            ->firstOrFail();

        $user->forceFill([
            'can_book' => (bool) $validated['can_book'],
        ])->save();

        return response()->json([
            'success' => true,
            'message' => $user->can_book ? 'پروفایل کاربر دوباره باز شد.' : 'پروفایل کاربر بسته شد.',
            'data' => [
                'canBook' => (bool) $user->can_book,
            ],
        ]);
    }

    private function ensureAdmin(Request $request): void
    {
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));
    }
}
