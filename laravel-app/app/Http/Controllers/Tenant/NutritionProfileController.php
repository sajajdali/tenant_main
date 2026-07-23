<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\NutritionProfile;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Support\NutritionMedicalConditionSupport;
use App\Support\NutritionWeightGoalCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class NutritionProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        /** @var TenantUser|null $user */
        $user = Auth::guard('tenant_web')->user();

        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $user = TenantUser::query()->find($user->id);

        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        }

        if (! $user->can_book) {
            return response()->json([
                'success' => false,
                'message' => 'دسترسی شما به بخش رژیم بسته است. لطفاً با پشتیبانی تماس بگیرید.',
            ], 423);
        }

        $profile = NutritionProfile::query()->where('user_id', $user->id)->first();

        return response()->json([
            'success' => true,
            'data' => [
                'profile' => $profile ? $this->formatProfile($profile) : null,
                'managerMessage' => $this->supportsNutritionFixedMessage()
                    ? (trim((string) ($user->nutrition_profile_fixed_message ?? '')) ?: null)
                    : null,
            ],
        ]);
    }

    private function supportsNutritionFixedMessage(): bool
    {
        $tenant = tenant();
        $tenant->loadMissing('audienceType');

        return in_array((string) ($tenant->audienceType?->slug ?? ''), ['nutritionists', 'nutrition-doctors'], true);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var TenantUser|null $user */
        $user = Auth::guard('tenant_web')->user();

        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'dietGoal' => ['required', 'in:lose-weight,gain-weight,maintain-weight'],
            'gender' => ['required', 'in:male,female'],
            'athleteMode' => ['required', 'in:athlete,non-athlete'],
            'activityLevel' => ['required', 'in:very-low,medium,high,intense'],
            'birthDate' => ['required', 'date'],
            'heightCm' => ['required', 'integer', 'min:80', 'max:250'],
            'weightKg' => ['required', 'numeric', 'min:20', 'max:350'],
        ], [
            'dietGoal.required' => 'هدف رژیم را انتخاب کنید.',
            'gender.required' => 'جنسیت را انتخاب کنید.',
            'athleteMode.required' => 'وضعیت ورزشی را انتخاب کنید.',
            'activityLevel.required' => 'سطح فعالیت روزانه را انتخاب کنید.',
            'birthDate.required' => 'تاریخ تولد را وارد کنید.',
            'heightCm.required' => 'قد را وارد کنید.',
            'weightKg.required' => 'وزن را وارد کنید.',
        ]);

        $metrics = NutritionWeightGoalCalculator::metrics(
            (int) $validated['heightCm'],
            (string) $validated['gender'],
            (float) $validated['weightKg'],
            (string) $validated['dietGoal'],
        );

        $profile = NutritionProfile::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'diet_goal' => $validated['dietGoal'],
                'gender' => $validated['gender'],
                'athlete_mode' => $validated['athleteMode'],
                'activity_level' => $validated['activityLevel'],
                'birth_date' => $validated['birthDate'],
                'height_cm' => $validated['heightCm'],
                'weight_kg' => $validated['weightKg'],
                'ideal_weight_kg' => $metrics['ideal_weight_kg'],
                'recommended_target_weight_kg' => $metrics['recommended_target_weight_kg'],
                'onboarding_completed_at' => now(),
            ],
        );

        DB::table('nutrition_weight_logs')->insert([
            'user_id' => $user->id,
            'logged_by_user_id' => $user->id,
            'source' => 'profile',
            'recorded_on' => now()->toDateString(),
            'recorded_at' => now(),
            'weight_kg' => $validated['weightKg'],
            'notes' => 'ثبت وزن هنگام تکمیل اطلاعات اولیه تغذیه',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $user->forceFill([
            'gender' => $validated['gender'],
            'birth_date' => $validated['birthDate'],
        ])->save();

        return response()->json([
            'success' => true,
            'message' => 'اطلاعات اولیه تغذیه با موفقیت ثبت شد.',
            'data' => [
                'profile' => $this->formatProfile($profile),
                'recommendation' => $metrics,
            ],
        ]);
    }

    public function updateTargetWeight(Request $request): JsonResponse
    {
        /** @var TenantUser|null $user */
        $user = Auth::guard('tenant_web')->user();

        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'targetWeightKg' => ['required', 'numeric', 'min:20', 'max:350'],
            'weeklyWeightChangeKg' => ['nullable', 'numeric', 'min:0.25', 'max:5'],
        ], [
            'targetWeightKg.required' => 'وزن هدف را وارد کنید.',
        ]);

        $profile = NutritionProfile::query()->where('user_id', $user->id)->first();

        if (! $profile) {
            return response()->json([
                'success' => false,
                'message' => 'ابتدا اطلاعات اولیه تغذیه را کامل کنید.',
            ], 422);
        }

        $profile->forceFill([
            'target_weight_kg' => $validated['targetWeightKg'],
            'weekly_weight_change_kg' => $validated['weeklyWeightChangeKg'] ?? $profile->weekly_weight_change_kg,
        ])->save();

        return response()->json([
            'success' => true,
            'message' => 'وزن هدف شما ثبت شد.',
            'data' => [
                'profile' => $this->formatProfile($profile),
            ],
        ]);
    }

    public function updateBirthDate(Request $request): JsonResponse
    {
        /** @var TenantUser|null $user */
        $user = Auth::guard('tenant_web')->user();

        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'birthDate' => ['required', 'date'],
        ], [
            'birthDate.required' => 'تاریخ تولد را وارد کنید.',
            'birthDate.date' => 'تاریخ تولد معتبر نیست.',
        ]);

        $profile = NutritionProfile::query()->where('user_id', $user->id)->first();

        if (! $profile) {
            return response()->json([
                'success' => false,
                'message' => 'پروفایل تغذیه برای ویرایش تاریخ تولد پیدا نشد.',
            ], 404);
        }

        $profile->forceFill([
            'birth_date' => $validated['birthDate'],
        ])->save();

        $user->forceFill([
            'birth_date' => $validated['birthDate'],
        ])->save();

        return response()->json([
            'success' => true,
            'message' => 'تاریخ تولد با موفقیت ذخیره شد.',
            'data' => [
                'profile' => $this->formatProfile($profile->fresh()),
            ],
        ]);
    }

    public function updatePreferences(Request $request): JsonResponse
    {
        /** @var TenantUser|null $user */
        $user = Auth::guard('tenant_web')->user();

        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'dislikedFoods' => ['nullable', 'string'],
            'foodAllergies' => ['nullable', 'string'],
            'medicalConditions' => ['nullable', 'string'],
            'medicalConditionsItems' => ['nullable', 'array'],
            'medicalConditionsItems.*.id' => ['nullable', 'string', 'max:120'],
            'medicalConditionsItems.*.title' => ['required_with:medicalConditionsItems', 'string', 'max:255'],
            'medicalConditionsItems.*.status' => ['nullable', 'in:current,past,temporary'],
            'medicalConditionsItems.*.startedAt' => ['nullable', 'date'],
            'medicalConditionsItems.*.endedAt' => ['nullable', 'date'],
            'medicalConditionsItems.*.ongoing' => ['nullable', 'boolean'],
            'medicalConditionsItems.*.notes' => ['nullable', 'string', 'max:1000'],
            'medicationsAndSupplements' => ['nullable', 'string'],
        ]);

        $profile = NutritionProfile::query()->where('user_id', $user->id)->first();

        if (! $profile) {
            return response()->json([
                'success' => false,
                'message' => 'ابتدا اطلاعات اولیه تغذیه را کامل کنید.',
            ], 422);
        }

        $medicalConditionEntries = array_key_exists('medicalConditionsItems', $validated)
            ? NutritionMedicalConditionSupport::normalizeEntries($validated['medicalConditionsItems'] ?? [])
            : NutritionMedicalConditionSupport::parseEntries($validated['medicalConditions'] ?? null);

        $profile->forceFill([
            'medical_conditions' => NutritionMedicalConditionSupport::encodeEntries($medicalConditionEntries),
            'medications_and_supplements' => trim((string) ($validated['medicationsAndSupplements'] ?? '')) ?: null,
            'disliked_foods' => trim((string) ($validated['dislikedFoods'] ?? '')) ?: null,
            'food_allergies' => trim((string) ($validated['foodAllergies'] ?? '')) ?: null,
            'preferences_completed_at' => now(),
        ])->save();

        return response()->json([
            'success' => true,
            'message' => 'ترجیحات غذایی شما ثبت شد.',
            'data' => [
                'profile' => $this->formatProfile($profile->fresh()),
            ],
        ]);
    }

    public function updateMindset(Request $request): JsonResponse
    {
        /** @var TenantUser|null $user */
        $user = Auth::guard('tenant_web')->user();

        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'answers' => ['required', 'array'],
            'answers.reason' => ['required', 'string', 'max:255'],
            'answers.barrier' => ['required', 'string', 'max:255'],
            'answers.stressAppetite' => ['required', 'string', 'max:255'],
            'answers.hardestTime' => ['required', 'string', 'max:255'],
            'answers.planStyle' => ['required', 'string', 'max:255'],
        ], [
            'answers.required' => 'پاسخ سؤالات رفتاری را کامل کنید.',
        ]);

        $profile = NutritionProfile::query()->where('user_id', $user->id)->first();

        if (! $profile) {
            return response()->json([
                'success' => false,
                'message' => 'ابتدا اطلاعات اولیه تغذیه را کامل کنید.',
            ], 422);
        }

        $profile->forceFill([
            'mindset_answers' => $validated['answers'],
            'mindset_completed_at' => now(),
        ])->save();

        return response()->json([
            'success' => true,
            'message' => 'پاسخ‌های شما ثبت شد.',
            'data' => [
                'profile' => $this->formatProfile($profile->fresh(['selectedPackage'])),
            ],
        ]);
    }

    public function updatePackageSelection(Request $request): JsonResponse
    {
        /** @var TenantUser|null $user */
        $user = Auth::guard('tenant_web')->user();

        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'nutritionPackageId' => ['required', 'integer', 'exists:nutrition_packages,id'],
        ], [
            'nutritionPackageId.required' => 'پکیج را انتخاب کنید.',
        ]);

        $profile = NutritionProfile::query()->where('user_id', $user->id)->first();

        if (! $profile) {
            return response()->json([
                'success' => false,
                'message' => 'ابتدا اطلاعات اولیه تغذیه را کامل کنید.',
            ], 422);
        }

        $profile->forceFill([
            'selected_nutrition_package_id' => (int) $validated['nutritionPackageId'],
            'package_selected_at' => now(),
        ])->save();

        return response()->json([
            'success' => true,
            'message' => 'پکیج انتخابی شما ثبت شد.',
            'data' => [
                'profile' => $this->formatProfile($profile->fresh(['selectedPackage'])),
            ],
        ]);
    }

    private function formatProfile(NutritionProfile $profile): array
    {
        $medicalConditionItems = NutritionMedicalConditionSupport::parseEntries($profile->medical_conditions);

        return [
            'id' => (string) $profile->id,
            'dietGoal' => $profile->diet_goal,
            'gender' => $profile->gender,
            'athleteMode' => $profile->athlete_mode,
            'activityLevel' => $profile->activity_level,
            'birthDate' => optional($profile->birth_date)->format('Y-m-d'),
            'heightCm' => $profile->height_cm,
            'weightKg' => (float) $profile->weight_kg,
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
            'preferencesCompletedAt' => optional($profile->preferences_completed_at)->toIso8601String(),
            'mindsetCompletedAt' => optional($profile->mindset_completed_at)->toIso8601String(),
            'packageSelectedAt' => optional($profile->package_selected_at)->toIso8601String(),
            'onboardingCompletedAt' => optional($profile->onboarding_completed_at)->toIso8601String(),
        ];
    }
}
