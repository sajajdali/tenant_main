<?php

declare(strict_types=1);

namespace App\OpenApi;

use OpenApi\Attributes as OA;

#[OA\Tag(
    name: 'Diet Request Flow',
    description: 'ثبت درخواست رژیم اول و رژیم‌های بعدی',
)]
#[OA\Get(
    path: '/api/v1/app/nutrition/diet-requests/options',
    operationId: 'customerAppDietRequestOptions',
    description: 'داده مسیر دریافت رژیم را برمی‌گرداند: نوع flow، پیش‌نیازها، تنظیمات auto-first، پکیج فعال، موجودی کل/مصرف‌شده/باقی‌مانده رژیم آنلاین و کارشناس، امکان انتخاب هر روش و مسیر مرحله بعد. تصمیم UI باید از همین response گرفته شود، نه از route ثابت. سناریوی رژیم اول بعد از خرید پکیج این است: اگر mindsetCompleted=false باشد، اپ باید پیام «برای دریافت رژیم باید به ۵ سؤال تکمیلی پاسخ دهید» نشان دهد و کاربر را به GET/POST /api/v1/app/membership/mindset ببرد. UI سؤال‌ها باید با انتخاب هر گزینه خودکار به سؤال بعدی برود و نیاز به دکمه مرحله بعد نداشته باشد. بعد از تکمیل mindset، اگر flowType=first_diet و autoFirstDiet.enabled=true و autoFirstDiet.templateAvailable=true و mode ai در modes available=true باشد، اپ نباید صفحه انتخاب «هوش مصنوعی یا کارشناس» و نباید صفحه انتخاب الگو را نشان دهد؛ باید مستقیم صفحه تأیید را باز کند و preview/confirm را با payload {"requestType":"ai"} انجام دهد. در این حالت nutritionDietTemplateId لازم نیست و سرور قالب را resolve می‌کند. قانون تک‌حالته بودن پکیج نیز عمومی است: اگر فقط یکی از modes دارای included=true و remaining>0 باشد، صفحه انتخاب روش هیچ‌وقت نباید نمایش داده شود؛ مخصوصاً اگر پکیج فقط رژیم آنلاین/AI دارد، در رژیم اول و رژیم‌های بعدی مرحله انتخاب AI/کارشناس حذف می‌شود و اپ مستقیم وارد nextStep همان mode می‌شود. این endpoint هیچ سهمیه‌ای مصرف نمی‌کند.',
    security: [['bearerAuth' => []]],
    tags: ['Diet Request Flow'],
    responses: [
        new OA\Response(
            response: 200,
            description: 'Diet request choices and current balance',
            content: new OA\JsonContent(ref: '#/components/schemas/DietRequestOptionsResponse'),
        ),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 423, description: 'Nutrition access is locked for this user'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/nutrition/diet-requests/preview',
    operationId: 'customerAppDietRequestPreview',
    description: 'پیش‌نمایش دقیق صفحه تأیید را می‌سازد و باید قبل از هر POST نهایی صدا زده شود. بعد از خرید پکیج و پاسخ به ۵ سؤال mindset، اگر auto-first برقرار است اپ باید این endpoint را با payload {"requestType":"ai"} صدا بزند و داده برگشتی را در صفحه تأیید نشان دهد؛ صفحه انتخاب «هوش مصنوعی یا کارشناس» و صفحه انتخاب الگو در این مسیر ممنوع است. اگر autoFirstDiet.enabled=true و autoFirstDiet.templateAvailable=true باشد، برای اولین رژیم آنلاین nutritionDietTemplateId لازم نیست و سرور قالب خودکار را resolve کرده و در request.dietTemplate برمی‌گرداند. اگر سرور nutritionDietTemplateId را لازم دانست، فقط در این حالت اپ به انتخاب دستی الگو برمی‌گردد. برای رژیم دوم به بعد auto-first اعمال نمی‌شود، اما اگر پکیج فقط یک mode قابل استفاده دارد باز هم صفحه انتخاب mode حذف می‌شود و preview با همان mode انجام می‌شود. تمام قواعد ثبت نهایی بررسی می‌شوند، اما هیچ درخواست، لاگ وزن یا مصرف سهمیه‌ای ثبت نمی‌شود.',
    security: [['bearerAuth' => []]],
    tags: ['Diet Request Flow'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            oneOf: [
                new OA\Schema(ref: '#/components/schemas/FirstAiDietRequest'),
                new OA\Schema(ref: '#/components/schemas/FirstExpertDietRequest'),
                new OA\Schema(ref: '#/components/schemas/FollowUpAiDietRequest'),
                new OA\Schema(ref: '#/components/schemas/FollowUpExpertDietRequest'),
            ],
            examples: [
                new OA\Examples(
                    example: 'auto_first_ai',
                    summary: 'پیش‌نمایش رژیم اول آنلاین با قالب خودکار',
                    value: [
                        'requestType' => 'ai',
                    ],
                ),
                new OA\Examples(
                    example: 'ai_with_template',
                    summary: 'پیش‌نمایش رژیم آنلاین با قالب انتخابی',
                    value: [
                        'requestType' => 'ai',
                        'nutritionDietTemplateId' => 12,
                    ],
                ),
                new OA\Examples(
                    example: 'expert',
                    summary: 'پیش‌نمایش رژیم توسط کارشناس',
                    value: [
                        'requestType' => 'expert',
                        'expertDescription' => 'غذاهای ساده و قابل حمل را ترجیح می‌دهم.',
                    ],
                ),
            ],
        ),
    ),
    responses: [
        new OA\Response(
            response: 200,
            description: 'Read-only preview; quota is unchanged',
            content: new OA\JsonContent(ref: '#/components/schemas/DietRequestPreviewResponse'),
        ),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 423, description: 'Nutrition access is locked for this user'),
        new OA\Response(response: 422, description: 'The selection cannot be confirmed under the current profile, package, quota, template, active-request, or follow-up rules'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/nutrition/diet-templates',
    operationId: 'customerAppFirstDietTemplates',
    description: 'الگوهای فعال قابل انتخاب برای اولین درخواست رژیم آنلاین را به شکل درختی برمی‌گرداند. این endpoint فقط وقتی لازم است که requestType برابر ai باشد. برای فیلتر کردن الگوها بر اساس هدف ثبت‌شده کاربر، dietGoal را در query goal بفرستید. فقط آیتم نهایی بدون children باید به عنوان nutritionDietTemplateId ثبت شود.',
    security: [['bearerAuth' => []]],
    tags: ['Diet Request Flow'],
    parameters: [
        new OA\Parameter(
            name: 'goal',
            description: 'هدف رژیم ثبت‌شده در پروفایل.',
            in: 'query',
            required: false,
            schema: new OA\Schema(type: 'string', enum: ['lose-weight', 'gain-weight', 'maintain-weight']),
            example: 'lose-weight',
        ),
    ],
    responses: [
        new OA\Response(
            response: 200,
            description: 'Active diet template tree',
            content: new OA\JsonContent(ref: '#/components/schemas/FirstDietTemplateListResponse'),
        ),
        new OA\Response(response: 401, description: 'Unauthenticated'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/nutrition/diet-requests',
    operationId: 'customerAppDietRequestsIndex',
    description: 'درخواست‌های رژیم کاربر را برمی‌گرداند. قبل از شروع مرحله اول، اگر آیتمی با status برابر sent یا in_progress یا not_sent وجود داشته باشد، درخواست جدید نباید ثبت شود. وجود prescription قبلی یعنی درخواست بعدی دیگر first-diet نیست و باید با قرارداد follow-up رژیم دوم به بعد ادامه پیدا کند.',
    security: [['bearerAuth' => []]],
    tags: ['Diet Request Flow'],
    parameters: [
        new OA\Parameter(
            name: 'per_page',
            description: 'تعداد درخواست‌ها در هر صفحه.',
            in: 'query',
            required: false,
            schema: new OA\Schema(type: 'integer', default: 20, minimum: 1),
            example: 20,
        ),
    ],
    responses: [
        new OA\Response(
            response: 200,
            description: 'Customer diet requests',
            content: new OA\JsonContent(ref: '#/components/schemas/FirstDietRequestListResponse'),
        ),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 423, description: 'Nutrition access is locked for this user'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/nutrition/diet-requests',
    operationId: 'customerAppFirstDietRequestStore',
    description: 'مرحله تأیید نهایی صفحه preview است. همان payload تأییدشده preview دوباره بررسی می‌شود و سپس داخل transaction درخواست رژیم ثبت و دقیقاً یک سهمیه از روش انتخابی مصرف می‌شود. برای اولین رژیم آنلاین اگر autoFirstDiet.enabled=true و autoFirstDiet.templateAvailable=true باشد، nutritionDietTemplateId اختیاری است و payload {"requestType":"ai"} کافی است؛ سرور قالب خودکار را انتخاب می‌کند. در این مسیر اپ فقط بعد از نمایش صفحه تأیید حق دارد این POST را بزند و نباید قبل از آن صفحه انتخاب AI/کارشناس یا انتخاب الگو نشان دهد. بعد از موفقیت، اپ باید پیام «رژیم شما در حال تجویز است» نشان دهد و صفحه پروفایل را دوباره بگیرد؛ در /api/v1/app/nutrition/profile مقدار dashboard.state برابر prescribing و dietAction.type برابر prescribing می‌شود تا کاربر تا زمان تأیید/انتشار کارشناس رژیم جدیدی ثبت نکند. بعد از تأیید کارشناس و publish نسخه، profile به view_current_diet تغییر می‌کند و رژیم در اپ قابل مشاهده است. رژیم دوم به بعد هیچ‌وقت auto-first نیست و ابتدا باید currentWeightKg و سؤال‌های follow-up پرسیده شود؛ سپس روش/قالب طبق modes انتخاب می‌شود. اگر پکیج فقط یک mode قابل استفاده داشته باشد، صفحه انتخاب روش حتی در رژیم‌های بعدی هم نباید نمایش داده شود و اپ مستقیم مسیر همان mode را ادامه می‌دهد. مسیر follow-up شامل ۱۵ مرحله است: currentWeightKg، سیزده پاسخ repeatDietFeedback، و مرحله بیماری/دارو در /nutrition/diet-followup/15. این ۱۳ سؤال جداگانه در دیتابیس ذخیره یا جداگانه submit نمی‌شوند؛ همه جواب‌ها در یک object به نام repeatDietFeedback ارسال می‌شوند و سرور آن object را در snapshot درخواست ذخیره می‌کند. در مرحله بیماری، repeatDietMedicalConditionsItems ساختار اصلی است و repeatDietMedicalNotes summary سازگار با نسخه قبلی را نگه می‌دارد.',
    security: [['bearerAuth' => []]],
    tags: ['Diet Request Flow'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            oneOf: [
                new OA\Schema(ref: '#/components/schemas/FirstAiDietRequest'),
                new OA\Schema(ref: '#/components/schemas/FirstExpertDietRequest'),
                new OA\Schema(ref: '#/components/schemas/FollowUpAiDietRequest'),
                new OA\Schema(ref: '#/components/schemas/FollowUpExpertDietRequest'),
            ],
            examples: [
                new OA\Examples(
                    example: 'auto_first_ai',
                    summary: 'اولین رژیم آنلاین با قالب خودکار',
                    value: [
                        'requestType' => 'ai',
                    ],
                ),
                new OA\Examples(
                    example: 'ai_with_template',
                    summary: 'اولین رژیم آنلاین با قالب انتخابی',
                    value: [
                        'requestType' => 'ai',
                        'nutritionDietTemplateId' => 12,
                    ],
                ),
                new OA\Examples(
                    example: 'expert',
                    summary: 'اولین رژیم اختصاصی توسط کارشناس',
                    value: [
                        'requestType' => 'expert',
                        'expertDescription' => 'غذاهای ساده و قابل حمل را ترجیح می‌دهم.',
                    ],
                ),
                new OA\Examples(
                    example: 'follow_up_ai',
                    summary: 'رژیم دوم به بعد - آنلاین',
                    value: [
                        'requestType' => 'ai',
                        'nutritionDietTemplateId' => 12,
                        'currentWeightKg' => 76.5,
                        'repeatDietFeedback' => [
                            'adherenceLevel' => 'بیشتر مواقع رعایت کردم (۷۰–۹۰٪)',
                            'weightOutcome' => 'کاهش وزن مناسب',
                            'sizeChange' => 'کمی کاهش',
                            'energyLevel' => 'خوب',
                            'satietyLevel' => 'معمولاً سیر می‌شدم',
                            'cravingsLevel' => 'کم',
                            'sleepQuality' => 'خوب',
                            'activityLevel' => 'متوسط (چند بار در هفته)',
                            'dietDifficulty' => 'متوسط',
                            'overallSatisfaction' => 'راضی',
                            'newDietPreference' => 'متعادل',
                            'experiencedIssue' => 'هیچکدام',
                            'foodPreference' => 'غذاهای ساده و سریع',
                        ],
                        'repeatDietMedicalNotes' => 'مورد خاصی ندارم.',
                        'repeatDietMedicalConditionsItems' => [],
                    ],
                ),
                new OA\Examples(
                    example: 'follow_up_expert',
                    summary: 'رژیم دوم به بعد - کارشناس',
                    value: [
                        'requestType' => 'expert',
                        'expertDescription' => 'در برنامه جدید غذای قابل حمل بیشتری می‌خواهم.',
                        'currentWeightKg' => 76.5,
                        'repeatDietFeedback' => [
                            'adherenceLevel' => 'بیشتر مواقع رعایت کردم (۷۰–۹۰٪)',
                            'weightOutcome' => 'کاهش وزن مناسب',
                            'sizeChange' => 'کمی کاهش',
                            'energyLevel' => 'خوب',
                            'satietyLevel' => 'معمولاً سیر می‌شدم',
                            'cravingsLevel' => 'کم',
                            'sleepQuality' => 'خوب',
                            'activityLevel' => 'متوسط (چند بار در هفته)',
                            'dietDifficulty' => 'متوسط',
                            'overallSatisfaction' => 'راضی',
                            'newDietPreference' => 'متعادل',
                            'experiencedIssue' => 'هیچکدام',
                            'foodPreference' => 'غذاهای ساده و سریع',
                        ],
                        'repeatDietMedicalNotes' => 'کم‌کاری تیروئید [فعلی] (از 2025-02-01، ادامه‌دار) - روزانه لووتیروکسین مصرف می‌کنم.',
                        'repeatDietMedicalConditionsItems' => [
                            [
                                'title' => 'کم‌کاری تیروئید',
                                'status' => 'current',
                                'startedAt' => '2025-02-01',
                                'endedAt' => null,
                                'ongoing' => true,
                                'notes' => 'روزانه لووتیروکسین مصرف می‌کنم.',
                            ],
                        ],
                    ],
                ),
            ],
        ),
    ),
    responses: [
        new OA\Response(
            response: 200,
            description: 'First diet request created',
            content: new OA\JsonContent(ref: '#/components/schemas/FirstDietRequestStoreResponse'),
        ),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 423, description: 'Nutrition access is locked for this user'),
        new OA\Response(
            response: 422,
            description: 'Validation or business rule error: incomplete profile/mindset, no active subscription, exhausted quota, invalid template, or another active diet request',
        ),
    ],
)]
#[OA\Schema(
    schema: 'NutritionPackageSubscriptionBalance',
    required: [
        'id',
        'status',
        'onlineDietTotal',
        'onlineDietUsed',
        'offlineDietTotal',
        'offlineDietUsed',
        'onlineDietRemaining',
        'offlineDietRemaining',
    ],
    properties: [
        new OA\Property(property: 'id', type: 'string', example: '31'),
        new OA\Property(property: 'status', type: 'string', example: 'active'),
        new OA\Property(property: 'startsAt', type: 'string', format: 'date', nullable: true, example: '2026-07-01'),
        new OA\Property(property: 'endsAt', type: 'string', format: 'date', nullable: true, example: '2026-09-29'),
        new OA\Property(property: 'onlineDietTotal', type: 'integer', example: 3),
        new OA\Property(property: 'onlineDietUsed', type: 'integer', example: 1),
        new OA\Property(property: 'onlineDietRemaining', type: 'integer', example: 2),
        new OA\Property(property: 'offlineDietTotal', type: 'integer', example: 1),
        new OA\Property(property: 'offlineDietUsed', type: 'integer', example: 0),
        new OA\Property(property: 'offlineDietRemaining', type: 'integer', example: 1),
        new OA\Property(property: 'priceAmount', type: 'integer', example: 1200000),
        new OA\Property(property: 'payableAmount', type: 'integer', example: 1200000),
        new OA\Property(property: 'package', type: 'object', nullable: true),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'DietRequestModeOption',
    required: ['key', 'included', 'total', 'used', 'remaining', 'available', 'nextStep'],
    properties: [
        new OA\Property(property: 'key', type: 'string', enum: ['ai', 'expert'], example: 'ai'),
        new OA\Property(property: 'included', type: 'boolean', example: true),
        new OA\Property(property: 'total', type: 'integer', example: 3),
        new OA\Property(property: 'used', type: 'integer', example: 1),
        new OA\Property(property: 'remaining', type: 'integer', example: 2),
        new OA\Property(property: 'available', type: 'boolean', example: true),
        new OA\Property(property: 'nextStep', description: 'مسیر پیشنهادی همان mode. اگر فقط همین mode قابل استفاده باشد، اپ باید مستقیم به این مسیر برود و صفحه انتخاب mode را نشان ندهد.', type: 'string', example: '/nutrition/select-diet'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'DietRequestOptionsResponse',
    required: ['success', 'data'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
        new OA\Property(
            property: 'data',
            required: [
                'flowType',
                'hasDietHistory',
                'requiresFollowUpQuestions',
                'requirements',
                'autoFirstDiet',
                'modes',
                'canChooseMode',
                'nextStep',
                'previewEndpoint',
                'confirmEndpoint',
            ],
            properties: [
                new OA\Property(property: 'flowType', type: 'string', enum: ['first_diet', 'follow_up'], example: 'first_diet'),
                new OA\Property(property: 'hasDietHistory', type: 'boolean', example: false),
                new OA\Property(property: 'requiresFollowUpQuestions', type: 'boolean', example: false),
                new OA\Property(
                    property: 'requirements',
                    required: ['profileCompleted', 'activePackage', 'mindsetCompleted', 'hasActiveDietRequest'],
                    properties: [
                        new OA\Property(property: 'profileCompleted', type: 'boolean', example: true),
                        new OA\Property(property: 'activePackage', type: 'boolean', example: true),
                        new OA\Property(property: 'mindsetCompleted', type: 'boolean', example: true),
                        new OA\Property(property: 'hasActiveDietRequest', type: 'boolean', example: false),
                    ],
                    type: 'object',
                ),
                new OA\Property(
                    property: 'autoFirstDiet',
                    description: 'تنظیمات و قابلیت اجرای خودکار رژیم اول. فقط برای flowType=first_diet معنی دارد؛ رژیم دوم به بعد باید مسیر انتخاب دستی/سؤال‌های follow-up را طی کند.',
                    required: ['enabled', 'requiresApproval', 'templateAvailable'],
                    properties: [
                        new OA\Property(property: 'enabled', description: 'برابر تنظیم autoFirstDietEnabled در پنل تنظیمات تغذیه.', type: 'boolean', example: true),
                        new OA\Property(property: 'requiresApproval', description: 'اگر true باشد درخواست بعد از ثبت برای تأیید/انتشار کارشناس نگه داشته می‌شود.', type: 'boolean', example: true),
                        new OA\Property(property: 'templateAvailable', description: 'وقتی true باشد سرور برای هدف/پکیج کاربر قالب معتبر دارد و preview/confirm رژیم اول آنلاین می‌تواند بدون nutritionDietTemplateId انجام شود.', type: 'boolean', example: true),
                    ],
                    type: 'object',
                ),
                new OA\Property(property: 'subscription', ref: '#/components/schemas/NutritionPackageSubscriptionBalance', nullable: true),
                new OA\Property(property: 'modes', type: 'array', items: new OA\Items(ref: '#/components/schemas/DietRequestModeOption')),
                new OA\Property(property: 'activeRequest', type: 'object', nullable: true),
                new OA\Property(property: 'canChooseMode', type: 'boolean', example: true),
                new OA\Property(property: 'nextStep', description: 'برای رژیم اول پس از خرید پکیج: اگر mindset کامل نیست /nutrition/membership/mindset/1؛ اگر auto-first فعال و قالب معتبر موجود است /nutrition/diet-request/confirm؛ در غیر این صورت /nutrition/diet-type. اگر فقط یک mode قابل استفاده در modes وجود دارد، اپ باید از nextStep همان mode استفاده کند و /nutrition/diet-type را نشان ندهد.', type: 'string', nullable: true, example: '/nutrition/diet-request/confirm'),
                new OA\Property(property: 'previewEndpoint', type: 'string', example: '/api/v1/app/nutrition/diet-requests/preview'),
                new OA\Property(property: 'confirmEndpoint', type: 'string', example: '/api/v1/app/nutrition/diet-requests'),
            ],
            type: 'object',
        ),
        new OA\Property(property: 'meta', type: 'object'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'DietRequestPreviewResponse',
    required: ['success', 'message', 'data'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(property: 'message', type: 'string', example: 'پیش‌نمایش درخواست رژیم آماده است.'),
        new OA\Property(
            property: 'data',
            required: ['flowType', 'request', 'balance', 'subscription', 'canConfirm', 'confirmEndpoint'],
            properties: [
                new OA\Property(property: 'flowType', type: 'string', enum: ['first_diet', 'follow_up'], example: 'first_diet'),
                new OA\Property(
                    property: 'request',
                    required: ['requestType', 'dietTemplate', 'expertDescription', 'currentWeightKg', 'dietGoal', 'followUp'],
                    properties: [
                        new OA\Property(property: 'requestType', type: 'string', enum: ['ai', 'expert'], example: 'ai'),
                        new OA\Property(property: 'dietTemplate', type: 'object', nullable: true, example: ['id' => '12', 'name' => 'رژیم کاهش وزن متعادل', 'durationDays' => 30]),
                        new OA\Property(property: 'expertDescription', type: 'string', nullable: true, example: null),
                new OA\Property(property: 'currentWeightKg', type: 'number', format: 'float', nullable: true, example: 78.5),
                new OA\Property(property: 'dietGoal', type: 'string', nullable: true, example: 'lose-weight'),
                new OA\Property(property: 'followUp', ref: '#/components/schemas/DietRequestFollowUpPayload', nullable: true),
                    ],
                    type: 'object',
                ),
                new OA\Property(
                    property: 'balance',
                    required: ['mode', 'total', 'used', 'remaining', 'remainingAfterConfirmation'],
                    properties: [
                        new OA\Property(property: 'mode', type: 'string', enum: ['ai', 'expert'], example: 'ai'),
                        new OA\Property(property: 'total', type: 'integer', example: 3),
                        new OA\Property(property: 'used', type: 'integer', example: 1),
                        new OA\Property(property: 'remaining', type: 'integer', example: 2),
                        new OA\Property(property: 'remainingAfterConfirmation', type: 'integer', example: 1),
                    ],
                    type: 'object',
                ),
                new OA\Property(property: 'subscription', ref: '#/components/schemas/NutritionPackageSubscriptionBalance'),
                new OA\Property(property: 'canConfirm', type: 'boolean', example: true),
                new OA\Property(property: 'confirmEndpoint', type: 'string', example: '/api/v1/app/nutrition/diet-requests'),
            ],
            type: 'object',
        ),
        new OA\Property(property: 'meta', type: 'object'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'DietRequestFollowUpMedicalConditionItem',
    required: ['title'],
    properties: [
        new OA\Property(property: 'id', type: 'string', nullable: true, example: 'condition_9x2k1a'),
        new OA\Property(property: 'title', type: 'string', example: 'کم‌کاری تیروئید'),
        new OA\Property(property: 'status', type: 'string', enum: ['current', 'past', 'temporary'], example: 'current'),
        new OA\Property(property: 'startedAt', type: 'string', format: 'date', nullable: true, example: '2025-02-01'),
        new OA\Property(property: 'endedAt', type: 'string', format: 'date', nullable: true, example: null),
        new OA\Property(property: 'ongoing', type: 'boolean', example: true),
        new OA\Property(property: 'notes', type: 'string', nullable: true, example: 'روزانه لووتیروکسین مصرف می‌کنم.'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'DietRequestFollowUpStepGuide',
    description: 'راهنمای هر مرحله از فرم رژیم دوم به بعد. این schema برای مستندسازی UI/Swagger است؛ endpoint جداگانه‌ای برای ذخیره هر مرحله وجود ندارد.',
    required: ['step', 'field', 'type', 'question', 'description'],
    properties: [
        new OA\Property(property: 'step', type: 'integer', minimum: 1, maximum: 15, example: 2),
        new OA\Property(property: 'field', description: 'نام فیلدی که در payload نهایی استفاده می‌شود. سؤال‌های ۲ تا ۱۴ داخل repeatDietFeedback قرار می‌گیرند.', type: 'string', example: 'repeatDietFeedback.adherenceLevel'),
        new OA\Property(property: 'type', type: 'string', enum: ['number', 'choice', 'medical_conditions'], example: 'choice'),
        new OA\Property(property: 'question', type: 'string', example: 'در طول رژیم چقدر به رژیم پایبند بودید؟'),
        new OA\Property(property: 'description', type: 'string', example: 'این پاسخ کمک می‌کند شدت و انعطاف نسخه بعدی بهتر تنظیم شود.'),
        new OA\Property(property: 'helper', type: 'string', nullable: true, example: null),
        new OA\Property(
            property: 'options',
            description: 'برای type=choice مقدار ارسالی باید یکی از همین labelها باشد. کلاینت وب همین متن label را در repeatDietFeedback ذخیره می‌کند.',
            type: 'array',
            nullable: true,
            items: new OA\Items(type: 'string'),
            example: ['کاملاً طبق برنامه (۹۰٪ به بالا)', 'بیشتر مواقع رعایت کردم (۷۰–۹۰٪)', 'متوسط (۴۰–۷۰٪)', 'کم رعایت کردم (زیر ۴۰٪)'],
        ),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'DietRequestFollowUpFlowGuide',
    description: 'راهنمای کامل ۱۵ مرحله رژیم دوم به بعد. ترتیب UI دقیقاً همین است: مرحله ۱ وزن فعلی، مراحل ۲ تا ۱۴ سیزده سؤال choice داخل repeatDietFeedback، مرحله ۱۵ وضعیت بیماری/دارو. در وب هر پاسخ موقتاً در sessionStorage نگه داشته می‌شود و فقط هنگام POST نهایی diet-requests همه داده‌ها یکجا ذخیره می‌شوند.',
    required: ['totalSteps', 'storageBehavior', 'submitEndpoint', 'finalPayloadShape', 'steps'],
    properties: [
        new OA\Property(property: 'totalSteps', type: 'integer', example: 15),
        new OA\Property(property: 'storageBehavior', type: 'string', example: 'هر مرحله در وب موقتاً در sessionStorage ذخیره می‌شود؛ دیتابیس فقط هنگام ثبت نهایی آپدیت می‌شود.'),
        new OA\Property(property: 'submitEndpoint', type: 'string', example: 'POST /api/v1/app/nutrition/diet-requests'),
        new OA\Property(property: 'finalPayloadShape', type: 'string', example: 'currentWeightKg + repeatDietFeedback object شامل ۱۳ پاسخ + repeatDietMedicalNotes/repeatDietMedicalConditionsItems'),
        new OA\Property(
            property: 'steps',
            type: 'array',
            items: new OA\Items(ref: '#/components/schemas/DietRequestFollowUpStepGuide'),
            example: [
                [
                    'step' => 1,
                    'field' => 'currentWeightKg',
                    'type' => 'number',
                    'question' => 'وزن فعلی جدید خودتان را وارد کنید',
                    'description' => 'برای تجویز رژیم جدید، وزن فعلی شما باید به‌روز باشد تا محاسبات نسخه بعدی دقیق انجام شود.',
                    'helper' => 'وزن را به کیلوگرم وارد کنید. مثال: ۷۶ یا ۷۶.۵',
                    'options' => null,
                ],
                [
                    'step' => 2,
                    'field' => 'repeatDietFeedback.adherenceLevel',
                    'type' => 'choice',
                    'question' => 'در طول رژیم چقدر به رژیم پایبند بودید؟',
                    'description' => 'این پاسخ کمک می‌کند شدت و انعطاف نسخه بعدی بهتر تنظیم شود.',
                    'helper' => null,
                    'options' => ['کاملاً طبق برنامه (۹۰٪ به بالا)', 'بیشتر مواقع رعایت کردم (۷۰–۹۰٪)', 'متوسط (۴۰–۷۰٪)', 'کم رعایت کردم (زیر ۴۰٪)'],
                ],
                [
                    'step' => 3,
                    'field' => 'repeatDietFeedback.weightOutcome',
                    'type' => 'choice',
                    'question' => 'نتیجه شما از نظر وزن چی بوده؟',
                    'description' => 'می‌خواهیم بدانیم نسخه قبلی از نظر نتیجه وزنی چقدر موثر بوده است.',
                    'helper' => null,
                    'options' => ['کاهش وزن عالی (بیشتر از انتظار)', 'کاهش وزن مناسب', 'کاهش وزن کم', 'بدون تغییر', 'افزایش وزن'],
                ],
                [
                    'step' => 4,
                    'field' => 'repeatDietFeedback.sizeChange',
                    'type' => 'choice',
                    'question' => 'تغییر سایز شما چطور بوده؟',
                    'description' => 'مثلاً دور شکم، ران یا فرم لباس‌ها در این بخش ارزیابی می‌شود.',
                    'helper' => null,
                    'options' => ['کاهش محسوس', 'کمی کاهش', 'بدون تغییر', 'افزایش'],
                ],
                [
                    'step' => 5,
                    'field' => 'repeatDietFeedback.energyLevel',
                    'type' => 'choice',
                    'question' => 'در طول رژیم، سطح انرژی شما چطور بود؟',
                    'description' => 'این بخش به تنظیم کالری، وعده‌ها و حجم غذا در نسخه بعدی کمک می‌کند.',
                    'helper' => null,
                    'options' => ['خیلی خوب (سرحال و پرانرژی)', 'خوب', 'متوسط', 'کم‌انرژی', 'خیلی خسته و بی‌حال'],
                ],
                [
                    'step' => 6,
                    'field' => 'repeatDietFeedback.satietyLevel',
                    'type' => 'choice',
                    'question' => 'بعد از غذا خوردن چقدر احساس سیری داشتید؟',
                    'description' => 'اگر سیری کافی نداشته‌اید، نسخه بعدی باید از نظر ترکیب وعده‌ها بازتنظیم شود.',
                    'helper' => null,
                    'options' => ['کاملاً سیر می‌شدم', 'معمولاً سیر می‌شدم', 'بعضی وقت‌ها گرسنه می‌موندم', 'اغلب گرسنه بودم'],
                ],
                [
                    'step' => 7,
                    'field' => 'repeatDietFeedback.cravingsLevel',
                    'type' => 'choice',
                    'question' => 'چقدر دچار هوس یا ریزه‌خواری می‌شدید؟',
                    'description' => 'شدت هوس‌های غذایی روی انتخاب میان‌وعده و سبک برنامه بعدی اثر می‌گذارد.',
                    'helper' => null,
                    'options' => ['اصلاً', 'کم', 'متوسط', 'زیاد', 'خیلی زیاد'],
                ],
                [
                    'step' => 8,
                    'field' => 'repeatDietFeedback.sleepQuality',
                    'type' => 'choice',
                    'question' => 'کیفیت خواب شما در این مدت چطور بود؟',
                    'description' => 'خواب یکی از عوامل موثر در نتیجه رژیم و سطح اشتهاست.',
                    'helper' => null,
                    'options' => ['عالی', 'خوب', 'متوسط', 'ضعیف'],
                ],
                [
                    'step' => 9,
                    'field' => 'repeatDietFeedback.activityLevel',
                    'type' => 'choice',
                    'question' => 'در طول این مدت چقدر فعالیت بدنی داشتید؟',
                    'description' => 'فعالیت بدنی شما می‌تواند نیاز کالری و ساختار رژیم جدید را تغییر دهد.',
                    'helper' => null,
                    'options' => ['زیاد (ورزش منظم)', 'متوسط (چند بار در هفته)', 'کم', 'تقریباً هیچ'],
                ],
                [
                    'step' => 10,
                    'field' => 'repeatDietFeedback.dietDifficulty',
                    'type' => 'choice',
                    'question' => 'رژیم قبلی برای شما چقدر سخت بود؟',
                    'description' => 'این بخش شدت فشار نسخه قبلی را مشخص می‌کند تا نسخه بعدی واقع‌بینانه‌تر باشد.',
                    'helper' => null,
                    'options' => ['خیلی راحت', 'نسبتاً راحت', 'متوسط', 'سخت', 'خیلی سخت'],
                ],
                [
                    'step' => 11,
                    'field' => 'repeatDietFeedback.overallSatisfaction',
                    'type' => 'choice',
                    'question' => 'چقدر از رژیم قبلی راضی بودید؟',
                    'description' => 'رضایت کلی شما جهت نسخه بعدی و حفظ انگیزه بسیار مهم است.',
                    'helper' => null,
                    'options' => ['خیلی راضی', 'راضی', 'متوسط', 'ناراضی'],
                ],
                [
                    'step' => 12,
                    'field' => 'repeatDietFeedback.newDietPreference',
                    'type' => 'choice',
                    'question' => 'دوست دارید رژیم جدید چطور باشد؟',
                    'description' => 'این ترجیح به ما می‌گوید نسخه جدید را سریع‌تر، متعادل‌تر یا قابل‌ادامه‌تر تنظیم کنیم.',
                    'helper' => null,
                    'options' => ['سخت‌تر ولی سریع‌تر نتیجه بده', 'متعادل', 'راحت‌تر و قابل‌ادامه‌تر'],
                ],
                [
                    'step' => 13,
                    'field' => 'repeatDietFeedback.experiencedIssue',
                    'type' => 'choice',
                    'question' => 'در طول رژیم با مشکل خاصی مواجه شدید؟',
                    'description' => 'اگر مشکلی داشته‌اید، رژیم بعدی باید برای کاهش آن تنظیم شود.',
                    'helper' => null,
                    'options' => ['ضعف و بی‌حالی', 'یبوست', 'گرسنگی شدید', 'بی‌حوصلگی', 'هیچکدام'],
                ],
                [
                    'step' => 14,
                    'field' => 'repeatDietFeedback.foodPreference',
                    'type' => 'choice',
                    'question' => 'در رژیم جدید کدام را ترجیح می‌دهید؟',
                    'description' => 'این ترجیح به شخصی‌سازی سبک غذاهای نسخه جدید کمک می‌کند.',
                    'helper' => null,
                    'options' => ['غذاهای ساده و سریع', 'غذاهای متنوع‌تر', 'رژیم شبیه غذای خانواده', 'مهم نیست'],
                ],
                [
                    'step' => 15,
                    'field' => 'repeatDietMedicalConditionsItems / repeatDietMedicalNotes',
                    'type' => 'medical_conditions',
                    'question' => 'اگر بیماری خاصی دارید یا داروی خاصی مصرف می‌کنید، اینجا ثبت کنید',
                    'description' => 'این بخش برای نسخه‌های بعدی مهم است. اگر موردی ندارید، بدون افزودن بیماری ادامه دهید.',
                    'helper' => 'repeatDietMedicalConditionsItems ساختار اصلی است؛ repeatDietMedicalNotes summary سازگار با نسخه قبلی است. اگر موردی ندارد، متن summary می‌تواند «ندارم» باشد.',
                    'options' => null,
                ],
            ],
        ),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'DietRequestFollowUpPayload',
    description: 'نمای read-only داده follow-up در preview. این آبجکت نتیجه ۱۵ مرحله UI است و نشان می‌دهد ۱۳ سؤال داخل answers یکجا نگهداری می‌شوند. برای دیدن متن کامل مراحل و گزینه‌ها schema DietRequestFollowUpFlowGuide را ببینید.',
    required: ['currentWeightKg', 'medicalNotes', 'medicalConditionsItems', 'answers'],
    properties: [
        new OA\Property(property: 'currentWeightKg', type: 'number', format: 'float', example: 76.5),
        new OA\Property(property: 'medicalNotes', type: 'string', example: 'کم‌کاری تیروئید [فعلی] (از 2025-02-01، ادامه‌دار) - روزانه لووتیروکسین مصرف می‌کنم.'),
        new OA\Property(
            property: 'medicalConditionsItems',
            type: 'array',
            items: new OA\Items(ref: '#/components/schemas/DietRequestFollowUpMedicalConditionItem'),
        ),
        new OA\Property(property: 'answers', ref: '#/components/schemas/DietRequestFollowUpAnswers'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'DietRequestFollowUpAnswers',
    description: '۱۳ پاسخ مربوط به رژیم قبلی. این فیلدها endpoint یا رکورد جداگانه ندارند؛ کل آبجکت به عنوان repeatDietFeedback همراه ثبت نهایی درخواست رژیم ارسال و در snapshot درخواست ذخیره می‌شود.',
    required: [
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
    ],
    properties: [
        new OA\Property(property: 'adherenceLevel', description: 'مرحله ۲ follow-up، سؤال: «در طول رژیم چقدر به رژیم پایبند بودید؟»', type: 'string', enum: ['کاملاً طبق برنامه (۹۰٪ به بالا)', 'بیشتر مواقع رعایت کردم (۷۰–۹۰٪)', 'متوسط (۴۰–۷۰٪)', 'کم رعایت کردم (زیر ۴۰٪)'], example: 'بیشتر مواقع رعایت کردم (۷۰–۹۰٪)'),
        new OA\Property(property: 'weightOutcome', description: 'مرحله ۳ follow-up، سؤال: «نتیجه شما از نظر وزن چی بوده؟»', type: 'string', enum: ['کاهش وزن عالی (بیشتر از انتظار)', 'کاهش وزن مناسب', 'کاهش وزن کم', 'بدون تغییر', 'افزایش وزن'], example: 'کاهش وزن مناسب'),
        new OA\Property(property: 'sizeChange', description: 'مرحله ۴ follow-up، سؤال: «تغییر سایز شما چطور بوده؟»', type: 'string', enum: ['کاهش محسوس', 'کمی کاهش', 'بدون تغییر', 'افزایش'], example: 'کمی کاهش'),
        new OA\Property(property: 'energyLevel', description: 'مرحله ۵ follow-up، سؤال: «در طول رژیم، سطح انرژی شما چطور بود؟»', type: 'string', enum: ['خیلی خوب (سرحال و پرانرژی)', 'خوب', 'متوسط', 'کم‌انرژی', 'خیلی خسته و بی‌حال'], example: 'خوب'),
        new OA\Property(property: 'satietyLevel', description: 'مرحله ۶ follow-up، سؤال: «بعد از غذا خوردن چقدر احساس سیری داشتید؟»', type: 'string', enum: ['کاملاً سیر می‌شدم', 'معمولاً سیر می‌شدم', 'بعضی وقت‌ها گرسنه می‌موندم', 'اغلب گرسنه بودم'], example: 'معمولاً سیر می‌شدم'),
        new OA\Property(property: 'cravingsLevel', description: 'مرحله ۷ follow-up، سؤال: «چقدر دچار هوس یا ریزه‌خواری می‌شدید؟»', type: 'string', enum: ['اصلاً', 'کم', 'متوسط', 'زیاد', 'خیلی زیاد'], example: 'کم'),
        new OA\Property(property: 'sleepQuality', description: 'مرحله ۸ follow-up، سؤال: «کیفیت خواب شما در این مدت چطور بود؟»', type: 'string', enum: ['عالی', 'خوب', 'متوسط', 'ضعیف'], example: 'خوب'),
        new OA\Property(property: 'activityLevel', description: 'مرحله ۹ follow-up، سؤال: «در طول این مدت چقدر فعالیت بدنی داشتید؟»', type: 'string', enum: ['زیاد (ورزش منظم)', 'متوسط (چند بار در هفته)', 'کم', 'تقریباً هیچ'], example: 'متوسط (چند بار در هفته)'),
        new OA\Property(property: 'dietDifficulty', description: 'مرحله ۱۰ follow-up، سؤال: «رژیم قبلی برای شما چقدر سخت بود؟»', type: 'string', enum: ['خیلی راحت', 'نسبتاً راحت', 'متوسط', 'سخت', 'خیلی سخت'], example: 'متوسط'),
        new OA\Property(property: 'overallSatisfaction', description: 'مرحله ۱۱ follow-up، سؤال: «چقدر از رژیم قبلی راضی بودید؟»', type: 'string', enum: ['خیلی راضی', 'راضی', 'متوسط', 'ناراضی'], example: 'راضی'),
        new OA\Property(property: 'newDietPreference', description: 'مرحله ۱۲ follow-up، سؤال: «دوست دارید رژیم جدید چطور باشد؟»', type: 'string', enum: ['سخت‌تر ولی سریع‌تر نتیجه بده', 'متعادل', 'راحت‌تر و قابل‌ادامه‌تر'], example: 'متعادل'),
        new OA\Property(property: 'experiencedIssue', description: 'مرحله ۱۳ follow-up، سؤال: «در طول رژیم با مشکل خاصی مواجه شدید؟»', type: 'string', enum: ['ضعف و بی‌حالی', 'یبوست', 'گرسنگی شدید', 'بی‌حوصلگی', 'هیچکدام'], example: 'هیچکدام'),
        new OA\Property(property: 'foodPreference', description: 'مرحله ۱۴ follow-up، سؤال: «در رژیم جدید کدام را ترجیح می‌دهید؟»', type: 'string', enum: ['غذاهای ساده و سریع', 'غذاهای متنوع‌تر', 'رژیم شبیه غذای خانواده', 'مهم نیست'], example: 'غذاهای ساده و سریع'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'FollowUpAiDietRequest',
    description: 'payload preview/ثبت نهایی رژیم دوم به بعد برای حالت آنلاین. سؤال‌های follow-up جداگانه submit نمی‌شوند؛ currentWeightKg، ۱۳ پاسخ repeatDietFeedback و وضعیت بیماری/دارو یکجا با همین درخواست ارسال می‌شوند. auto-first برای این payload معنی ندارد، اما اگر پکیج فقط AI داشته باشد، اپ نباید صفحه انتخاب AI/کارشناس را نشان دهد و باید بعد از تکمیل follow-up مستقیم وارد انتخاب الگوی AI/preview شود.',
    required: ['requestType', 'nutritionDietTemplateId', 'currentWeightKg', 'repeatDietFeedback', 'repeatDietMedicalNotes'],
    properties: [
        new OA\Property(property: 'requestType', type: 'string', enum: ['ai'], example: 'ai'),
        new OA\Property(property: 'nutritionDietTemplateId', type: 'integer', minimum: 1, example: 12),
        new OA\Property(property: 'currentWeightKg', type: 'number', format: 'float', minimum: 20, maximum: 350, example: 76.5),
        new OA\Property(property: 'repeatDietFeedback', ref: '#/components/schemas/DietRequestFollowUpAnswers'),
        new OA\Property(property: 'repeatDietMedicalNotes', description: 'Summary متنی مرحله /nutrition/diet-followup/15 برای سازگاری نسخه قبلی. اگر repeatDietMedicalConditionsItems ارسال شود، سرور summary را از همان آیتم‌ها می‌سازد.', type: 'string', example: 'کم‌کاری تیروئید [فعلی] (از 2025-02-01، ادامه‌دار) - روزانه لووتیروکسین مصرف می‌کنم.'),
        new OA\Property(
            property: 'repeatDietMedicalConditionsItems',
            description: 'داده structured مرحله بیماری در /nutrition/diet-followup/15، مشابه صفحه بیماری عضویت.',
            type: 'array',
            items: new OA\Items(ref: '#/components/schemas/DietRequestFollowUpMedicalConditionItem'),
        ),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'FollowUpExpertDietRequest',
    description: 'payload preview/ثبت نهایی رژیم دوم به بعد برای حالت کارشناس. سؤال‌های follow-up جداگانه submit نمی‌شوند؛ currentWeightKg، ۱۳ پاسخ repeatDietFeedback و وضعیت بیماری/دارو یکجا با همین درخواست ارسال می‌شوند. اگر پکیج فقط کارشناس داشته باشد، اپ نباید صفحه انتخاب AI/کارشناس را نشان دهد و باید بعد از تکمیل follow-up مستقیم وارد مسیر expert/preview شود.',
    required: ['requestType', 'currentWeightKg', 'repeatDietFeedback', 'repeatDietMedicalNotes'],
    properties: [
        new OA\Property(property: 'requestType', type: 'string', enum: ['expert'], example: 'expert'),
        new OA\Property(property: 'expertDescription', type: 'string', nullable: true, example: 'در برنامه جدید غذای قابل حمل بیشتری می‌خواهم.'),
        new OA\Property(property: 'currentWeightKg', type: 'number', format: 'float', minimum: 20, maximum: 350, example: 76.5),
        new OA\Property(property: 'repeatDietFeedback', ref: '#/components/schemas/DietRequestFollowUpAnswers'),
        new OA\Property(property: 'repeatDietMedicalNotes', description: 'Summary متنی مرحله /nutrition/diet-followup/15 برای سازگاری نسخه قبلی. اگر repeatDietMedicalConditionsItems ارسال شود، سرور summary را از همان آیتم‌ها می‌سازد.', type: 'string', example: 'کم‌کاری تیروئید [فعلی] (از 2025-02-01، ادامه‌دار) - روزانه لووتیروکسین مصرف می‌کنم.'),
        new OA\Property(
            property: 'repeatDietMedicalConditionsItems',
            description: 'داده structured مرحله بیماری در /nutrition/diet-followup/15، مشابه صفحه بیماری عضویت.',
            type: 'array',
            items: new OA\Items(ref: '#/components/schemas/DietRequestFollowUpMedicalConditionItem'),
        ),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'FirstAiDietRequest',
    required: ['requestType'],
    properties: [
        new OA\Property(property: 'requestType', type: 'string', enum: ['ai'], example: 'ai'),
        new OA\Property(property: 'nutritionDietTemplateId', description: 'برای اولین رژیم آنلاین فقط وقتی لازم است که auto-first فعال نباشد یا اپ عمداً قالب انتخابی کاربر را ارسال کند. اگر autoFirstDietEnabled فعال و قالب معتبر برای هدف/پکیج وجود داشته باشد، این فیلد را نفرستید؛ سرور قالب را خودش انتخاب می‌کند و در preview داخل request.dietTemplate برمی‌گرداند.', type: 'integer', nullable: true, minimum: 1, example: 12),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'FirstExpertDietRequest',
    required: ['requestType'],
    properties: [
        new OA\Property(property: 'requestType', type: 'string', enum: ['expert'], example: 'expert'),
        new OA\Property(property: 'expertDescription', description: 'توضیح اختیاری کاربر برای کارشناس.', type: 'string', nullable: true, example: 'غذاهای ساده و قابل حمل را ترجیح می‌دهم.'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'FirstDietTemplateListResponse',
    required: ['success', 'data'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(
            property: 'data',
            required: ['items'],
            properties: [
                new OA\Property(
                    property: 'items',
                    type: 'array',
                    items: new OA\Items(ref: '#/components/schemas/FirstDietTemplate'),
                ),
            ],
            type: 'object',
        ),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'FirstDietTemplate',
    required: ['id', 'name', 'depth', 'isActive', 'children'],
    properties: [
        new OA\Property(property: 'id', type: 'string', example: '12'),
        new OA\Property(property: 'parentId', type: 'string', nullable: true, example: null),
        new OA\Property(property: 'depth', type: 'integer', example: 2),
        new OA\Property(property: 'name', type: 'string', example: 'رژیم کاهش وزن متعادل'),
        new OA\Property(property: 'slug', type: 'string', example: 'balanced-weight-loss'),
        new OA\Property(property: 'imageUrl', type: 'string', nullable: true, example: '/storage/nutrition/templates/weight-loss.webp'),
        new OA\Property(property: 'dietBasis', type: 'string', example: 'calorie'),
        new OA\Property(property: 'prescriptionMode', type: 'string', enum: ['daily_prescription', 'user_choice', 'fixed_text'], example: 'daily_prescription'),
        new OA\Property(property: 'durationDays', type: 'integer', example: 30),
        new OA\Property(property: 'description', type: 'string', nullable: true),
        new OA\Property(property: 'conditionsText', type: 'string', nullable: true),
        new OA\Property(property: 'isActive', type: 'boolean', example: true),
        new OA\Property(
            property: 'children',
            type: 'array',
            items: new OA\Items(ref: '#/components/schemas/FirstDietTemplate'),
        ),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'FirstDietRequestSummary',
    required: ['id', 'requestType', 'status', 'createdAt'],
    properties: [
        new OA\Property(property: 'id', type: 'string', example: '81'),
        new OA\Property(property: 'requestType', type: 'string', enum: ['ai', 'expert'], example: 'ai'),
        new OA\Property(property: 'requestTypeLabel', type: 'string', example: 'آنلاین'),
        new OA\Property(property: 'status', type: 'string', enum: ['sent', 'in_progress', 'not_sent', 'finished', 'cancelled'], example: 'sent'),
        new OA\Property(property: 'statusLabel', type: 'string', example: 'ارسال شده'),
        new OA\Property(property: 'dietTemplateId', type: 'string', nullable: true, example: '12'),
        new OA\Property(property: 'dietTemplateName', type: 'string', nullable: true, example: 'رژیم کاهش وزن متعادل'),
        new OA\Property(property: 'currentWeightKg', type: 'number', format: 'float', nullable: true, example: 78.5),
        new OA\Property(property: 'startedAt', type: 'string', format: 'date', nullable: true, example: '2026-07-06'),
        new OA\Property(property: 'endsAt', type: 'string', format: 'date', nullable: true, example: '2026-08-04'),
        new OA\Property(property: 'createdAt', type: 'string', format: 'date-time', example: '2026-07-06T12:30:00+03:30'),
        new OA\Property(property: 'aiGenerationStatus', type: 'string', nullable: true, example: 'queued'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'FirstDietRequestListResponse',
    required: ['success', 'data'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(
            property: 'data',
            required: ['items', 'page', 'perPage', 'total', 'lastPage'],
            properties: [
                new OA\Property(property: 'items', type: 'array', items: new OA\Items(ref: '#/components/schemas/FirstDietRequestSummary')),
                new OA\Property(property: 'page', type: 'integer', example: 1),
                new OA\Property(property: 'perPage', type: 'integer', example: 20),
                new OA\Property(property: 'total', type: 'integer', example: 1),
                new OA\Property(property: 'lastPage', type: 'integer', example: 1),
            ],
            type: 'object',
        ),
        new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
        new OA\Property(property: 'meta', type: 'object'),
    ],
    type: 'object',
)]
#[OA\Schema(
    schema: 'FirstDietRequestStoreResponse',
    required: ['success', 'message', 'data'],
    properties: [
        new OA\Property(property: 'success', type: 'boolean', example: true),
        new OA\Property(property: 'message', type: 'string', example: 'درخواست رژیم شما با موفقیت ثبت شد.'),
        new OA\Property(
            property: 'data',
            required: ['request', 'subscription'],
            properties: [
                new OA\Property(property: 'request', ref: '#/components/schemas/FirstDietRequestSummary'),
                new OA\Property(
                    property: 'subscription',
                    required: ['onlineDietUsed', 'offlineDietUsed', 'onlineDietRemaining', 'offlineDietRemaining'],
                    properties: [
                        new OA\Property(property: 'onlineDietUsed', type: 'integer', example: 1),
                        new OA\Property(property: 'offlineDietUsed', type: 'integer', example: 0),
                        new OA\Property(property: 'onlineDietRemaining', type: 'integer', example: 2),
                        new OA\Property(property: 'offlineDietRemaining', type: 'integer', example: 1),
                    ],
                    type: 'object',
                ),
            ],
            type: 'object',
        ),
        new OA\Property(property: 'meta', type: 'object'),
    ],
    type: 'object',
)]
final class CustomerAppFirstDietRequestApi {}
