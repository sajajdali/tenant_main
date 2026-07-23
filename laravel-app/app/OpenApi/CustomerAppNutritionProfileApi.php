<?php

declare(strict_types=1);

namespace App\OpenApi;

use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Nutrition Profile', description: 'Nutrition profile dashboard')]
#[OA\Get(
    path: '/api/v1/app/nutrition/profile',
    operationId: 'customerAppNutritionProfileDashboard',
    description: 'داده کامل صفحه /nutrition/profile را یکجا برمی گرداند. ترتیب تصمیم گیری داشبورد دقیقاً این است: ۱) رژیم فعال: مشاهده رژیم؛ ۲) درخواست فعال: رژیم در حال تجویز؛ ۳) عضویت ناقص: بنر «عضویت کامل نیست» و actionHref اولین مرحله ناقص عضویت؛ ۴) عضویت کامل بدون بسته قابل استفاده: کلید «دریافت رژیم» و هدایت به خرید بسته؛ ۵) بسته فعال و بدون سابقه رژیم: کلید «دریافت رژیم» و هدایت به انتخاب/ثبت رژیم اول (در صورت ناقص بودن mindset ابتدا همان مرحله)؛ ۶) بسته فعال و دارای سابقه رژیم تمام شده: هدایت مستقیم به /nutrition/diet-followup/1 برای پاسخ به ۱۵ مرحله رژیم دوم. پاسخ های مراحل ۲ تا ۱۴ در repeatDietFeedback و مرحله ۱۵ در repeatDietMedicalConditionsItems/repeatDietMedicalNotes هنگام preview/store ارسال می شوند.',
    security: [['bearerAuth' => []]],
    tags: ['Nutrition Profile'],
    responses: [
        new OA\Response(
            response: 200,
            description: 'Nutrition profile dashboard',
            content: new OA\JsonContent(
                required: ['success', 'data', 'meta'],
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
                    new OA\Property(
                        property: 'data',
                        required: ['profile', 'subscription', 'dietRequest', 'prescription', 'dashboard', 'nullables'],
                        properties: [
                            new OA\Property(property: 'profile', type: 'object', nullable: true),
                            new OA\Property(property: 'managerMessage', type: 'string', nullable: true, example: 'پیغام اختصاصی کارشناس'),
                            new OA\Property(property: 'subscription', type: 'object', nullable: true),
                            new OA\Property(
                                property: 'dietRequest',
                                properties: [
                                    new OA\Property(property: 'active', type: 'object', nullable: true),
                                    new OA\Property(property: 'latest', type: 'object', nullable: true),
                                    new OA\Property(property: 'isPrescribing', type: 'boolean', example: false),
                                ],
                                type: 'object',
                            ),
                            new OA\Property(
                                property: 'prescription',
                                properties: [
                                    new OA\Property(property: 'current', type: 'object', nullable: true),
                                    new OA\Property(property: 'hasHistory', type: 'boolean', example: true),
                                ],
                                type: 'object',
                            ),
                            new OA\Property(
                                property: 'dashboard',
                                properties: [
                                    new OA\Property(
                                        property: 'state',
                                        type: 'string',
                                        description: 'profile_incomplete یعنی عضویت تا پایان اطلاعات پزشکی/ترجیحات کامل نیست؛ ready_for_first_diet برای اولین رژیم و ready_for_repeat_diet برای رژیم دوم به بعد است.',
                                        enum: ['has_current_prescription', 'prescribing', 'profile_incomplete', 'needs_package', 'needs_mindset', 'ready_for_first_diet', 'ready_for_repeat_diet'],
                                        example: 'ready_for_repeat_diet',
                                    ),
                                    new OA\Property(
                                        property: 'banner',
                                        properties: [
                                            new OA\Property(property: 'type', type: 'string', enum: ['prescribing', 'membership_incomplete', 'needs_package', 'get_first_diet', 'get_repeat_diet'], example: 'get_repeat_diet'),
                                            new OA\Property(property: 'title', type: 'string', example: 'دریافت رژیم'),
                                            new OA\Property(property: 'description', type: 'string', example: 'برای دریافت رژیم دوم، ابتدا به ۱۵ سؤال پیگیری پاسخ دهید.'),
                                            new OA\Property(property: 'actionLabel', type: 'string', nullable: true, example: 'دریافت رژیم'),
                                            new OA\Property(property: 'actionHref', description: 'برای عضویت ناقص اولین مرحله ناقص، برای نبود بسته صفحه خرید، برای رژیم اول مسیر انتخاب نوع رژیم و برای رژیم دوم به بعد /nutrition/diet-followup/1 است.', type: 'string', nullable: true, example: '/nutrition/diet-followup/1'),
                                        ],
                                        type: 'object',
                                        nullable: true,
                                    ),
                                    new OA\Property(
                                        property: 'dietAction',
                                        properties: [
                                            new OA\Property(property: 'type', type: 'string', enum: ['view_current_diet', 'prescribing', 'get_diet'], example: 'get_diet'),
                                            new OA\Property(property: 'title', type: 'string', example: 'دریافت رژیم'),
                                            new OA\Property(property: 'href', type: 'string', nullable: true, example: '/nutrition/diet-followup/1'),
                                            new OA\Property(property: 'disabled', type: 'boolean', example: false),
                                        ],
                                        type: 'object',
                                    ),
                                    new OA\Property(property: 'activeDate', type: 'string', format: 'date', example: '2026-06-15'),
                                    new OA\Property(
                                        property: 'days',
                                        type: 'array',
                                        nullable: true,
                                        items: new OA\Items(
                                            properties: [
                                                new OA\Property(property: 'dayNumber', type: 'integer', example: 1),
                                                new OA\Property(property: 'date', type: 'string', nullable: true, format: 'date', example: '2026-06-15'),
                                                new OA\Property(property: 'label', type: 'string', nullable: true, example: 'روز اول'),
                                                new OA\Property(property: 'notes', type: 'string', nullable: true, example: null),
                                                new OA\Property(property: 'totalCalories', type: 'integer', nullable: true, example: 1850),
                                                new OA\Property(property: 'mealsCount', type: 'integer', example: 5),
                                                new OA\Property(property: 'isActive', type: 'boolean', example: true),
                                            ],
                                            type: 'object',
                                        ),
                                    ),
                                    new OA\Property(
                                        property: 'dailyCalories',
                                        properties: [
                                            new OA\Property(property: 'date', type: 'string', format: 'date', example: '2026-06-15'),
                                            new OA\Property(property: 'targetCalories', type: 'integer', nullable: true, example: 1850),
                                            new OA\Property(property: 'loggedMeals', type: 'integer', example: 2),
                                            new OA\Property(property: 'loggedExercises', type: 'integer', example: 1),
                                            new OA\Property(property: 'consumedCalories', type: 'integer', example: 720),
                                            new OA\Property(property: 'burnedCalories', type: 'integer', example: 180),
                                            new OA\Property(property: 'netCalories', type: 'integer', example: 540),
                                            new OA\Property(property: 'remainingCalories', type: 'integer', nullable: true, example: 1130),
                                            new OA\Property(property: 'macros', type: 'object'),
                                        ],
                                        type: 'object',
                                        nullable: true,
                                    ),
                                    new OA\Property(
                                        property: 'exercise',
                                        properties: [
                                            new OA\Property(property: 'enabled', type: 'boolean', example: true),
                                            new OA\Property(property: 'date', type: 'string', format: 'date', example: '2026-06-15'),
                                            new OA\Property(property: 'href', type: 'string', example: '/nutrition/my-diet/exercises?date=2026-06-15'),
                                            new OA\Property(property: 'loggedCount', type: 'integer', example: 1),
                                            new OA\Property(property: 'burnedCalories', type: 'integer', example: 180),
                                            new OA\Property(property: 'netCalories', type: 'integer', nullable: true, example: 540),
                                            new OA\Property(property: 'items', type: 'array', items: new OA\Items(type: 'object')),
                                        ],
                                        type: 'object',
                                        nullable: true,
                                    ),
                                ],
                                type: 'object',
                            ),
                            new OA\Property(
                                property: 'nullables',
                                description: 'برای هر بخش خالی دلیل null شدن را برمی گرداند؛ اگر بخش پر باشد مقدار همان کلید null است.',
                                type: 'object',
                                example: [
                                    'profile' => null,
                                    'subscription' => 'no_active_subscription',
                                    'currentPrescription' => 'no_current_prescription',
                                ],
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
        new OA\Response(response: 423, description: 'Nutrition access locked'),
    ],
)]
final class CustomerAppNutritionProfileApi
{
}
