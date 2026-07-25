<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Customer\Membership;

use App\Domain\Tenant\Models\NutritionProfile;
use App\Domain\Tenant\Models\NutritionPackage;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Support\JalaliDate;
use App\Support\NutritionMedicalConditionSupport;
use App\Support\NutritionWeightGoalCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class MembershipController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();
        $profile = $this->nutritionProfile($user);

        return $this->success([
            'membership' => $this->membershipData($user, $profile),
            'steps' => $this->steps(),
        ]);
    }

    public function profile(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        return $this->success([
            'step' => 'profile',
            'title' => 'نام و جنسیت',
            'value' => $this->profileValue($user),
            'options' => [
                'genders' => $this->genderOptions(),
            ],
        ]);
    }

    public function storeProfile(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        $validated = $request->validate([
            'fullName' => ['required', 'string', 'min:3', 'max:200'],
            'gender' => ['required', Rule::in(['male', 'female'])],
        ], [
            'fullName.required' => 'نام را وارد کنید.',
            'fullName.string' => 'نام باید متن باشد.',
            'fullName.min' => 'نام باید حداقل ۳ حرف باشد.',
            'fullName.max' => 'نام نباید بیشتر از ۲۰۰ کاراکتر باشد.',
            'gender.required' => 'جنسیت را انتخاب کنید.',
            'gender.in' => 'جنسیت انتخاب‌شده معتبر نیست.',
        ]);

        $fullName = preg_replace('/\s+/u', ' ', trim($validated['fullName'])) ?: '';

        $user->forceFill([
            'name' => $fullName,
            'gender' => $validated['gender'],
        ])->save();

        $profile = $this->nutritionProfile($user);

        if ($profile) {
            $profile->forceFill([
                'gender' => $validated['gender'],
            ])->save();
        }

        return $this->success([
            'membership' => $this->membershipData($user->fresh(), $profile?->fresh()),
            'nextStep' => $this->membershipPath('goal'),
        ], 'اطلاعات عضویت ثبت شد.');
    }

    public function goal(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();
        $profile = $this->nutritionProfile($user);

        return $this->success([
            'step' => 'goal',
            'title' => 'هدفت از رژیم چیه ؟',
            'value' => [
                'dietGoal' => $profile?->diet_goal ?? $this->draft($user)['dietGoal'] ?? null,
            ],
            'options' => [
                'goals' => $this->goalOptions(),
            ],
        ]);
    }

    public function storeGoal(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        $validated = $request->validate([
            'dietGoal' => ['required', Rule::in(['lose-weight', 'gain-weight', 'maintain-weight'])],
        ], [
            'dietGoal.required' => 'هدف رژیم را انتخاب کنید.',
        ]);

        $profile = $this->nutritionProfile($user);

        if ($profile) {
            $profile->forceFill([
                'diet_goal' => $validated['dietGoal'],
            ])->save();
        } else {
            $this->putDraft($user, ['dietGoal' => $validated['dietGoal']]);
        }

        return $this->success([
            'membership' => $this->membershipData($user, $profile?->fresh()),
            'nextStep' => $this->membershipPath('activity'),
        ], 'هدف رژیم ثبت شد.');
    }

    public function activity(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();
        $profile = $this->nutritionProfile($user);
        $draft = $this->draft($user);

        return $this->success([
            'step' => 'activity',
            'title' => 'میزان فعالیت شما چقدره ؟',
            'value' => [
                'athleteMode' => $profile?->athlete_mode ?? $draft['athleteMode'] ?? null,
                'activityLevel' => $profile?->activity_level ?? $draft['activityLevel'] ?? null,
            ],
            'options' => [
                'athleteModes' => $this->athleteOptions(),
                'activityLevels' => $this->activityLevelOptions(),
            ],
        ]);
    }

    public function storeActivity(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        $validated = $request->validate([
            'athleteMode' => ['required', Rule::in(['athlete', 'non-athlete'])],
            'activityLevel' => ['required', Rule::in(['very-low', 'medium', 'high', 'intense'])],
        ], [
            'athleteMode.required' => 'وضعیت ورزشی را انتخاب کنید.',
            'activityLevel.required' => 'سطح فعالیت روزانه را انتخاب کنید.',
        ]);

        $profile = $this->nutritionProfile($user);

        if ($profile) {
            $profile->forceFill([
                'athlete_mode' => $validated['athleteMode'],
                'activity_level' => $validated['activityLevel'],
            ])->save();
        } else {
            $this->putDraft($user, [
                'athleteMode' => $validated['athleteMode'],
                'activityLevel' => $validated['activityLevel'],
            ]);
        }

        return $this->success([
            'membership' => $this->membershipData($user, $profile?->fresh()),
            'nextStep' => $this->membershipPath('birth-date'),
        ], 'میزان فعالیت ثبت شد.');
    }

    public function birthDate(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();
        $profile = $this->nutritionProfile($user);
        $draft = $this->draft($user);
        $birthDate = $profile?->birth_date?->toDateString()
            ?? $user->birth_date?->toDateString()
            ?? $draft['birthDate']
            ?? null;

        return $this->success([
            'step' => 'birth-date',
            'title' => 'لطفا تاریخ تولدت رو وارد کن',
            'value' => $this->birthDateValue($birthDate),
            'options' => [
                'calendar' => 'jalali',
                'years' => $this->birthDateYears(),
                'months' => $this->jalaliMonths(),
                'days' => range(1, 31),
            ],
        ]);
    }

    public function storeBirthDate(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        $validated = $request->validate([
            'jalaliYear' => ['required', 'integer', 'min:1200', 'max:1700'],
            'jalaliMonth' => ['required', 'integer', 'min:1', 'max:12'],
            'jalaliDay' => ['required', 'integer', 'min:1', 'max:31'],
        ], [
            'jalaliYear.required' => 'سال تولد را انتخاب کنید.',
            'jalaliMonth.required' => 'ماه تولد را انتخاب کنید.',
            'jalaliDay.required' => 'روز تولد را انتخاب کنید.',
        ]);

        $jalaliYear = (int) $validated['jalaliYear'];
        $jalaliMonth = (int) $validated['jalaliMonth'];
        $jalaliDay = (int) $validated['jalaliDay'];

        if (! JalaliDate::isValidJalaliDate($jalaliYear, $jalaliMonth, $jalaliDay)) {
            return response()->json([
                'success' => false,
                'message' => 'تاریخ تولد معتبر نیست.',
                'errors' => [
                    'jalaliDay' => ['روز انتخاب شده برای این ماه و سال معتبر نیست.'],
                ],
            ], 422);
        }

        [$gy, $gm, $gd] = JalaliDate::toGregorian($jalaliYear, $jalaliMonth, $jalaliDay);
        $birthDate = sprintf('%04d-%02d-%02d', $gy, $gm, $gd);
        $profile = $this->nutritionProfile($user);

        if ($profile) {
            $profile->forceFill([
                'birth_date' => $birthDate,
            ])->save();

            $user->forceFill([
                'birth_date' => $birthDate,
            ])->save();
        } else {
            $this->putDraft($user, ['birthDate' => $birthDate]);
        }

        return $this->success([
            'membership' => $this->membershipData($user->fresh(), $profile?->fresh()),
            'nextStep' => $this->membershipPath('height'),
        ], 'تاریخ تولد ثبت شد.');
    }

    public function height(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();
        $profile = $this->nutritionProfile($user);
        $draft = $this->draft($user);

        return $this->success([
            'step' => 'height',
            'title' => 'قد خود را وارد کنید',
            'value' => [
                'height' => $profile?->height_cm ?? $draft['heightCm'] ?? null,
            ],
            'options' => [
                'unit' => 'cm',
                'min' => 80,
                'max' => 250,
            ],
        ]);
    }

    public function storeHeight(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        $validated = $request->validate([
            'height' => ['required', 'integer', 'min:80', 'max:250'],
        ], [
            'height.required' => 'قد را وارد کنید.',
            'height.integer' => 'قد باید عدد صحیح باشد.',
            'height.min' => 'قد باید حداقل ۸۰ سانتی‌متر باشد.',
            'height.max' => 'قد باید حداکثر ۲۵۰ سانتی‌متر باشد.',
        ]);

        $profile = $this->nutritionProfile($user);

        if ($profile) {
            $profile->forceFill([
                'height_cm' => (int) $validated['height'],
            ])->save();
        } else {
            $this->putDraft($user, ['heightCm' => (int) $validated['height']]);
        }

        return $this->success([
            'membership' => $this->membershipData($user, $profile?->fresh()),
            'nextStep' => $this->membershipPath('weight'),
        ], 'قد ثبت شد.');
    }

    public function weight(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();
        $profile = $this->nutritionProfile($user);
        $draft = $this->draft($user);

        return $this->success([
            'step' => 'weight',
            'title' => 'وزن خود را وارد کنید',
            'value' => [
                'weight' => $profile?->weight_kg ?? $draft['weight'] ?? null,
            ],
            'options' => [
                'unit' => 'kg',
                'min' => 20,
                'max' => 350,
                'decimals' => 2,
            ],
        ]);
    }

    public function storeWeight(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        $validated = $request->validate([
            'weight' => ['required', 'numeric', 'min:20', 'max:350'],
        ], [
            'weight.required' => 'وزن را وارد کنید.',
            'weight.numeric' => 'وزن باید عددی باشد.',
            'weight.min' => 'وزن باید حداقل ۲۰ کیلوگرم باشد.',
            'weight.max' => 'وزن باید حداکثر ۳۵۰ کیلوگرم باشد.',
        ]);

        $profile = $this->nutritionProfile($user);
        $draft = $this->draft($user);
        $profileValue = $this->profileValue($user);

        $dietGoal = $profile?->diet_goal ?? $draft['dietGoal'] ?? null;
        $gender = $profile?->gender ?? $profileValue['gender'] ?? null;
        $athleteMode = $profile?->athlete_mode ?? $draft['athleteMode'] ?? null;
        $activityLevel = $profile?->activity_level ?? $draft['activityLevel'] ?? null;
        $birthDate = $profile?->birth_date?->toDateString()
            ?? $user->birth_date?->toDateString()
            ?? $draft['birthDate']
            ?? null;
        $height = $profile?->height_cm ?? $draft['heightCm'] ?? null;

        $missing = [];
        foreach ([
            'dietGoal' => $dietGoal,
            'gender' => $gender,
            'athleteMode' => $athleteMode,
            'activityLevel' => $activityLevel,
            'birthDate' => $birthDate,
            'height' => $height,
        ] as $field => $value) {
            if (! $value) {
                $missing[] = $field;
            }
        }

        if ($missing !== []) {
            return response()->json([
                'success' => false,
                'message' => 'برای ثبت وزن، ابتدا مراحل قبلی عضویت را کامل کنید.',
                'errors' => [
                    'missingFields' => $missing,
                ],
            ], 422);
        }

        $metrics = NutritionWeightGoalCalculator::metrics(
            (int) $height,
            (string) $gender,
            (float) $validated['weight'],
            (string) $dietGoal,
        );

        $profile = NutritionProfile::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'diet_goal' => $dietGoal,
                'gender' => $gender,
                'athlete_mode' => $athleteMode,
                'activity_level' => $activityLevel,
                'birth_date' => $birthDate,
                'height_cm' => (int) $height,
                'weight_kg' => $validated['weight'],
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
            'weight_kg' => $validated['weight'],
            'notes' => 'ثبت وزن هنگام تکمیل اطلاعات اولیه تغذیه',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $user->forceFill([
            'gender' => $gender,
            'birth_date' => $birthDate,
        ])->save();

        return $this->success([
            'membership' => $this->membershipData($user->fresh(), $profile->fresh()),
            'recommendation' => $metrics,
            'nextStep' => $this->membershipPath('target-weight'),
        ], 'وزن ثبت شد.');
    }

    public function targetWeight(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();
        $profile = $this->nutritionProfile($user);

        if (! $profile || ! $profile->height_cm || ! $profile->gender || ! $profile->diet_goal || ! $profile->weight_kg) {
            return response()->json([
                'success' => false,
                'message' => 'ابتدا اطلاعات اولیه عضویت و وزن فعلی را کامل کنید.',
                'errors' => [
                    'profile' => ['Initial nutrition profile is incomplete.'],
                ],
            ], 422);
        }

        return $this->success([
            'step' => 'target-weight',
            'title' => 'حالا وزن هدف خود را انتخاب کنید',
            'value' => [
                'targetWeight' => $profile->target_weight_kg !== null ? (float) $profile->target_weight_kg : null,
            ],
            'recommendation' => $this->targetWeightRecommendation($profile),
            'options' => [
                'unit' => 'kg',
                'min' => 20,
                'max' => 350,
                'decimals' => 2,
            ],
        ]);
    }

    public function storeTargetWeight(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        $validated = $request->validate([
            'targetWeight' => ['required', 'numeric', 'min:20', 'max:350'],
        ], [
            'targetWeight.required' => 'وزن هدف را وارد کنید.',
            'targetWeight.numeric' => 'وزن هدف باید عددی باشد.',
            'targetWeight.min' => 'وزن هدف باید حداقل ۲۰ کیلوگرم باشد.',
            'targetWeight.max' => 'وزن هدف باید حداکثر ۳۵۰ کیلوگرم باشد.',
        ]);

        $profile = $this->nutritionProfile($user);

        if (! $profile) {
            return response()->json([
                'success' => false,
                'message' => 'ابتدا اطلاعات اولیه تغذیه را کامل کنید.',
                'errors' => [
                    'profile' => ['Nutrition profile not found.'],
                ],
            ], 422);
        }

        $profile->forceFill([
            'target_weight_kg' => $validated['targetWeight'],
        ])->save();

        return $this->success([
            'membership' => $this->membershipData($user, $profile->fresh()),
            'recommendation' => $this->targetWeightRecommendation($profile->fresh()),
            'nextStep' => $this->membershipPath('result'),
        ], 'وزن هدف ثبت شد.');
    }

    public function result(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();
        $profile = $this->nutritionProfile($user);

        if (! $profile || ! $profile->weight_kg || $profile->target_weight_kg === null) {
            return response()->json([
                'success' => false,
                'message' => 'ابتدا وزن فعلی و وزن هدف را کامل کنید.',
                'errors' => [
                    'profile' => ['Weight and target weight are required before result step.'],
                ],
            ], 422);
        }

        $weeklyRate = $profile->weekly_weight_change_kg !== null
            ? (float) $profile->weekly_weight_change_kg
            : 1.0;

        return $this->success($this->resultStepData($profile, $weeklyRate));
    }

    public function storeResult(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        $validated = $request->validate([
            'weeklyRate' => ['required', 'numeric', 'in:0.5,1,1.5'],
        ], [
            'weeklyRate.required' => 'میزان تغییر وزن هفتگی را انتخاب کنید.',
            'weeklyRate.numeric' => 'میزان تغییر وزن هفتگی باید عددی باشد.',
            'weeklyRate.in' => 'میزان تغییر وزن هفتگی باید یکی از گزینه‌های مجاز باشد.',
        ]);

        $profile = $this->nutritionProfile($user);

        if (! $profile || ! $profile->weight_kg || $profile->target_weight_kg === null) {
            return response()->json([
                'success' => false,
                'message' => 'ابتدا وزن فعلی و وزن هدف را کامل کنید.',
                'errors' => [
                    'profile' => ['Weight and target weight are required before result step.'],
                ],
            ], 422);
        }

        $profile->forceFill([
            'weekly_weight_change_kg' => (float) $validated['weeklyRate'],
        ])->save();

        return $this->success([
            'membership' => $this->membershipData($user, $profile->fresh()),
            'result' => $this->resultStepData($profile->fresh(), (float) $validated['weeklyRate']),
            'nextStep' => $this->membershipPath('medical-conditions'),
        ], 'میزان تغییر وزن هفتگی ثبت شد.');
    }

    public function medicalConditions(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();
        $profile = $this->nutritionProfile($user);

        if (! $profile || $profile->weekly_weight_change_kg === null) {
            return response()->json([
                'success' => false,
                'message' => 'ابتدا مراحل قبلی عضویت را کامل کنید.',
                'errors' => [
                    'profile' => ['Weekly rate is required before medical conditions step.'],
                ],
            ], 422);
        }

        return $this->success($this->medicalConditionsStepData($profile));
    }

    public function storeMedicalConditions(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        $validated = $request->validate([
            'medicalConditions' => ['nullable', 'string'],
            'medicalConditionsItems' => ['nullable', 'array'],
            'medicalConditionsItems.*.id' => ['nullable', 'string', 'max:120'],
            'medicalConditionsItems.*.title' => ['required_with:medicalConditionsItems', 'string', 'max:255'],
            'medicalConditionsItems.*.status' => ['nullable', Rule::in(['current', 'past', 'temporary'])],
            'medicalConditionsItems.*.startedAt' => ['nullable', 'date'],
            'medicalConditionsItems.*.endedAt' => ['nullable', 'date'],
            'medicalConditionsItems.*.ongoing' => ['nullable', 'boolean'],
            'medicalConditionsItems.*.notes' => ['nullable', 'string', 'max:1000'],
        ], [
            'medicalConditionsItems.*.title.required_with' => 'عنوان بیماری را وارد کنید.',
            'medicalConditionsItems.*.status.in' => 'وضعیت بیماری معتبر نیست.',
            'medicalConditionsItems.*.startedAt.date' => 'تاریخ شروع بیماری معتبر نیست.',
            'medicalConditionsItems.*.endedAt.date' => 'تاریخ پایان بیماری معتبر نیست.',
        ]);

        $profile = $this->nutritionProfile($user);

        if (! $profile || $profile->weekly_weight_change_kg === null) {
            return response()->json([
                'success' => false,
                'message' => 'ابتدا مراحل قبلی عضویت را کامل کنید.',
                'errors' => [
                    'profile' => ['Weekly rate is required before medical conditions step.'],
                ],
            ], 422);
        }

        $medicalConditionEntries = array_key_exists('medicalConditionsItems', $validated)
            ? NutritionMedicalConditionSupport::normalizeEntries($validated['medicalConditionsItems'] ?? [])
            : NutritionMedicalConditionSupport::parseEntries($validated['medicalConditions'] ?? null);

        $profile->forceFill([
            'medical_conditions' => NutritionMedicalConditionSupport::encodeEntries($medicalConditionEntries),
            'preferences_completed_at' => now(),
        ])->save();

        return $this->success([
            'membership' => $this->membershipData($user, $profile->fresh()),
            'medicalConditions' => $this->medicalConditionsStepData($profile->fresh()),
            'nextStep' => $this->membershipPath('medications-and-supplements'),
        ], 'سوابق بیماری ثبت شد.');
    }

    public function medicationsAndSupplements(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();
        $profile = $this->nutritionProfile($user);

        if (! $profile || $profile->weekly_weight_change_kg === null) {
            return response()->json([
                'success' => false,
                'message' => 'ابتدا مراحل قبلی عضویت را کامل کنید.',
                'errors' => [
                    'profile' => ['Weekly rate is required before medications and supplements step.'],
                ],
            ], 422);
        }

        return $this->success($this->medicationsAndSupplementsStepData($profile));
    }

    public function storeMedicationsAndSupplements(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        $validated = $request->validate([
            'medicationsAndSupplements' => ['nullable', 'string', 'max:4000'],
        ]);

        $profile = $this->nutritionProfile($user);

        if (! $profile || $profile->weekly_weight_change_kg === null) {
            return response()->json([
                'success' => false,
                'message' => 'ابتدا مراحل قبلی عضویت را کامل کنید.',
                'errors' => [
                    'profile' => ['Weekly rate is required before medications and supplements step.'],
                ],
            ], 422);
        }

        $profile->forceFill([
            'medications_and_supplements' => trim((string) ($validated['medicationsAndSupplements'] ?? '')) ?: null,
            'preferences_completed_at' => now(),
        ])->save();

        return $this->success([
            'membership' => $this->membershipData($user, $profile->fresh()),
            'medicationsAndSupplements' => $this->medicationsAndSupplementsStepData($profile->fresh()),
            'nextStep' => $this->membershipPath('allergies'),
        ], 'داروها و مکمل‌های مصرفی ثبت شد.');
    }

    public function allergies(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();
        $profile = $this->nutritionProfile($user);

        if (! $profile || $profile->weekly_weight_change_kg === null) {
            return response()->json([
                'success' => false,
                'message' => 'ابتدا مراحل قبلی عضویت را کامل کنید.',
                'errors' => [
                    'profile' => ['Weekly rate is required before allergies step.'],
                ],
            ], 422);
        }

        return $this->success($this->allergiesStepData($profile));
    }

    public function storeAllergies(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        $validated = $request->validate([
            'foodAllergies' => ['nullable', 'string', 'max:4000'],
        ]);

        $profile = $this->nutritionProfile($user);

        if (! $profile || $profile->weekly_weight_change_kg === null) {
            return response()->json([
                'success' => false,
                'message' => 'ابتدا مراحل قبلی عضویت را کامل کنید.',
                'errors' => [
                    'profile' => ['Weekly rate is required before allergies step.'],
                ],
            ], 422);
        }

        $profile->forceFill([
            'food_allergies' => trim((string) ($validated['foodAllergies'] ?? '')) ?: null,
            'preferences_completed_at' => now(),
        ])->save();

        return $this->success([
            'membership' => $this->membershipData($user, $profile->fresh()),
            'allergies' => $this->allergiesStepData($profile->fresh()),
            'nextStep' => $this->membershipPath('disliked-foods'),
        ], 'حساسیت غذایی ثبت شد.');
    }

    public function dislikedFoods(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();
        $profile = $this->nutritionProfile($user);

        if (! $profile || $profile->weekly_weight_change_kg === null) {
            return response()->json([
                'success' => false,
                'message' => 'ابتدا مراحل قبلی عضویت را کامل کنید.',
                'errors' => [
                    'profile' => ['Weekly rate is required before disliked foods step.'],
                ],
            ], 422);
        }

        return $this->success($this->dislikedFoodsStepData($profile));
    }

    public function storeDislikedFoods(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        $validated = $request->validate([
            'dislikedFoods' => ['nullable', 'string', 'max:4000'],
        ]);

        $profile = $this->nutritionProfile($user);

        if (! $profile || $profile->weekly_weight_change_kg === null) {
            return response()->json([
                'success' => false,
                'message' => 'ابتدا مراحل قبلی عضویت را کامل کنید.',
                'errors' => [
                    'profile' => ['Weekly rate is required before disliked foods step.'],
                ],
            ], 422);
        }

        $profile->forceFill([
            'disliked_foods' => trim((string) ($validated['dislikedFoods'] ?? '')) ?: null,
            'preferences_completed_at' => now(),
        ])->save();

        return $this->success([
            'membership' => $this->membershipData($user, $profile->fresh()),
            'dislikedFoods' => $this->dislikedFoodsStepData($profile->fresh()),
            'nextStep' => $this->membershipPath('packages'),
        ], 'غذاهای نامطلوب ثبت شد.');
    }

    public function packages(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();
        $profile = $this->nutritionProfile($user);

        if (! $profile || $profile->weekly_weight_change_kg === null) {
            return response()->json([
                'success' => false,
                'message' => 'ابتدا مراحل قبلی عضویت را کامل کنید.',
                'errors' => [
                    'profile' => ['Weekly rate is required before packages step.'],
                ],
            ], 422);
        }

        return $this->success($this->packagesStepData($profile));
    }

    public function mindset(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();
        $profile = $this->nutritionProfile($user);

        return $this->success($this->mindsetStepData($profile));
    }

    public function storeMindset(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        $validated = $request->validate([
            'answers' => ['required', 'array'],
            'answers.reason' => ['required', 'string', 'max:255'],
            'answers.barrier' => ['required', 'string', 'max:255'],
            'answers.stressAppetite' => ['required', 'string', 'max:255'],
            'answers.hardestTime' => ['required', 'string', 'max:255'],
            'answers.planStyle' => ['required', 'string', 'max:255'],
        ], [
            'answers.required' => 'پاسخ سؤالات رفتاری را کامل کنید.',
            'answers.reason.required' => 'دلیل اصلی رسیدن به وزن هدف را انتخاب کنید.',
            'answers.barrier.required' => 'مانع اصلی رژیم‌های قبلی را انتخاب کنید.',
            'answers.stressAppetite.required' => 'تغییر اشتها در زمان استرس را انتخاب کنید.',
            'answers.hardestTime.required' => 'سخت‌ترین زمان کنترل اشتها را انتخاب کنید.',
            'answers.planStyle.required' => 'سبک برنامه غذایی را انتخاب کنید.',
        ]);

        $profile = $this->nutritionProfile($user);

        if (! $profile || $profile->target_weight_kg === null) {
            return response()->json([
                'success' => false,
                'message' => 'ابتدا مراحل قبلی عضویت را کامل کنید.',
                'errors' => [
                    'profile' => ['Target weight is required before mindset step.'],
                ],
            ], 422);
        }

        $answers = $this->normalizeMindsetAnswers($validated['answers']);

        $profile->forceFill([
            'mindset_answers' => $answers,
            'mindset_completed_at' => now(),
        ])->save();

        return $this->success([
            'membership' => $this->membershipData($user, $profile->fresh()),
            'mindset' => $this->mindsetStepData($profile->fresh()),
            'nextStep' => $this->membershipPath('review'),
        ], 'پاسخ‌های شما ثبت شد.');
    }

    private function success(array $data, ?string $message = null): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
            'meta' => [],
        ]);
    }

    private function nutritionProfile(TenantUser $user): ?NutritionProfile
    {
        return NutritionProfile::query()->where('user_id', $user->id)->first();
    }

    private function membershipData(TenantUser $user, ?NutritionProfile $profile): array
    {
        $draft = $this->draft($user);
        $profileValue = $this->profileValue($user);

        return [
            'profile' => $profileValue,
            'goal' => [
                'dietGoal' => $profile?->diet_goal ?? $draft['dietGoal'] ?? null,
            ],
            'activity' => [
                'athleteMode' => $profile?->athlete_mode ?? $draft['athleteMode'] ?? null,
                'activityLevel' => $profile?->activity_level ?? $draft['activityLevel'] ?? null,
            ],
            'birthDate' => $this->birthDateValue(
                $profile?->birth_date?->toDateString()
                    ?? $user->birth_date?->toDateString()
                    ?? $draft['birthDate']
                    ?? null,
            ),
            'height' => [
                'height' => $profile?->height_cm ?? $draft['heightCm'] ?? null,
            ],
            'weight' => [
                'weight' => $profile?->weight_kg ?? $draft['weight'] ?? null,
            ],
            'targetWeight' => [
                'targetWeight' => $profile?->target_weight_kg !== null ? (float) $profile->target_weight_kg : null,
            ],
            'result' => [
                'weeklyRate' => $profile?->weekly_weight_change_kg !== null ? (float) $profile->weekly_weight_change_kg : null,
            ],
            'medicalConditions' => $profile ? $this->medicalConditionsValue($profile) : [
                'medicalConditions' => null,
                'medicalConditionsItems' => [],
                'completedAt' => null,
            ],
            'medicationsAndSupplements' => $profile ? $this->medicationsAndSupplementsValue($profile) : [
                'medicationsAndSupplements' => null,
                'completedAt' => null,
            ],
            'allergies' => $profile ? $this->allergiesValue($profile) : [
                'foodAllergies' => null,
                'completedAt' => null,
            ],
            'dislikedFoods' => $profile ? $this->dislikedFoodsValue($profile) : [
                'dislikedFoods' => null,
                'completedAt' => null,
            ],
            'packageSelection' => [
                'selectedNutritionPackageId' => $profile?->selected_nutrition_package_id ? (string) $profile->selected_nutrition_package_id : null,
                'selectedNutritionPackageName' => $profile?->selectedPackage?->name,
                'completedAt' => $profile?->package_selected_at?->toIso8601String(),
            ],
            'mindset' => [
                'answers' => $profile?->mindset_answers ?? [],
                'completedAt' => $profile?->mindset_completed_at?->toIso8601String(),
            ],
            'status' => $this->status($profileValue, $profile, $draft),
        ];
    }

    private function profileValue(TenantUser $user): array
    {
        return [
            'fullName' => trim((string) $user->name) ?: null,
            'gender' => $user->gender,
        ];
    }

    private function status(array $profileValue, ?NutritionProfile $profile, array $draft): array
    {
        $missing = [];

        if (! $profileValue['fullName']) {
            $missing[] = 'fullName';
        }

        if (! $profileValue['gender']) {
            $missing[] = 'gender';
        }

        if (! ($profile?->diet_goal ?? $draft['dietGoal'] ?? null)) {
            $missing[] = 'dietGoal';
        }

        if (! ($profile?->athlete_mode ?? $draft['athleteMode'] ?? null)) {
            $missing[] = 'athleteMode';
        }

        if (! ($profile?->activity_level ?? $draft['activityLevel'] ?? null)) {
            $missing[] = 'activityLevel';
        }

        if (! ($profile?->birth_date ?? $draft['birthDate'] ?? null)) {
            $missing[] = 'birthDate';
        }

        if (! ($profile?->height_cm ?? $draft['heightCm'] ?? null)) {
            $missing[] = 'height';
        }

        if (! ($profile?->weight_kg ?? $draft['weight'] ?? null)) {
            $missing[] = 'weight';
        }

        if ($profile && $profile->target_weight_kg === null) {
            $missing[] = 'targetWeight';
        }

        if ($profile && $profile->target_weight_kg !== null && $profile->weekly_weight_change_kg === null) {
            $missing[] = 'weeklyRate';
        }

        if ($profile && $profile->weekly_weight_change_kg !== null && ! $profile->preferences_completed_at) {
            $missing[] = $profile->medical_conditions === null ? 'medicalConditions' : 'medicationsAndSupplements';
        }

        if ($profile && $profile->preferences_completed_at && ! $profile->selected_nutrition_package_id) {
            $missing[] = 'nutritionPackage';
        }

        return [
            'missingFields' => $missing,
            'nextStep' => match (true) {
                in_array('fullName', $missing, true),
                in_array('gender', $missing, true) => $this->membershipPath('profile'),
                in_array('dietGoal', $missing, true) => $this->membershipPath('goal'),
                in_array('athleteMode', $missing, true),
                in_array('activityLevel', $missing, true) => $this->membershipPath('activity'),
                in_array('birthDate', $missing, true) => $this->membershipPath('birth-date'),
                in_array('height', $missing, true) => $this->membershipPath('height'),
                in_array('weight', $missing, true) => $this->membershipPath('weight'),
                in_array('targetWeight', $missing, true) => $this->membershipPath('target-weight'),
                in_array('weeklyRate', $missing, true) => $this->membershipPath('result'),
                in_array('medicalConditions', $missing, true) => $this->membershipPath('medical-conditions'),
                in_array('medicationsAndSupplements', $missing, true) => $this->membershipPath('medications-and-supplements'),
                in_array('nutritionPackage', $missing, true) => $this->membershipPath('packages'),
                default => null,
            },
        ];
    }

    private function membershipPath(string $step): string
    {
        return '/membership/'.$step;
    }

    private function steps(): array
    {
        return [
            ['key' => 'profile', 'title' => 'نام و جنسیت', 'endpoint' => '/api/v1/app/membership/profile'],
            ['key' => 'goal', 'title' => 'هدف رژیم', 'endpoint' => '/api/v1/app/membership/goal'],
            ['key' => 'activity', 'title' => 'میزان فعالیت', 'endpoint' => '/api/v1/app/membership/activity'],
            ['key' => 'birth-date', 'title' => 'تاریخ تولد', 'endpoint' => '/api/v1/app/membership/birth-date'],
            ['key' => 'height', 'title' => 'قد', 'endpoint' => '/api/v1/app/membership/height'],
            ['key' => 'weight', 'title' => 'وزن', 'endpoint' => '/api/v1/app/membership/weight'],
            ['key' => 'target-weight', 'title' => 'وزن هدف', 'endpoint' => '/api/v1/app/membership/target-weight'],
            ['key' => 'result', 'title' => 'برنامه رسیدن به وزن هدف', 'endpoint' => '/api/v1/app/membership/result'],
            ['key' => 'medical-conditions', 'title' => 'سوابق بیماری', 'endpoint' => '/api/v1/app/membership/medical-conditions'],
            ['key' => 'medications-and-supplements', 'title' => 'دارو یا مکمل مصرفی', 'endpoint' => '/api/v1/app/membership/medications-and-supplements'],
            ['key' => 'allergies', 'title' => 'حساسیت غذایی', 'endpoint' => '/api/v1/app/membership/allergies'],
            ['key' => 'disliked-foods', 'title' => 'غذاهای نامطلوب', 'endpoint' => '/api/v1/app/membership/disliked-foods'],
            ['key' => 'packages', 'title' => 'انتخاب پکیج', 'endpoint' => '/api/v1/app/membership/packages'],
            ['key' => 'mindset', 'title' => 'سؤالات مهم قبل از دریافت رژیم', 'endpoint' => '/api/v1/app/membership/mindset'],
        ];
    }

    private function mindsetStepData(?NutritionProfile $profile): array
    {
        $answers = $this->mindsetAnswerLabels($profile?->mindset_answers ?? []);
        $questions = $this->mindsetQuestions($answers);

        return [
            'step' => 'mindset',
            'title' => 'سؤالات مهم قبل از دریافت رژیم',
            'subtitle' => 'مرحله شناخت انگیزه و رفتار غذایی',
            'description' => 'این سؤالات فقط یک‌بار پرسیده می‌شود و کمک می‌کند برنامه با انگیزه و سبک زندگی کاربر هماهنگ‌تر تنظیم شود.',
            'value' => [
                'answers' => $answers,
                'completedAt' => $profile?->mindset_completed_at?->toIso8601String(),
            ],
            'questions' => $questions,
            'items' => $questions,
            'pages' => $this->mindsetPages($questions),
            'options' => [
                'totalSteps' => count($questions),
                'totalQuestions' => count($questions),
                'answerField' => 'answers',
                'submitEndpoint' => '/api/v1/app/membership/mindset',
                'pageBasePath' => '/nutrition/membership/mindset',
            ],
        ];
    }

    private function mindsetPages(array $questions): array
    {
        return collect($questions)
            ->map(fn (array $question): array => [
                'step' => (int) $question['step'],
                'path' => '/nutrition/membership/mindset/'.$question['step'],
                'questionKey' => $question['key'],
                'question' => $question,
            ])
            ->values()
            ->all();
    }

    private function mindsetQuestions(array $answers = []): array
    {
        return collect([
            [
                'key' => 'reason',
                'step' => 1,
                'title' => 'مهم‌ترین دلیل شما برای رسیدن به این وزن هدف چیست؟',
                'description' => 'این جواب کمک می‌کند برنامه شما با انگیزه اصلی‌تان هماهنگ‌تر تنظیم شود.',
                'options' => [
                    ['key' => 'health-tests', 'label' => 'سلامتی و نتایج آزمایش'],
                    ['key' => 'confidence', 'label' => 'افزایش اعتمادبه‌نفس'],
                    ['key' => 'energy', 'label' => 'سبک شدن و انرژی بیشتر'],
                    ['key' => 'event', 'label' => 'آمادگی برای مراسم یا رویداد'],
                    ['key' => 'body-shape', 'label' => 'زیبایی اندام و تناسب بیشتر'],
                    ['key' => 'none', 'label' => 'هیچ‌کدام'],
                ],
            ],
            [
                'key' => 'barrier',
                'step' => 2,
                'title' => 'بزرگ‌ترین مانع شما در رژیم‌های قبلی چه بوده است؟',
                'description' => 'می‌خواهیم بدانیم کجاها بیشتر از همه به حمایت نیاز دارید.',
                'options' => [
                    ['key' => 'hunger-cravings', 'label' => 'گرسنگی و میل شدید به خوردن'],
                    ['key' => 'no-routine', 'label' => 'نداشتن برنامه منظم'],
                    ['key' => 'social-eating', 'label' => 'مهمانی و بیرون‌خوری'],
                    ['key' => 'stress-eating', 'label' => 'استرس و پرخوری عصبی'],
                    ['key' => 'prep-time', 'label' => 'کمبود زمان برای تهیه غذا'],
                    ['key' => 'none', 'label' => 'هیچ‌کدام'],
                ],
            ],
            [
                'key' => 'stressAppetite',
                'step' => 3,
                'title' => 'وقتی استرس می‌گیرید، اشتهای شما بیشتر می‌شود یا کمتر؟',
                'description' => 'این پاسخ در تنظیم نوع میان‌وعده و کنترل اشتها خیلی مهم است.',
                'options' => [
                    ['key' => 'more', 'label' => 'بیشتر می‌شود'],
                    ['key' => 'less', 'label' => 'کمتر می‌شود'],
                    ['key' => 'same', 'label' => 'تقریباً فرقی نمی‌کند'],
                    ['key' => 'mixed', 'label' => 'گاهی بیشتر و گاهی کمتر'],
                    ['key' => 'none', 'label' => 'هیچ‌کدام'],
                ],
            ],
            [
                'key' => 'hardestTime',
                'step' => 4,
                'title' => 'بیشتر در چه زمانی از روز کنترل اشتها برایتان سخت‌تر است؟',
                'description' => 'می‌خواهیم زمان‌های حساس روز شما را بهتر بشناسیم.',
                'options' => [
                    ['key' => 'morning', 'label' => 'صبح‌ها'],
                    ['key' => 'noon', 'label' => 'ظهر'],
                    ['key' => 'afternoon', 'label' => 'عصر'],
                    ['key' => 'night', 'label' => 'شب'],
                    ['key' => 'midnight', 'label' => 'نیمه‌شب'],
                    ['key' => 'none', 'label' => 'هیچ‌کدام'],
                ],
            ],
            [
                'key' => 'planStyle',
                'step' => 5,
                'title' => 'دوست دارید برنامه غذایی شما سخت‌گیرانه باشد یا منعطف؟',
                'description' => 'میزان انعطاف برنامه را با روحیه و سبک زندگی شما هماهنگ می‌کنیم.',
                'options' => [
                    ['key' => 'very-flexible', 'label' => 'خیلی منعطف'],
                    ['key' => 'flexible', 'label' => 'نسبتاً منعطف'],
                    ['key' => 'balanced', 'label' => 'متعادل'],
                    ['key' => 'strict', 'label' => 'نسبتاً سخت‌گیرانه'],
                    ['key' => 'very-strict', 'label' => 'کاملاً سخت‌گیرانه'],
                    ['key' => 'none', 'label' => 'هیچ‌کدام'],
                ],
            ],
        ])->map(function (array $question) use ($answers): array {
            $selectedLabel = (string) ($answers[$question['key']] ?? '');
            $question['options'] = collect($question['options'])
                ->map(fn (array $option): array => [
                    'key' => $option['key'],
                    'label' => $option['label'],
                    'selected' => $selectedLabel !== '' && $selectedLabel === $option['label'],
                ])
                ->values()
                ->all();

            return $question;
        })->values()->all();
    }

    private function normalizeMindsetAnswers(array $rawAnswers): array
    {
        $questions = $this->mindsetQuestions();
        $answers = [];

        foreach ($questions as $question) {
            $questionKey = (string) $question['key'];
            $value = trim((string) ($rawAnswers[$questionKey] ?? ''));
            $option = collect($question['options'])
                ->first(fn (array $option): bool => $value === $option['key'] || $value === $option['label']);

            if (! $option) {
                throw ValidationException::withMessages([
                    'answers.'.$questionKey => ['گزینه انتخاب‌شده برای این سؤال معتبر نیست.'],
                ]);
            }

            $answers[$questionKey] = (string) $option['label'];
        }

        return $answers;
    }

    private function mindsetAnswerLabels(array $rawAnswers): array
    {
        $labels = [];

        foreach ($rawAnswers as $key => $value) {
            $labels[$key] = is_array($value)
                ? (string) ($value['label'] ?? $value['value'] ?? '')
                : (string) $value;
        }

        return $labels;
    }

    private function medicalConditionsStepData(NutritionProfile $profile): array
    {
        return [
            'step' => 'medical-conditions',
            'title' => 'سوابق بیماری',
            'subtitle' => 'مرحله وضعیت پزشکی',
            'description' => 'اگر بیماری خاصی دارید، موردبه‌مورد ثبت کنید.',
            'value' => $this->medicalConditionsValue($profile),
            'options' => [
                'statuses' => $this->medicalConditionStatusOptions(),
                'allowEmpty' => true,
            ],
        ];
    }

    private function medicalConditionsValue(NutritionProfile $profile): array
    {
        $items = NutritionMedicalConditionSupport::parseEntries($profile->medical_conditions);

        return [
            'medicalConditions' => NutritionMedicalConditionSupport::summarizeEntries($items),
            'medicalConditionsItems' => $items,
            'completedAt' => $profile->preferences_completed_at?->toIso8601String(),
        ];
    }

    private function medicationsAndSupplementsStepData(NutritionProfile $profile): array
    {
        return [
            'step' => 'medications-and-supplements',
            'title' => 'دارو یا مکمل مصرفی',
            'subtitle' => 'مرحله دارو و مکمل',
            'description' => 'اگر دارو یا مکمل مصرف می‌کنید، نام، مقدار و زمان مصرف را وارد کنید.',
            'value' => $this->medicationsAndSupplementsValue($profile),
            'options' => [
                'allowEmpty' => true,
                'maxLength' => 4000,
            ],
        ];
    }

    private function medicationsAndSupplementsValue(NutritionProfile $profile): array
    {
        return [
            'medicationsAndSupplements' => $profile->medications_and_supplements,
            'completedAt' => $profile->preferences_completed_at?->toIso8601String(),
        ];
    }

    private function allergiesStepData(NutritionProfile $profile): array
    {
        return [
            'step' => 'allergies',
            'title' => 'حساسیت غذایی',
            'subtitle' => 'مرحله آلرژی و محدودیت',
            'description' => 'اگر به ماده غذایی خاصی حساسیت یا منع مصرف دارید، اینجا وارد کنید.',
            'value' => $this->allergiesValue($profile),
            'options' => [
                'allowEmpty' => true,
                'maxLength' => 4000,
            ],
        ];
    }

    private function allergiesValue(NutritionProfile $profile): array
    {
        return [
            'foodAllergies' => $profile->food_allergies,
            'completedAt' => $profile->preferences_completed_at?->toIso8601String(),
        ];
    }

    private function dislikedFoodsStepData(NutritionProfile $profile): array
    {
        return [
            'step' => 'disliked-foods',
            'title' => 'غذاهای نامطلوب',
            'subtitle' => 'مرحله ترجیحات غذایی',
            'description' => 'چه غذاهایی دوست نداری تو رژیمت باشه رو برامون بنویس',
            'value' => $this->dislikedFoodsValue($profile),
            'options' => [
                'allowEmpty' => true,
                'maxLength' => 4000,
            ],
        ];
    }

    private function dislikedFoodsValue(NutritionProfile $profile): array
    {
        return [
            'dislikedFoods' => $profile->disliked_foods,
            'completedAt' => $profile->preferences_completed_at?->toIso8601String(),
        ];
    }

    private function packagesStepData(NutritionProfile $profile): array
    {
        $packages = NutritionPackage::query()
            ->where('is_active', true)
            ->orderBy('depth')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();
        $items = $this->buildPackageTree($packages);

        return [
            'step' => 'packages',
            'title' => 'انتخاب پکیج',
            'subtitle' => 'مرحله انتخاب نوع رژیم',
            'description' => 'پکیج مناسب خود را انتخاب کنید. اگر یک پکیج زیرمجموعه دارد، یکی از زیرمجموعه‌های آن قابل خرید است.',
            'value' => [
                'selectedNutritionPackageId' => $profile->selected_nutrition_package_id ? (string) $profile->selected_nutrition_package_id : null,
                'selectedNutritionPackageName' => $profile->selectedPackage?->name,
                'completedAt' => $profile->package_selected_at?->toIso8601String(),
            ],
            'items' => $items,
            'emptyState' => [
                'isEmpty' => $items === [],
                'message' => $items === [] ? 'پکیجی برای شما تعریف نشده است.' : null,
            ],
            'options' => [
                'allowEmpty' => false,
                'selectionField' => 'nutritionPackageId',
                'previewEndpoint' => '/api/v1/app/nutrition/package-checkout/preview',
                'payEndpoint' => '/api/v1/app/nutrition/package-checkout/pay',
            ],
        ];
    }

    private function buildPackageTree($packages, ?int $parentId = null): array
    {
        return $packages
            ->filter(fn (NutritionPackage $package): bool => ($package->parent_id === null ? null : (int) $package->parent_id) === $parentId)
            ->sortBy(['sort_order', 'name'])
            ->map(fn (NutritionPackage $package): array => $this->formatPackage($package, $this->buildPackageTree($packages, (int) $package->id)))
            ->values()
            ->all();
    }

    private function formatPackage(NutritionPackage $package, array $children): array
    {
        $goals = collect($package->applicable_goals ?? [])->filter()->values()->all();
        $discountedPrice = $package->discounted_price_amount !== null ? (int) $package->discounted_price_amount : null;
        $price = (int) $package->price_amount;

        return [
            'id' => (string) $package->id,
            'parentId' => $package->parent_id ? (string) $package->parent_id : null,
            'depth' => (int) $package->depth,
            'name' => $package->name,
            'slug' => $package->slug,
            'imageUrl' => $this->tenantMediaUrl($package->image_path),
            'onlineDietCount' => (int) $package->online_diet_count,
            'offlineDietCount' => (int) $package->offline_diet_count,
            'durationDays' => (int) $package->duration_days,
            'priceAmount' => $price,
            'discountedPriceAmount' => $discountedPrice,
            'badgeTitle' => $package->badge_title,
            'payableAmount' => $discountedPrice ?? $price,
            'hasDiscount' => $discountedPrice !== null,
            'applicableGoals' => $goals,
            'applicableGoalLabels' => collect($goals)
                ->map(fn (string $goal): string => $this->goalLabel($goal))
                ->values()
                ->all(),
            'sortOrder' => (int) $package->sort_order,
            'isActive' => (bool) $package->is_active,
            'isPurchasable' => $children === [],
            'children' => $children,
        ];
    }

    private function goalLabel(string $goal): string
    {
        return match ($goal) {
            'lose-weight' => 'رسیدن به وزن کمتر و خوش اندام',
            'gain-weight' => 'وزن سالم و فرم دهی به بدن',
            'maintain-weight' => 'حفظ وزن و لایف استایل بهتر',
            default => $goal,
        };
    }

    private function medicalConditionStatusOptions(): array
    {
        return [
            ['value' => 'current', 'label' => 'فعلی'],
            ['value' => 'temporary', 'label' => 'موقت'],
            ['value' => 'past', 'label' => 'بیماری گذشته'],
        ];
    }

    private function resultStepData(NutritionProfile $profile, float $weeklyRate): array
    {
        $currentWeight = (float) $profile->weight_kg;
        $targetWeight = (float) $profile->target_weight_kg;
        $totalDifference = round(abs($currentWeight - $targetWeight), 2);
        $totalWeeks = $totalDifference === 0.0 ? 0 : (int) ceil($totalDifference / $weeklyRate);
        $dietPlansCount = $totalWeeks === 0 ? 0 : max(1, (int) ceil($totalWeeks / 4));
        $reachDate = now()->copy()->addDays($totalWeeks * 7);
        $milestones = $this->resultMilestones($currentWeight, $targetWeight, $totalWeeks, $weeklyRate);
        $chart = $this->resultChart($milestones);

        return [
            'step' => 'result',
            'title' => 'برنامه رسیدن به وزن هدف',
            'subtitle' => 'تحلیل مسیر کاهش وزن',
            'value' => [
                'weeklyRate' => $weeklyRate,
            ],
            'weights' => [
                'currentWeight' => $currentWeight,
                'targetWeight' => $targetWeight,
                'unit' => 'kg',
            ],
            'options' => [
                'weeklyRates' => $this->weeklyRateOptions(),
            ],
            'stats' => [
                'totalDifference' => $totalDifference,
                'totalWeeks' => $totalWeeks,
                'dietPlansCount' => $dietPlansCount,
                'reachDate' => $reachDate->toDateString(),
                'reachDateFormatted' => JalaliDate::format($reachDate),
                'targetReachedText' => $totalWeeks === 0
                    ? 'شما همین حالا روی وزن هدف قرار دارید.'
                    : 'اگر با این سرعت جلو بروید، حدود '.JalaliDate::toPersianDigits((string) $totalWeeks).' هفته دیگر به وزن هدف می‌رسید.',
            ],
            'summaryCards' => [
                [
                    'key' => 'total-weeks',
                    'title' => 'زمان رسیدن به وزن هدف',
                    'value' => $totalWeeks === 0 ? 'همین حالا' : JalaliDate::toPersianDigits((string) $totalWeeks).' هفته',
                ],
                [
                    'key' => 'reach-date',
                    'title' => 'تاریخ رسیدن',
                    'value' => JalaliDate::format($reachDate),
                ],
                [
                    'key' => 'diet-plans-count',
                    'title' => 'تعداد رژیم مورد نیاز',
                    'value' => JalaliDate::toPersianDigits((string) $dietPlansCount).' رژیم',
                    'description' => 'هر رژیم معادل یک ماه در نظر گرفته شده است.',
                ],
                [
                    'key' => 'target-weight',
                    'title' => 'وزن هدف انتخابی',
                    'value' => $this->formatWeightLabel($targetWeight).' کیلو',
                    'description' => 'وزن فعلی: '.$this->formatWeightLabel($currentWeight).' کیلو',
                ],
            ],
            'chart' => $chart,
            'milestones' => $milestones,
        ];
    }

    private function resultMilestones(float $currentWeight, float $targetWeight, int $totalWeeks, float $weeklyRate): array
    {
        $direction = $targetWeight >= $currentWeight ? 1 : -1;
        $steps = match (true) {
            $totalWeeks <= 1 => [0.0, 1.0],
            $totalWeeks === 2 => [0.0, 0.5, 1.0],
            default => [0.0, 1 / 3, 2 / 3, 1.0],
        };
        $today = now();

        return array_map(function (float $progress, int $index) use ($currentWeight, $targetWeight, $totalWeeks, $weeklyRate, $direction, $today): array {
            $elapsedWeeks = $totalWeeks === 0 ? 0.0 : $progress * $totalWeeks;
            $rawWeight = $currentWeight + ($direction * $elapsedWeeks * $weeklyRate);
            $boundedWeight = $direction === -1
                ? max($targetWeight, $rawWeight)
                : min($targetWeight, $rawWeight);
            $date = $today->copy()->addDays((int) round($elapsedWeeks * 7));
            $weekLabel = $totalWeeks <= 2
                ? 'هفته '.JalaliDate::toPersianDigits((string) ((int) round($elapsedWeeks)))
                : 'ماه '.$this->formatWeightLabel(max(1, round(($elapsedWeeks / 4) * 10) / 10));

            return [
                'id' => $index.'-'.$progress,
                'title' => $index === count($this->milestoneProgressSteps($totalWeeks)) - 1
                    ? 'رسیدن به وزن هدف'
                    : 'ایستگاه '.JalaliDate::toPersianDigits((string) ($index + 1)),
                'progress' => $progress,
                'weight' => $this->roundWeightToHalfKg($boundedWeight),
                'date' => $date->toDateString(),
                'dateFormatted' => JalaliDate::format($date),
                'weekLabel' => $weekLabel,
            ];
        }, $steps, array_keys($steps));
    }

    private function roundWeightToHalfKg(float $weight): float
    {
        return round($weight * 2) / 2;
    }

    private function milestoneProgressSteps(int $totalWeeks): array
    {
        return match (true) {
            $totalWeeks <= 1 => [0.0, 1.0],
            $totalWeeks === 2 => [0.0, 0.5, 1.0],
            default => [0.0, 1 / 3, 2 / 3, 1.0],
        };
    }

    private function resultChart(array $milestones): array
    {
        $width = 320;
        $height = 180;
        $paddingX = 26;
        $paddingY = 24;
        $weights = array_column($milestones, 'weight');
        $minWeight = min($weights);
        $maxWeight = max($weights);
        $range = max($maxWeight - $minWeight, 1);
        $lastIndex = max(count($milestones) - 1, 1);

        $points = array_map(static function (array $milestone, int $index) use ($width, $height, $paddingX, $paddingY, $minWeight, $range, $lastIndex): array {
            $x = $paddingX + (($width - $paddingX * 2) * ($index / $lastIndex));
            $y = $paddingY + (($height - $paddingY * 2) * (1 - (($milestone['weight'] - $minWeight) / $range)));

            return array_merge($milestone, [
                'x' => round($x, 2),
                'y' => round($y, 2),
            ]);
        }, $milestones, array_keys($milestones));

        return [
            'width' => $width,
            'height' => $height,
            'paddingX' => $paddingX,
            'paddingY' => $paddingY,
            'gridLines' => [40, 90, 140],
            'points' => $points,
            'polyline' => implode(' ', array_map(static fn (array $point): string => $point['x'].','.$point['y'], $points)),
        ];
    }

    private function weeklyRateOptions(): array
    {
        return [
            ['value' => 0.5, 'label' => 'هفته‌ای ۰.۵ کیلو'],
            ['value' => 1, 'label' => 'هفته‌ای ۱ کیلو'],
            ['value' => 1.5, 'label' => 'هفته‌ای ۱.۵ کیلو'],
        ];
    }

    private function formatWeightLabel(float $value): string
    {
        $formatted = number_format($value, 2, '.', '');
        $formatted = rtrim(rtrim($formatted, '0'), '.');

        return JalaliDate::toPersianDigits($formatted);
    }

    private function targetWeightRecommendation(NutritionProfile $profile): array
    {
        $metrics = NutritionWeightGoalCalculator::metrics(
            (int) $profile->height_cm,
            (string) $profile->gender,
            (float) $profile->weight_kg,
            (string) $profile->diet_goal,
        );

        return [
            'idealWeight' => (float) $metrics['ideal_weight_kg'],
            'healthWeight' => (float) $metrics['recommended_target_weight_kg'],
            'recommendedTargetWeight' => (float) $metrics['recommended_target_weight_kg'],
            'healthyRange' => [
                'start' => (float) $metrics['healthy_min_weight_kg'],
                'end' => (float) $metrics['healthy_max_weight_kg'],
                'description' => 'بازه وزن سالم بر اساس BMI برای قد ثبت شده کاربر.',
            ],
            'range' => [
                'start' => 20,
                'end' => 350,
                'description' => 'وزن هدف باید در این بازه و به کیلوگرم وارد شود.',
            ],
            'description' => $this->targetWeightDescription(
                (string) $profile->diet_goal,
                (float) $profile->weight_kg,
                (float) $metrics['healthy_min_weight_kg'],
                (float) $metrics['healthy_max_weight_kg'],
            ),
        ];
    }

    private function targetWeightDescription(string $dietGoal, float $currentWeight, float $healthyMin, float $healthyMax): string
    {
        if ($dietGoal === 'lose-weight') {
            if ($currentWeight <= $healthyMin) {
                return 'شما همین حالا هم در مرز پایین وزن سالم هستید. اگر باز هم قصد کاهش وزن دارید، بهتر است با احتیاط و زیر نظر متخصص جلو بروید.';
            }

            if ($currentWeight <= $healthyMax) {
                return 'وزن شما در بازه سالم قرار دارد. وزن سلامت، عددی امن برای ماندن در همین بازه است و وزن ایده‌آل هم نقطه مرجع تخصصی شماست.';
            }

            return 'با توجه به قد شما، سیستم یک وزن سلامت برای ورود به بازه سالم پیشنهاد می‌دهد و وزن ایده‌آل را هم جداگانه نمایش می‌دهد.';
        }

        if ($dietGoal === 'gain-weight') {
            return 'برای افزایش وزن، وزن سلامت کمینه مناسب ورود به بازه سالم است و وزن ایده‌آل به عنوان مرجع تخصصی جداگانه نمایش داده می‌شود.';
        }

        return 'برای تثبیت وزن، وزن سلامت عددی است که شما را داخل بازه سالم نگه می‌دارد و وزن ایده‌آل هم به عنوان مرجع حرفه‌ای نمایش داده می‌شود.';
    }

    private function birthDateValue(?string $birthDate): array
    {
        if (! $birthDate) {
            return [
                'birthDate' => null,
                'calendar' => 'jalali',
                'jalaliYear' => null,
                'jalaliMonth' => null,
                'jalaliDay' => null,
                'formatted' => null,
            ];
        }

        [$gy, $gm, $gd] = array_map('intval', explode('-', $birthDate));
        [$jy, $jm, $jd] = JalaliDate::fromGregorian($gy, $gm, $gd);

        return [
            'birthDate' => $birthDate,
            'calendar' => 'jalali',
            'jalaliYear' => $jy,
            'jalaliMonth' => $jm,
            'jalaliDay' => $jd,
            'formatted' => JalaliDate::format($birthDate),
        ];
    }

    private function genderOptions(): array
    {
        return [
            ['value' => 'female', 'label' => 'زن'],
            ['value' => 'male', 'label' => 'مرد'],
        ];
    }

    private function goalOptions(): array
    {
        return [
            ['value' => 'lose-weight', 'label' => 'رسیدن به وزن کمتر و خوش اندام', 'description' => 'برای سبک‌تر شدن و ساخت فرم بدنی دلخواه'],
            ['value' => 'gain-weight', 'label' => 'وزن سالم و فرم دهی به بدن', 'description' => 'برای رسیدن به وزن سالم و فرم‌دهی هدفمند'],
            ['value' => 'maintain-weight', 'label' => 'حفظ وزن و لایف استایل بهتر', 'description' => 'برای نگه داشتن وزن و ساخت سبک زندگی بهتر'],
        ];
    }

    private function athleteOptions(): array
    {
        return [
            ['value' => 'athlete', 'label' => 'ورزشکار هستم', 'description' => 'تمرین منظم دارم و برنامه غذایی باید با آن هماهنگ شود.'],
            ['value' => 'non-athlete', 'label' => 'ورزشکار نیستم', 'description' => 'برای سبک زندگی روزمره و عادی برنامه‌ریزی می‌کنم.'],
        ];
    }

    private function activityLevelOptions(): array
    {
        return [
            ['value' => 'very-low', 'label' => 'خیلی کم', 'description' => 'بیشتر ساعات روز کم‌تحرک هستم.'],
            ['value' => 'medium', 'label' => 'متوسط', 'description' => 'تحرک روزانه معمولی و قابل‌قبول دارم.'],
            ['value' => 'high', 'label' => 'زیاد', 'description' => 'در طول روز فعالیت بدنی نسبتاً زیادی دارم.'],
            ['value' => 'intense', 'label' => 'شدید', 'description' => 'ورزش و فعالیت بدنی سنگین و مداوم دارم.'],
        ];
    }

    private function birthDateYears(): array
    {
        [$currentJalaliYear] = JalaliDate::fromGregorian((int) now()->format('Y'), (int) now()->format('n'), (int) now()->format('j'));

        return range($currentJalaliYear, $currentJalaliYear - 89);
    }

    private function jalaliMonths(): array
    {
        return [
            ['value' => 1, 'label' => 'فروردین'],
            ['value' => 2, 'label' => 'اردیبهشت'],
            ['value' => 3, 'label' => 'خرداد'],
            ['value' => 4, 'label' => 'تیر'],
            ['value' => 5, 'label' => 'مرداد'],
            ['value' => 6, 'label' => 'شهریور'],
            ['value' => 7, 'label' => 'مهر'],
            ['value' => 8, 'label' => 'آبان'],
            ['value' => 9, 'label' => 'آذر'],
            ['value' => 10, 'label' => 'دی'],
            ['value' => 11, 'label' => 'بهمن'],
            ['value' => 12, 'label' => 'اسفند'],
        ];
    }

    private function draft(TenantUser $user): array
    {
        return Cache::get($this->draftCacheKey($user), []);
    }

    private function putDraft(TenantUser $user, array $values): void
    {
        Cache::put(
            $this->draftCacheKey($user),
            array_merge($this->draft($user), $values),
            now()->addDays(7),
        );
    }

    private function draftCacheKey(TenantUser $user): string
    {
        return 'customer_app_membership:draft:'.tenant('id').':'.$user->id;
    }
}
