<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\NutritionDietPrescription;
use App\Domain\Tenant\Models\NutritionDietRequest;
use App\Support\TenantLocale;
use App\Support\NutritionMedicalConditionSupport;
use InvalidArgumentException;

class NutritionAiDietPromptBuilder
{
    public function __construct(
        private readonly NutritionAiDietPromptCatalog $catalog,
    ) {
    }

    /**
     * @return array{messages: array<int, array<string, mixed>>, schema: array<string, mixed>, snapshot: array<string, mixed>}
     */
    public function build(NutritionDietRequest $request, array $settings): array
    {
        $requestMode = (string) ($request->prescription_mode ?? 'daily_prescription');
        $profile = is_array($request->profile_snapshot) ? $request->profile_snapshot : [];
        $template = is_array($request->template_snapshot) ? $request->template_snapshot : [];
        $requestPayload = is_array($request->request_payload_snapshot) ? $request->request_payload_snapshot : [];
        $userChoiceMealSlotRequirements = $requestMode === 'user_choice'
            ? $this->userChoiceMealSlotRequirements($template)
            : [];
        $showDietExplanations = (bool) ($template['showDietExplanations'] ?? false);
        $dietExplanationPrompt = trim((string) ($template['dietExplanationPrompt'] ?? ''));
        $currentPrescription = NutritionDietPrescription::query()
            ->where('nutrition_diet_request_id', $request->id)
            ->where('is_current', true)
            ->latest('id')
            ->first();
        $previousDietVariety = $this->previousDietVarietyContext($request);
        $clinicalSafetyContext = $this->buildClinicalSafetyContext($profile, $requestPayload, [
            'mustAvoid' => $request->must_avoid,
            'clinicalNotes' => $request->clinical_notes,
            'expertNotes' => $request->expert_notes,
        ]);
        $revisionRequestedChangeText = $this->compactText(implode(' | ', array_filter([
            $request->expert_notes,
            $request->clinical_notes,
            $request->generation_instructions,
            $request->must_include,
            $request->must_avoid,
        ], fn (mixed $value): bool => $this->compactText($value) !== null)));
        $revisionTargetingText = $this->compactText(implode(' | ', array_filter([
            $request->expert_notes,
            $request->generation_instructions,
            $request->must_include,
            $request->must_avoid,
        ], fn (mixed $value): bool => $this->compactText($value) !== null)));
        $revisionTargeting = $currentPrescription
            ? $this->buildRevisionTargetingContext($revisionRequestedChangeText, $requestMode, $revisionTargetingText)
            : null;
        $localeConfig = TenantLocale::configFor((string) app()->getLocale());

        $input = [
            'dietRequestId' => $request->id,
            'requestType' => $request->request_type,
            'prescriptionMode' => $requestMode,
            'allowFoodReplacement' => (bool) $request->allow_food_replacement,
            'suggestDailyReplacements' => (bool) $request->suggest_daily_replacements,
            'showDietExplanations' => $showDietExplanations,
            'timeline' => [
                'startedAt' => $request->started_at?->toDateString(),
                'endsAt' => $request->ends_at?->toDateString(),
                'durationDays' => (int) (($template['durationDays'] ?? null) ?: max(1, optional($request->ends_at)->diffInDays($request->started_at) + 1)),
            ],
            'profile' => $profile,
            'clinicalSafetyContext' => $clinicalSafetyContext,
            'template' => $template,
            'userChoiceMealSlotRequirements' => $userChoiceMealSlotRequirements,
            'fixedTextInstructions' => $requestMode === 'fixed_text' ? [
                'templateDescription' => trim((string) ($template['description'] ?? '')),
                'templateNotes' => trim((string) ($template['templateNotes'] ?? '')),
                'conditionsText' => trim((string) ($template['conditionsText'] ?? '')),
                'rule' => 'فقط برای mode برابر fixed_text: این متن‌ها را به بخش‌های text_sections تبدیل کن. هیچ وعده، غذا، کالری، گرم، برنامه روزانه، آب یا مکمل ساختاریافته تولید نکن.',
            ] : null,
            'followUpAssessment' => $requestPayload['repeatDietFeedback'] ?? ($profile['repeatDietFeedback'] ?? null),
            'expertInstructions' => [
                'expertNotes' => $request->expert_notes,
                'clinicalNotes' => $request->clinical_notes,
                'generationInstructions' => $request->generation_instructions,
                'mustInclude' => $request->must_include,
                'mustAvoid' => $request->must_avoid,
            ],
            'dietExplanationInstructions' => [
                'enabled' => $showDietExplanations,
                'templatePrompt' => $dietExplanationPrompt,
            ],
            'previousDietVariety' => $previousDietVariety,
            'existingPrescription' => $currentPrescription ? [
                'id' => $currentPrescription->id,
                'version' => (int) $currentPrescription->version,
                'summaryText' => $currentPrescription->summary_text,
                'notes' => $currentPrescription->notes,
                'content' => is_array($currentPrescription->content_snapshot) ? $currentPrescription->content_snapshot : [],
            ] : null,
            'revisionContext' => $currentPrescription ? [
                'isRevision' => true,
                'requestedChangeText' => $revisionRequestedChangeText,
                'targeting' => $revisionTargeting,
                'instruction' => 'شما در حال بازبینی یک نسخه صادرشده هستید. درخواست تغییر کارشناس را روی نسخه فعلی اعمال کنید و بخش‌هایی را که تغییری برایشان خواسته نشده، بدون تغییر نگه دارید. خروجی باید نسخه کامل و معتبر باشد، اما محتوای خارج از scope تغییر نباید بازنویسی، تنوع‌دهی یا اصلاح سلیقه‌ای شود.',
            ] : [
                'isRevision' => false,
            ],
            'uiContract' => [
                'language' => (string) ($localeConfig['date_locale'] ?? app()->getLocale()),
                'rtl' => (string) ($localeConfig['dir'] ?? 'rtl') === 'rtl',
                'sections' => $this->catalog->sectionsForMode($requestMode),
                'modeRules' => $this->catalog->modeRules(),
                'userChoiceOptionCountRule' => $requestMode === 'user_choice'
                    ? 'فقط در mode برابر user_choice، برای هر slot فعال موجود در userChoiceMealSlotRequirements باید تعداد options دقیقاً برابر required_option_count همان slot باشد. کمتر یا بیشتر نده. food_count خروجی همان عدد required_option_count باشد. برای slot های غیرفعال یا slot هایی که در این فهرست نیستند options تولید نکن.'
                    : '',
                'portionRule' => 'برای هر آیتم غذایی که تجویز می‌کنی، همیشه مقدار grams را هم دقیق محاسبه و برگردان. مثال: اگر 5 پسته تجویز می‌کنی، باید معادل دقیق گرمی آن را هم بدهی. هیچ آیتم شمارشی را بدون مقدار grams صحیح رها نکن.',
                'macroNutrientRule' => 'برای هر گزینه غذایی در user_choice و هر daily meal در daily_prescription و هر replacement، علاوه بر calories، مقادیر protein_grams، fat_grams، carbohydrate_grams و fiber_grams را بر حسب گرم محاسبه و برگردان. این اعداد باید با quantity_text، grams و calories همان غذا سازگار باشند.',
                'macroTargetRule' => $requestMode === 'daily_prescription'
                    ? 'در mode برابر daily_prescription، برای هر day_plan حتماً macro_targets همان روز را با protein_grams، fat_grams، carbohydrate_grams و fiber_grams بر حسب گرم برگردان. این هدف‌ها باید با day_total_calories، هدف درمانی و جمع ماکروهای meals همان روز سازگار باشند.'
                    : ($requestMode === 'user_choice'
                        ? 'در mode برابر user_choice، حتماً macro_targets سطح کل رژیم را به عنوان هدف تخمینی روزانه با protein_grams، fat_grams، carbohydrate_grams و fiber_grams بر حسب گرم برگردان. این هدف‌ها باید با prescribed_calories، target_calories وعده‌ها و options طراحی‌شده سازگار باشند.'
                        : 'در mode برابر fixed_text، macro_targets را صفر/خالی نگه دار و meal یا غذا تولید نکن.'),
                'preparationRule' => 'برای هر meal option، daily meal و replacement همیشه یک preparation_text کاربردی و فارسی بنویس؛ معمولاً در 1 تا 4 خط کوتاه. این متن باید دقیقاً به کاربر بگوید غذا را چطور آماده، ترکیب، پخته و سرو کند. از دستورهای مبهم مثل "مرغ را سرخ کنید" یا "سبزیجات را تفت دهید" پرهیز کن؛ اگر سرخ/تفت/گریل/فر/آب‌پز/بخارپز لازم است مقدار و نوع روغن یا بدون روغن بودن، روش حرارت، زمان تقریبی، چاشنی‌های مهم، دورچین و فرم سرو را مشخص کن. در انتخاب غذاها تا حد امکان غذاهای ایرانی و سفره ایرانی را در اولویت بگذار، مگر محدودیت پزشکی، ترجیح کاربر یا دستور کارشناس خلاف آن را لازم کند.',
                'dailyMealQuantityTextRule' => 'فقط در mode برابر daily_prescription، برای هر daily meal فیلد quantity_text را هم پر کن. این فیلد باید اجزای دقیق غذای اصلی و مقدار هر جزء را به‌صورت مستقل برگرداند و نباید فقط تکرار meal_text باشد. مثال: ۱۵۰ گرم ماست | ۱ قاشق چای‌خوری عسل | ۱۰ گرم گردو.',
                'clinicalSafetyRule' => $clinicalSafetyContext['enabled']
                    ? 'clinicalSafetyContext برای این کاربر پر شده است. بیماری‌های خاص، داروها، مکمل‌های فعلی، حساسیت‌ها، mustAvoid و یادداشت‌های بالینی را محدودیت فعال بدان. در انتخاب غذا، زمان‌بندی وعده‌ها، شدت محدودیت کالری، guidance_sections و supplement_plan این داده‌ها را دقیقاً لحاظ کن. اگر بین ترجیحات و ایمنی تعارض بود، ایمنی مقدم است.'
                    : 'clinicalSafetyContext برای این کاربر مورد خاص پررنگی ندارد. با این حال همچنان آلرژی‌ها، mustAvoid و قواعد ایمنی عمومی را رعایت کن.',
                'clinicalGuidanceRule' => $clinicalSafetyContext['medicalConditions'] !== null
                    ? 'چون برای این کاربر بیماری خاص ثبت شده است، guidance_sections را خالی یا عمومی برنگردان. دست‌کم یک guidance_section اختصاصی و صمیمی بساز که روشن کند بیماری کاربر دیده شده و برای شما مهم بوده است. داخل آن 2 تا 4 توصیه کوتاه، عملی و قابل‌اجرای روزمره بده که دقیقاً به همان بیماری/بیماری‌ها و همین رژیم مربوط باشند؛ مثل مدیریت محرک‌های غذایی، آب، خواب، فاصله وعده‌ها، کافئین، نمک، قند، حجم وعده یا زمان‌بندی خوردن. لحن باید حرفه‌ای، همدلانه و غیرترساننده باشد و حس مراقبت شخصی‌سازی‌شده بدهد، نه متن کلیشه‌ای. مثال ذهنی: برای میگرن باید توصیه‌ها به منظم بودن وعده‌ها، آب کافی، خواب منظم و پرهیز از محرک‌های احتمالی مرتبط باشد.'
                    : 'اگر بیماری خاصی ثبت نشده، guidance_sections را فقط بر اساس الگو، هدف درمانی و نیازهای عمومی کاربر تولید کن و ادعای مراقبت پزشکی شخصی‌سازی‌شده نداشته باش.',
                'supplementSafetyRule' => $clinicalSafetyContext['hasMedicationTiming']
                    ? 'در clinicalSafetyContext برای دارو یا مکمل فعلی زمان مصرف ثبت شده است. supplement_plan و timing وعده‌ها را طوری بچین که با این زمان‌بندی تداخل آشکار نداشته باشد و مکمل تکراری یا هم‌پوشان پیشنهاد نده.'
                    : ($clinicalSafetyContext['medicationsAndSupplements'] !== null
                        ? 'کاربر دارو یا مکمل فعلی دارد. قبل از پیشنهاد هر مکمل جدید، هم‌پوشانی و نیاز واقعی را بررسی کن و اگر اطمینان کافی نداری supplement_plan را حداقلی یا disabled نگه دار.'
                        : 'اگر داده پزشکی یا دارویی مشخصی برای مکمل وجود ندارد، فقط در صورت نیاز روشن و کم‌ریسک supplement_plan بده و از مکمل‌تراشی غیرضروری پرهیز کن.'),
                'dailyMealReplacementRule' => $requestMode === 'daily_prescription'
                    ? ((bool) $request->suggest_daily_replacements
                        ? 'در mode برابر daily_prescription، چون suggestDailyReplacements فعال است، برای هر day_plan و برای تک‌تک meals دقیقاً ۱ replacement واقعی، هم‌راستا و قابل‌اجرا برگردان. برای هر وعده نه صفر replacement بده و نه بیشتر از ۱ مورد. replacement باید با همان هدف درمانی، کالری و منطق وعده اصلی سازگار باشد.'
                        : ((bool) $request->allow_food_replacement
                            ? 'در mode برابر daily_prescription، مقدار allowFoodReplacement فقط به این معناست که رابط کاربری باید دکمه یا امکان "جایگزین کردن غذا" را به کاربر نشان بدهد. این فیلد به معنی تجویز replacement داخل نسخه اولیه نیست. پس در تجویز اولیه برای meals هیچ replacement ثابتی نده و آرایه replacements را خالی نگه دار. اگر کاربر بعداً خواست غذا را تغییر دهد، جایگزینی فقط از flow جداگانه change food انجام می‌شود.'
                            : 'فقط در mode برابر daily_prescription، در تجویز اولیه برای meals هیچ replacement ثابتی نده و آرایه replacements را خالی نگه دار. اگر کاربر بعداً خواست غذا را تغییر دهد، جایگزینی از flow جداگانه change food انجام می‌شود.'))
                    : 'فقط در mode برابر daily_prescription، در تجویز اولیه برای meals هیچ replacement ثابتی نده و آرایه replacements را خالی نگه دار. اگر کاربر بعداً خواست غذا را تغییر دهد، جایگزینی از flow جداگانه change food انجام می‌شود.',
                'fixedTextOnlyRule' => $requestMode === 'fixed_text'
                    ? 'فقط در mode برابر fixed_text، خروجی باید متن توصیه‌ای در text_sections باشد. meal_slots و day_plans دقیقاً [] باشند. water_plan مقدار صفر، supplement_plan غیرفعال و guidance_sections خالی باشد. هیچ meal/food/grams/calories/replacement تولید نکن.'
                    : '',
                'revisionRule' => 'اگر existingPrescription وجود دارد، آن را نسخه فعلی و تاییدشده بدان و خروجی کامل همان نسخه را با اعمال درخواست کارشناس برگردان. اگر revisionContext.targeting.isTargetedRevision فعال است، فقط scope های مشخص‌شده در revisionContext.targeting را تغییر بده و تمام بخش‌های دیگر existingPrescription را بدون بازنویسی، بدون تغییر غذاها، بدون تغییر ترتیب، بدون تغییر راهنماها، بدون تغییر آب/مکمل/کالری/ماکرو و بدون تنوع‌دهی اضافه حفظ کن. مثال: اگر کارشناس گفته «نهار را عوض کن»، فقط meal/slot مربوط به lunch/ناهار تغییر کند و صبحانه، شام، میان‌وعده‌ها، متن‌های راهنما، مکمل، آب و سایر روزها/وعده‌ها دست‌نخورده بمانند؛ مگر اینکه کارشناس صریحاً بخش دیگری را هم خواسته باشد یا تعارض ایمنی جدی وجود داشته باشد.',
                'followUpAssessmentRule' => 'اگر followUpAssessment وجود دارد، یعنی پاسخ‌های کاربر بعد از پایان رژیم قبلی و قبل از درخواست رژیم جدید. باید این داده‌ها را به شکل فعال در نسخه جدید به کار بگیری. وزن فعلی جدید، میزان پایبندی، نتیجه تغییر وزن، تغییر سایز، انرژی، سیری، هوس غذایی، خواب، فعالیت، سختی برنامه، رضایت، میزان سخت‌گیری مطلوب، مشکلات گزارش‌شده، ترجیحات غذایی و یادداشت‌های پزشکی باید روی کالری، ساختار وعده‌ها، انعطاف برنامه، طراحی سیری، تنوع غذایی و استراتژی کلی نسخه بعدی اثر بگذارند.',
                'expertPriorityRule' => 'فیلد expertInstructions شامل دستورهای ثبت‌شده توسط کارشناس تغذیه یا پزشک تغذیه است و باید با اولویت بالاتر از ترجیحات عمومی کاربر در نظر گرفته شود؛ مگر در تعارض با ایمنی یا داده‌های صریح پرونده.',
                'previousDietVarietyRule' => $previousDietVariety['enabled']
                    ? 'previousDietVariety شامل خلاصه غذاهای رژیم‌های قبلی همین کاربر است. اگر previousDietVariety.mostRecentDiet وجود دارد، نسبت به رژیم قبلی غذای مستقیم تکراری نده؛ یعنی در daily_prescription هیچ meal_text یا ترکیب اصلی مشابه و در user_choice هیچ option با عنوان/ترکیب مشابه نساز. اگر به دلیل محدودیت پزشکی، کالری، آلرژی، ترجیحات یا دستور کارشناس واقعاً ناچار به استفاده از همان ایده غذایی شدی، باید حداقل یک جزء قابل مشاهده را عوض کنی؛ مثلاً پروتئین اصلی، دورچین، سبزی/میوه همراه، چاشنی، لبنیات یا مخلفات کنار غذا، روش پخت یا فرم سرو را تغییر بده تا وعده عیناً تکراری نباشد؛ مثل تبدیل ترکیب ماست به ترکیب با ترشی/سبزی خوردن/سالاد مناسب، در صورتی که با شرایط کاربر سازگار باشد. اگر previousDietVariety.secondMostRecentDiet وجود دارد، نسبت به دو رژیم قبل هم تا جای ممکن تکرار نکن، اما سخت‌گیری آن کمتر از رژیم قبلی است. این قانون فقط برای mode های غذایی daily_prescription و user_choice اعمال می‌شود و برای fixed_text نباید meal/food تولید کنی.'
                    : 'برای این کاربر هنوز خلاصه قابل استفاده‌ای از رژیم قبلی در previousDietVariety وجود ندارد. پس قانون تنوع نسبت به رژیم‌های قبلی را بدون سخت‌گیری اضافه اجرا نکن و فقط قواعد عمومی تنوع همین نسخه را رعایت کن.',
                'dietExplanationRule' => $showDietExplanations
                    ? 'برای این الگو showDietExplanations فعال است. guidance_sections را خالی نگذار و آن‌ها را دقیقاً بر اساس dietExplanationInstructions.templatePrompt و شرایط همین کاربر تولید کن.'
                    : 'برای این الگو showDietExplanations غیرفعال است. guidance_sections را خالی برگردان و توضیحات آموزشی اضافه تولید نکن.',
            ],
        ];

        $systemPrompt = trim((string) ($settings['system_prompt'] ?? ''));
        $editablePromptTexts = is_array($settings['diet_prompt_texts'] ?? null) ? $settings['diet_prompt_texts'] : [];
        $generalPromptText = trim((string) ($editablePromptTexts['general'] ?? $this->catalog->defaultEditablePrompt('general')));
        $modePromptText = trim((string) ($editablePromptTexts[$requestMode] ?? $this->catalog->defaultEditablePrompt($requestMode)));
        $dietExplanationPromptText = trim((string) ($editablePromptTexts['diet_explanations'] ?? $this->catalog->defaultEditablePrompt('diet_explanations')));

        if ($systemPrompt === '') {
            $systemPrompt = $this->buildDefaultSystemPrompt($requestMode, $generalPromptText, $modePromptText, $showDietExplanations ? $dietExplanationPromptText : '');
        }

        $legacySystemPrompt = trim((string) ($settings['system_prompt'] ?? ''));
        if ($legacySystemPrompt !== '' && $legacySystemPrompt !== $systemPrompt) {
            $systemPrompt = $legacySystemPrompt;
        }

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
            'schema' => $this->schema(),
            'snapshot' => [
                'systemPrompt' => $systemPrompt,
                'promptLayers' => [
                    'general' => $generalPromptText,
                    'mode' => $modePromptText,
                    'dietExplanations' => $showDietExplanations ? $dietExplanationPromptText : '',
                ],
                'featureFlags' => [
                    'dailyMealQuantityTextRequired' => true,
                    'dailyMealQuantityTextRuleVersion' => 1,
                    'userChoiceExactOptionCountsRequired' => true,
                    'userChoiceExactOptionCountsRuleVersion' => 1,
                    'fixedTextOnlyRequired' => true,
                    'fixedTextOnlyRuleVersion' => 1,
                ],
                'input' => $input,
            ],
        ];
    }

    /**
     * @param array<string, mixed> $profile
     * @param array<string, mixed> $requestPayload
     * @param array{mustAvoid?: mixed, clinicalNotes?: mixed, expertNotes?: mixed} $expertContext
     * @return array<string, mixed>
     */
    private function buildClinicalSafetyContext(array $profile, array $requestPayload, array $expertContext = []): array
    {
        $medicalConditionItems = NutritionMedicalConditionSupport::normalizeEntries(
            is_array($requestPayload['medicalConditionsItems'] ?? null)
                ? $requestPayload['medicalConditionsItems']
                : (is_array($profile['medicalConditionsItems'] ?? null)
                    ? $profile['medicalConditionsItems']
                    : NutritionMedicalConditionSupport::parseEntries($requestPayload['medicalConditions'] ?? $profile['medicalConditions'] ?? $profile['medical_conditions'] ?? null))
        );
        $medicalConditions = NutritionMedicalConditionSupport::summarizeEntries($medicalConditionItems);
        $medicationsAndSupplements = $this->compactText(
            $requestPayload['medicationsAndSupplements'] ?? $profile['medicationsAndSupplements'] ?? $profile['medications_and_supplements'] ?? null
        );
        $foodAllergies = $this->compactText($profile['foodAllergies'] ?? $profile['food_allergies'] ?? null);
        $dislikedFoods = $this->compactText($profile['dislikedFoods'] ?? $profile['disliked_foods'] ?? null);
        $mustAvoid = $this->compactText($expertContext['mustAvoid'] ?? null);
        $clinicalNotes = $this->compactText($expertContext['clinicalNotes'] ?? null);
        $expertNotes = $this->compactText($expertContext['expertNotes'] ?? null);

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

        if ($mustAvoid !== null) {
            $summaryParts[] = 'موارد منع‌شده: ' . $mustAvoid;
        }

        if ($clinicalNotes !== null) {
            $summaryParts[] = 'یادداشت بالینی: ' . $clinicalNotes;
        }

        if ($expertNotes !== null) {
            $summaryParts[] = 'یادداشت کارشناس: ' . $expertNotes;
        }

        $hasMedicationTiming = $medicationsAndSupplements !== null
            && preg_match('/\d|صبح|ظهر|عصر|شب|قبل|بعد|ناشتا|هنگام/u', $medicationsAndSupplements) === 1;

        return [
            'enabled' => $medicalConditions !== null
                || $medicationsAndSupplements !== null
                || $foodAllergies !== null
                || $mustAvoid !== null
                || $clinicalNotes !== null
                || $expertNotes !== null,
            'medicalConditions' => $medicalConditions,
            'medicalConditionsItems' => $medicalConditionItems,
            'medicationsAndSupplements' => $medicationsAndSupplements,
            'foodAllergies' => $foodAllergies,
            'dislikedFoods' => $dislikedFoods,
            'mustAvoid' => $mustAvoid,
            'clinicalNotes' => $clinicalNotes,
            'expertNotes' => $expertNotes,
            'hasMedicationTiming' => $hasMedicationTiming,
            'safetySummary' => $summaryParts !== []
                ? implode(' | ', $summaryParts)
                : 'محدودیت پزشکی یا دارویی برجسته‌ای ثبت نشده است؛ فقط قواعد عمومی ایمنی و ترجیحات غذایی را رعایت کن.',
            'rules' => [
                'بیماری‌های خاص، داروها و مکمل‌های فعلی را محدودیت فعال بدان و در ساخت وعده‌ها، انتخاب مواد غذایی، روش پخت و supplement_plan لحاظ کن.',
                'اگر داده‌های پزشکی یا دارویی با ترجیح غذایی تعارض داشت، ایمنی را مقدم بدان.',
                'درباره دارو توصیه تغییر دوز، قطع یا جایگزینی نده؛ فقط رژیم و timing وعده‌ها را با آن سازگار کن.',
                'اگر درباره مکمل جدید اطمینان کافی نداری یا با داروهای فعلی هم‌پوشانی محتمل است، supplement_plan را حداقلی یا غیرفعال نگه دار.',
            ],
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
    private function buildRevisionTargetingContext(?string $requestedChangeText, string $requestMode, ?string $targetingText = null): array
    {
        $scopeText = $targetingText ?? $requestedChangeText ?? '';
        $mealSlotTargets = $this->detectMealSlotTargets($scopeText);
        $dayTargets = $this->detectDayTargets($scopeText);
        $isTargetedRevision = $requestedChangeText !== null
            && (
                $mealSlotTargets !== []
                || $dayTargets !== []
                || $this->looksLikePartialRevision($scopeText)
            );

        return [
            'isTargetedRevision' => $isTargetedRevision,
            'requestedChangeText' => $requestedChangeText,
            'mealSlotTargets' => $mealSlotTargets,
            'dayTargets' => $dayTargets,
            'scopeRule' => $isTargetedRevision
                ? 'این یک بازبینی هدفمند است. فقط بخش‌هایی را تغییر بده که در requestedChangeText، mealSlotTargets یا dayTargets آمده‌اند. تمام بخش‌های دیگر existingPrescription باید از نسخه قبلی حفظ شوند و فقط برای معتبر ماندن JSON در خروجی کامل تکرار شوند.'
                : 'اگر requestedChangeText فقط دستور کلی بازبینی است، باز هم existingPrescription را مبنا بگیر و فقط مواردی را که کارشناس صریحاً خواسته تغییر بده.',
            'modeSpecificRule' => match ($requestMode) {
                'daily_prescription' => 'در daily_prescription اگر mealSlotTargets پر است، فقط day_plans[*].meals مربوط به slot_key های همان target ها تغییر کند. اگر dayTargets هم پر است، تغییر فقط به همان روزها محدود شود؛ اگر dayTargets خالی است، فقط همان slot در روزهای مرتبط تغییر کند. سایر meals، day_total_calories، macro_targets، water_plan، supplement_plan، guidance_sections و text های بیرون از scope را حفظ کن؛ فقط اگر تغییر وعده باعث ناسازگاری عددی همان روز شد، اعداد همان روز و همان وعده را حداقلی اصلاح کن.',
                'user_choice' => 'در user_choice اگر mealSlotTargets پر است، فقط meal_slots با slot_key همان target ها و options داخل همان slot تغییر کند. سایر slot ها، option ها، macro_targets، calorie_plan، guidance_sections، water_plan و supplement_plan را حفظ کن؛ فقط اگر تغییر target باعث ناسازگاری عددی مستقیم شد، اصلاح حداقلی و محدود به همان target انجام بده.',
                'fixed_text' => 'در fixed_text فقط text_sections یا قسمت متنی مشخص‌شده توسط کارشناس را اصلاح کن و متن‌های دیگر را حفظ کن.',
                default => 'فقط scope صریح درخواست کارشناس را تغییر بده و بقیه existingPrescription را حفظ کن.',
            },
        ];
    }

    /**
     * @return array<int, array{slot_key: string, labels: array<int, string>}>
     */
    private function detectMealSlotTargets(string $text): array
    {
        $normalizedText = mb_strtolower($text);
        $slots = [
            'breakfast' => ['صبحانه', 'ناشتایی', 'breakfast'],
            'morning_snack' => ['میان وعده صبح', 'میان‌وعده صبح', 'میانوعده صبح', 'snack صبح', 'morning snack'],
            'lunch' => ['ناهار', 'نهار', 'ظهرانه', 'lunch'],
            'afternoon_snack' => ['میان وعده عصر', 'میان‌وعده عصر', 'میانوعده عصر', 'عصرانه', 'afternoon snack'],
            'dinner' => ['شام', 'dinner'],
            'night_snack' => ['میان وعده شب', 'میان‌وعده شب', 'میانوعده شب', 'قبل خواب', 'night snack', 'bedtime snack'],
        ];

        $targets = [];

        foreach ($slots as $slotKey => $labels) {
            $matchedLabels = array_values(array_filter($labels, fn (string $label): bool => str_contains($normalizedText, mb_strtolower($label))));

            if ($matchedLabels === []) {
                continue;
            }

            $targets[] = [
                'slot_key' => $slotKey,
                'labels' => $matchedLabels,
            ];
        }

        return $targets;
    }

    /**
     * @return array<int, int>
     */
    private function detectDayTargets(string $text): array
    {
        $targets = [];

        if (preg_match_all('/(?:روز|day)\s*(\d{1,3})/iu', $text, $matches)) {
            foreach ($matches[1] as $dayNumber) {
                $day = (int) $dayNumber;

                if ($day > 0) {
                    $targets[] = $day;
                }
            }
        }

        $persianOrdinals = [
            1 => ['اول', 'یکم'],
            2 => ['دوم'],
            3 => ['سوم'],
            4 => ['چهارم'],
            5 => ['پنجم'],
            6 => ['ششم'],
            7 => ['هفتم'],
            8 => ['هشتم'],
            9 => ['نهم'],
            10 => ['دهم'],
        ];

        foreach ($persianOrdinals as $day => $labels) {
            foreach ($labels as $label) {
                if (preg_match('/روز\s+' . preg_quote($label, '/') . '/u', $text) === 1) {
                    $targets[] = $day;
                    break;
                }
            }
        }

        return array_values(array_unique($targets));
    }

    private function looksLikePartialRevision(string $text): bool
    {
        $normalizedText = mb_strtolower($text);
        $partialKeywords = [
            'فقط',
            'همین',
            'همون',
            'همان',
            'عوض کن',
            'تغییر بده',
            'اصلاح کن',
            'جایگزین',
            'تعویض',
            'دست نزن',
            'دست‌نزن',
            'بقیه',
            'بقیه را تغییر نده',
            'only',
            'just',
            'change',
            'replace',
            'keep the rest',
            'do not change the rest',
        ];

        foreach ($partialKeywords as $keyword) {
            if (str_contains($normalizedText, mb_strtolower($keyword))) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array{
     *     enabled: bool,
     *     mostRecentDiet: array<string, mixed>|null,
     *     secondMostRecentDiet: array<string, mixed>|null,
     *     rule: string
     * }
     */
    private function previousDietVarietyContext(NutritionDietRequest $request): array
    {
        $empty = [
            'enabled' => false,
            'mostRecentDiet' => null,
            'secondMostRecentDiet' => null,
            'rule' => 'No previous usable food history was found for this user.',
        ];

        if (! $request->user_id) {
            return $empty;
        }

        $previousPrescriptions = NutritionDietPrescription::query()
            ->where('user_id', $request->user_id)
            ->where(function ($query) use ($request): void {
                $query
                    ->whereNull('nutrition_diet_request_id')
                    ->orWhere('nutrition_diet_request_id', '!=', $request->id);
            })
            ->whereNotNull('content_snapshot')
            ->where('status', 'active')
            ->where('is_current', true)
            ->whereIn('prescription_mode', ['daily_prescription', 'user_choice'])
            ->orderByDesc('started_at')
            ->orderByDesc('id')
            ->limit(12)
            ->get()
            ->unique(fn (NutritionDietPrescription $prescription): string => $prescription->nutrition_diet_request_id
                ? 'request:' . $prescription->nutrition_diet_request_id
                : 'prescription:' . $prescription->id)
            ->values()
            ->map(fn (NutritionDietPrescription $prescription): ?array => $this->summarizePreviousPrescription($prescription))
            ->filter()
            ->values()
            ->take(2)
            ->all();

        if ($previousPrescriptions === []) {
            return $empty;
        }

        return [
            'enabled' => true,
            'mostRecentDiet' => $previousPrescriptions[0] ?? null,
            'secondMostRecentDiet' => $previousPrescriptions[1] ?? null,
            'rule' => 'Avoid direct food repetition from mostRecentDiet. Avoid repetition from secondMostRecentDiet when possible. If repetition is clinically necessary, change at least one visible component such as main protein, side, garnish, cooking method, condiment, dairy/accompaniment, or serving form.',
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function summarizePreviousPrescription(NutritionDietPrescription $prescription): ?array
    {
        $content = is_array($prescription->content_snapshot) ? $prescription->content_snapshot : [];
        $mode = (string) ($content['mode'] ?? $prescription->prescription_mode ?? '');
        $foods = $mode === 'user_choice'
            ? $this->extractUserChoiceFoods($content)
            : $this->extractDailyPrescriptionFoods($content);

        if ($foods === []) {
            return null;
        }

        return [
            'id' => $prescription->id,
            'mode' => $mode,
            'startedAt' => $prescription->started_at?->toDateString(),
            'endsAt' => $prescription->ends_at?->toDateString(),
            'foods' => $foods,
        ];
    }

    /**
     * @param array<string, mixed> $content
     * @return array<int, array{slot_key: string, title: string, food_text: string, quantity_text: string}>
     */
    private function extractDailyPrescriptionFoods(array $content): array
    {
        $items = [];

        foreach (is_array($content['day_plans'] ?? null) ? $content['day_plans'] : [] as $plan) {
            if (! is_array($plan)) {
                continue;
            }

            foreach (is_array($plan['meals'] ?? null) ? $plan['meals'] : [] as $meal) {
                if (! is_array($meal)) {
                    continue;
                }

                $foodText = $this->compactFoodText([
                    $meal['meal_text'] ?? null,
                    $meal['description'] ?? null,
                ]);

                if ($foodText === '') {
                    continue;
                }

                $items[] = [
                    'slot_key' => trim((string) ($meal['slot_key'] ?? '')),
                    'title' => trim((string) ($meal['title'] ?? '')),
                    'food_text' => $foodText,
                    'quantity_text' => trim((string) ($meal['quantity_text'] ?? '')),
                ];
            }
        }

        return collect($items)
            ->unique(fn (array $item): string => mb_strtolower($item['slot_key'] . '|' . $item['food_text'] . '|' . $item['quantity_text']))
            ->values()
            ->take(180)
            ->all();
    }

    /**
     * @param array<string, mixed> $content
     * @return array<int, array{slot_key: string, title: string, food_text: string, quantity_text: string}>
     */
    private function extractUserChoiceFoods(array $content): array
    {
        $items = [];

        foreach (is_array($content['meal_slots'] ?? null) ? $content['meal_slots'] : [] as $slot) {
            if (! is_array($slot)) {
                continue;
            }

            foreach (is_array($slot['options'] ?? null) ? $slot['options'] : [] as $option) {
                if (! is_array($option)) {
                    continue;
                }

                $foodText = $this->compactFoodText([
                    $option['title'] ?? null,
                    $option['description'] ?? null,
                ]);

                if ($foodText === '') {
                    continue;
                }

                $items[] = [
                    'slot_key' => trim((string) ($slot['slot_key'] ?? '')),
                    'title' => trim((string) ($slot['title'] ?? '')),
                    'food_text' => $foodText,
                    'quantity_text' => trim((string) ($option['quantity_text'] ?? '')),
                ];
            }
        }

        return collect($items)
            ->unique(fn (array $item): string => mb_strtolower($item['slot_key'] . '|' . $item['food_text'] . '|' . $item['quantity_text']))
            ->values()
            ->take(180)
            ->all();
    }

    /**
     * @param array<int, mixed> $parts
     */
    private function compactFoodText(array $parts): string
    {
        return collect($parts)
            ->map(fn (mixed $part): string => preg_replace('/\s+/u', ' ', trim((string) $part)) ?: '')
            ->filter(fn (string $part): bool => $part !== '')
            ->unique()
            ->implode(' | ');
    }

    /**
     * @param array<string, mixed> $template
     * @return array<int, array{slot_key: string, title: string, required_option_count: int, description: string}>
     */
    private function userChoiceMealSlotRequirements(array $template): array
    {
        $slots = is_array($template['mealSlots'] ?? null) ? $template['mealSlots'] : [];

        return collect($slots)
            ->filter(fn ($slot): bool => is_array($slot))
            ->filter(function (array $slot): bool {
                if (array_key_exists('enabled', $slot)) {
                    return (bool) $slot['enabled'];
                }

                return true;
            })
            ->map(function (array $slot): array {
                return [
                    'slot_key' => trim((string) ($slot['key'] ?? '')),
                    'title' => trim((string) ($slot['title'] ?? $slot['key'] ?? '')),
                    'required_option_count' => max(1, (int) ($slot['foodCount'] ?? $slot['food_count'] ?? 1)),
                    'description' => trim((string) ($slot['description'] ?? '')),
                ];
            })
            ->filter(fn (array $slot): bool => $slot['slot_key'] !== '')
            ->values()
            ->all();
    }

    private function buildDefaultSystemPrompt(string $mode, string $generalPromptText, string $modePromptText, string $dietExplanationPromptText = ''): string
    {
        if (! in_array($mode, $this->catalog->supportedModes(), true)) {
            throw new InvalidArgumentException("Unsupported mode [{$mode}]");
        }

        $parts = [];

        if ($generalPromptText !== '') {
            $parts[] = $generalPromptText;
        }

        if ($modePromptText !== '') {
            $parts[] = $modePromptText;
        }

        if ($dietExplanationPromptText !== '') {
            $parts[] = $dietExplanationPromptText;
        }

        $parts[] = implode("\n", $this->catalog->immutableBaseSystemLines());
        $parts[] = implode("\n", $this->catalog->immutableModeSystemLines($mode));

        return trim(implode("\n\n", array_filter($parts, fn ($value): bool => trim((string) $value) !== '')));
    }

    /**
     * @return array<string, mixed>
     */
    private function schema(): array
    {
        return [
            'type' => 'object',
            'additionalProperties' => false,
            'required' => [
                'mode',
                'summary_text',
                'duration_days',
                'allow_food_replacement',
                'notes',
                'intro_banner',
                'macro_targets',
                'calorie_plan',
                'water_plan',
                'supplement_plan',
                'guidance_sections',
                'meal_slots',
                'day_plans',
                'text_sections',
            ],
            'properties' => [
                'mode' => [
                    'type' => 'string',
                    'enum' => ['daily_prescription', 'user_choice', 'fixed_text'],
                ],
                'summary_text' => ['type' => 'string'],
                'duration_days' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 365],
                'allow_food_replacement' => ['type' => 'boolean'],
                'notes' => ['type' => 'string'],
                'intro_banner' => ['type' => 'string'],
                'macro_targets' => $this->macroTargetsSchema(),
                'calorie_plan' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['base_calories', 'prescribed_calories', 'goal_adjustment', 'reasoning', 'summary_text'],
                    'properties' => [
                        'base_calories' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 10000],
                        'prescribed_calories' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 10000],
                        'goal_adjustment' => ['type' => 'string'],
                        'reasoning' => ['type' => 'string'],
                        'summary_text' => ['type' => 'string'],
                    ],
                ],
                'water_plan' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['daily_target_ml', 'daily_target_glasses', 'summary_text', 'timing_tips'],
                    'properties' => [
                        'daily_target_ml' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 10000],
                        'daily_target_glasses' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 30],
                        'summary_text' => ['type' => 'string'],
                        'timing_tips' => [
                            'type' => 'array',
                            'items' => ['type' => 'string'],
                        ],
                    ],
                ],
                'supplement_plan' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['enabled', 'summary_text', 'items'],
                    'properties' => [
                        'enabled' => ['type' => 'boolean'],
                        'summary_text' => ['type' => 'string'],
                        'items' => [
                            'type' => 'array',
                            'items' => [
                                'type' => 'object',
                                'additionalProperties' => false,
                                'required' => ['title', 'usage', 'timing', 'notes'],
                                'properties' => [
                                    'title' => ['type' => 'string'],
                                    'usage' => ['type' => 'string'],
                                    'timing' => ['type' => 'string'],
                                    'notes' => ['type' => 'string'],
                                ],
                            ],
                        ],
                    ],
                ],
                'guidance_sections' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'additionalProperties' => false,
                        'required' => ['title', 'body', 'accent'],
                        'properties' => [
                            'title' => ['type' => 'string'],
                            'body' => ['type' => 'string'],
                            'accent' => [
                                'type' => 'string',
                                'enum' => ['amber', 'cyan', 'violet', 'emerald'],
                            ],
                        ],
                    ],
                ],
                'meal_slots' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'additionalProperties' => false,
                        'required' => ['slot_key', 'title', 'sort_order', 'description', 'food_count', 'target_calories', 'options'],
                        'properties' => [
                            'slot_key' => ['type' => 'string'],
                            'title' => ['type' => 'string'],
                            'sort_order' => ['type' => 'integer', 'minimum' => 0],
                            'description' => ['type' => 'string'],
                            'food_count' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 50],
                            'target_calories' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 3000],
                            'options' => [
                                'type' => 'array',
                                'items' => [
                                    'type' => 'object',
                                    'additionalProperties' => false,
                                    'required' => ['title', 'description', 'preparation_text', 'quantity_text', 'grams', 'calories', 'protein_grams', 'fat_grams', 'carbohydrate_grams', 'fiber_grams'],
                                    'properties' => [
                                        'title' => ['type' => 'string'],
                                        'description' => ['type' => 'string'],
                                        'preparation_text' => ['type' => 'string'],
                                        'quantity_text' => ['type' => 'string'],
                                        'grams' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 2000],
                                        'calories' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 3000],
                                        'protein_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 300],
                                        'fat_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 300],
                                        'carbohydrate_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 600],
                                        'fiber_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 150],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
                'day_plans' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'additionalProperties' => false,
                        'required' => ['day_number', 'day_label', 'notes', 'day_total_calories', 'macro_targets', 'meals'],
                        'properties' => [
                            'day_number' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 31],
                            'day_label' => ['type' => 'string'],
                            'notes' => ['type' => 'string'],
                            'day_total_calories' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 10000],
                            'macro_targets' => $this->macroTargetsSchema(),
                            'meals' => [
                                'type' => 'array',
                                'items' => [
                                    'type' => 'object',
                                    'additionalProperties' => false,
                                    'required' => ['slot_key', 'title', 'meal_text', 'description', 'quantity_text', 'preparation_text', 'grams', 'calories', 'protein_grams', 'fat_grams', 'carbohydrate_grams', 'fiber_grams', 'replacements'],
                                    'properties' => [
                                        'slot_key' => ['type' => 'string'],
                                        'title' => ['type' => 'string'],
                                        'meal_text' => ['type' => 'string'],
                                        'description' => ['type' => 'string'],
                                        'quantity_text' => ['type' => 'string'],
                                        'preparation_text' => ['type' => 'string'],
                                        'grams' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 2000],
                                        'calories' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 3000],
                                        'protein_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 300],
                                        'fat_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 300],
                                        'carbohydrate_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 600],
                                        'fiber_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 150],
                                        'replacements' => [
                                            'type' => 'array',
                                            'items' => [
                                                'type' => 'object',
                                                'additionalProperties' => false,
                                                'required' => ['title', 'description', 'preparation_text', 'quantity_text', 'grams', 'calories', 'protein_grams', 'fat_grams', 'carbohydrate_grams', 'fiber_grams'],
                                                'properties' => [
                                                    'title' => ['type' => 'string'],
                                                    'description' => ['type' => 'string'],
                                                    'preparation_text' => ['type' => 'string'],
                                                    'quantity_text' => ['type' => 'string'],
                                                    'grams' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 2000],
                                                    'calories' => ['type' => 'integer', 'minimum' => 0, 'maximum' => 3000],
                                                    'protein_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 300],
                                                    'fat_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 300],
                                                    'carbohydrate_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 600],
                                                    'fiber_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 150],
                                                ],
                                            ],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
                'text_sections' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'additionalProperties' => false,
                        'required' => ['page_number', 'title', 'body'],
                        'properties' => [
                            'page_number' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50],
                            'title' => ['type' => 'string'],
                            'body' => ['type' => 'string'],
                        ],
                    ],
                ],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function macroTargetsSchema(): array
    {
        return [
            'type' => 'object',
            'additionalProperties' => false,
            'required' => ['protein_grams', 'fat_grams', 'carbohydrate_grams', 'fiber_grams'],
            'properties' => [
                'protein_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 300],
                'fat_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 300],
                'carbohydrate_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 600],
                'fiber_grams' => ['type' => 'number', 'minimum' => 0, 'maximum' => 150],
            ],
        ];
    }
}
