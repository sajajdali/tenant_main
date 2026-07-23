<?php

declare(strict_types=1);

namespace App\OpenApi;

use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Nutrition Prescriptions', description: 'Customer nutrition diet view and tracking APIs')]
#[OA\Get(
    path: '/api/v1/app/nutrition/prescriptions',
    operationId: 'nutritionPrescriptionsIndex',
    description: 'تاریخچه رژیم های منتشرشده کاربر جاری را برای صفحه /nutrition/my-diets برمی گرداند. هر آیتم همان ساختار کامل prescription صفحه مشاهده رژیم را دارد و می تواند daily_prescription یا user_choice باشد.',
    security: [['bearerAuth' => []]],
    tags: ['Nutrition Prescriptions'],
    responses: [
        new OA\Response(response: 200, description: 'Published prescriptions', content: new OA\JsonContent(ref: '#/components/schemas/NutritionPrescriptionListResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/nutrition/prescriptions/current',
    operationId: 'nutritionPrescriptionsCurrent',
    description: 'رژیم فعال صفحه /nutrition/my-diet و /nutrition/my-diet/exercises?date=YYYY-MM-DD را برمی گرداند. اگر رژیم فعال وجود نداشته باشد یا تاریخ پایان گذشته باشد prescription برابر null است. query string date برای dailyMacroSummary استفاده می شود؛ اگر ارسال نشود تاریخ امروز مبناست. صفحه ثبت ورزش، exerciseLogs همین پاسخ را بر اساس query string date فیلتر می کند و با mealLogs همان روز summary کالری مصرف شده، کالری ورزش، خالص امروز و اضافه مصرف باقی مانده را می سازد. جابه جایی روز قبل/بعد در UI با startedAt، endsAt، durationDays و contentSnapshot.day_plans انجام می شود.',
    security: [['bearerAuth' => []]],
    tags: ['Nutrition Prescriptions'],
    responses: [
        new OA\Response(response: 200, description: 'Current prescription', content: new OA\JsonContent(ref: '#/components/schemas/NutritionPrescriptionResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/nutrition/prescriptions/{nutritionDietPrescription}',
    operationId: 'nutritionPrescriptionsShow',
    description: 'نمایش یک رژیم منتشرشده از تاریخچه کاربر. برای /nutrition/my-diets/{prescriptionId} و /nutrition/my-diets/{prescriptionId}/exercises?date=YYYY-MM-DD استفاده می شود و مالکیت نسخه بررسی می شود. query string date برای dailyMacroSummary استفاده می شود؛ اگر ارسال نشود تاریخ امروز مبناست. لاگ های ورزش در exerciseLogs برمی گردند و صفحه تاریخ انتخابی را سمت کلاینت فیلتر می کند.',
    security: [['bearerAuth' => []]],
    tags: ['Nutrition Prescriptions'],
    parameters: [
        new OA\Parameter(
            name: 'nutritionDietPrescription',
            description: 'شناسه رژیم',
            in: 'path',
            required: true,
            schema: new OA\Schema(type: 'integer', minimum: 1),
            example: 42,
        ),
    ],
    responses: [
        new OA\Response(response: 200, description: 'Prescription details', content: new OA\JsonContent(ref: '#/components/schemas/NutritionPrescriptionResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 403, description: 'Prescription belongs to another user'),
        new OA\Response(response: 404, description: 'Prescription is not published or not found'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/nutrition/prescriptions/current/meal-log',
    operationId: 'nutritionPrescriptionsStoreMealLog',
    description: 'تأیید و ثبت غذایی که کاربر از برنامه خورده است. این غذا می تواند گزینه اصلی رژیم یا یکی از options برگشتی از meal-replacement-suggestions باشد؛ مقادیر گزینه انتخابی (عنوان، توضیح، مقدار، کالری و ماکروها) را در همین درخواست بفرستید. برای رژیم روزانه فقط روز جاری قابل ثبت/حذف است. پاسخ، کل prescription تازه را برمی گرداند تا درصد کالری، وضعیت وعده ها و UI روز فعلی دوباره محاسبه شود.',
    security: [['bearerAuth' => []]],
    tags: ['Nutrition Prescriptions'],
    requestBody: new OA\RequestBody(required: true, content: new OA\JsonContent(ref: '#/components/schemas/NutritionMealLogStoreRequest')),
    responses: [
        new OA\Response(response: 200, description: 'Meal log saved', content: new OA\JsonContent(ref: '#/components/schemas/NutritionPrescriptionMutationResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 404, description: 'Current prescription not found'),
        new OA\Response(response: 422, description: 'Validation error or daily prescription date is not today'),
    ],
)]
#[OA\Delete(
    path: '/api/v1/app/nutrition/prescriptions/current/meal-log/{mealLogId}',
    operationId: 'nutritionPrescriptionsDeleteMealLog',
    description: 'حذف ثبت مصرف یک وعده برنامه ای. برای daily_prescription فقط ثبت های روز جاری حذف می شوند. پاسخ، نسخه تازه برای آپدیت درصدها و وضعیت وعده ها است.',
    security: [['bearerAuth' => []]],
    tags: ['Nutrition Prescriptions'],
    parameters: [
        new OA\Parameter(name: 'mealLogId', in: 'path', required: true, schema: new OA\Schema(type: 'integer', minimum: 1), example: 701),
    ],
    responses: [
        new OA\Response(response: 200, description: 'Meal log deleted', content: new OA\JsonContent(ref: '#/components/schemas/NutritionPrescriptionMutationResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 404, description: 'Current prescription or meal log not found'),
        new OA\Response(response: 422, description: 'Daily prescription date is not today'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/nutrition/prescriptions/current/other-meal-photo-analysis',
    operationId: 'nutritionPrescriptionsAnalyzeOtherMealPhoto',
    description: 'مرحله ۱ ثبت غذای خارج از رژیم با عکس: تصویر همراه با متن اختیاری نام غذا (user_food_title) و توضیح کاربر (user_note) برای تحلیل AI ارسال می شود. این endpoint فقط یک پیش نویس پیشنهادی شامل نام، مقدار، کالری و ماکروها می دهد و هیچ غذایی ثبت نمی کند. کلاینت می تواند فیلدهای analysis را به کاربر نشان دهد تا ویرایش شوند؛ سپس برای تأیید نهایی باید مرحله ۲ یعنی other-meal-log را با مقادیر نهایی و در صورت نیاز همان فایل عکس صدا بزند. این قابلیت فقط وقتی out-of-plan meal logging و meal photo analysis فعال باشند در دسترس است.',
    security: [['bearerAuth' => []]],
    tags: ['Nutrition Prescriptions'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\MediaType(
            mediaType: 'multipart/form-data',
            schema: new OA\Schema(
                required: ['consumed_date', 'meal_slot_key', 'image'],
                properties: [
                    new OA\Property(property: 'consumed_date', type: 'string', format: 'date', example: '2026-06-16'),
                    new OA\Property(property: 'meal_slot_key', type: 'string', maxLength: 64, example: 'lunch'),
                    new OA\Property(property: 'slot_title', type: 'string', nullable: true, maxLength: 255, example: 'ناهار'),
                    new OA\Property(property: 'user_food_title', description: 'نامی که کاربر برای کمک به تشخیص AI وارد کرده است.', type: 'string', nullable: true, maxLength: 255, example: 'چلو مرغ با سالاد'),
                    new OA\Property(property: 'user_note', description: 'توضیح همراه عکس؛ مانند مقدار، مواد داخل غذا یا شیوه پخت.', type: 'string', nullable: true, maxLength: 1000, example: 'حدود یک بشقاب بود و مرغ با یک قاشق روغن پخته شده بود.'),
                    new OA\Property(property: 'image', description: 'jpg, jpeg, png, webp, gif تا 4MB', type: 'string', format: 'binary'),
                ],
                type: 'object',
            ),
        ),
    ),
    responses: [
        new OA\Response(response: 200, description: 'Photo analysis result', content: new OA\JsonContent(ref: '#/components/schemas/NutritionOtherMealPhotoAnalysisResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 404, description: 'Current prescription not found'),
        new OA\Response(response: 422, description: 'Validation error, feature disabled, or AI usage limit reached'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/nutrition/prescriptions/current/other-meal-log',
    operationId: 'nutritionPrescriptionsStoreOtherMealLog',
    description: 'مرحله تأیید نهایی غذای خارج از رژیم. در ورود متنی، food_title و توضیحات کاربر را بفرستید؛ اگر option_calories خالی باشد محاسبه ارزش غذایی با AI در صف قرار می گیرد. در ورود با عکس، ابتدا other-meal-photo-analysis را صدا بزنید، نتیجه را در UI قابل ویرایش نمایش دهید و سپس مقادیر نهایی ویرایش شده را همراه manual_entry_method=photo و در صورت نیاز فایل image با multipart/form-data به این endpoint بفرستید. وجود option_calories یعنی مقادیر تحلیل/ویرایش شده مستقیم ثبت می شوند و محاسبه دوباره صف نمی شود. این endpoint همان عمل «تأیید» در UI است؛ endpoint جداگانه ای برای ویرایش پیش نویس وجود ندارد، چون ویرایش پیش از ثبت در کلاینت انجام می شود. پاسخ کل prescription تازه را برمی گرداند.',
    security: [['bearerAuth' => []]],
    tags: ['Nutrition Prescriptions'],
    requestBody: new OA\RequestBody(
        required: true,
        content: [
            new OA\JsonContent(ref: '#/components/schemas/NutritionOtherMealLogStoreRequest'),
            new OA\MediaType(
                mediaType: 'multipart/form-data',
                schema: new OA\Schema(ref: '#/components/schemas/NutritionOtherMealLogStoreRequest'),
            ),
        ],
    ),
    responses: [
        new OA\Response(response: 200, description: 'Manual meal log saved', content: new OA\JsonContent(ref: '#/components/schemas/NutritionPrescriptionMutationResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 404, description: 'Current prescription not found'),
        new OA\Response(response: 422, description: 'Validation error, feature disabled, or AI usage limit reached'),
        new OA\Response(response: 503, description: 'Required meal nutrition columns or migrations are missing'),
    ],
)]
#[OA\Delete(
    path: '/api/v1/app/nutrition/prescriptions/current/other-meal-log/{mealLogId}',
    operationId: 'nutritionPrescriptionsDeleteOtherMealLog',
    description: 'حذف غذای دستی/خارج از رژیم و فایل عکس مرتبط در صورت وجود. پاسخ نسخه تازه را برای آپدیت درصدها و لیست روز برمی گرداند.',
    security: [['bearerAuth' => []]],
    tags: ['Nutrition Prescriptions'],
    parameters: [
        new OA\Parameter(name: 'mealLogId', in: 'path', required: true, schema: new OA\Schema(type: 'integer', minimum: 1), example: 812),
    ],
    responses: [
        new OA\Response(response: 200, description: 'Manual meal log deleted', content: new OA\JsonContent(ref: '#/components/schemas/NutritionPrescriptionMutationResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 404, description: 'Current prescription or manual meal log not found'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/nutrition/prescriptions/current/water-log',
    operationId: 'nutritionPrescriptionsStoreWaterLog',
    description: 'ثبت یا جایگزینی آب مصرفی یک روز. اگر glasses و amount_ml صفر باشند ثبت آب همان روز حذف می شود. پاسخ نسخه تازه را برای آپدیت درصد آب و summary روز برمی گرداند.',
    security: [['bearerAuth' => []]],
    tags: ['Nutrition Prescriptions'],
    requestBody: new OA\RequestBody(required: true, content: new OA\JsonContent(ref: '#/components/schemas/NutritionWaterLogStoreRequest')),
    responses: [
        new OA\Response(response: 200, description: 'Water log saved', content: new OA\JsonContent(ref: '#/components/schemas/NutritionPrescriptionMutationResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 404, description: 'Current prescription not found'),
        new OA\Response(response: 422, description: 'Validation error'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/nutrition/prescriptions/current/meal-replacement-suggestions',
    operationId: 'nutritionPrescriptionsGenerateMealReplacementSuggestions',
    description: 'ساخت یا دریافت لیست ذخیره/کش شده جایگزین های یک وعده با AI؛ فقط وقتی allowFoodReplacement نسخه فعال باشد. برای user_choice از source_type=meal_slot و meal_slot_key استفاده کنید. برای daily_prescription از source_type=daily_meal استفاده کنید و day_number و meal_index (اندیس صفرمبنای وعده در day_plans[day].meals) را نیز بفرستید. نتیجه ممکن است queued/processing باشد؛ وضعیت و options در suggestion و سپس در mealReplacementSuggestions پاسخ prescription برمی گردد. انتخاب یکی از options به تنهایی چیزی ثبت نمی کند؛ برای تأیید غذای انتخاب شده، مقادیر همان option را به endpoint meal-log بفرستید.',
    security: [['bearerAuth' => []]],
    tags: ['Nutrition Prescriptions'],
    requestBody: new OA\RequestBody(required: true, content: new OA\JsonContent(ref: '#/components/schemas/NutritionMealReplacementSuggestionRequest')),
    responses: [
        new OA\Response(response: 200, description: 'Suggestion queued or reused', content: new OA\JsonContent(ref: '#/components/schemas/NutritionMealReplacementSuggestionResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 404, description: 'Current prescription not found'),
        new OA\Response(response: 422, description: 'Replacement is disabled or validation error'),
        new OA\Response(response: 503, description: 'Meal replacement migration is missing'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/nutrition/prescriptions/current/meal-replacement-suggestions/{mealSuggestion}/cancel',
    operationId: 'nutritionPrescriptionsCancelMealReplacementSuggestions',
    description: 'لغو درخواست در حال پردازش جایگزین غذا. فقط پیشنهاد متعلق به کاربر و رژیم فعلی قابل لغو است.',
    security: [['bearerAuth' => []]],
    tags: ['Nutrition Prescriptions'],
    parameters: [
        new OA\Parameter(name: 'mealSuggestion', in: 'path', required: true, schema: new OA\Schema(type: 'integer', minimum: 1), example: 91),
    ],
    responses: [
        new OA\Response(response: 200, description: 'Suggestion cancelled', content: new OA\JsonContent(ref: '#/components/schemas/NutritionMealReplacementSuggestionResponse')),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 403, description: 'Suggestion belongs to another user or prescription'),
        new OA\Response(response: 404, description: 'Current prescription or suggestion not found'),
        new OA\Response(response: 503, description: 'Meal replacement migration is missing'),
    ],
)]
#[OA\Schema(
    schema: 'NutritionPrescriptionResponse',
    required: ['success', 'data'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
        new OA\Property(
            property: 'data',
            required: ['prescription'],
            properties: [
                new OA\Property(property: 'prescription', ref: '#/components/schemas/NutritionPrescription', nullable: true),
            ],
            type: 'object',
        ),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionPrescriptionMutationResponse',
    required: ['success', 'message', 'data'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(property: 'message', type: 'string', example: 'وضعیت آب روزانه ذخیره شد.'),
        new OA\Property(
            property: 'data',
            required: ['prescription'],
            properties: [
                new OA\Property(property: 'prescription', ref: '#/components/schemas/NutritionPrescription'),
            ],
            type: 'object',
        ),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionPrescriptionListResponse',
    required: ['success', 'data'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(
            property: 'data',
            required: ['items'],
            properties: [
                new OA\Property(property: 'items', type: 'array', items: new OA\Items(ref: '#/components/schemas/NutritionPrescription')),
            ],
            type: 'object',
        ),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionPrescription',
    required: ['id', 'deliveryChannel', 'prescriptionMode', 'status', 'expired', 'isCurrent', 'contentSnapshot', 'mealLogs', 'waterLogs', 'exerciseLogs', 'mealReplacementSuggestions'],
    properties: [
        new OA\Property(property: 'id', type: 'string', example: '42'),
        new OA\Property(property: 'requestId', type: 'string', nullable: true, example: '18'),
        new OA\Property(property: 'nutritionDietTemplateId', type: 'string', nullable: true, example: '7'),
        new OA\Property(property: 'deliveryChannel', type: 'string', enum: ['ai', 'expert_file', 'manual'], example: 'ai'),
        new OA\Property(property: 'prescriptionMode', type: 'string', enum: ['daily_prescription', 'user_choice', 'fixed_text'], example: 'daily_prescription'),
        new OA\Property(property: 'status', type: 'string', example: 'active'),
        new OA\Property(property: 'expired', type: 'boolean', example: false),
        new OA\Property(property: 'allowFoodReplacement', type: 'boolean', example: true),
        new OA\Property(property: 'suggestDailyReplacements', type: 'boolean', example: false),
        new OA\Property(property: 'exerciseLoggingEnabled', type: 'boolean', example: true),
        new OA\Property(property: 'outOfPlanMealLoggingEnabled', type: 'boolean', example: true),
        new OA\Property(property: 'mealPhotoAnalysisEnabled', type: 'boolean', example: true),
        new OA\Property(property: 'currentWeightKg', type: 'number', nullable: true, format: 'float', example: 86.5),
        new OA\Property(property: 'targetWeightKg', type: 'number', nullable: true, format: 'float', example: 78),
        new OA\Property(property: 'weeklyWeightChangeKg', type: 'number', nullable: true, format: 'float', example: 0.5),
        new OA\Property(property: 'startedAt', type: 'string', nullable: true, format: 'date', example: '2026-06-16'),
        new OA\Property(property: 'endsAt', type: 'string', nullable: true, format: 'date', example: '2026-06-30'),
        new OA\Property(property: 'durationDays', type: 'integer', nullable: true, example: 15),
        new OA\Property(property: 'version', type: 'integer', example: 1),
        new OA\Property(property: 'isCurrent', type: 'boolean', example: true),
        new OA\Property(property: 'summaryText', type: 'string', nullable: true, example: 'برنامه ۱۵ روزه کاهش وزن با وعده های ساده'),
        new OA\Property(property: 'notes', type: 'string', nullable: true),
        new OA\Property(property: 'contentSnapshot', ref: '#/components/schemas/NutritionPrescriptionContentSnapshot'),
        new OA\Property(property: 'expertFile', ref: '#/components/schemas/NutritionExpertFile', nullable: true),
        new OA\Property(property: 'dailyMacroSummary', ref: '#/components/schemas/NutritionDailyMacroSummary'),
        new OA\Property(property: 'mealReplacementSuggestions', type: 'array', items: new OA\Items(ref: '#/components/schemas/NutritionMealReplacementSuggestion')),
        new OA\Property(property: 'mealLogs', type: 'array', items: new OA\Items(ref: '#/components/schemas/NutritionMealLog')),
        new OA\Property(property: 'waterLogs', type: 'array', items: new OA\Items(ref: '#/components/schemas/NutritionWaterLog')),
        new OA\Property(property: 'exerciseLogs', type: 'array', items: new OA\Items(ref: '#/components/schemas/NutritionExerciseLog')),
        new OA\Property(property: 'publishedAt', type: 'string', nullable: true, format: 'date-time'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionPrescriptionContentSnapshot',
    description: 'بدنه اصلی رژیم. در daily_prescription آرایه day_plans پر است؛ در user_choice آرایه meal_slots پر است؛ در fixed_text فقط text_sections استفاده می شود.',
    required: ['mode', 'summary_text', 'duration_days', 'meal_slots', 'day_plans', 'text_sections'],
    properties: [
        new OA\Property(property: 'mode', type: 'string', enum: ['daily_prescription', 'user_choice', 'fixed_text'], example: 'daily_prescription'),
        new OA\Property(property: 'summary_text', type: 'string', example: 'رژیم امروز شما با تمرکز روی پروتئین کافی تنظیم شده است.'),
        new OA\Property(property: 'duration_days', type: 'integer', minimum: 1, maximum: 365, example: 15),
        new OA\Property(property: 'allow_food_replacement', type: 'boolean', example: true),
        new OA\Property(property: 'suggest_daily_replacements', type: 'boolean', example: false),
        new OA\Property(property: 'notes', type: 'string', nullable: true),
        new OA\Property(property: 'intro_banner', type: 'string', nullable: true, example: 'این رژیم را باید ۱۵ روز با دقت رعایت کنید.'),
        new OA\Property(property: 'macro_targets', ref: '#/components/schemas/NutritionMacroTargets', nullable: true),
        new OA\Property(property: 'calorie_plan', ref: '#/components/schemas/NutritionCaloriePlan', nullable: true),
        new OA\Property(property: 'water_plan', ref: '#/components/schemas/NutritionWaterPlan', nullable: true),
        new OA\Property(property: 'supplement_plan', ref: '#/components/schemas/NutritionSupplementPlan', nullable: true),
        new OA\Property(property: 'guidance_sections', type: 'array', items: new OA\Items(ref: '#/components/schemas/NutritionGuidanceSection')),
        new OA\Property(property: 'meal_slots', description: 'برای user_choice؛ هر وعده چند option انتخابی دارد.', type: 'array', items: new OA\Items(ref: '#/components/schemas/NutritionMealSlot')),
        new OA\Property(property: 'day_plans', description: 'برای daily_prescription؛ هر روز شامل وعده های همان روز و replacementهای اولیه احتمالی است.', type: 'array', items: new OA\Items(ref: '#/components/schemas/NutritionDayPlan')),
        new OA\Property(property: 'text_sections', description: 'برای fixed_text یا توضیحات متنی نسخه.', type: 'array', items: new OA\Items(ref: '#/components/schemas/NutritionTextSection')),
        new OA\Property(property: 'audio_tracks', type: 'array', items: new OA\Items(ref: '#/components/schemas/NutritionAudioTrack')),
        new OA\Property(property: 'expert_file', type: 'object', nullable: true),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionCaloriePlan',
    properties: [
        new OA\Property(property: 'base_calories', type: 'integer', example: 2250),
        new OA\Property(property: 'prescribed_calories', type: 'integer', example: 1850),
        new OA\Property(property: 'goal_adjustment', type: 'string', example: 'کاهش وزن آرام'),
        new OA\Property(property: 'reasoning', type: 'string', example: 'کالری بر اساس وزن فعلی، فعالیت و هدف کاهش وزن تنظیم شده است.'),
        new OA\Property(property: 'summary_text', type: 'string', example: 'هدف روزانه حدود ۱۸۵۰ کیلوکالری است.'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionWaterPlan',
    properties: [
        new OA\Property(property: 'daily_target_ml', type: 'integer', example: 2800),
        new OA\Property(property: 'daily_target_glasses', type: 'integer', example: 11),
        new OA\Property(property: 'summary_text', type: 'string', example: 'مقدار آب روزانه بر اساس وزن شما تنظیم شده است.'),
        new OA\Property(property: 'timing_tips', type: 'array', items: new OA\Items(type: 'string'), example: ['یک لیوان بعد از بیدار شدن', 'یک لیوان بین ناهار و شام']),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionSupplementPlan',
    properties: [
        new OA\Property(property: 'enabled', type: 'boolean', example: true),
        new OA\Property(property: 'summary_text', type: 'string', example: 'مکمل ها طبق دستور کارشناس مصرف شوند.'),
        new OA\Property(property: 'items', type: 'array', items: new OA\Items(ref: '#/components/schemas/NutritionSupplementItem')),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionSupplementItem',
    properties: [
        new OA\Property(property: 'title', type: 'string', example: 'ویتامین D'),
        new OA\Property(property: 'usage', type: 'string', example: 'یک عدد'),
        new OA\Property(property: 'timing', type: 'string', example: 'بعد از ناهار'),
        new OA\Property(property: 'notes', type: 'string', example: 'طبق شرایط پزشکی کاربر بررسی شود.'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionGuidanceSection',
    properties: [
        new OA\Property(property: 'title', type: 'string', example: 'نکته اجرای رژیم'),
        new OA\Property(property: 'body', type: 'string', example: 'وعده ها را با فاصله منظم مصرف کنید.'),
        new OA\Property(property: 'accent', type: 'string', enum: ['amber', 'cyan', 'violet', 'emerald'], example: 'emerald'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionMealSlot',
    properties: [
        new OA\Property(property: 'slot_key', type: 'string', example: 'breakfast'),
        new OA\Property(property: 'title', type: 'string', example: 'صبحانه'),
        new OA\Property(property: 'sort_order', type: 'integer', example: 1),
        new OA\Property(property: 'description', type: 'string', example: 'یکی از گزینه های زیر را انتخاب کنید.'),
        new OA\Property(property: 'food_count', type: 'integer', example: 3),
        new OA\Property(property: 'target_calories', type: 'integer', example: 420),
        new OA\Property(property: 'options', type: 'array', items: new OA\Items(ref: '#/components/schemas/NutritionMealOption')),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionMealOption',
    properties: [
        new OA\Property(property: 'title', type: 'string', example: 'املت گوجه'),
        new OA\Property(property: 'description', type: 'string', example: 'با نان سبوس دار و سبزی خوردن'),
        new OA\Property(property: 'quantity_text', type: 'string', example: '۲ عدد تخم مرغ | ۱ کف دست نان'),
        new OA\Property(property: 'calories', type: 'integer', nullable: true, example: 410),
        new OA\Property(property: 'protein_grams', type: 'number', nullable: true, format: 'float', example: 24),
        new OA\Property(property: 'fat_grams', type: 'number', nullable: true, format: 'float', example: 18),
        new OA\Property(property: 'carbohydrate_grams', type: 'number', nullable: true, format: 'float', example: 38),
        new OA\Property(property: 'fiber_grams', type: 'number', nullable: true, format: 'float', example: 5),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionDayPlan',
    properties: [
        new OA\Property(property: 'day_number', type: 'integer', example: 1),
        new OA\Property(property: 'day_label', type: 'string', example: 'روز اول'),
        new OA\Property(property: 'notes', type: 'string', nullable: true),
        new OA\Property(property: 'day_total_calories', type: 'integer', nullable: true, example: 1850),
        new OA\Property(property: 'macro_targets', ref: '#/components/schemas/NutritionMacroTargets', nullable: true),
        new OA\Property(property: 'meals', type: 'array', items: new OA\Items(ref: '#/components/schemas/NutritionDayMeal')),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionDayMeal',
    properties: [
        new OA\Property(property: 'slot_key', type: 'string', example: 'lunch'),
        new OA\Property(property: 'title', type: 'string', example: 'ناهار'),
        new OA\Property(property: 'meal_text', type: 'string', example: 'مرغ گریل، برنج قهوه ای و سالاد'),
        new OA\Property(property: 'description', type: 'string', nullable: true),
        new OA\Property(property: 'quantity_text', type: 'string', nullable: true, example: '۱۵۰ گرم مرغ | ۶ قاشق برنج | سالاد آزاد'),
        new OA\Property(property: 'calories', type: 'integer', nullable: true, example: 560),
        new OA\Property(property: 'protein_grams', type: 'number', nullable: true, format: 'float', example: 42),
        new OA\Property(property: 'fat_grams', type: 'number', nullable: true, format: 'float', example: 14),
        new OA\Property(property: 'carbohydrate_grams', type: 'number', nullable: true, format: 'float', example: 62),
        new OA\Property(property: 'fiber_grams', type: 'number', nullable: true, format: 'float', example: 7),
        new OA\Property(property: 'replacements', type: 'array', items: new OA\Items(ref: '#/components/schemas/NutritionMealReplacementOption')),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionMealReplacementOption',
    properties: [
        new OA\Property(property: 'id', type: 'string', nullable: true, example: 'suggestion_1'),
        new OA\Property(property: 'title', type: 'string', example: 'ماهی تن با سیب زمینی'),
        new OA\Property(property: 'description', type: 'string', example: 'جایگزین هم کالری برای ناهار'),
        new OA\Property(property: 'preparation_text', type: 'string', nullable: true, example: 'تن را آبکش کنید و با آبلیمو مصرف کنید.'),
        new OA\Property(property: 'quantity_text', type: 'string', example: '۱۲۰ گرم تن | ۱ عدد سیب زمینی متوسط'),
        new OA\Property(property: 'grams', type: 'integer', nullable: true, example: 250),
        new OA\Property(property: 'calories', type: 'integer', nullable: true, example: 540),
        new OA\Property(property: 'match_reason', type: 'string', nullable: true, example: 'پروتئین مشابه و کالری نزدیک دارد.'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionTextSection',
    properties: [
        new OA\Property(property: 'page_number', type: 'integer', example: 1),
        new OA\Property(property: 'title', type: 'string', example: 'توصیه های رژیم'),
        new OA\Property(property: 'body', type: 'string', example: 'مصرف قند ساده را محدود کنید.'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionAudioTrack',
    properties: [
        new OA\Property(property: 'id', type: 'string', example: '3'),
        new OA\Property(property: 'title', type: 'string', example: 'راهنمای هفته اول'),
        new OA\Property(property: 'description', type: 'string', nullable: true),
        new OA\Property(property: 'fileUrl', type: 'string', example: '/storage/nutrition/audio/week-1.mp3'),
        new OA\Property(property: 'sessionNumber', type: 'integer', nullable: true, example: 1),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionExpertFile',
    properties: [
        new OA\Property(property: 'source', type: 'string', example: 'upload'),
        new OA\Property(property: 'libraryFileId', type: 'string', nullable: true, example: '12'),
        new OA\Property(property: 'title', type: 'string', example: 'فایل رژیم اختصاصی'),
        new OA\Property(property: 'description', type: 'string', nullable: true),
        new OA\Property(property: 'calories', type: 'integer', nullable: true, example: 1800),
        new OA\Property(property: 'fileName', type: 'string', example: 'diet.pdf'),
        new OA\Property(property: 'filePath', type: 'string', example: 'nutrition/diet-files/diet.pdf'),
        new OA\Property(property: 'fileUrl', type: 'string', example: '/storage/nutrition/diet-files/diet.pdf'),
        new OA\Property(property: 'mimeType', type: 'string', nullable: true, example: 'application/pdf'),
        new OA\Property(property: 'fileSize', type: 'integer', nullable: true, example: 245760),
        new OA\Property(property: 'group', type: 'object', nullable: true),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionMacroTargets',
    description: 'هدف روزانه ماکروها بر حسب گرم؛ برای daily_prescription داخل هر روز و برای user_choice به صورت هدف تخمینی روزانه ذخیره می شود.',
    properties: [
        new OA\Property(property: 'protein_grams', type: 'number', format: 'float', example: 132),
        new OA\Property(property: 'fat_grams', type: 'number', format: 'float', example: 56),
        new OA\Property(property: 'carbohydrate_grams', type: 'number', format: 'float', example: 199),
        new OA\Property(property: 'fiber_grams', type: 'number', format: 'float', example: 30),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionMacroProgress',
    properties: [
        new OA\Property(property: 'targetGrams', type: 'number', nullable: true, format: 'float', example: 132),
        new OA\Property(property: 'consumedGrams', type: 'number', format: 'float', example: 33),
        new OA\Property(property: 'remainingGrams', type: 'number', nullable: true, format: 'float', example: 99),
        new OA\Property(property: 'overGrams', type: 'number', nullable: true, format: 'float', example: 0),
        new OA\Property(property: 'percent', type: 'integer', nullable: true, example: 25),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionDailyMacroSummary',
    description: 'خلاصه مصرف و هدف ماکروهای روز انتخاب‌شده. source مشخص می‌کند هدف از AI، جمع وعده‌های روز، تخمین گزینه‌های انتخابی یا fallback آمده است.',
    properties: [
        new OA\Property(property: 'date', type: 'string', format: 'date', example: '2026-06-25'),
        new OA\Property(property: 'source', type: 'string', enum: ['ai_target', 'day_plan_sum', 'estimated', 'content_target', 'unavailable'], example: 'ai_target'),
        new OA\Property(property: 'protein', ref: '#/components/schemas/NutritionMacroProgress'),
        new OA\Property(property: 'carbohydrate', ref: '#/components/schemas/NutritionMacroProgress'),
        new OA\Property(property: 'fat', ref: '#/components/schemas/NutritionMacroProgress'),
        new OA\Property(property: 'fiber', ref: '#/components/schemas/NutritionMacroProgress'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionMealLog',
    properties: [
        new OA\Property(property: 'id', type: 'string', example: '701'),
        new OA\Property(property: 'consumedDate', type: 'string', format: 'date', example: '2026-06-16'),
        new OA\Property(property: 'mealSlotKey', type: 'string', example: 'lunch'),
        new OA\Property(property: 'foodTitle', type: 'string', example: 'مرغ گریل'),
        new OA\Property(property: 'foodDescription', type: 'string', nullable: true),
        new OA\Property(property: 'quantityText', type: 'string', nullable: true, example: '۱۵۰ گرم'),
        new OA\Property(property: 'calories', type: 'integer', example: 560),
        new OA\Property(property: 'proteinGrams', type: 'number', format: 'float', example: 42),
        new OA\Property(property: 'fatGrams', type: 'number', format: 'float', example: 14),
        new OA\Property(property: 'carbohydrateGrams', type: 'number', format: 'float', example: 62),
        new OA\Property(property: 'fiberGrams', type: 'number', format: 'float', example: 7),
        new OA\Property(property: 'aiNutritionStatus', type: 'string', enum: ['not_requested', 'queued', 'processing', 'generated', 'failed'], example: 'generated'),
        new OA\Property(property: 'aiNutritionError', type: 'string', nullable: true),
        new OA\Property(property: 'notes', type: 'string', nullable: true),
        new OA\Property(property: 'status', type: 'string', example: 'eaten'),
        new OA\Property(property: 'consumptionType', type: 'string', enum: ['scheduled', 'manual'], example: 'scheduled'),
        new OA\Property(property: 'isManual', type: 'boolean', example: false),
        new OA\Property(property: 'manualEntryMethod', type: 'string', enum: ['manual', 'photo'], example: 'manual'),
        new OA\Property(property: 'photoUrl', type: 'string', nullable: true, example: '/storage/tenant/nutrition/meal-photos/photo.jpg'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionWaterLog',
    properties: [
        new OA\Property(property: 'id', type: 'string', example: '55'),
        new OA\Property(property: 'consumedDate', type: 'string', format: 'date', example: '2026-06-16'),
        new OA\Property(property: 'amountMl', type: 'integer', example: 2000),
        new OA\Property(property: 'glasses', type: 'integer', example: 8),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionMealReplacementSuggestion',
    properties: [
        new OA\Property(property: 'id', type: 'string', example: '91'),
        new OA\Property(property: 'sourceType', type: 'string', enum: ['meal_slot', 'daily_meal'], example: 'daily_meal'),
        new OA\Property(property: 'sourceSignature', type: 'string', nullable: true),
        new OA\Property(property: 'mealSlotKey', type: 'string', example: 'lunch'),
        new OA\Property(property: 'slotTitle', type: 'string', nullable: true, example: 'ناهار'),
        new OA\Property(property: 'dayNumber', type: 'integer', nullable: true, example: 1),
        new OA\Property(property: 'mealIndex', type: 'integer', nullable: true, example: 0),
        new OA\Property(property: 'cacheScope', type: 'string', nullable: true),
        new OA\Property(property: 'cacheScopeLabel', type: 'string', nullable: true),
        new OA\Property(property: 'suggestionCount', type: 'integer', example: 3),
        new OA\Property(property: 'status', type: 'string', enum: ['queued', 'processing', 'generated', 'failed', 'cancelled'], example: 'generated'),
        new OA\Property(property: 'errorMessage', type: 'string', nullable: true),
        new OA\Property(property: 'requestedAt', type: 'string', nullable: true, format: 'date-time'),
        new OA\Property(property: 'generatedAt', type: 'string', nullable: true, format: 'date-time'),
        new OA\Property(property: 'cancelledAt', type: 'string', nullable: true, format: 'date-time'),
        new OA\Property(property: 'promptMode', type: 'string', example: 'tenant'),
        new OA\Property(property: 'options', type: 'array', items: new OA\Items(ref: '#/components/schemas/NutritionMealReplacementOption')),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionMealLogStoreRequest',
    description: 'ثبت/تأیید گزینه اصلی یا جایگزین انتخاب‌شده. برای گزینه جایگزین، فیلدهای همان NutritionMealReplacementOption را به نام‌های متناظر این schema نگاشت کنید (title به food_title، description به food_description، calories به option_calories).',
    required: ['consumed_date', 'meal_slot_key', 'food_title'],
    properties: [
        new OA\Property(property: 'consumed_date', type: 'string', format: 'date', example: '2026-06-16'),
        new OA\Property(property: 'meal_slot_key', type: 'string', maxLength: 64, example: 'lunch'),
        new OA\Property(property: 'slot_title', type: 'string', nullable: true, maxLength: 255, example: 'ناهار'),
        new OA\Property(property: 'food_title', type: 'string', maxLength: 255, example: 'مرغ گریل'),
        new OA\Property(property: 'food_description', type: 'string', nullable: true),
        new OA\Property(property: 'quantity_text', type: 'string', nullable: true, maxLength: 255, example: '۱۵۰ گرم'),
        new OA\Property(property: 'option_calories', type: 'integer', nullable: true, minimum: 0, maximum: 3000, example: 560),
        new OA\Property(property: 'protein_grams', type: 'number', nullable: true, format: 'float', minimum: 0, maximum: 300, example: 42),
        new OA\Property(property: 'fat_grams', type: 'number', nullable: true, format: 'float', minimum: 0, maximum: 300, example: 14),
        new OA\Property(property: 'carbohydrate_grams', type: 'number', nullable: true, format: 'float', minimum: 0, maximum: 600, example: 62),
        new OA\Property(property: 'fiber_grams', type: 'number', nullable: true, format: 'float', minimum: 0, maximum: 150, example: 7),
        new OA\Property(property: 'notes', type: 'string', nullable: true),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionOtherMealLogStoreRequest',
    description: 'بدنه تأیید غذای خارج از برنامه. برای ورود با عکس از multipart/form-data و manual_entry_method=photo استفاده کنید. فیلدهای برگشتی از NutritionOtherMealPhotoAnalysis قابل ویرایش‌اند و مقادیر نهایی باید در این بدنه ارسال شوند.',
    required: ['consumed_date', 'meal_slot_key', 'food_title'],
    properties: [
        new OA\Property(property: 'consumed_date', type: 'string', format: 'date', example: '2026-06-16'),
        new OA\Property(property: 'meal_slot_key', type: 'string', maxLength: 64, example: 'snack'),
        new OA\Property(property: 'slot_title', type: 'string', nullable: true, maxLength: 255, example: 'میان وعده'),
        new OA\Property(property: 'food_title', type: 'string', maxLength: 255, example: 'کیک خانگی'),
        new OA\Property(property: 'food_description', type: 'string', nullable: true, example: 'یک برش متوسط'),
        new OA\Property(property: 'quantity_text', type: 'string', nullable: true, maxLength: 255, example: '۸۰ گرم'),
        new OA\Property(property: 'option_calories', description: 'اگر null/ارسال‌نشده باشد محاسبه AI در صف قرار می‌گیرد؛ اگر مقدار داشته باشد نتیجه تحلیل یا مقدار ویرایش‌شده مستقیم ثبت می‌شود.', type: 'integer', nullable: true, minimum: 0, maximum: 3000, example: 280),
        new OA\Property(property: 'protein_grams', type: 'number', nullable: true, format: 'float', minimum: 0, maximum: 300, example: 5),
        new OA\Property(property: 'fat_grams', type: 'number', nullable: true, format: 'float', minimum: 0, maximum: 300, example: 12),
        new OA\Property(property: 'carbohydrate_grams', type: 'number', nullable: true, format: 'float', minimum: 0, maximum: 600, example: 38),
        new OA\Property(property: 'fiber_grams', type: 'number', nullable: true, format: 'float', minimum: 0, maximum: 150, example: 2),
        new OA\Property(property: 'manual_entry_method', description: 'برای ثبت همراه عکس مقدار photo؛ مقدار پیش‌فرض manual است. حالت photo فقط در صورت فعال بودن قابلیت تحلیل عکس مجاز است.', type: 'string', nullable: true, enum: ['manual', 'photo'], example: 'photo'),
        new OA\Property(property: 'image', description: 'فقط در multipart/form-data؛ jpg, jpeg, png, webp, gif تا 4MB', type: 'string', nullable: true, format: 'binary'),
        new OA\Property(property: 'notes', type: 'string', nullable: true),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionWaterLogStoreRequest',
    required: ['consumed_date', 'glasses'],
    properties: [
        new OA\Property(property: 'consumed_date', type: 'string', format: 'date', example: '2026-06-16'),
        new OA\Property(property: 'glasses', type: 'integer', minimum: 0, maximum: 30, example: 8),
        new OA\Property(property: 'amount_ml', type: 'integer', nullable: true, minimum: 0, maximum: 10000, example: 2000),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionMealReplacementSuggestionRequest',
    description: 'برای meal_slot فقط meal_slot_key لازم است. برای daily_meal علاوه بر meal_slot_key، ارسال day_number و meal_index برای تعیین دقیق وعده روزانه الزامی عملیاتی است.',
    required: ['source_type', 'meal_slot_key'],
    properties: [
        new OA\Property(property: 'source_type', type: 'string', enum: ['meal_slot', 'daily_meal'], example: 'daily_meal'),
        new OA\Property(property: 'meal_slot_key', type: 'string', maxLength: 64, example: 'lunch'),
        new OA\Property(property: 'slot_title', type: 'string', nullable: true, maxLength: 255, example: 'ناهار'),
        new OA\Property(property: 'day_number', description: 'برای source_type=daily_meal؛ شماره روز مطابق day_plans[].day_number.', type: 'integer', nullable: true, minimum: 1, maximum: 365, example: 1),
        new OA\Property(property: 'meal_index', description: 'برای source_type=daily_meal؛ اندیس صفرمبنای وعده در آرایه meals همان روز.', type: 'integer', nullable: true, minimum: 0, maximum: 100, example: 0),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionMealReplacementSuggestionResponse',
    required: ['success', 'message', 'data'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(property: 'message', type: 'string', example: 'در حال ساخت لیست غذاهای جایگزین این وعده با AI هستیم.'),
        new OA\Property(
            property: 'data',
            required: ['suggestion', 'prescription'],
            properties: [
                new OA\Property(property: 'suggestion', ref: '#/components/schemas/NutritionMealReplacementSuggestion'),
                new OA\Property(property: 'prescription', ref: '#/components/schemas/NutritionPrescription'),
            ],
            type: 'object',
        ),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionOtherMealPhotoAnalysisResponse',
    required: ['success', 'message', 'data'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(property: 'message', type: 'string', example: 'تحلیل عکس غذا آماده شد.'),
        new OA\Property(
            property: 'data',
            required: ['analysis'],
            properties: [
                new OA\Property(property: 'analysis', ref: '#/components/schemas/NutritionOtherMealPhotoAnalysis'),
            ],
            type: 'object',
        ),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'NutritionOtherMealPhotoAnalysis',
    description: 'خروجی سرویس AI برای عکس غذای خارج از رژیم. کلیدهای دقیق ممکن است بر اساس مدل کامل تر شوند، اما این فیلدها برای پر کردن فرم ثبت دستی استفاده می شوند.',
    properties: [
        new OA\Property(property: 'food_title', type: 'string', example: 'خوراک مرغ و برنج'),
        new OA\Property(property: 'food_description', type: 'string', nullable: true, example: 'یک بشقاب متوسط'),
        new OA\Property(property: 'quantity_text', type: 'string', nullable: true, example: 'حدود ۳۰۰ گرم'),
        new OA\Property(property: 'option_calories', type: 'integer', nullable: true, example: 620),
        new OA\Property(property: 'protein_grams', type: 'number', nullable: true, format: 'float', example: 38),
        new OA\Property(property: 'fat_grams', type: 'number', nullable: true, format: 'float', example: 19),
        new OA\Property(property: 'carbohydrate_grams', type: 'number', nullable: true, format: 'float', example: 72),
        new OA\Property(property: 'fiber_grams', type: 'number', nullable: true, format: 'float', example: 5),
        new OA\Property(property: 'confidence', type: 'number', nullable: true, format: 'float', example: 0.82),
        new OA\Property(property: 'notes', type: 'string', nullable: true),
    ],
    type: 'object',
)]
final class CustomerNutritionPrescriptionApi
{
}
