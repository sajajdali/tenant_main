<?php

declare(strict_types=1);

namespace App\OpenApi;

use OpenApi\Attributes as OA;

#[OA\Get(
    path: '/api/v1/app/membership',
    operationId: 'customerAppMembershipIndex',
    description: 'وضعیت کلی مراحل عضویت کاربر و قدم بعدی را برمی گرداند.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    responses: [
        new OA\Response(response: 200, description: 'Membership overview'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/membership/profile',
    operationId: 'customerAppMembershipProfile',
    description: 'اطلاعات و گزینه های مرحله اول عضویت: نام، و جنسیت.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    responses: [
        new OA\Response(response: 200, description: 'Profile step data'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/membership/profile',
    operationId: 'customerAppMembershipStoreProfile',
    description: 'ثبت نام، و جنسیت کاربر.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['fullName', 'gender'],
            properties: [
                new OA\Property(property: 'fullName', type: 'string', minLength: 3, example: 'سجاد'),
                new OA\Property(property: 'gender', type: 'string', enum: ['male', 'female'], example: 'male'),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(response: 200, description: 'Profile step saved'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Validation error'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/membership/goal',
    operationId: 'customerAppMembershipGoal',
    description: 'گزینه های صفحه انتخاب هدف رژیم، متناظر با /nutrition/membership/goal.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    responses: [
        new OA\Response(response: 200, description: 'Goal step data'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/membership/goal',
    operationId: 'customerAppMembershipStoreGoal',
    description: 'ثبت هدف رژیم کاربر.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['dietGoal'],
            properties: [
                new OA\Property(
                    property: 'dietGoal',
                    type: 'string',
                    enum: ['lose-weight', 'gain-weight', 'maintain-weight'],
                    example: 'lose-weight',
                ),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(response: 200, description: 'Goal saved'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Validation error'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/membership/activity',
    operationId: 'customerAppMembershipActivity',
    description: 'گزینه های صفحه میزان فعالیت، شامل ورزشکار بودن و سطح فعالیت. متناظر با /nutrition/membership/activity.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    responses: [
        new OA\Response(response: 200, description: 'Activity step data'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/membership/activity',
    operationId: 'customerAppMembershipStoreActivity',
    description: 'ثبت وضعیت ورزشکار بودن و سطح فعالیت کاربر.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['athleteMode', 'activityLevel'],
            properties: [
                new OA\Property(property: 'athleteMode', type: 'string', enum: ['athlete', 'non-athlete'], example: 'non-athlete'),
                new OA\Property(property: 'activityLevel', type: 'string', enum: ['very-low', 'medium', 'high', 'intense'], example: 'medium'),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(response: 200, description: 'Activity saved'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Validation error'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/membership/birth-date',
    operationId: 'customerAppMembershipBirthDate',
    description: 'داده های صفحه انتخاب تاریخ تولد، متناظر با /nutrition/membership/birth-date. تاریخ در UI شمسی انتخاب می شود و مقدار ذخیره شده در دیتابیس میلادی است.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    responses: [
        new OA\Response(
            response: 200,
            description: 'Birth date step data',
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
                    new OA\Property(
                        property: 'data',
                        properties: [
                            new OA\Property(property: 'step', type: 'string', example: 'birth-date'),
                            new OA\Property(property: 'title', type: 'string', example: 'تاریخ تولد خود را انتخاب کنید'),
                            new OA\Property(
                                property: 'value',
                                properties: [
                                    new OA\Property(property: 'birthDate', description: 'تاریخ میلادی نرمال شده برای ذخیره سازی.', type: 'string', format: 'date', nullable: true, example: '1988-12-01'),
                                    new OA\Property(property: 'calendar', type: 'string', example: 'jalali'),
                                    new OA\Property(property: 'jalaliYear', type: 'integer', nullable: true, example: 1367),
                                    new OA\Property(property: 'jalaliMonth', type: 'integer', nullable: true, example: 9),
                                    new OA\Property(property: 'jalaliDay', type: 'integer', nullable: true, example: 10),
                                    new OA\Property(property: 'formatted', type: 'string', nullable: true, example: '۱۰ آذر ۱۳۶۷'),
                                ],
                                type: 'object',
                            ),
                            new OA\Property(
                                property: 'options',
                                properties: [
                                    new OA\Property(property: 'calendar', type: 'string', example: 'jalali'),
                                    new OA\Property(property: 'years', type: 'array', items: new OA\Items(type: 'integer'), example: [1405, 1404, 1403]),
                                    new OA\Property(
                                        property: 'months',
                                        type: 'array',
                                        items: new OA\Items(
                                            properties: [
                                                new OA\Property(property: 'value', type: 'integer', example: 1),
                                                new OA\Property(property: 'label', type: 'string', example: 'فروردین'),
                                            ],
                                            type: 'object',
                                        ),
                                    ),
                                    new OA\Property(property: 'days', type: 'array', items: new OA\Items(type: 'integer'), example: [1, 2, 3, 4, 5]),
                                ],
                                type: 'object',
                            ),
                        ],
                        type: 'object',
                    ),
                    new OA\Property(property: 'meta', type: 'object'),
                ],
                type: 'object',
            ),
        ),
        new OA\Response(response: 401, description: 'Unauthenticated'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/membership/birth-date',
    operationId: 'customerAppMembershipStoreBirthDate',
    description: 'ثبت تاریخ تولد شمسی انتخاب شده در صفحه /nutrition/membership/birth-date. API تاریخ شمسی را دریافت می کند و تاریخ میلادی نرمال شده را برای ادامه جریان برمی گرداند.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['jalaliYear', 'jalaliMonth', 'jalaliDay'],
            properties: [
                new OA\Property(property: 'jalaliYear', type: 'integer', minimum: 1200, maximum: 1700, example: 1367),
                new OA\Property(property: 'jalaliMonth', type: 'integer', minimum: 1, maximum: 12, example: 9),
                new OA\Property(property: 'jalaliDay', type: 'integer', minimum: 1, maximum: 31, example: 10),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(response: 200, description: 'Birth date saved'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Validation error'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/membership/height',
    operationId: 'customerAppMembershipHeight',
    description: 'داده های صفحه ورود قد، متناظر با /nutrition/membership/height. قد به سانتی متر دریافت می شود.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    responses: [
        new OA\Response(
            response: 200,
            description: 'Height step data',
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
                    new OA\Property(
                        property: 'data',
                        properties: [
                            new OA\Property(property: 'step', type: 'string', example: 'height'),
                            new OA\Property(property: 'title', type: 'string', example: 'قد خود را وارد کنید'),
                            new OA\Property(
                                property: 'value',
                                properties: [
                                    new OA\Property(property: 'height', type: 'integer', nullable: true, example: 172),
                                ],
                                type: 'object',
                            ),
                            new OA\Property(
                                property: 'options',
                                properties: [
                                    new OA\Property(property: 'unit', type: 'string', example: 'cm'),
                                    new OA\Property(property: 'min', type: 'integer', example: 80),
                                    new OA\Property(property: 'max', type: 'integer', example: 250),
                                ],
                                type: 'object',
                            ),
                        ],
                        type: 'object',
                    ),
                    new OA\Property(property: 'meta', type: 'object'),
                ],
                type: 'object',
            ),
        ),
        new OA\Response(response: 401, description: 'Unauthenticated'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/membership/height',
    operationId: 'customerAppMembershipStoreHeight',
    description: 'ثبت قد کاربر به سانتی متر در صفحه /nutrition/membership/height.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['height'],
            properties: [
                new OA\Property(property: 'height', type: 'integer', minimum: 80, maximum: 250, example: 172),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(response: 200, description: 'Height saved'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Validation error'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/membership/weight',
    operationId: 'customerAppMembershipWeight',
    description: 'داده های صفحه ورود وزن، متناظر با /nutrition/membership/weight. وزن به کیلوگرم دریافت می شود و اعشار تا دو رقم قابل قبول است.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    responses: [
        new OA\Response(
            response: 200,
            description: 'Weight step data',
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
                    new OA\Property(
                        property: 'data',
                        properties: [
                            new OA\Property(property: 'step', type: 'string', example: 'weight'),
                            new OA\Property(property: 'title', type: 'string', example: 'وزن خود را وارد کنید'),
                            new OA\Property(
                                property: 'value',
                                properties: [
                                    new OA\Property(property: 'weight', type: 'number', format: 'float', nullable: true, example: 80.5),
                                ],
                                type: 'object',
                            ),
                            new OA\Property(
                                property: 'options',
                                properties: [
                                    new OA\Property(property: 'unit', type: 'string', example: 'kg'),
                                    new OA\Property(property: 'min', type: 'integer', example: 20),
                                    new OA\Property(property: 'max', type: 'integer', example: 350),
                                    new OA\Property(property: 'decimals', type: 'integer', example: 2),
                                ],
                                type: 'object',
                            ),
                        ],
                        type: 'object',
                    ),
                    new OA\Property(property: 'meta', type: 'object'),
                ],
                type: 'object',
            ),
        ),
        new OA\Response(response: 401, description: 'Unauthenticated'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/membership/weight',
    operationId: 'customerAppMembershipStoreWeight',
    description: 'ثبت وزن کاربر به کیلوگرم در صفحه /nutrition/membership/weight. این مرحله در صورت کامل بودن مراحل قبلی، پروفایل اولیه تغذیه را می سازد یا به روز می کند.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['weight'],
            properties: [
                new OA\Property(property: 'weight', type: 'number', format: 'float', minimum: 20, maximum: 350, example: 80.5),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(response: 200, description: 'Weight saved and initial nutrition profile completed'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Validation or incomplete previous steps'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/membership/target-weight',
    operationId: 'customerAppMembershipTargetWeight',
    description: 'داده های صفحه وزن هدف، متناظر با /nutrition/membership/target-weight. شامل بازه مجاز ورود، توضیحات، وزن ایده آل، وزن سلامت و بازه سالم است.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    responses: [
        new OA\Response(
            response: 200,
            description: 'Target weight step data',
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
                    new OA\Property(
                        property: 'data',
                        properties: [
                            new OA\Property(property: 'step', type: 'string', example: 'target-weight'),
                            new OA\Property(property: 'title', type: 'string', example: 'حالا وزن هدف خود را انتخاب کنید'),
                            new OA\Property(
                                property: 'value',
                                properties: [
                                    new OA\Property(property: 'targetWeight', type: 'number', format: 'float', nullable: true, example: 68.5),
                                ],
                                type: 'object',
                            ),
                            new OA\Property(
                                property: 'recommendation',
                                properties: [
                                    new OA\Property(property: 'idealWeight', type: 'number', format: 'float', example: 68),
                                    new OA\Property(property: 'healthWeight', type: 'number', format: 'float', example: 72),
                                    new OA\Property(property: 'recommendedTargetWeight', type: 'number', format: 'float', example: 72),
                                    new OA\Property(
                                        property: 'healthyRange',
                                        properties: [
                                            new OA\Property(property: 'start', type: 'number', format: 'float', example: 55.5),
                                            new OA\Property(property: 'end', type: 'number', format: 'float', example: 74.7),
                                            new OA\Property(property: 'description', type: 'string', example: 'بازه وزن سالم بر اساس BMI برای قد ثبت شده کاربر.'),
                                        ],
                                        type: 'object',
                                    ),
                                    new OA\Property(
                                        property: 'range',
                                        properties: [
                                            new OA\Property(property: 'start', type: 'integer', example: 20),
                                            new OA\Property(property: 'end', type: 'integer', example: 350),
                                            new OA\Property(property: 'description', type: 'string', example: 'وزن هدف باید در این بازه و به کیلوگرم وارد شود.'),
                                        ],
                                        type: 'object',
                                    ),
                                    new OA\Property(property: 'description', type: 'string', example: 'با توجه به قد شما، سیستم یک وزن سلامت برای ورود به بازه سالم پیشنهاد می‌دهد و وزن ایده‌آل را هم جداگانه نمایش می‌دهد.'),
                                ],
                                type: 'object',
                            ),
                            new OA\Property(
                                property: 'options',
                                properties: [
                                    new OA\Property(property: 'unit', type: 'string', example: 'kg'),
                                    new OA\Property(property: 'min', type: 'integer', example: 20),
                                    new OA\Property(property: 'max', type: 'integer', example: 350),
                                    new OA\Property(property: 'decimals', type: 'integer', example: 2),
                                ],
                                type: 'object',
                            ),
                        ],
                        type: 'object',
                    ),
                    new OA\Property(property: 'meta', type: 'object'),
                ],
                type: 'object',
            ),
        ),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Incomplete previous steps'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/membership/target-weight',
    operationId: 'customerAppMembershipStoreTargetWeight',
    description: 'ثبت وزن هدف کاربر به کیلوگرم در صفحه /nutrition/membership/target-weight.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['targetWeight'],
            properties: [
                new OA\Property(property: 'targetWeight', type: 'number', format: 'float', minimum: 20, maximum: 350, example: 68.5),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(response: 200, description: 'Target weight saved'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Validation or missing nutrition profile'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/membership/result',
    operationId: 'customerAppMembershipResult',
    description: 'داده های صفحه برنامه رسیدن به وزن هدف، متناظر با /nutrition/membership/result. شامل گزینه های سرعت تغییر وزن هفتگی، خلاصه زمانی، تعداد رژیم، تاریخ رسیدن، نمودار و ایستگاه های مسیر است.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    responses: [
        new OA\Response(
            response: 200,
            description: 'Result step data',
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
                    new OA\Property(
                        property: 'data',
                        properties: [
                            new OA\Property(property: 'step', type: 'string', example: 'result'),
                            new OA\Property(property: 'title', type: 'string', example: 'برنامه رسیدن به وزن هدف'),
                            new OA\Property(property: 'subtitle', type: 'string', example: 'تحلیل مسیر کاهش وزن'),
                            new OA\Property(
                                property: 'value',
                                properties: [
                                    new OA\Property(property: 'weeklyRate', type: 'number', format: 'float', example: 1),
                                ],
                                type: 'object',
                            ),
                            new OA\Property(
                                property: 'weights',
                                properties: [
                                    new OA\Property(property: 'currentWeight', type: 'number', format: 'float', example: 82),
                                    new OA\Property(property: 'targetWeight', type: 'number', format: 'float', example: 72),
                                    new OA\Property(property: 'unit', type: 'string', example: 'kg'),
                                ],
                                type: 'object',
                            ),
                            new OA\Property(
                                property: 'options',
                                properties: [
                                    new OA\Property(
                                        property: 'weeklyRates',
                                        type: 'array',
                                        items: new OA\Items(
                                            properties: [
                                                new OA\Property(property: 'value', type: 'number', format: 'float', example: 0.5),
                                                new OA\Property(property: 'label', type: 'string', example: 'هفته‌ای ۰.۵ کیلو'),
                                            ],
                                            type: 'object',
                                        ),
                                    ),
                                ],
                                type: 'object',
                            ),
                            new OA\Property(
                                property: 'stats',
                                properties: [
                                    new OA\Property(property: 'totalDifference', type: 'number', format: 'float', example: 10),
                                    new OA\Property(property: 'totalWeeks', type: 'integer', example: 10),
                                    new OA\Property(property: 'dietPlansCount', type: 'integer', example: 3),
                                    new OA\Property(property: 'reachDate', type: 'string', format: 'date', example: '2026-08-23'),
                                    new OA\Property(property: 'reachDateFormatted', type: 'string', example: '۱ شهریور ۱۴۰۵'),
                                    new OA\Property(property: 'targetReachedText', type: 'string', example: 'اگر با این سرعت جلو بروید، حدود ۱۰ هفته دیگر به وزن هدف می‌رسید.'),
                                ],
                                type: 'object',
                            ),
                            new OA\Property(
                                property: 'summaryCards',
                                type: 'array',
                                items: new OA\Items(type: 'object'),
                            ),
                            new OA\Property(
                                property: 'chart',
                                properties: [
                                    new OA\Property(property: 'width', type: 'integer', example: 320),
                                    new OA\Property(property: 'height', type: 'integer', example: 180),
                                    new OA\Property(property: 'polyline', type: 'string', example: '26,24 115.33,68 204.67,112 294,156'),
                                    new OA\Property(property: 'points', type: 'array', items: new OA\Items(type: 'object')),
                                ],
                                type: 'object',
                            ),
                            new OA\Property(
                                property: 'milestones',
                                type: 'array',
                                items: new OA\Items(
                                    properties: [
                                        new OA\Property(property: 'id', type: 'string', example: '0-0'),
                                        new OA\Property(property: 'title', type: 'string', example: 'ایستگاه ۱'),
                                        new OA\Property(property: 'progress', type: 'number', format: 'float', example: 0),
                                        new OA\Property(property: 'weight', type: 'number', format: 'float', example: 82),
                                        new OA\Property(property: 'date', type: 'string', format: 'date', example: '2026-06-14'),
                                        new OA\Property(property: 'dateFormatted', type: 'string', example: '۲۴ خرداد ۱۴۰۵'),
                                        new OA\Property(property: 'weekLabel', type: 'string', example: 'ماه ۱'),
                                    ],
                                    type: 'object',
                                ),
                            ),
                        ],
                        type: 'object',
                    ),
                    new OA\Property(property: 'meta', type: 'object'),
                ],
                type: 'object',
            ),
        ),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Incomplete previous steps'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/membership/result',
    operationId: 'customerAppMembershipStoreResult',
    description: 'ثبت میزان تغییر وزن هفتگی انتخاب شده در صفحه /nutrition/membership/result. مقدار مجاز یکی از 0.5، 1 یا 1.5 کیلو در هفته است.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['weeklyRate'],
            properties: [
                new OA\Property(property: 'weeklyRate', type: 'number', format: 'float', enum: [0.5, 1, 1.5], example: 1),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(response: 200, description: 'Weekly weight change saved'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Validation or missing nutrition profile'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/membership/medical-conditions',
    operationId: 'customerAppMembershipMedicalConditions',
    description: 'داده های صفحه ثبت سوابق بیماری، متناظر با /nutrition/membership/medical-conditions. لیست بیماری های ثبت شده کاربر و گزینه های وضعیت بیماری را برمی گرداند.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    responses: [
        new OA\Response(
            response: 200,
            description: 'Medical conditions step data',
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
                    new OA\Property(
                        property: 'data',
                        properties: [
                            new OA\Property(property: 'step', type: 'string', example: 'medical-conditions'),
                            new OA\Property(property: 'title', type: 'string', example: 'سوابق بیماری'),
                            new OA\Property(property: 'subtitle', type: 'string', example: 'مرحله وضعیت پزشکی'),
                            new OA\Property(property: 'description', type: 'string', example: 'اگر بیماری خاصی دارید، موردبه‌مورد ثبت کنید.'),
                            new OA\Property(
                                property: 'value',
                                properties: [
                                    new OA\Property(property: 'medicalConditions', type: 'string', nullable: true, example: 'میگرن [فعلی] (ادامه‌دار)'),
                                    new OA\Property(
                                        property: 'medicalConditionsItems',
                                        type: 'array',
                                        items: new OA\Items(
                                            properties: [
                                                new OA\Property(property: 'id', type: 'string', example: 'condition_1'),
                                                new OA\Property(property: 'title', type: 'string', example: 'میگرن'),
                                                new OA\Property(property: 'status', type: 'string', enum: ['current', 'temporary', 'past'], example: 'current'),
                                                new OA\Property(property: 'startedAt', type: 'string', format: 'date', nullable: true, example: '2024-01-10'),
                                                new OA\Property(property: 'endedAt', type: 'string', format: 'date', nullable: true, example: null),
                                                new OA\Property(property: 'ongoing', type: 'boolean', example: true),
                                                new OA\Property(property: 'notes', type: 'string', nullable: true, example: 'با استرس شدیدتر می‌شود'),
                                            ],
                                            type: 'object',
                                        ),
                                    ),
                                    new OA\Property(property: 'completedAt', type: 'string', format: 'date-time', nullable: true, example: '2026-06-14T12:00:00+03:30'),
                                ],
                                type: 'object',
                            ),
                            new OA\Property(
                                property: 'options',
                                properties: [
                                    new OA\Property(
                                        property: 'statuses',
                                        type: 'array',
                                        items: new OA\Items(
                                            properties: [
                                                new OA\Property(property: 'value', type: 'string', example: 'current'),
                                                new OA\Property(property: 'label', type: 'string', example: 'فعلی'),
                                            ],
                                            type: 'object',
                                        ),
                                    ),
                                    new OA\Property(property: 'allowEmpty', type: 'boolean', example: true),
                                ],
                                type: 'object',
                            ),
                        ],
                        type: 'object',
                    ),
                    new OA\Property(property: 'meta', type: 'object'),
                ],
                type: 'object',
            ),
        ),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Incomplete previous steps'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/membership/medical-conditions',
    operationId: 'customerAppMembershipStoreMedicalConditions',
    description: 'ثبت لیست بیماری های کاربر در صفحه /nutrition/membership/medical-conditions. برای ثبت اینکه کاربر بیماری ندارد، medicalConditionsItems را آرایه خالی بفرستید.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            properties: [
                new OA\Property(property: 'medicalConditions', type: 'string', nullable: true, example: 'میگرن'),
                new OA\Property(
                    property: 'medicalConditionsItems',
                    type: 'array',
                    items: new OA\Items(
                        required: ['title'],
                        properties: [
                            new OA\Property(property: 'id', type: 'string', example: 'condition_1'),
                            new OA\Property(property: 'title', type: 'string', example: 'میگرن'),
                            new OA\Property(property: 'status', type: 'string', enum: ['current', 'temporary', 'past'], example: 'current'),
                            new OA\Property(property: 'startedAt', type: 'string', format: 'date', nullable: true, example: '2024-01-10'),
                            new OA\Property(property: 'endedAt', type: 'string', format: 'date', nullable: true, example: null),
                            new OA\Property(property: 'ongoing', type: 'boolean', example: true),
                            new OA\Property(property: 'notes', type: 'string', nullable: true, example: 'با استرس شدیدتر می‌شود'),
                        ],
                        type: 'object',
                    ),
                    example: [
                        [
                            'id' => 'condition_1',
                            'title' => 'میگرن',
                            'status' => 'current',
                            'startedAt' => '2024-01-10',
                            'endedAt' => null,
                            'ongoing' => true,
                            'notes' => 'با استرس شدیدتر می‌شود',
                        ],
                    ],
                ),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(response: 200, description: 'Medical conditions saved'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Validation or incomplete previous steps'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/membership/medications-and-supplements',
    operationId: 'customerAppMembershipMedicationsAndSupplements',
    description: 'داده های صفحه ثبت داروها و مکمل های مصرفی، متناظر با /nutrition/membership/medications-and-supplements. مقدار فعلی و تنظیمات ورودی را برمی گرداند.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    responses: [
        new OA\Response(
            response: 200,
            description: 'Medications and supplements step data',
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
                    new OA\Property(
                        property: 'data',
                        properties: [
                            new OA\Property(property: 'step', type: 'string', example: 'medications-and-supplements'),
                            new OA\Property(property: 'title', type: 'string', example: 'دارو یا مکمل مصرفی'),
                            new OA\Property(property: 'subtitle', type: 'string', example: 'مرحله دارو و مکمل'),
                            new OA\Property(property: 'description', type: 'string', example: 'اگر دارو یا مکمل مصرف می‌کنید، نام، مقدار و زمان مصرف را وارد کنید.'),
                            new OA\Property(
                                property: 'value',
                                properties: [
                                    new OA\Property(property: 'medicationsAndSupplements', type: 'string', nullable: true, example: 'قرص تیروئید ساعت ۷ صبح، آهن بعد از ناهار'),
                                    new OA\Property(property: 'completedAt', type: 'string', format: 'date-time', nullable: true, example: '2026-06-14T12:00:00+03:30'),
                                ],
                                type: 'object',
                            ),
                            new OA\Property(
                                property: 'options',
                                properties: [
                                    new OA\Property(property: 'allowEmpty', type: 'boolean', example: true),
                                    new OA\Property(property: 'maxLength', type: 'integer', example: 4000),
                                ],
                                type: 'object',
                            ),
                        ],
                        type: 'object',
                    ),
                    new OA\Property(property: 'meta', type: 'object'),
                ],
                type: 'object',
            ),
        ),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Incomplete previous steps'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/membership/medications-and-supplements',
    operationId: 'customerAppMembershipStoreMedicationsAndSupplements',
    description: 'ثبت داروها و مکمل های مصرفی کاربر در صفحه /nutrition/membership/medications-and-supplements. اگر کاربر دارو یا مکمل مصرف نمی کند، مقدار خالی یا null بفرستید.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            properties: [
                new OA\Property(
                    property: 'medicationsAndSupplements',
                    type: 'string',
                    maxLength: 4000,
                    nullable: true,
                    example: 'قرص تیروئید ساعت ۷ صبح، آهن بعد از ناهار، منیزیم قبل خواب',
                ),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(response: 200, description: 'Medications and supplements saved'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Validation or incomplete previous steps'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/membership/allergies',
    operationId: 'customerAppMembershipAllergies',
    description: 'داده های صفحه ثبت حساسیت غذایی، متناظر با /nutrition/membership/allergies. مقدار فعلی و تنظیمات ورودی را برمی گرداند.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    responses: [
        new OA\Response(
            response: 200,
            description: 'Food allergies step data',
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
                    new OA\Property(
                        property: 'data',
                        properties: [
                            new OA\Property(property: 'step', type: 'string', example: 'allergies'),
                            new OA\Property(property: 'title', type: 'string', example: 'حساسیت غذایی'),
                            new OA\Property(property: 'subtitle', type: 'string', example: 'مرحله آلرژی و محدودیت'),
                            new OA\Property(property: 'description', type: 'string', example: 'اگر به ماده غذایی خاصی حساسیت یا منع مصرف دارید، اینجا وارد کنید.'),
                            new OA\Property(
                                property: 'value',
                                properties: [
                                    new OA\Property(property: 'foodAllergies', type: 'string', nullable: true, example: 'بادام‌زمینی، شیر، گلوتن، میگو'),
                                    new OA\Property(property: 'completedAt', type: 'string', format: 'date-time', nullable: true, example: '2026-06-14T12:00:00+03:30'),
                                ],
                                type: 'object',
                            ),
                            new OA\Property(
                                property: 'options',
                                properties: [
                                    new OA\Property(property: 'allowEmpty', type: 'boolean', example: true),
                                    new OA\Property(property: 'maxLength', type: 'integer', example: 4000),
                                ],
                                type: 'object',
                            ),
                        ],
                        type: 'object',
                    ),
                    new OA\Property(property: 'meta', type: 'object'),
                ],
                type: 'object',
            ),
        ),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Incomplete previous steps'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/membership/allergies',
    operationId: 'customerAppMembershipStoreAllergies',
    description: 'ثبت حساسیت غذایی کاربر در صفحه /nutrition/membership/allergies. اگر کاربر حساسیت غذایی ندارد، مقدار خالی یا null بفرستید.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            properties: [
                new OA\Property(
                    property: 'foodAllergies',
                    type: 'string',
                    maxLength: 4000,
                    nullable: true,
                    example: 'بادام‌زمینی، شیر، گلوتن، میگو',
                ),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(response: 200, description: 'Food allergies saved'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Validation or incomplete previous steps'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/membership/disliked-foods',
    operationId: 'customerAppMembershipDislikedFoods',
    description: 'داده های صفحه غذاهای نامطلوب، متناظر با /nutrition/membership/disliked-foods. مقدار فعلی و تنظیمات ورودی را برمی گرداند.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    responses: [
        new OA\Response(
            response: 200,
            description: 'Disliked foods step data',
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
                    new OA\Property(
                        property: 'data',
                        properties: [
                            new OA\Property(property: 'step', type: 'string', example: 'disliked-foods'),
                            new OA\Property(property: 'title', type: 'string', example: 'غذاهای نامطلوب'),
                            new OA\Property(property: 'subtitle', type: 'string', example: 'مرحله ترجیحات غذایی'),
                            new OA\Property(property: 'description', type: 'string', example: 'غذاهایی که دوست ندارید یا نمی‌خواهید در رژیم باشد را وارد کنید.'),
                            new OA\Property(
                                property: 'value',
                                properties: [
                                    new OA\Property(property: 'dislikedFoods', type: 'string', nullable: true, example: 'ماهی، بادمجان، دل و جگر'),
                                    new OA\Property(property: 'completedAt', type: 'string', format: 'date-time', nullable: true, example: '2026-06-14T12:00:00+03:30'),
                                ],
                                type: 'object',
                            ),
                            new OA\Property(
                                property: 'options',
                                properties: [
                                    new OA\Property(property: 'allowEmpty', type: 'boolean', example: true),
                                    new OA\Property(property: 'maxLength', type: 'integer', example: 4000),
                                ],
                                type: 'object',
                            ),
                        ],
                        type: 'object',
                    ),
                    new OA\Property(property: 'meta', type: 'object'),
                ],
                type: 'object',
            ),
        ),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Incomplete previous steps'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/membership/disliked-foods',
    operationId: 'customerAppMembershipStoreDislikedFoods',
    description: 'ثبت غذاهای نامطلوب کاربر در صفحه /nutrition/membership/disliked-foods. اگر کاربر غذای نامطلوبی ندارد، مقدار خالی یا null بفرستید.',
    security: [['bearerAuth' => []]],
    tags: ['Membership'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            properties: [
                new OA\Property(
                    property: 'dislikedFoods',
                    type: 'string',
                    maxLength: 4000,
                    nullable: true,
                    example: 'ماهی، بادمجان، دل و جگر',
                ),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(response: 200, description: 'Disliked foods saved'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Validation or incomplete previous steps'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/membership/packages',
    operationId: 'customerAppMembershipPackages',
    description: 'داده های صفحه لیست پکیج ها، متناظر با /nutrition/membership/packages. همه پکیج های فعال را به صورت درختی همراه زیرمجموعه ها برمی گرداند و اگر پکیجی تعریف نشده باشد emptyState.message مقدار «پکیجی برای شما تعریف نشده است.» دارد. سناریوی رژیم اول برای اپ Flutter: بعد از خرید موفق پکیج، اگر /api/v1/app/nutrition/profile یا /api/v1/app/nutrition/diet-requests/options نشان داد mindsetCompleted=false یا state=needs_mindset، اپ باید پیام «برای دریافت رژیم باید به ۵ سؤال تکمیلی پاسخ دهید» نمایش دهد و کاربر را به GET/POST /api/v1/app/membership/mindset ببرد. خرید پکیج به تنهایی رژیم نمی‌سازد؛ بعد از ۵ سؤال باید preview و سپس confirm درخواست رژیم زده شود.',
    security: [['bearerAuth' => []]],
    tags: ['Package Purchase'],
    responses: [
        new OA\Response(
            response: 200,
            description: 'Packages step data',
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
                    new OA\Property(
                        property: 'data',
                        properties: [
                            new OA\Property(property: 'step', type: 'string', example: 'packages'),
                            new OA\Property(property: 'title', type: 'string', example: 'انتخاب پکیج'),
                            new OA\Property(property: 'subtitle', type: 'string', example: 'مرحله انتخاب نوع رژیم'),
                            new OA\Property(property: 'description', type: 'string', example: 'پکیج مناسب خود را انتخاب کنید. اگر یک پکیج زیرمجموعه دارد، یکی از زیرمجموعه‌های آن قابل خرید است.'),
                            new OA\Property(
                                property: 'value',
                                properties: [
                                    new OA\Property(property: 'selectedNutritionPackageId', type: 'string', nullable: true, example: '12'),
                                    new OA\Property(property: 'selectedNutritionPackageName', type: 'string', nullable: true, example: 'پکیج ماهانه کاهش وزن'),
                                    new OA\Property(property: 'completedAt', type: 'string', format: 'date-time', nullable: true, example: '2026-06-14T12:00:00+03:30'),
                                ],
                                type: 'object',
                            ),
                            new OA\Property(
                                property: 'items',
                                type: 'array',
                                items: new OA\Items(
                                    properties: [
                                        new OA\Property(property: 'id', type: 'string', example: '1'),
                                        new OA\Property(property: 'parentId', type: 'string', nullable: true, example: null),
                                        new OA\Property(property: 'depth', type: 'integer', example: 0),
                                        new OA\Property(property: 'name', type: 'string', example: 'پکیج‌های کاهش وزن'),
                                        new OA\Property(property: 'slug', type: 'string', example: 'weight-loss'),
                                        new OA\Property(property: 'imageUrl', type: 'string', nullable: true, example: 'https://example.com/storage/nutrition/packages/package.png'),
                                        new OA\Property(property: 'onlineDietCount', type: 'integer', example: 1),
                                        new OA\Property(property: 'offlineDietCount', type: 'integer', example: 0),
                                        new OA\Property(property: 'durationDays', type: 'integer', example: 30),
                                        new OA\Property(property: 'priceAmount', type: 'integer', example: 900000),
                                        new OA\Property(property: 'discountedPriceAmount', type: 'integer', nullable: true, example: 750000),
                                        new OA\Property(property: 'badgeTitle', type: 'string', nullable: true, example: 'عنوان برچسب روی کارت'),
                                        new OA\Property(property: 'payableAmount', type: 'integer', example: 750000),
                                        new OA\Property(property: 'hasDiscount', type: 'boolean', example: true),
                                        new OA\Property(property: 'applicableGoals', type: 'array', items: new OA\Items(type: 'string'), example: ['lose-weight']),
                                        new OA\Property(property: 'applicableGoalLabels', type: 'array', items: new OA\Items(type: 'string'), example: ['کاهش وزن']),
                                        new OA\Property(property: 'sortOrder', type: 'integer', example: 1),
                                        new OA\Property(property: 'isActive', type: 'boolean', example: true),
                                        new OA\Property(property: 'isPurchasable', type: 'boolean', example: false),
                                        new OA\Property(property: 'children', type: 'array', items: new OA\Items(type: 'object')),
                                    ],
                                    type: 'object',
                                ),
                            ),
                            new OA\Property(
                                property: 'emptyState',
                                properties: [
                                    new OA\Property(property: 'isEmpty', type: 'boolean', example: false),
                                    new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
                                ],
                                type: 'object',
                            ),
                            new OA\Property(
                                property: 'options',
                                properties: [
                                    new OA\Property(property: 'allowEmpty', type: 'boolean', example: false),
                                    new OA\Property(property: 'selectionField', type: 'string', example: 'nutritionPackageId'),
                                    new OA\Property(property: 'previewEndpoint', type: 'string', example: '/api/v1/app/nutrition/package-checkout/preview'),
                                    new OA\Property(property: 'payEndpoint', type: 'string', example: '/api/v1/app/nutrition/package-checkout/pay'),
                                ],
                                type: 'object',
                            ),
                        ],
                        type: 'object',
                    ),
                    new OA\Property(property: 'meta', type: 'object'),
                ],
                type: 'object',
            ),
        ),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Incomplete previous steps'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/membership/mindset',
    operationId: 'customerAppMembershipMindset',
    description: 'همه دیتای پنج صفحه /nutrition/membership/mindset/1 تا /nutrition/membership/mindset/5 را در یک response برمی‌گرداند. آرایه questions/items شامل هر پنج سؤال است و pages هر سؤال را به path همان صفحه وصل می‌کند. روی هر گزینه فیلد selected مشخص می‌کند کاربر همان گزینه را زده یا نه.',
    security: [['bearerAuth' => []]],
    tags: ['Supplementary Membership Questions'],
    responses: [
        new OA\Response(
            response: 200,
            description: 'Mindset questions list',
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
                    new OA\Property(
                        property: 'data',
                        properties: [
                            new OA\Property(property: 'step', type: 'string', example: 'mindset'),
                            new OA\Property(property: 'title', type: 'string', example: 'سؤالات مهم قبل از دریافت رژیم'),
                            new OA\Property(property: 'subtitle', type: 'string', example: 'مرحله شناخت انگیزه و رفتار غذایی'),
                            new OA\Property(property: 'description', type: 'string', example: 'این سؤالات فقط یک‌بار پرسیده می‌شود و کمک می‌کند برنامه با انگیزه و سبک زندگی کاربر هماهنگ‌تر تنظیم شود.'),
                            new OA\Property(
                                property: 'value',
                                properties: [
                                    new OA\Property(
                                        property: 'answers',
                                        properties: [
                                            new OA\Property(property: 'reason', type: 'string', nullable: true, example: 'سلامتی و نتایج آزمایش'),
                                            new OA\Property(property: 'barrier', type: 'string', nullable: true, example: 'نداشتن برنامه منظم'),
                                            new OA\Property(property: 'stressAppetite', type: 'string', nullable: true, example: 'تقریباً فرقی نمی‌کند'),
                                            new OA\Property(property: 'hardestTime', type: 'string', nullable: true, example: 'شب'),
                                            new OA\Property(property: 'planStyle', type: 'string', nullable: true, example: 'متعادل'),
                                        ],
                                        type: 'object',
                                    ),
                                    new OA\Property(property: 'completedAt', type: 'string', format: 'date-time', nullable: true, example: null),
                                ],
                                type: 'object',
                            ),
                            new OA\Property(
                                property: 'questions',
                                description: 'همه ۵ سؤال تکمیلی به ترتیب صفحه‌های mindset/1 تا mindset/5.',
                                type: 'array',
                                minItems: 5,
                                maxItems: 5,
                                items: new OA\Items(
                                    properties: [
                                        new OA\Property(property: 'key', type: 'string', example: 'reason'),
                                        new OA\Property(property: 'step', type: 'integer', example: 1),
                                        new OA\Property(property: 'title', type: 'string', example: 'مهم‌ترین دلیل شما برای رسیدن به این وزن هدف چیست؟'),
                                        new OA\Property(property: 'description', type: 'string', example: 'این جواب کمک می‌کند برنامه شما با انگیزه اصلی‌تان هماهنگ‌تر تنظیم شود.'),
                                        new OA\Property(
                                            property: 'options',
                                            type: 'array',
                                            items: new OA\Items(
                                                properties: [
                                                    new OA\Property(property: 'key', type: 'string', example: 'health-tests'),
                                                    new OA\Property(property: 'label', type: 'string', example: 'سلامتی و نتایج آزمایش'),
                                                    new OA\Property(property: 'selected', type: 'boolean', example: true),
                                                ],
                                                type: 'object',
                                            ),
                                        ),
                                    ],
                                    type: 'object',
                                ),
                            ),
                            new OA\Property(property: 'items', description: 'Alias of questions for backward compatibility.', type: 'array', items: new OA\Items(type: 'object')),
                            new OA\Property(
                                property: 'pages',
                                description: 'نگاشت صفحه‌های فرانت به سؤال‌ها؛ هر پنج مسیر mindset/1 تا mindset/5 در همین response می‌آیند.',
                                type: 'array',
                                minItems: 5,
                                maxItems: 5,
                                items: new OA\Items(
                                    properties: [
                                        new OA\Property(property: 'step', type: 'integer', example: 1),
                                        new OA\Property(property: 'path', type: 'string', example: '/nutrition/membership/mindset/1'),
                                        new OA\Property(property: 'questionKey', type: 'string', example: 'reason'),
                                        new OA\Property(property: 'question', type: 'object'),
                                    ],
                                    type: 'object',
                                ),
                                example: [
                                    [
                                        'step' => 1,
                                        'path' => '/nutrition/membership/mindset/1',
                                        'questionKey' => 'reason',
                                        'question' => [
                                            'key' => 'reason',
                                            'step' => 1,
                                            'title' => 'مهم‌ترین دلیل شما برای رسیدن به این وزن هدف چیست؟',
                                        ],
                                    ],
                                    [
                                        'step' => 2,
                                        'path' => '/nutrition/membership/mindset/2',
                                        'questionKey' => 'barrier',
                                        'question' => [
                                            'key' => 'barrier',
                                            'step' => 2,
                                            'title' => 'بزرگ‌ترین مانع شما در رژیم‌های قبلی چه بوده است؟',
                                        ],
                                    ],
                                    [
                                        'step' => 3,
                                        'path' => '/nutrition/membership/mindset/3',
                                        'questionKey' => 'stressAppetite',
                                        'question' => [
                                            'key' => 'stressAppetite',
                                            'step' => 3,
                                            'title' => 'وقتی استرس می‌گیرید، اشتهای شما بیشتر می‌شود یا کمتر؟',
                                        ],
                                    ],
                                    [
                                        'step' => 4,
                                        'path' => '/nutrition/membership/mindset/4',
                                        'questionKey' => 'hardestTime',
                                        'question' => [
                                            'key' => 'hardestTime',
                                            'step' => 4,
                                            'title' => 'بیشتر در چه زمانی از روز کنترل اشتها برایتان سخت‌تر است؟',
                                        ],
                                    ],
                                    [
                                        'step' => 5,
                                        'path' => '/nutrition/membership/mindset/5',
                                        'questionKey' => 'planStyle',
                                        'question' => [
                                            'key' => 'planStyle',
                                            'step' => 5,
                                            'title' => 'دوست دارید برنامه غذایی شما سخت‌گیرانه باشد یا منعطف؟',
                                        ],
                                    ],
                                ],
                            ),
                            new OA\Property(
                                property: 'options',
                                properties: [
                                    new OA\Property(property: 'totalSteps', type: 'integer', example: 5),
                                    new OA\Property(property: 'totalQuestions', type: 'integer', example: 5),
                                    new OA\Property(property: 'answerField', type: 'string', example: 'answers'),
                                    new OA\Property(property: 'submitEndpoint', type: 'string', example: '/api/v1/app/membership/mindset'),
                                    new OA\Property(property: 'pageBasePath', type: 'string', example: '/nutrition/membership/mindset'),
                                ],
                                type: 'object',
                            ),
                        ],
                        type: 'object',
                    ),
                    new OA\Property(property: 'meta', type: 'object'),
                ],
                type: 'object',
            ),
        ),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Incomplete previous steps'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/membership/mindset',
    operationId: 'customerAppMembershipStoreMindset',
    description: 'ثبت پاسخ‌های هر پنج صفحه mindset در یک route واحد و در ستون mindset_answers. همه پنج پاسخ الزامی هستند؛ مقدار هر پاسخ می‌تواند key گزینه یا label گزینه باشد.',
    security: [['bearerAuth' => []]],
    tags: ['Supplementary Membership Questions'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['answers'],
            properties: [
                new OA\Property(
                    property: 'answers',
                    required: ['reason', 'barrier', 'stressAppetite', 'hardestTime', 'planStyle'],
                    properties: [
                        new OA\Property(property: 'reason', description: 'key یا label گزینه انتخاب‌شده.', type: 'string', example: 'health-tests'),
                        new OA\Property(property: 'barrier', description: 'key یا label گزینه انتخاب‌شده.', type: 'string', example: 'no-routine'),
                        new OA\Property(property: 'stressAppetite', description: 'key یا label گزینه انتخاب‌شده.', type: 'string', example: 'same'),
                        new OA\Property(property: 'hardestTime', description: 'key یا label گزینه انتخاب‌شده.', type: 'string', example: 'night'),
                        new OA\Property(property: 'planStyle', description: 'key یا label گزینه انتخاب‌شده.', type: 'string', example: 'balanced'),
                    ],
                    type: 'object',
                ),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(response: 200, description: 'Mindset answers saved'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Validation or incomplete previous steps'),
    ],
)]
final class CustomerAppMembershipApi {}
