<?php

declare(strict_types=1);

namespace App\OpenApi;

use OpenApi\Attributes as OA;

#[OA\Info(
    version: '1.0.0',
    title: 'Customer App API',
    description: 'API رسمی نسخه کاربر برای اپلیکیشن، با شروع از اطلاعات صفحه اصلی و ورود OTP.'
)]
#[OA\Server(
    url: '/',
    description: 'Current tenant domain'
)]
#[OA\SecurityScheme(
    securityScheme: 'bearerAuth',
    type: 'http',
    description: 'Sanctum Bearer token. Use: Authorization: Bearer <token>',
    scheme: 'bearer',
    bearerFormat: 'Sanctum'
)]
#[OA\Tag(name: 'Customer App', description: 'Customer App')]
#[OA\Tag(name: 'Customer App Auth', description: 'Customer App Auth')]
#[OA\Tag(name: 'Membership', description: 'Membership')]
#[OA\Tag(name: 'Supplementary Membership Questions', description: 'Supplementary Membership Questions')]
#[OA\Tag(name: 'Package Purchase', description: 'Package Purchase')]
#[OA\Get(
    path: '/api/v1/app/home',
    operationId: 'customerAppHome',
    description: 'فقط متن ها، تصویر و اکشن های اصلی صفحه home اپلیکیشن کاربر را برمی گرداند.',
    tags: ['Customer App'],
    parameters: [
        new OA\Parameter(
            name: 'domain',
            description: 'دامنه ای که باید برای ساخت URLهای خروجی استفاده شود. مثال: tenant.example.com',
            in: 'query',
            required: false,
            schema: new OA\Schema(type: 'string'),
            example: 'tenant.example.com',
        ),
    ],
    responses: [
        new OA\Response(
            response: 200,
            description: 'Home display data',
            content: new OA\JsonContent(
                required: ['success', 'data'],
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(property: 'message', type: 'string', nullable: true, example: null),
                    new OA\Property(
                        property: 'data',
                        properties: [
                            new OA\Property(
                                property: 'domain',
                                properties: [
                                    new OA\Property(property: 'host', type: 'string', example: 'tenant.example.com'),
                                    new OA\Property(property: 'baseUrl', type: 'string', example: 'https://tenant.example.com'),
                                ],
                                type: 'object',
                            ),
                            new OA\Property(
                                property: 'brand',
                                properties: [
                                    new OA\Property(property: 'name', type: 'string', example: 'دایـت'),
                                    new OA\Property(property: 'logoUrl', type: 'string', nullable: true, example: 'https://tenant.example.com/storage/branding/logo.png'),
                                    new OA\Property(property: 'faviconUrl', type: 'string', nullable: true, example: null),
                                ],
                                type: 'object',
                            ),
                            new OA\Property(
                                property: 'home',
                                properties: [
                                    new OA\Property(property: 'topBadge', type: 'string', example: 'وب اپلیکیشن دریافت رژیم'),
                                    new OA\Property(property: 'imageUrl', type: 'string', example: 'https://tenant.example.com/booking-app/nutrition-hero.jpg'),
                                    new OA\Property(property: 'eyebrow', type: 'string', example: 'شروع سبک زندگی دقیق‌تر'),
                                    new OA\Property(
                                        property: 'title',
                                        properties: [
                                            new OA\Property(property: 'beforeHighlight', type: 'string', example: 'برای دریافت رژیم اختصاصی'),
                                            new OA\Property(property: 'highlight', type: 'string', example: 'نسخه اختصاصی رژیم'),
                                            new OA\Property(property: 'afterHighlight', type: 'string', example: 'شروع کنید'),
                                        ],
                                        type: 'object',
                                    ),
                                    new OA\Property(property: 'description', type: 'string', example: 'برنامه غذایی شما می‌تواند بر اساس شرایط بدنی، سبک زندگی و هدف شخصیتان تنظیم شود.'),
                                    new OA\Property(
                                        property: 'quote',
                                        properties: [
                                            new OA\Property(property: 'label', type: 'string', example: 'شعار پیشنهادی'),
                                            new OA\Property(property: 'title', type: 'string', example: 'رژیمی که فقط یک لیست غذا نیست؛'),
                                            new OA\Property(property: 'subtitle', type: 'string', example: 'نقشه راهی برای سبک زندگی پایدار شماست.'),
                                        ],
                                        type: 'object',
                                    ),
                                    new OA\Property(
                                        property: 'actions',
                                        properties: [
                                            new OA\Property(property: 'booking', type: 'object'),
                                            new OA\Property(property: 'profile', type: 'object'),
                                        ],
                                        type: 'object',
                                    ),
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
    ],
)]
#[OA\Post(
    path: '/api/v1/app/auth/login',
    operationId: 'customerAppLogin',
    description: 'ارسال کد ورود به شماره موبایل کاربر tenant.',
    tags: ['Customer App Auth'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['mobile'],
            properties: [
                new OA\Property(property: 'mobile', type: 'string', example: '09123456789'),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(
            response: 200,
            description: 'OTP sent',
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(property: 'message', type: 'string', example: 'کد ورود ارسال شد.'),
                    new OA\Property(
                        property: 'data',
                        properties: [
                            new OA\Property(property: 'remainingSeconds', type: 'integer', example: 60),
                            new OA\Property(property: 'expiresIn', type: 'integer', nullable: true, example: 120),
                            new OA\Property(property: 'testMode', type: 'boolean', example: true),
                            new OA\Property(
                                property: 'code',
                                description: 'در حالت تست یا sandbox کد را برمی گرداند. در حالت واقعی مقدار null است.',
                                type: 'string',
                                example: '1234',
                                nullable: true,
                            ),
                        ],
                        type: 'object',
                    ),
                    new OA\Property(property: 'meta', type: 'object'),
                ],
                type: 'object',
            ),
        ),
        new OA\Response(response: 422, description: 'Validation or OTP sending error'),
        new OA\Response(response: 423, description: 'Tenant panel access is locked'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/auth/verify',
    operationId: 'customerAppVerify',
    description: 'تأیید کد OTP و صدور Bearer token برای اپلیکیشن.',
    tags: ['Customer App Auth'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['mobile', 'code'],
            properties: [
                new OA\Property(property: 'mobile', type: 'string', example: '09123456789'),
                new OA\Property(property: 'code', type: 'string', example: '1234'),
                new OA\Property(property: 'deviceName', type: 'string', nullable: true, example: 'ios-app'),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(
            response: 200,
            description: 'Logged in',
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(property: 'message', type: 'string', example: 'ورود با موفقیت انجام شد.'),
                    new OA\Property(
                        property: 'data',
                        properties: [
                            new OA\Property(property: 'accessToken', type: 'string', example: '1|plain-text-token'),
                            new OA\Property(property: 'tokenType', type: 'string', example: 'Bearer'),
                            new OA\Property(
                                property: 'expiresAt',
                                description: 'توکن اپلیکیشن انقضا ندارد و مقدار این فیلد null است.',
                                type: 'string',
                                format: 'date-time',
                                nullable: true,
                                example: null,
                            ),
                            new OA\Property(property: 'user', type: 'object'),
                            new OA\Property(
                                property: 'profileStatus',
                                properties: [
                                    new OA\Property(property: 'isNewUser', type: 'boolean', example: true),
                                    new OA\Property(property: 'hasFullName', type: 'boolean', example: false),
                                    new OA\Property(
                                        property: 'membershipFlow',
                                        description: 'completed یعنی ورود به خانه، start یعنی اولین مرحله عضویت، continue یعنی ادامه مراحل عضویت.',
                                        type: 'string',
                                        enum: ['completed', 'start', 'continue'],
                                        example: 'start',
                                    ),
                                    new OA\Property(property: 'missingFields', type: 'array', items: new OA\Items(type: 'string'), example: ['fullName']),
                                    new OA\Property(
                                        property: 'nextStep',
                                        type: 'string',
                                        enum: [
                                            '/home',
                                            '/membership/profile',
                                            '/membership/goal',
                                            '/membership/activity',
                                            '/membership/birth-date',
                                            '/membership/height',
                                            '/membership/weight',
                                            '/membership/target-weight',
                                            '/membership/result',
                                            '/membership/medical-conditions',
                                            '/membership/medications-and-supplements',
                                            '/membership/packages',
                                            '/membership/mindset',
                                        ],
                                        example: '/membership/profile',
                                    ),
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
        new OA\Response(response: 422, description: 'Invalid OTP or validation error'),
        new OA\Response(response: 423, description: 'Tenant panel access is locked'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/auth/me',
    operationId: 'customerAppMe',
    description: 'اطلاعات کاربر لاگین شده و وضعیت تکمیل نام را برمی گرداند.',
    security: [['bearerAuth' => []]],
    tags: ['Customer App Auth'],
    responses: [
        new OA\Response(response: 200, description: 'Authenticated user'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/auth/logout',
    operationId: 'customerAppLogout',
    description: 'توکن فعلی کاربر را revoke می کند.',
    security: [['bearerAuth' => []]],
    tags: ['Customer App Auth'],
    responses: [
        new OA\Response(response: 200, description: 'Logged out'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
    ],
)]
final class CustomerAppApi {}
