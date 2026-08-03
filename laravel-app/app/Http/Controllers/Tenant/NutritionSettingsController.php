<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Services\NutritionDietRequestSettingsService;
use App\Support\TenantAudienceScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NutritionSettingsController extends Controller
{
    public function __construct(
        private readonly NutritionDietRequestSettingsService $settings,
    ) {
    }

    public function show(Request $request): JsonResponse
    {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        abort_unless($this->canManageSettings($request), 403, __('authorization.nutrition_allowed_section'));

        return response()->json([
            'success' => true,
            'data' => $this->settings->payload(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        abort_unless($this->canManageSettings($request), 403, __('authorization.nutrition_allowed_section'));

        $validated = $request->validate([
            'manualAiApprovalRequired' => ['required', 'boolean'],
            'holdIncompletePrescriptionsForReview' => ['required', 'boolean'],
            'exerciseLoggingEnabled' => ['required', 'boolean'],
            'outOfPlanMealLoggingEnabled' => ['required', 'boolean'],
            'mealPhotoAnalysisEnabled' => ['required', 'boolean'],
            'mealPhotoAnalysisHourlyLimit' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'mealPhotoAnalysisDietLimit' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'manualMealNutritionHourlyLimit' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'manualMealNutritionDietLimit' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'mealReplacementHourlyLimit' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'mealReplacementDietLimit' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'autoFirstDietEnabled' => ['required', 'boolean'],
            'autoFirstDietTemplateId' => ['nullable', 'integer', 'exists:nutrition_diet_templates,id'],
            'autoFirstDietTemplateIds' => ['nullable', 'array'],
            'autoFirstDietTemplateIds.lose-weight' => ['nullable', 'integer', 'exists:nutrition_diet_templates,id'],
            'autoFirstDietTemplateIds.gain-weight' => ['nullable', 'integer', 'exists:nutrition_diet_templates,id'],
            'autoFirstDietTemplateIds.maintain-weight' => ['nullable', 'integer', 'exists:nutrition_diet_templates,id'],
            'autoFirstDietRequiresApproval' => ['required', 'boolean'],
            'dietGenerationPrompt' => ['nullable', 'string', 'max:20000'],
            'promptSettings' => ['nullable', 'array'],
            'promptSettings.general' => ['nullable', 'string', 'max:20000'],
            'promptSettings.user_choice' => ['nullable', 'string', 'max:12000'],
            'promptSettings.daily_prescription' => ['nullable', 'string', 'max:12000'],
            'promptSettings.fixed_text' => ['nullable', 'string', 'max:12000'],
            'promptSettings.meal_replacement' => ['nullable', 'string', 'max:12000'],
            'promptSettings.manual_meal_nutrition' => ['nullable', 'string', 'max:6000'],
            'promptSettings.meal_photo_analysis' => ['nullable', 'string', 'max:8000'],
            'promptSettings.diet_explanations' => ['nullable', 'string', 'max:12000'],
        ]);

        if (($validated['autoFirstDietEnabled'] ?? false) === true) {
            $templateIds = is_array($validated['autoFirstDietTemplateIds'] ?? null) ? $validated['autoFirstDietTemplateIds'] : [];
            foreach (['lose-weight', 'gain-weight', 'maintain-weight'] as $goal) {
                if (empty($templateIds[$goal])) {
                    return response()->json([
                        'success' => false,
                        'message' => 'برای فعال‌سازی رژیم اول خودکار، الگوی هر سه هدف کاهش وزن، افزایش وزن و تثبیت وزن را انتخاب کنید.',
                    ], 422);
                }
            }
        }

        return response()->json([
            'success' => true,
            'message' => __('tenant.settings.nutrition_saved'),
            'data' => $this->settings->update($validated),
        ]);
    }

    private function canManageSettings(Request $request): bool
    {
        $role = (string) ($request->user('tenant_web')?->role ?? '');

        return in_array($role, [
            'admin',
            'nutritionist',
            'nutrition_doctor',
            'nutrition-expert',
            'nutrition-doctor',
            'expert',
            'doctor',
        ], true);
    }
}
