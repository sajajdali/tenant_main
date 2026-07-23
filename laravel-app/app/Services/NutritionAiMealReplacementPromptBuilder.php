<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\NutritionMealReplacementSuggestion;
use App\Support\NutritionMedicalConditionSupport;
use App\Support\TenantLocale;

class NutritionAiMealReplacementPromptBuilder
{
    public function __construct(
        private readonly NutritionAiDietPromptCatalog $catalog,
    ) {
    }

    /**
     * @return array{messages: array<int, array<string, mixed>>, schema: array<string, mixed>, snapshot: array<string, mixed>}
     */
    public function build(NutritionMealReplacementSuggestion $suggestion, array $settings): array
    {
        $context = is_array($suggestion->context_snapshot) ? $suggestion->context_snapshot : [];
        $minItems = max(10, min(30, (int) ($context['min_items'] ?? 10)));
        $maxItems = max($minItems, min(30, (int) ($context['max_items'] ?? 30)));
        $promptPreferences = is_array($context['prompt_preferences'] ?? null) ? $context['prompt_preferences'] : [];
        $clinicalSafetyContext = $this->buildClinicalSafetyContext($context);
        $localeConfig = TenantLocale::configFor((string) app()->getLocale());

        $input = [
            'task' => 'generate_meal_replacement_suggestions',
            'language' => (string) ($localeConfig['date_locale'] ?? app()->getLocale()),
            'rtl' => (string) ($localeConfig['dir'] ?? 'rtl') === 'rtl',
            'replacementListRules' => [
                'minItems' => $minItems,
                'maxItems' => $maxItems,
                'countDecision' => 'تعداد نهایی را خودت بر اساس تعداد جایگزین‌های واقع‌بینانه و باکیفیت برای همین slot انتخاب کن. برای صبحانه، ناهار و شام معمولاً تعداد باید نزدیک سقف باشد. برای slot های سخت‌تر مثل میان‌وعده قبل خواب می‌توانی به حداقل نزدیک‌تر بمانی. هرگز از بازه تعیین‌شده خارج نشو.',
                'slotMatch' => 'هر آیتم باید دقیقاً با همین slot غذایی و همان محدودیت‌های درمانی وعده اصلی هماهنگ باشد.',
                'safety' => 'به آلرژی‌ها، بیماری‌های خاص، داروها و مکمل‌های فعلی، زمان مصرف آن‌ها، غذاهای نامطلوب، شاخص‌های بدنی، هدف وزنی، athlete mode، سطح فعالیت، یادداشت‌های کارشناس، یادداشت‌های نسخه فعلی، وضعیت مکمل‌ها و سبک دقیق وعده اصلی پایبند باش.',
                'quality' => 'گزینه‌های کلیشه‌ای و پرکننده برنگردان. هر پیشنهاد باید واقعی، متمایز و از نظر تغذیه‌ای با همین نسخه هم‌راستا باشد.',
                'duplicates' => 'از موارد تکراری، نزدیک به تکراری و تفاوت‌های صرفاً لفظی پرهیز کن.',
                'iranianFoodPriority' => 'در انتخاب جایگزین‌ها تا حد امکان از غذاها، ترکیب‌ها و مواد رایج سفره ایرانی استفاده کن؛ مگر اینکه محدودیت پزشکی، آلرژی، هدف درمانی، نسخه فعلی یا دستور کارشناس گزینه غیرایرانی را مناسب‌تر کند.',
                'preparationDetail' => 'برای هر پیشنهاد، preparation_text باید دقیق و اجرایی باشد. اگر پخت، سرخ کردن، تفت دادن، گریل، فر، آب‌پز یا بخارپز دارد، مقدار و نوع روغن یا بدون روغن بودن، روش پخت، زمان تقریبی، چاشنی‌ها، دورچین و فرم سرو را صریح بنویس. دستور مبهم مثل "مرغ را سرخ کنید" قابل قبول نیست.',
                'medicalSafety' => $clinicalSafetyContext['enabled']
                    ? 'clinicalSafetyContext را محدودیت فعال بدان. پیشنهادی نده که با بیماری‌های ثبت‌شده، داروها، مکمل‌های فعلی یا زمان مصرف آن‌ها ناسازگار باشد. اگر ابهام وجود داشت، گزینه‌های محافظه‌کارانه‌تر و کم‌ریسک‌تر را ترجیح بده.'
                    : 'اگرچه clinicalSafetyContext مورد برجسته‌ای ندارد، همچنان باید تمام محدودیت‌های نسخه اصلی و آلرژی‌ها را کامل رعایت کنی.',
                'conditionAwareReasons' => $clinicalSafetyContext['medicalConditions'] !== null
                    ? 'چون بیماری خاص برای این کاربر ثبت شده است، در match_reason هر پیشنهاد فقط از شباهت کالری یا وعده حرف نزن؛ خیلی کوتاه و حرفه‌ای بگو این گزینه از نظر شرایط بیماری کاربر هم چرا انتخاب مناسبی است، مثلاً از نظر ثبات انرژی، سبک‌بودن، محرک کمتر، هضم بهتر یا زمان‌بندی سازگار.'
                    : 'اگر بیماری خاصی ثبت نشده، match_reason را بر اساس هم‌خوانی با وعده، کالری و محدودیت‌های عمومی نسخه بنویس.',
            ],
            'clinicalSafetyContext' => $clinicalSafetyContext,
            'prescriptionContext' => $context,
        ];

        $editablePromptTexts = is_array($settings['diet_prompt_texts'] ?? null) ? $settings['diet_prompt_texts'] : [];
        $generalPromptText = trim((string) ($editablePromptTexts['general'] ?? $this->catalog->defaultEditablePrompt('general')));
        $defaultMealReplacementPromptText = trim((string) $this->catalog->defaultEditablePrompt('meal_replacement'));
        $tenantMealReplacementPromptText = trim((string) ($editablePromptTexts['meal_replacement'] ?? $defaultMealReplacementPromptText));
        $promptMode = (string) ($promptPreferences['mode'] ?? 'tenant');
        $customPromptText = trim((string) ($promptPreferences['custom_text'] ?? ''));

        $mealReplacementPromptText = match ($promptMode) {
            'default' => $defaultMealReplacementPromptText,
            'custom' => $customPromptText !== '' ? $customPromptText : $tenantMealReplacementPromptText,
            default => $tenantMealReplacementPromptText,
        };

        $parts = [];

        if ($generalPromptText !== '') {
            $parts[] = $generalPromptText;
        }

        if ($mealReplacementPromptText !== '') {
            $parts[] = $mealReplacementPromptText;
        }

        $parts[] = 'شما برای یک نسخه تغذیه فارسی که قبلاً صادر شده، غذاهای جایگزین تولید می‌کنید.';
        $parts[] = implode("\n", $this->catalog->immutableMealReplacementSystemLines());

        $systemPrompt = trim(implode("\n\n", array_filter($parts, fn ($value): bool => trim((string) $value) !== '')));

        return [
            'messages' => [
                [
                    'role' => 'system',
                    'content' => $systemPrompt,
                ],
                [
                    'role' => 'user',
                    'content' => json_encode($input, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                ],
            ],
            'schema' => $this->schema($minItems, $maxItems),
            'snapshot' => [
                'systemPrompt' => $systemPrompt,
                'promptLayers' => [
                    'general' => $generalPromptText,
                    'meal_replacement' => $mealReplacementPromptText,
                ],
                'promptPreferences' => [
                    'mode' => $promptMode,
                    'customText' => $promptMode === 'custom' ? $customPromptText : null,
                    'tenantMealReplacementPrompt' => $tenantMealReplacementPromptText,
                    'defaultMealReplacementPrompt' => $defaultMealReplacementPromptText,
                ],
                'input' => $input,
            ],
        ];
    }

    /**
     * @param array<string, mixed> $context
     * @return array<string, mixed>
     */
    private function buildClinicalSafetyContext(array $context): array
    {
        $profile = is_array($context['profile'] ?? null) ? $context['profile'] : [];
        $prescription = is_array($context['prescription'] ?? null) ? $context['prescription'] : [];
        $content = is_array($prescription['content'] ?? null) ? $prescription['content'] : [];
        $supplementPlan = is_array($content['supplement_plan'] ?? null) ? $content['supplement_plan'] : [];

        $medicalConditionItems = NutritionMedicalConditionSupport::normalizeEntries(
            is_array($profile['medicalConditionsItems'] ?? null)
                ? $profile['medicalConditionsItems']
                : NutritionMedicalConditionSupport::parseEntries($profile['medicalConditions'] ?? $profile['medical_conditions'] ?? null)
        );
        $medicalConditions = NutritionMedicalConditionSupport::summarizeEntries($medicalConditionItems);
        $medicationsAndSupplements = $this->compactText($profile['medicationsAndSupplements'] ?? $profile['medications_and_supplements'] ?? null);
        $foodAllergies = $this->compactText($profile['foodAllergies'] ?? $profile['food_allergies'] ?? null);
        $dislikedFoods = $this->compactText($profile['dislikedFoods'] ?? $profile['disliked_foods'] ?? null);
        $prescriptionNotes = $this->compactText($prescription['notes'] ?? null);
        $supplementSummary = $this->compactText($supplementPlan['summary_text'] ?? null);
        $hasMedicationTiming = $medicationsAndSupplements !== null
            && preg_match('/\d|صبح|ظهر|عصر|شب|قبل|بعد|ناشتا|هنگام/u', $medicationsAndSupplements) === 1;

        $summaryParts = [];

        if ($medicalConditions !== null) {
            $summaryParts[] = 'بیماری خاص: ' . $medicalConditions;
        }

        if ($medicationsAndSupplements !== null) {
            $summaryParts[] = 'دارو/مکمل فعلی: ' . $medicationsAndSupplements;
        }

        if ($foodAllergies !== null) {
            $summaryParts[] = 'حساسیت غذایی: ' . $foodAllergies;
        }

        if ($supplementSummary !== null) {
            $summaryParts[] = 'برنامه مکمل نسخه: ' . $supplementSummary;
        }

        if ($prescriptionNotes !== null) {
            $summaryParts[] = 'یادداشت نسخه: ' . $prescriptionNotes;
        }

        return [
            'enabled' => $medicalConditions !== null
                || $medicationsAndSupplements !== null
                || $foodAllergies !== null
                || $prescriptionNotes !== null
                || $supplementSummary !== null,
            'medicalConditions' => $medicalConditions,
            'medicalConditionsItems' => $medicalConditionItems,
            'medicationsAndSupplements' => $medicationsAndSupplements,
            'foodAllergies' => $foodAllergies,
            'dislikedFoods' => $dislikedFoods,
            'prescriptionNotes' => $prescriptionNotes,
            'supplementPlanSummary' => $supplementSummary,
            'hasMedicationTiming' => $hasMedicationTiming,
            'safetySummary' => $summaryParts !== []
                ? implode(' | ', $summaryParts)
                : 'محدودیت پزشکی یا دارویی برجسته‌ای برای جایگزین‌سازی ثبت نشده است.',
        ];
    }

    private function compactText(mixed $value): ?string
    {
        $text = preg_replace('/\s+/u', ' ', trim((string) $value)) ?: '';

        return $text !== '' ? $text : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function schema(int $minItems, int $maxItems): array
    {
        return [
            'type' => 'object',
            'additionalProperties' => false,
            'required' => ['slot_key', 'slot_title', 'count_reason', 'items'],
            'properties' => [
                'slot_key' => ['type' => 'string'],
                'slot_title' => ['type' => 'string'],
                'count_reason' => ['type' => 'string'],
                'items' => [
                    'type' => 'array',
                    'minItems' => $minItems,
                    'maxItems' => $maxItems,
                    'items' => [
                        'type' => 'object',
                        'additionalProperties' => false,
                        'required' => ['title', 'description', 'preparation_text', 'quantity_text', 'grams', 'calories', 'match_reason'],
                        'properties' => [
                            'title' => ['type' => 'string'],
                            'description' => ['type' => 'string'],
                            'preparation_text' => ['type' => 'string'],
                            'quantity_text' => ['type' => 'string'],
                            'grams' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 2000],
                            'calories' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 3000],
                            'match_reason' => ['type' => 'string'],
                        ],
                    ],
                ],
            ],
        ];
    }
}
