<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\NutritionDietPrescription;
use App\Domain\Tenant\Models\NutritionDietRequest;
use App\Domain\Tenant\Models\NutritionMealReplacementSuggestion;
use App\Domain\Tenant\Models\NutritionPackageSubscription;
use App\Domain\Tenant\Models\NutritionProfile;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Services\NutritionAiManualMealNutritionService;
use App\Services\NutritionAiMealPhotoAnalysisService;
use App\Services\NutritionAiMealReplacementGenerationService;
use App\Services\NutritionCustomerClubRewardService;
use App\Services\NutritionDietRequestSettingsService;
use App\Services\NutritionExerciseCaloriesService;
use App\Services\TenantNutritionExerciseLibraryService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class NutritionDietPrescriptionController extends Controller
{
    public function __construct(
        private readonly NutritionAiMealReplacementGenerationService $mealReplacementGeneration,
        private readonly NutritionAiManualMealNutritionService $manualMealNutrition,
        private readonly NutritionAiMealPhotoAnalysisService $mealPhotoAnalysis,
        private readonly NutritionCustomerClubRewardService $customerClubRewards,
        private readonly NutritionDietRequestSettingsService $settings,
        private readonly NutritionExerciseCaloriesService $exerciseCalories,
        private readonly TenantNutritionExerciseLibraryService $exerciseLibrary,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $user = $this->user();
        abort_unless($user, 401);

        $items = NutritionDietPrescription::query()
            ->with('request')
            ->where('user_id', $user->id)
            ->whereNotNull('published_at')
            ->latest('published_at')
            ->latest('id')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $items->map(fn (NutritionDietPrescription $item): array => $this->serializePrescription($item))->values()->all(),
                'action' => $this->listAction($user, $items->count()),
            ],
        ]);
    }

    public function current(Request $request): JsonResponse
    {
        $user = $this->user();
        abort_unless($user, 401);

        /** @var NutritionDietPrescription|null $prescription */
        $prescription = NutritionDietPrescription::query()
            ->with('request:id,request_type')
            ->where('user_id', $user->id)
            ->where('is_current', true)
            ->whereNotNull('published_at')
            ->latest('id')
            ->first();

        return response()->json([
            'success' => true,
            'data' => [
                'prescription' => $prescription ? $this->serializePrescription($prescription, $this->activeDate($request)) : null,
            ],
        ]);
    }

    public function show(Request $request, NutritionDietPrescription $nutritionDietPrescription): JsonResponse
    {
        $user = $this->user();
        abort_unless($user, 401);
        abort_unless((int) $nutritionDietPrescription->user_id === (int) $user->id, 403);
        abort_unless($nutritionDietPrescription->published_at !== null, 404);

        return response()->json([
            'success' => true,
            'data' => [
                'prescription' => $this->serializePrescription($nutritionDietPrescription, $this->activeDate($request)),
            ],
        ]);
    }

    public function storeMealLog(Request $request): JsonResponse
    {
        $user = $this->user();
        abort_unless($user, 401);

        $validated = $request->validate([
            'consumed_date' => ['required', 'date'],
            'meal_slot_key' => ['required', 'string', 'max:64'],
            'slot_title' => ['nullable', 'string', 'max:255'],
            'food_title' => ['required', 'string', 'max:255'],
            'food_description' => ['nullable', 'string'],
            'quantity_text' => ['nullable', 'string', 'max:255'],
            'option_calories' => ['nullable', 'integer', 'min:0', 'max:3000'],
            'protein_grams' => ['nullable', 'numeric', 'min:0', 'max:300'],
            'fat_grams' => ['nullable', 'numeric', 'min:0', 'max:300'],
            'carbohydrate_grams' => ['nullable', 'numeric', 'min:0', 'max:600'],
            'fiber_grams' => ['nullable', 'numeric', 'min:0', 'max:150'],
            'notes' => ['nullable', 'string'],
        ]);

        /** @var NutritionDietPrescription $prescription */
        $prescription = NutritionDietPrescription::query()
            ->where('user_id', $user->id)
            ->where('is_current', true)
            ->whereNotNull('published_at')
            ->latest('id')
            ->firstOrFail();

        $this->ensureDailyPrescriptionCurrentDay($prescription, (string) $validated['consumed_date']);

        $mealSlotId = DB::table('nutrition_prescription_meal_slots')
            ->where('nutrition_diet_prescription_id', $prescription->id)
            ->where('slot_key', $validated['meal_slot_key'])
            ->value('id');

        DB::transaction(function () use ($mealSlotId, $prescription, $user, $validated): void {
            DB::table('nutrition_meal_logs')
                ->where('user_id', $user->id)
                ->where('nutrition_diet_prescription_id', $prescription->id)
                ->whereDate('consumed_date', $validated['consumed_date'])
                ->where('meal_slot_key', $validated['meal_slot_key'])
                ->where('consumption_type', 'scheduled')
                ->delete();

            DB::table('nutrition_meal_logs')->insert([
                'user_id' => $user->id,
                'nutrition_diet_prescription_id' => $prescription->id,
                'nutrition_prescription_meal_slot_id' => $mealSlotId,
                'logged_by_user_id' => $user->id,
                'consumed_date' => $validated['consumed_date'],
                'consumed_at' => now(),
                'meal_slot_key' => $validated['meal_slot_key'],
                'consumption_type' => 'scheduled',
                'status' => 'eaten',
                'food_title' => $validated['food_title'],
                'food_description' => trim((string) ($validated['food_description'] ?? '')),
                'quantity_text' => $validated['quantity_text'] ?? null,
                'option_calories' => isset($validated['option_calories']) ? (int) $validated['option_calories'] : null,
                'protein_grams' => isset($validated['protein_grams']) ? (float) $validated['protein_grams'] : null,
                'fat_grams' => isset($validated['fat_grams']) ? (float) $validated['fat_grams'] : null,
                'carbohydrate_grams' => isset($validated['carbohydrate_grams']) ? (float) $validated['carbohydrate_grams'] : null,
                'fiber_grams' => isset($validated['fiber_grams']) ? (float) $validated['fiber_grams'] : null,
                'notes' => $this->mealLogNotes($validated),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        $fresh = NutritionDietPrescription::query()->findOrFail($prescription->id);
        $this->customerClubRewards->awardForScheduledMealLog(
            $user,
            $fresh,
            (string) $validated['consumed_date'],
            (string) $validated['meal_slot_key'],
        );

        return response()->json([
            'success' => true,
            'message' => 'مصرف این وعده ثبت شد.',
            'data' => [
                'prescription' => $this->serializePrescription($fresh),
            ],
        ]);
    }

    public function deleteMealLog(Request $request, int $mealLogId): JsonResponse
    {
        $user = $this->user();
        abort_unless($user, 401);

        /** @var NutritionDietPrescription $prescription */
        $prescription = NutritionDietPrescription::query()
            ->where('user_id', $user->id)
            ->where('is_current', true)
            ->whereNotNull('published_at')
            ->latest('id')
            ->firstOrFail();

        $mealLog = DB::table('nutrition_meal_logs')
            ->where('id', $mealLogId)
            ->where('user_id', $user->id)
            ->where('nutrition_diet_prescription_id', $prescription->id)
            ->where('consumption_type', 'scheduled')
            ->first(['consumed_date']);

        abort_unless($mealLog, 404, 'وعده ثبت‌شده پیدا نشد.');

        $this->ensureDailyPrescriptionCurrentDay($prescription, (string) $mealLog->consumed_date);

        $deleted = DB::table('nutrition_meal_logs')
            ->where('id', $mealLogId)
            ->where('user_id', $user->id)
            ->where('nutrition_diet_prescription_id', $prescription->id)
            ->where('consumption_type', 'scheduled')
            ->delete();

        $fresh = NutritionDietPrescription::query()->findOrFail($prescription->id);

        return response()->json([
            'success' => true,
            'message' => 'ثبت این وعده برای این روز حذف شد.',
            'data' => [
                'prescription' => $this->serializePrescription($fresh),
            ],
        ]);
    }

    public function storeOtherMealLog(Request $request): JsonResponse
    {
        $user = $this->user();
        abort_unless($user, 401);
        abort_unless($this->settings->outOfPlanMealLoggingEnabled(), 422, 'ثبت غذای خارج از برنامه برای این کارشناس غیرفعال شده است.');
        abort_unless($this->mealLogAiNutritionColumnsExist(), 503, 'ستون‌های محاسبه ارزش غذایی AI هنوز روی دیتابیس این tenant ساخته نشده‌اند. لطفاً migration جدید را اجرا کنید.');

        $validated = $request->validate([
            'consumed_date' => ['required', 'date'],
            'meal_slot_key' => ['required', 'string', 'max:64'],
            'slot_title' => ['nullable', 'string', 'max:255'],
            'food_title' => ['required', 'string', 'max:255'],
            'food_description' => ['nullable', 'string'],
            'quantity_text' => ['nullable', 'string', 'max:255'],
            'option_calories' => ['nullable', 'integer', 'min:0', 'max:3000'],
            'protein_grams' => ['nullable', 'numeric', 'min:0', 'max:300'],
            'fat_grams' => ['nullable', 'numeric', 'min:0', 'max:300'],
            'carbohydrate_grams' => ['nullable', 'numeric', 'min:0', 'max:600'],
            'fiber_grams' => ['nullable', 'numeric', 'min:0', 'max:150'],
            'manual_entry_method' => ['nullable', 'in:manual,photo'],
            'image' => ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:4096'],
            'notes' => ['nullable', 'string'],
        ]);

        /** @var NutritionDietPrescription $prescription */
        $prescription = NutritionDietPrescription::query()
            ->where('user_id', $user->id)
            ->where('is_current', true)
            ->whereNotNull('published_at')
            ->latest('id')
            ->firstOrFail();

        if (($validated['manual_entry_method'] ?? 'manual') === 'photo') {
            abort_unless($this->settings->mealPhotoAnalysisEnabled(), 422, 'ثبت با عکس و تحلیل کالری برای این کارشناس غیرفعال شده است.');
        }

        $mealSlotId = DB::table('nutrition_prescription_meal_slots')
            ->where('nutrition_diet_prescription_id', $prescription->id)
            ->where('slot_key', $validated['meal_slot_key'])
            ->value('id');

        /** @var UploadedFile|null $image */
        $image = $request->file('image');
        $supportsManualEntryMeta = $this->manualMealEntryColumnsExist();
        $hasPrecomputedNutrition = isset($validated['option_calories']);

        if (! $hasPrecomputedNutrition) {
            $this->settings->assertAiUsageAllowed('manual_meal_nutrition', $prescription, $user);
        }

        $photoPath = ($image instanceof UploadedFile && $supportsManualEntryMeta)
            ? $this->storeMealPhoto($image, (int) $user->id, (string) $validated['consumed_date'], (string) $validated['meal_slot_key'])
            : null;

        try {
            $mealLogId = DB::transaction(function () use ($mealSlotId, $prescription, $user, $validated, $photoPath, $hasPrecomputedNutrition, $supportsManualEntryMeta): int {
                $insertPayload = [
                    'user_id' => $user->id,
                    'nutrition_diet_prescription_id' => $prescription->id,
                    'nutrition_prescription_meal_slot_id' => $mealSlotId,
                    'logged_by_user_id' => $user->id,
                    'consumed_date' => $validated['consumed_date'],
                    'consumed_at' => now(),
                    'meal_slot_key' => $validated['meal_slot_key'],
                    'consumption_type' => 'manual',
                    'status' => 'eaten',
                    'food_title' => $validated['food_title'],
                    'food_description' => trim((string) ($validated['food_description'] ?? '')),
                    'quantity_text' => $validated['quantity_text'] ?? null,
                    'option_calories' => $validated['option_calories'] ?? null,
                    'protein_grams' => $validated['protein_grams'] ?? null,
                    'fat_grams' => $validated['fat_grams'] ?? null,
                    'carbohydrate_grams' => $validated['carbohydrate_grams'] ?? null,
                    'fiber_grams' => $validated['fiber_grams'] ?? null,
                    'notes' => $this->mealLogNotes([
                        ...$validated,
                        'notes' => trim('manual:' . ($validated['notes'] ?? '')),
                    ]),
                    'ai_nutrition_status' => $hasPrecomputedNutrition ? 'generated' : 'queued',
                    'ai_nutrition_error' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];

                if ($supportsManualEntryMeta) {
                    $insertPayload['manual_entry_method'] = $validated['manual_entry_method'] ?? 'manual';
                    $insertPayload['photo_path'] = $photoPath;
                }

                return (int) DB::table('nutrition_meal_logs')->insertGetId($insertPayload);
            });
        } catch (\Throwable $exception) {
            if ($photoPath !== null) {
                Storage::disk('media_public')->delete($photoPath);
            }

            throw $exception;
        }

        if ($photoPath !== null && $image instanceof UploadedFile) {
            $this->recordTenantMediaFile($photoPath, (int) $image->getSize());
        }

        if (! $hasPrecomputedNutrition) {
            $this->manualMealNutrition->queue($mealLogId);
        }
        $fresh = NutritionDietPrescription::query()->findOrFail($prescription->id);

        return response()->json([
            'success' => true,
            'message' => $hasPrecomputedNutrition
                ? 'غذای خارج از رژیم با پیشنهاد AI ثبت شد.'
                : 'غذای خارج از رژیم ثبت شد و محاسبه ارزش غذایی با AI شروع شد.',
            'data' => [
                'prescription' => $this->serializePrescription($fresh),
            ],
        ]);
    }

    public function analyzeOtherMealPhoto(Request $request): JsonResponse
    {
        $user = $this->user();
        abort_unless($user, 401);
        abort_unless($this->settings->outOfPlanMealLoggingEnabled(), 422, 'ثبت غذای خارج از برنامه برای این کارشناس غیرفعال شده است.');
        abort_unless($this->settings->mealPhotoAnalysisEnabled(), 422, 'ثبت با عکس و تحلیل کالری برای این کارشناس غیرفعال شده است.');

        $validated = $request->validate([
            'consumed_date' => ['required', 'date'],
            'meal_slot_key' => ['required', 'string', 'max:64'],
            'slot_title' => ['nullable', 'string', 'max:255'],
            'user_food_title' => ['nullable', 'string', 'max:255'],
            'user_note' => ['nullable', 'string', 'max:1000'],
            'image' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:4096'],
        ]);

        /** @var NutritionDietPrescription $prescription */
        $prescription = NutritionDietPrescription::query()
            ->where('user_id', $user->id)
            ->where('is_current', true)
            ->whereNotNull('published_at')
            ->latest('id')
            ->firstOrFail();
        $this->settings->assertMealPhotoAnalysisUsageAllowed($prescription, $user);

        /** @var UploadedFile $image */
        $image = $request->file('image');
        $analysis = $this->mealPhotoAnalysis->analyze($prescription, $user, $validated, $image);

        return response()->json([
            'success' => true,
            'message' => 'تحلیل عکس غذا آماده شد.',
            'data' => [
                'analysis' => $analysis,
            ],
        ]);
    }

    public function deleteOtherMealLog(Request $request, int $mealLogId): JsonResponse
    {
        $user = $this->user();
        abort_unless($user, 401);

        /** @var NutritionDietPrescription $prescription */
        $prescription = NutritionDietPrescription::query()
            ->where('user_id', $user->id)
            ->where('is_current', true)
            ->whereNotNull('published_at')
            ->latest('id')
            ->firstOrFail();

        $mealLog = DB::table('nutrition_meal_logs')
            ->where('id', $mealLogId)
            ->where('user_id', $user->id)
            ->where('nutrition_diet_prescription_id', $prescription->id)
            ->where('consumption_type', 'manual')
            ->first();

        abort_unless($mealLog, 404, 'مورد خارج از رژیم پیدا نشد.');

        $deleted = DB::table('nutrition_meal_logs')
            ->where('id', $mealLogId)
            ->where('user_id', $user->id)
            ->where('nutrition_diet_prescription_id', $prescription->id)
            ->where('consumption_type', 'manual')
            ->delete();

        abort_unless($deleted > 0, 404, 'مورد خارج از رژیم پیدا نشد.');

        $this->deletePhysicalFile((string) ($mealLog->photo_path ?? ''));

        $fresh = NutritionDietPrescription::query()->findOrFail($prescription->id);

        return response()->json([
            'success' => true,
            'message' => 'مورد خارج از رژیم حذف شد.',
            'data' => [
                'prescription' => $this->serializePrescription($fresh),
            ],
        ]);
    }

    public function storeExerciseLog(Request $request): JsonResponse
    {
        $user = $this->user();
        abort_unless($user, 401);
        abort_if(! Schema::hasTable('exercise_logs'), 503, 'قابلیت ثبت ورزش هنوز برای این tenant فعال نشده است. لطفاً migration مربوطه را اجرا کنید.');

        $validated = $request->validate([
            'consumed_date' => ['required', 'date'],
            'exercise_ref' => ['required', 'string'],
            'duration_minutes' => ['required', 'integer', 'min:1', 'max:1440'],
            'intensity' => ['required', 'in:light,moderate,vigorous'],
            'distance_km' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'speed_kmh' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'weight_kg' => ['required', 'numeric', 'min:20', 'max:400'],
            'notes' => ['nullable', 'string'],
        ]);

        $exercisePayload = $this->exerciseLibrary->findCatalogExercise((string) $validated['exercise_ref']);
        abort_unless($exercisePayload, 422, 'این فعالیت ورزشی در حال حاضر فعال نیست.');

        $exerciseReference = $this->exerciseLibrary->parseReference((string) $validated['exercise_ref']);
        abort_unless($exerciseReference, 422, 'ورزش انتخاب‌شده معتبر نیست.');

        $exercise = $exerciseReference['source'] === 'tenant'
            ? $this->exerciseLibrary->findTenantExercise((int) $exerciseReference['id'])
            : $this->exerciseLibrary->findCentralExercise((int) $exerciseReference['id']);
        abort_unless($exercise, 404, 'فعالیت ورزشی پیدا نشد.');

        $supportsTenantExerciseColumn = Schema::hasColumn('exercise_logs', 'tenant_nutrition_exercise_id');
        if ($exerciseReference['source'] === 'tenant' && ! $supportsTenantExerciseColumn) {
            abort(503, 'برای ثبت ورزش‌های اختصاصی این سایت، migration جدید ورزش را روی tenant اجرا کنید.');
        }

        /** @var NutritionDietPrescription $prescription */
        $prescription = NutritionDietPrescription::query()
            ->where('user_id', $user->id)
            ->where('is_current', true)
            ->whereNotNull('published_at')
            ->latest('id')
            ->firstOrFail();

        $this->ensureDailyPrescriptionCurrentDay($prescription, (string) $validated['consumed_date']);

        $caloriesBurned = $this->exerciseCalories->estimate(
            $exercise,
            (float) $validated['weight_kg'],
            (int) $validated['duration_minutes'],
            (string) $validated['intensity'],
            isset($validated['distance_km']) ? (float) $validated['distance_km'] : null,
            isset($validated['speed_kmh']) ? (float) $validated['speed_kmh'] : null,
        );

        $insertPayload = [
            'user_id' => $user->id,
            'nutrition_diet_prescription_id' => $prescription->id,
            'nutrition_exercise_id' => $exerciseReference['source'] === 'central' ? (int) $exerciseReference['id'] : null,
            'logged_by_user_id' => $user->id,
            'consumed_date' => $validated['consumed_date'],
            'consumed_at' => now(),
            'exercise_title' => $exercisePayload['title'] ?? $exercise->title,
            'exercise_group_title' => $exercisePayload['groupTitle'] ?? null,
            'exercise_icon_key' => $exercisePayload['iconKey'] ?? $exercise->icon_key,
            'intensity' => (string) $validated['intensity'],
            'duration_minutes' => (int) $validated['duration_minutes'],
            'distance_km' => isset($validated['distance_km']) ? (float) $validated['distance_km'] : null,
            'speed_kmh' => isset($validated['speed_kmh']) ? (float) $validated['speed_kmh'] : null,
            'weight_kg' => (float) $validated['weight_kg'],
            'calories_burned' => $caloriesBurned,
            'notes' => $this->nullableTrim($validated['notes'] ?? null),
            'created_at' => now(),
            'updated_at' => now(),
        ];

        if ($supportsTenantExerciseColumn) {
            $insertPayload['tenant_nutrition_exercise_id'] = $exerciseReference['source'] === 'tenant'
                ? (int) $exerciseReference['id']
                : null;
        }

        DB::table('exercise_logs')->insert($insertPayload);

        $fresh = NutritionDietPrescription::query()->findOrFail($prescription->id);

        return response()->json([
            'success' => true,
            'message' => 'فعالیت ورزشی ثبت شد.',
            'data' => [
                'prescription' => $this->serializePrescription($fresh),
            ],
        ]);
    }

    public function deleteExerciseLog(Request $request, int $exerciseLogId): JsonResponse
    {
        $user = $this->user();
        abort_unless($user, 401);
        abort_if(! Schema::hasTable('exercise_logs'), 503, 'قابلیت ثبت ورزش هنوز برای این tenant فعال نشده است. لطفاً migration مربوطه را اجرا کنید.');

        /** @var NutritionDietPrescription $prescription */
        $prescription = NutritionDietPrescription::query()
            ->where('user_id', $user->id)
            ->where('is_current', true)
            ->whereNotNull('published_at')
            ->latest('id')
            ->firstOrFail();

        $log = DB::table('exercise_logs')
            ->where('id', $exerciseLogId)
            ->where('user_id', $user->id)
            ->first(['id', 'consumed_date', 'nutrition_diet_prescription_id']);

        abort_unless($log, 404, 'ثبت ورزش پیدا نشد.');

        if ((int) ($log->nutrition_diet_prescription_id ?? 0) === (int) $prescription->id) {
            $this->ensureDailyPrescriptionCurrentDay($prescription, (string) $log->consumed_date);
        }

        DB::table('exercise_logs')
            ->where('id', $exerciseLogId)
            ->where('user_id', $user->id)
            ->delete();

        $fresh = NutritionDietPrescription::query()->findOrFail($prescription->id);

        return response()->json([
            'success' => true,
            'message' => 'ثبت ورزش حذف شد.',
            'data' => [
                'prescription' => $this->serializePrescription($fresh),
            ],
        ]);
    }

    public function storeWaterLog(Request $request): JsonResponse
    {
        $user = $this->user();
        abort_unless($user, 401);

        $validated = $request->validate([
            'consumed_date' => ['required', 'date'],
            'glasses' => ['required', 'integer', 'min:0', 'max:30'],
            'amount_ml' => ['nullable', 'integer', 'min:0', 'max:10000'],
        ]);

        /** @var NutritionDietPrescription $prescription */
        $prescription = NutritionDietPrescription::query()
            ->where('user_id', $user->id)
            ->where('is_current', true)
            ->whereNotNull('published_at')
            ->latest('id')
            ->firstOrFail();

        $amountMl = (int) ($validated['amount_ml'] ?? ($validated['glasses'] * 250));

        DB::transaction(function () use ($amountMl, $prescription, $user, $validated): void {
            DB::table('nutrition_water_logs')
                ->where('user_id', $user->id)
                ->where('nutrition_diet_prescription_id', $prescription->id)
                ->whereDate('consumed_date', $validated['consumed_date'])
                ->delete();

            if ((int) $validated['glasses'] > 0 || $amountMl > 0) {
                DB::table('nutrition_water_logs')->insert([
                    'user_id' => $user->id,
                    'nutrition_diet_prescription_id' => $prescription->id,
                    'logged_by_user_id' => $user->id,
                    'consumed_date' => $validated['consumed_date'],
                    'consumed_at' => now(),
                    'amount_ml' => $amountMl,
                    'notes' => 'glasses:' . (int) $validated['glasses'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });

        $fresh = NutritionDietPrescription::query()->findOrFail($prescription->id);

        return response()->json([
            'success' => true,
            'message' => 'وضعیت آب روزانه ذخیره شد.',
            'data' => [
                'prescription' => $this->serializePrescription($fresh),
            ],
        ]);
    }

    public function generateMealReplacementSuggestions(Request $request): JsonResponse
    {
        $user = $this->user();
        abort_unless($user, 401);
        abort_if(! Schema::hasTable('nutrition_meal_replacement_suggestions'), 503, 'قابلیت جایگزینی غذا هنوز برای این دیتابیس فعال نشده است. لطفاً migration مربوطه را اجرا کنید.');

        $validated = $request->validate([
            'source_type' => ['required', 'in:meal_slot,daily_meal'],
            'meal_slot_key' => ['required', 'string', 'max:64'],
            'slot_title' => ['nullable', 'string', 'max:255'],
            'day_number' => ['nullable', 'integer', 'min:1', 'max:365'],
            'meal_index' => ['nullable', 'integer', 'min:0', 'max:100'],
        ]);

        /** @var NutritionDietPrescription $prescription */
        $prescription = NutritionDietPrescription::query()
            ->where('user_id', $user->id)
            ->where('is_current', true)
            ->whereNotNull('published_at')
            ->latest('id')
            ->firstOrFail();

        abort_if(! $prescription->allow_food_replacement, 422, 'برای این نسخه امکان جایگزینی غذا فعال نیست.');

        $suggestion = $this->mealReplacementGeneration->queue($prescription, $user, $validated);
        $fresh = NutritionDietPrescription::query()->findOrFail($prescription->id);

        return response()->json([
            'success' => true,
            'message' => in_array($suggestion->status, ['generated'], true)
                ? 'لیست غذاهای جایگزین این وعده از قبل آماده و ذخیره شده بود.'
                : 'در حال ساخت لیست غذاهای جایگزین این وعده با AI هستیم.',
            'data' => [
                'suggestion' => $this->serializeMealReplacementSuggestion($suggestion),
                'prescription' => $this->serializePrescription($fresh),
            ],
        ]);
    }

    public function cancelMealReplacementSuggestions(Request $request, NutritionMealReplacementSuggestion $mealSuggestion): JsonResponse
    {
        $user = $this->user();
        abort_unless($user, 401);
        abort_if(! Schema::hasTable('nutrition_meal_replacement_suggestions'), 503, 'قابلیت جایگزینی غذا هنوز برای این دیتابیس فعال نشده است. لطفاً migration مربوطه را اجرا کنید.');
        abort_unless((int) $mealSuggestion->user_id === (int) $user->id, 403);

        /** @var NutritionDietPrescription $prescription */
        $prescription = NutritionDietPrescription::query()
            ->where('user_id', $user->id)
            ->where('is_current', true)
            ->whereNotNull('published_at')
            ->latest('id')
            ->firstOrFail();

        abort_unless((int) $mealSuggestion->nutrition_diet_prescription_id === (int) $prescription->id, 403);

        $suggestion = $this->mealReplacementGeneration->cancel($mealSuggestion);
        $fresh = NutritionDietPrescription::query()->findOrFail($prescription->id);

        return response()->json([
            'success' => true,
            'message' => 'درخواست ساخت لیست جایگزین‌های این وعده لغو شد.',
            'data' => [
                'suggestion' => $this->serializeMealReplacementSuggestion($suggestion),
                'prescription' => $this->serializePrescription($fresh),
            ],
        ]);
    }

    private function serializePrescription(NutritionDietPrescription $item, ?string $activeDate = null): array
    {
        $effectiveExpired = $item->ends_at ? $item->ends_at->toDateString() < Carbon::today('Asia/Tehran')->toDateString() : false;
        $effectiveCurrent = (bool) $item->is_current && ! $effectiveExpired;
        $contentSnapshot = $this->normalizeContentSnapshot($item);
        $activeDate ??= $this->currentNutritionDate();
        $replacementSuggestions = Schema::hasTable('nutrition_meal_replacement_suggestions')
            ? NutritionMealReplacementSuggestion::query()
                ->where('nutrition_diet_prescription_id', $item->id)
                ->orderByDesc('requested_at')
                ->orderByDesc('id')
                ->get()
                ->map(fn (NutritionMealReplacementSuggestion $suggestion): array => $this->serializeMealReplacementSuggestion($suggestion))
                ->values()
                ->all()
            : [];
        $mealLogs = DB::table('nutrition_meal_logs')
            ->where('nutrition_diet_prescription_id', $item->id)
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
                'photoUrl' => property_exists($log, 'photo_path') && ! empty($log->photo_path) ? $this->tenantMediaUrl((string) $log->photo_path) : null,
            ])
            ->values()
            ->all();

        $waterLogs = DB::table('nutrition_water_logs')
            ->where('nutrition_diet_prescription_id', $item->id)
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
        $exerciseLogs = [];

        if (Schema::hasTable('exercise_logs')) {
            $exerciseLogsQuery = DB::table('exercise_logs')
                ->where('user_id', $item->user_id)
                ->orderBy('consumed_date')
                ->orderBy('id');

            if ($item->started_at && $item->ends_at) {
                $exerciseLogsQuery->whereBetween('consumed_date', [
                    $item->started_at->toDateString(),
                    $item->ends_at->toDateString(),
                ]);
            }

            if ($effectiveCurrent) {
                $exerciseLogsQuery->where(function ($query) use ($item): void {
                    $query->where('nutrition_diet_prescription_id', $item->id)
                        ->orWhereNull('nutrition_diet_prescription_id');
                });
            } else {
                $exerciseLogsQuery->where('nutrition_diet_prescription_id', $item->id);
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
            'id' => (string) $item->id,
            'requestId' => $item->nutrition_diet_request_id ? (string) $item->nutrition_diet_request_id : null,
            'nutritionDietTemplateId' => $item->nutrition_diet_template_id ? (string) $item->nutrition_diet_template_id : null,
            'dietName' => $item->request?->diet_template_name,
            'deliveryChannel' => $item->delivery_channel,
            'prescriptionMode' => $item->prescription_mode,
            'status' => $item->status,
            'statusLabel' => $this->prescriptionStatusLabel((string) $item->status),
            'expired' => $effectiveExpired,
            'usageStatus' => $effectiveExpired ? 'finished' : 'in_use',
            'usageStatusLabel' => $effectiveExpired ? 'تمام شده' : 'در حال استفاده',
            'allowFoodReplacement' => (bool) $item->allow_food_replacement,
            'suggestDailyReplacements' => (bool) $item->suggest_daily_replacements,
            'exerciseLoggingEnabled' => $this->settings->exerciseLoggingEnabled(),
            'outOfPlanMealLoggingEnabled' => $this->settings->outOfPlanMealLoggingEnabled(),
            'mealPhotoAnalysisEnabled' => $this->settings->mealPhotoAnalysisEnabled(),
            'currentWeightKg' => $item->current_weight_kg !== null ? (float) $item->current_weight_kg : null,
            'targetWeightKg' => $item->target_weight_kg !== null ? (float) $item->target_weight_kg : null,
            'weeklyWeightChangeKg' => $item->weekly_weight_change_kg !== null ? (float) $item->weekly_weight_change_kg : null,
            'startedAt' => $item->started_at?->toDateString(),
            'endsAt' => $item->ends_at?->toDateString(),
            'version' => (int) $item->version,
            'isCurrent' => $effectiveCurrent,
            'currentStatus' => $effectiveCurrent ? 'active' : 'inactive',
            'currentStatusLabel' => $effectiveCurrent ? 'فعال' : 'غیر فعال',
            'summaryText' => $item->summary_text,
            'notes' => $item->notes,
            'durationDays' => $item->started_at && $item->ends_at ? max(1, $item->ends_at->diffInDays($item->started_at) + 1) : null,
            'contentSnapshot' => $contentSnapshot,
            'expertFile' => $this->extractExpertFilePayload($contentSnapshot),
            'dailyMacroSummary' => $this->dailyMacroSummary($item, $contentSnapshot, $mealLogs, $activeDate),
            'mealReplacementSuggestions' => $replacementSuggestions,
            'mealLogs' => $mealLogs,
            'waterLogs' => $waterLogs,
            'exerciseLogs' => $exerciseLogs,
            'publishedAt' => $item->published_at?->toIso8601String(),
        ];
    }

    private function listAction(TenantUser $user, int $historyCount): array
    {
        $profile = NutritionProfile::query()
            ->where('user_id', $user->id)
            ->first();
        $activeRequest = NutritionDietRequest::query()
            ->where('user_id', $user->id)
            ->whereIn('status', ['sent', 'in_progress', 'not_sent'])
            ->whereDoesntHave('prescriptions', function ($query): void {
                $query->whereNotNull('published_at');
            })
            ->latest('id')
            ->first();
        $currentPrescription = NutritionDietPrescription::query()
            ->where('user_id', $user->id)
            ->where('is_current', true)
            ->whereNotNull('published_at')
            ->where(function ($query): void {
                $query->whereNull('ends_at')
                    ->orWhereDate('ends_at', '>=', Carbon::today('Asia/Tehran')->toDateString());
            })
            ->latest('id')
            ->first();

        if ($currentPrescription !== null) {
            return [
                'type' => 'view_current_diet',
                'title' => 'مشاهده رژیم فعلی',
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

        $hasSubscription = $this->hasUsableSubscription($user);

        return [
            'type' => $hasSubscription ? ($historyCount > 0 ? 'get_repeat_diet' : 'get_first_diet') : 'needs_package',
            'title' => $hasSubscription ? 'دریافت رژیم' : 'خرید بسته و دریافت رژیم',
            'href' => $this->dietStartHref($profile, $hasSubscription, $historyCount),
            'disabled' => false,
        ];
    }

    private function hasUsableSubscription(TenantUser $user): bool
    {
        $subscription = NutritionPackageSubscription::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->where(function ($query): void {
                $query->whereNull('starts_at')
                    ->orWhereDate('starts_at', '<=', Carbon::today('Asia/Tehran')->toDateString());
            })
            ->where(function ($query): void {
                $query->whereNull('ends_at')
                    ->orWhereDate('ends_at', '>=', Carbon::today('Asia/Tehran')->toDateString());
            })
            ->latest('id')
            ->first();

        if (! $subscription) {
            return false;
        }

        $onlineRemaining = max(0, (int) $subscription->online_diet_total - (int) $subscription->online_diet_used);
        $offlineRemaining = max(0, (int) $subscription->offline_diet_total - (int) $subscription->offline_diet_used);

        return $onlineRemaining > 0 || $offlineRemaining > 0;
    }

    private function dietStartHref(?NutritionProfile $profile, bool $hasSubscription, int $historyCount): string
    {
        if ($profile === null || ! $this->profileCompleted($profile)) {
            return '/nutrition/membership/profile';
        }

        if (! $hasSubscription) {
            return '/nutrition/membership/packages?direct_buy=1';
        }

        if ($historyCount > 0) {
            return '/nutrition/diet-followup/1';
        }

        if ($profile->mindset_completed_at === null) {
            return '/nutrition/membership/mindset/1';
        }

        return '/nutrition/diet-type';
    }

    private function profileCompleted(NutritionProfile $profile): bool
    {
        return $profile->onboarding_completed_at !== null
            || (
                $profile->birth_date !== null
                && $profile->height_cm !== null
                && $profile->weight_kg !== null
                && $profile->target_weight_kg !== null
                && $profile->preferences_completed_at !== null
            );
    }

    private function prescriptionStatusLabel(string $status): string
    {
        return match ($status) {
            'active' => 'فعال',
            'completed' => 'تکمیل شده',
            'cancelled' => 'لغو شده',
            default => $status,
        };
    }

    private function serializeMealReplacementSuggestion(NutritionMealReplacementSuggestion $suggestion): array
    {
        return [
            'id' => (string) $suggestion->id,
            'sourceType' => $suggestion->source_type,
            'sourceSignature' => $suggestion->source_signature,
            'mealSlotKey' => $suggestion->meal_slot_key,
            'slotTitle' => $suggestion->slot_title,
            'dayNumber' => $suggestion->day_number !== null ? (int) $suggestion->day_number : null,
            'mealIndex' => $suggestion->meal_index !== null ? (int) $suggestion->meal_index : null,
            'cacheScope' => is_array($suggestion->context_snapshot) ? ($suggestion->context_snapshot['cache_scope'] ?? null) : null,
            'cacheScopeLabel' => is_array($suggestion->context_snapshot) ? ($suggestion->context_snapshot['cache_scope_label'] ?? null) : null,
            'suggestionCount' => (int) $suggestion->suggestion_count,
            'status' => $suggestion->status,
            'errorMessage' => $suggestion->error_message,
            'requestedAt' => $suggestion->requested_at?->toIso8601String(),
            'generatedAt' => $suggestion->generated_at?->toIso8601String(),
            'cancelledAt' => $suggestion->cancelled_at?->toIso8601String(),
            'promptMode' => is_array($suggestion->context_snapshot) ? ((is_array($suggestion->context_snapshot['prompt_preferences'] ?? null) ? ($suggestion->context_snapshot['prompt_preferences']['mode'] ?? 'tenant') : 'tenant')) : 'tenant',
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
     * @return array<string, mixed>
     */
    private function normalizeContentSnapshot(NutritionDietPrescription $item): array
    {
        $content = is_array($item->content_snapshot) ? $item->content_snapshot : [];
        $profile = is_array($item->profile_snapshot) ? $item->profile_snapshot : [];
        $template = is_array($item->template_snapshot) ? $item->template_snapshot : [];
        $content = $this->filterDisabledTemplateMealSlots($item, $content);

        if (! is_array($content['water_plan'] ?? null)) {
            $weightKg = isset($profile['weightKg']) ? (float) $profile['weightKg'] : 0.0;
            $dailyTargetMl = max(1800, (int) round(($weightKg > 0 ? $weightKg : 60) * 35));
            $content['water_plan'] = [
                'daily_target_ml' => $dailyTargetMl,
                'daily_target_glasses' => max(6, (int) round($dailyTargetMl / 250)),
                'summary_text' => 'مقدار آب روزانه این نسخه بر اساس وزن فعلی و شرایط ثبت‌شده شما تعیین شده است.',
                'timing_tips' => ['یک لیوان بعد از بیدار شدن', 'یک لیوان بین صبحانه و ناهار', 'یک لیوان بین ناهار و شام'],
            ];
        }

        if (! is_array($content['supplement_plan'] ?? null)) {
            $templateNotes = trim((string) ($template['supplementNotes'] ?? ''));
            $enabled = (bool) ($template['supplementsEnabled'] ?? false);
            $content['supplement_plan'] = [
                'enabled' => $enabled,
                'summary_text' => $enabled
                    ? ($templateNotes !== '' ? $templateNotes : 'در این نسخه مصرف مکمل هم در نظر گرفته شده است.')
                    : 'در این نسخه مکمل ضروری ثبت نشده است.',
                'items' => $enabled && $templateNotes !== ''
                    ? [[
                        'title' => 'مکمل پیشنهادی',
                        'usage' => $templateNotes,
                        'timing' => 'طبق دستور نسخه',
                        'notes' => 'قبل از مصرف با شرایط بدنی کاربر تطبیق داده شود.',
                    ]]
                    : [],
            ];
        }

        $content['audio_tracks'] = $this->resolveAudioTracks($item);
        unset($content['audio_guidance']);

        return $content;
    }

    /**
     * @param array<string, mixed> $content
     * @return array<string, mixed>
     */
    private function filterDisabledTemplateMealSlots(NutritionDietPrescription $prescription, array $content): array
    {
        $enabledSlotKeys = $this->enabledTemplateMealSlotKeys($prescription);

        if ($enabledSlotKeys === []) {
            return $content;
        }

        if (is_array($content['meal_slots'] ?? null)) {
            $content['meal_slots'] = collect($content['meal_slots'])
                ->filter(fn ($slot): bool => is_array($slot)
                    && in_array(trim((string) ($slot['slot_key'] ?? '')), $enabledSlotKeys, true))
                ->values()
                ->all();
        }

        if (is_array($content['day_plans'] ?? null)) {
            $content['day_plans'] = collect($content['day_plans'])
                ->filter(fn ($plan): bool => is_array($plan))
                ->map(function (array $plan) use ($enabledSlotKeys): array {
                    $plan['meals'] = collect(is_array($plan['meals'] ?? null) ? $plan['meals'] : [])
                        ->filter(fn ($meal): bool => is_array($meal)
                            && in_array(trim((string) ($meal['slot_key'] ?? '')), $enabledSlotKeys, true))
                        ->values()
                        ->all();

                    return $plan;
                })
                ->values()
                ->all();
        }

        return $content;
    }

    /**
     * @return list<string>
     */
    private function enabledTemplateMealSlotKeys(NutritionDietPrescription $prescription): array
    {
        $template = is_array($prescription->template_snapshot) ? $prescription->template_snapshot : [];
        $slots = is_array($template['mealSlots'] ?? null) ? $template['mealSlots'] : [];

        return collect($slots)
            ->filter(fn ($slot): bool => is_array($slot))
            ->filter(function (array $slot): bool {
                if (array_key_exists('enabled', $slot)) {
                    return (bool) $slot['enabled'];
                }

                return true;
            })
            ->map(fn (array $slot): string => trim((string) ($slot['key'] ?? $slot['slot_key'] ?? '')))
            ->filter(fn (string $slotKey): bool => $slotKey !== '')
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @param array<string, mixed> $content
     * @param array<int, array<string, mixed>> $mealLogs
     * @return array<string, mixed>
     */
    private function dailyMacroSummary(NutritionDietPrescription $prescription, array $content, array $mealLogs, string $activeDate): array
    {
        $consumed = $this->sumLoggedMacros($mealLogs, $activeDate);
        [$targets, $source] = $this->resolveDailyMacroTargets($prescription, $content, $activeDate);

        return [
            'date' => $activeDate,
            'source' => $source,
            'protein' => $this->macroProgress($targets['protein_grams'], $consumed['protein_grams']),
            'carbohydrate' => $this->macroProgress($targets['carbohydrate_grams'], $consumed['carbohydrate_grams']),
            'fat' => $this->macroProgress($targets['fat_grams'], $consumed['fat_grams']),
            'fiber' => $this->macroProgress($targets['fiber_grams'], $consumed['fiber_grams']),
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $mealLogs
     * @return array{protein_grams:float,fat_grams:float,carbohydrate_grams:float,fiber_grams:float}
     */
    private function sumLoggedMacros(array $mealLogs, string $activeDate): array
    {
        $totals = ['protein_grams' => 0.0, 'fat_grams' => 0.0, 'carbohydrate_grams' => 0.0, 'fiber_grams' => 0.0];

        foreach ($mealLogs as $log) {
            if (($log['consumedDate'] ?? null) !== $activeDate) {
                continue;
            }

            $totals['protein_grams'] += (float) ($log['proteinGrams'] ?? 0);
            $totals['fat_grams'] += (float) ($log['fatGrams'] ?? 0);
            $totals['carbohydrate_grams'] += (float) ($log['carbohydrateGrams'] ?? 0);
            $totals['fiber_grams'] += (float) ($log['fiberGrams'] ?? 0);
        }

        return array_map(fn (float $value): float => round($value, 1), $totals);
    }

    /**
     * @param array<string, mixed> $content
     * @return array{0:array{protein_grams:?float,fat_grams:?float,carbohydrate_grams:?float,fiber_grams:?float},1:string}
     */
    private function resolveDailyMacroTargets(NutritionDietPrescription $prescription, array $content, string $activeDate): array
    {
        $mode = (string) ($content['mode'] ?? $prescription->prescription_mode);

        if ($mode === 'daily_prescription') {
            $plan = $this->activeDayPlan($prescription, $content, $activeDate);

            if ($plan !== null) {
                $targets = $this->nullableMacroTargets($plan['macro_targets'] ?? null);

                if ($this->hasMacroTargets($targets)) {
                    return [$targets, 'ai_target'];
                }

                $fallback = $this->sumPlannedMealMacros(is_array($plan['meals'] ?? null) ? $plan['meals'] : []);

                if ($this->hasMacroTargets($fallback)) {
                    return [$fallback, 'day_plan_sum'];
                }
            }
        }

        $targets = $this->nullableMacroTargets($content['macro_targets'] ?? null);

        if ($this->hasMacroTargets($targets)) {
            return [$targets, $mode === 'user_choice' ? 'ai_target' : 'content_target'];
        }

        if ($mode === 'user_choice') {
            $estimated = $this->estimateUserChoiceMacroTargets(is_array($content['meal_slots'] ?? null) ? $content['meal_slots'] : []);

            if ($this->hasMacroTargets($estimated)) {
                return [$estimated, 'estimated'];
            }
        }

        return [$this->emptyMacroTargets(), 'unavailable'];
    }

    /**
     * @param array<string, mixed> $content
     * @return array<string, mixed>|null
     */
    private function activeDayPlan(NutritionDietPrescription $prescription, array $content, string $activeDate): ?array
    {
        $plans = collect(is_array($content['day_plans'] ?? null) ? $content['day_plans'] : [])
            ->filter(fn ($plan): bool => is_array($plan))
            ->values();

        if ($plans->isEmpty()) {
            return null;
        }

        if ($prescription->started_at) {
            $dayNumber = $prescription->started_at->copy()->startOfDay()->diffInDays(Carbon::parse($activeDate)->startOfDay(), false) + 1;

            if ($dayNumber >= 1) {
                $matched = $plans->first(fn (array $plan): bool => (int) ($plan['day_number'] ?? 0) === $dayNumber);

                if (is_array($matched)) {
                    return $matched;
                }
            }
        }

        return $plans->first();
    }

    /**
     * @return array{protein_grams:?float,fat_grams:?float,carbohydrate_grams:?float,fiber_grams:?float}
     */
    private function nullableMacroTargets(mixed $value): array
    {
        if (! is_array($value)) {
            return $this->emptyMacroTargets();
        }

        return [
            'protein_grams' => $this->nullableMacroValue($value['protein_grams'] ?? null),
            'fat_grams' => $this->nullableMacroValue($value['fat_grams'] ?? null),
            'carbohydrate_grams' => $this->nullableMacroValue($value['carbohydrate_grams'] ?? null),
            'fiber_grams' => $this->nullableMacroValue($value['fiber_grams'] ?? null),
        ];
    }

    private function nullableMacroValue(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return round(max(0, (float) $value), 1);
    }

    /**
     * @return array{protein_grams:?float,fat_grams:?float,carbohydrate_grams:?float,fiber_grams:?float}
     */
    private function emptyMacroTargets(): array
    {
        return ['protein_grams' => null, 'fat_grams' => null, 'carbohydrate_grams' => null, 'fiber_grams' => null];
    }

    /**
     * @param array{protein_grams:?float,fat_grams:?float,carbohydrate_grams:?float,fiber_grams:?float} $targets
     */
    private function hasMacroTargets(array $targets): bool
    {
        foreach ($targets as $value) {
            if ($value !== null && $value > 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param array<int, mixed> $meals
     * @return array{protein_grams:?float,fat_grams:?float,carbohydrate_grams:?float,fiber_grams:?float}
     */
    private function sumPlannedMealMacros(array $meals): array
    {
        $totals = ['protein_grams' => 0.0, 'fat_grams' => 0.0, 'carbohydrate_grams' => 0.0, 'fiber_grams' => 0.0];

        foreach ($meals as $meal) {
            if (! is_array($meal)) {
                continue;
            }

            foreach (array_keys($totals) as $key) {
                $totals[$key] += max(0, (float) ($meal[$key] ?? 0));
            }
        }

        return array_map(fn (float $value): float => round($value, 1), $totals);
    }

    /**
     * @param array<int, mixed> $slots
     * @return array{protein_grams:?float,fat_grams:?float,carbohydrate_grams:?float,fiber_grams:?float}
     */
    private function estimateUserChoiceMacroTargets(array $slots): array
    {
        $totals = ['protein_grams' => 0.0, 'fat_grams' => 0.0, 'carbohydrate_grams' => 0.0, 'fiber_grams' => 0.0];

        foreach ($slots as $slot) {
            if (! is_array($slot)) {
                continue;
            }

            $options = collect(is_array($slot['options'] ?? null) ? $slot['options'] : [])
                ->filter(fn ($option): bool => is_array($option))
                ->values();

            if ($options->isEmpty()) {
                continue;
            }

            foreach (array_keys($totals) as $key) {
                $totals[$key] += (float) $options->avg(fn (array $option): float => max(0, (float) ($option[$key] ?? 0)));
            }
        }

        return array_map(fn (float $value): float => round($value, 1), $totals);
    }

    private function macroProgress(?float $targetGrams, float $consumedGrams): array
    {
        $target = $targetGrams !== null ? round(max(0, $targetGrams), 1) : null;
        $consumed = round(max(0, $consumedGrams), 1);

        return [
            'targetGrams' => $target,
            'consumedGrams' => $consumed,
            'remainingGrams' => $target !== null ? round(max(0, $target - $consumed), 1) : null,
            'overGrams' => $target !== null ? round(max(0, $consumed - $target), 1) : null,
            'percent' => $target !== null && $target > 0 ? (int) round(($consumed / $target) * 100) : null,
        ];
    }

    /**
     * @param  array<string, mixed>  $content
     * @return array<string, mixed>|null
     */
    private function extractExpertFilePayload(array $content): ?array
    {
        $file = is_array($content['expert_file'] ?? null) ? $content['expert_file'] : null;

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
     * @return array<int, array<string, mixed>>
     */
    private function resolveAudioTracks(NutritionDietPrescription $item): array
    {
        if (! Schema::hasTable('nutrition_audio_guidance_assets')) {
            return [];
        }

        $rows = DB::table('nutrition_audio_guidance_assets')
            ->where('is_active', true)
            ->where(function ($query) use ($item): void {
                $query->whereNull('nutrition_diet_template_id');

                if ($item->nutrition_diet_template_id) {
                    $query->orWhere('nutrition_diet_template_id', $item->nutrition_diet_template_id);
                }
            })
            ->where(function ($query) use ($item): void {
                $query->whereNull('session_number')
                    ->orWhere('session_number', (int) $item->version);
            })
            ->orderByRaw('CASE WHEN nutrition_diet_template_id IS NULL THEN 1 ELSE 0 END')
            ->orderByRaw('CASE WHEN session_number IS NULL THEN 1 ELSE 0 END')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return $rows->map(fn (object $row): array => [
            'id' => (string) $row->id,
            'title' => (string) $row->title,
            'description' => $row->description,
            'fileUrl' => Storage::disk('public')->url((string) $row->file_path),
            'sessionNumber' => $row->session_number !== null ? (int) $row->session_number : null,
        ])->values()->all();
    }

    private function mealLogNotes(array $validated): ?string
    {
        $parts = [];

        if (! empty($validated['slot_title'])) {
            $parts[] = 'slot:' . $validated['slot_title'];
        }

        if (isset($validated['option_calories'])) {
            $parts[] = 'calories:' . (int) $validated['option_calories'];
        }

        foreach (['protein_grams', 'fat_grams', 'carbohydrate_grams', 'fiber_grams'] as $macroKey) {
            if (isset($validated[$macroKey])) {
                $parts[] = $macroKey . ':' . rtrim(rtrim(number_format((float) $validated[$macroKey], 1, '.', ''), '0'), '.');
            }
        }

        if (! empty($validated['notes'])) {
            $parts[] = 'note:' . trim((string) $validated['notes']);
        }

        return $parts === [] ? null : implode(' | ', $parts);
    }

    private function mealLogAiNutritionColumnsExist(): bool
    {
        if (! Schema::hasTable('nutrition_meal_logs')) {
            return false;
        }

        foreach ([
            'option_calories',
            'protein_grams',
            'fat_grams',
            'carbohydrate_grams',
            'fiber_grams',
            'ai_nutrition_status',
            'ai_nutrition_error',
            'ai_nutrition_prompt_snapshot',
            'ai_nutrition_response_snapshot',
        ] as $column) {
            if (! Schema::hasColumn('nutrition_meal_logs', $column)) {
                return false;
            }
        }

        return true;
    }

    private function manualMealEntryColumnsExist(): bool
    {
        return Schema::hasTable('nutrition_meal_logs')
            && Schema::hasColumn('nutrition_meal_logs', 'manual_entry_method')
            && Schema::hasColumn('nutrition_meal_logs', 'photo_path');
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

    private function nullableTrim(mixed $value): ?string
    {
        $trimmed = trim((string) $value);

        return $trimmed === '' ? null : $trimmed;
    }

    private function deletePhysicalFile(?string $path): void
    {
        $relativePath = trim((string) $path);

        if ($relativePath === '') {
            return;
        }

        $this->deleteTenantMediaFile($relativePath);
    }

    private function storeMealPhoto(UploadedFile $image, int $userId, string $consumedDate, string $slotKey): string
    {
        $safeDate = preg_replace('/[^0-9-]/', '', $consumedDate) ?: now()->toDateString();
        $safeSlot = preg_replace('/[^A-Za-z0-9_-]/', '', $slotKey) ?: 'meal';

        return $image->store(
            "nutrition/meal-photos/users/{$userId}/{$safeDate}/{$safeSlot}",
            'media_public',
        );
    }

    private function ensureDailyPrescriptionCurrentDay(NutritionDietPrescription $prescription, string $consumedDate): void
    {
        if ($prescription->prescription_mode !== 'daily_prescription') {
            return;
        }

        abort_if(
            $consumedDate !== $this->currentNutritionDate(),
            422,
            'در رژیم روزانه فقط می‌توانید وعده‌های روز جاری را ثبت یا حذف کنید.'
        );
    }

    private function currentNutritionDate(): string
    {
        return Carbon::now('Asia/Tehran')->toDateString();
    }

    private function activeDate(Request $request): string
    {
        $date = trim((string) $request->query('date', ''));

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) === 1) {
            try {
                return Carbon::createFromFormat('Y-m-d', $date, 'Asia/Tehran')->toDateString();
            } catch (\Throwable) {
                return $this->currentNutritionDate();
            }
        }

        return $this->currentNutritionDate();
    }

    private function user(): ?TenantUser
    {
        /** @var TenantUser|null $user */
        $user = request()->user();

        return $user instanceof TenantUser ? $user : null;
    }
}
