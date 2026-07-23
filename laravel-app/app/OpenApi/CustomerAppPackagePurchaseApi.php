<?php

declare(strict_types=1);

namespace App\OpenApi;

use OpenApi\Attributes as OA;

#[OA\Post(
    path: '/api/v1/app/nutrition/package-checkout/preview',
    operationId: 'nutritionPackageCheckoutPreview',
    description: 'پیش نمایش خرید پکیج تغذیه را بر اساس پکیج انتخاب شده و کد تخفیف اختیاری برمی گرداند.',
    security: [['bearerAuth' => []]],
    tags: ['Package Purchase'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['nutrition_package_id'],
            properties: [
                new OA\Property(property: 'nutrition_package_id', type: 'integer', example: 12),
                new OA\Property(property: 'discount_code', type: 'string', nullable: true, example: 'SUMMER20'),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(
            response: 200,
            description: 'Package checkout preview',
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(
                        property: 'data',
                        properties: [
                            new OA\Property(property: 'package', type: 'object'),
                            new OA\Property(property: 'amount', type: 'integer', example: 900000),
                            new OA\Property(property: 'discountAmount', type: 'integer', example: 150000),
                            new OA\Property(property: 'payableAmount', type: 'integer', example: 750000),
                            new OA\Property(property: 'discountCode', type: 'object', nullable: true),
                            new OA\Property(property: 'settings', type: 'object'),
                        ],
                        type: 'object',
                    ),
                ],
                type: 'object',
            ),
        ),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Validation error'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/nutrition/package-checkout/pay',
    operationId: 'nutritionPackageCheckoutPay',
    description: 'سفارش خرید پکیج تغذیه را ایجاد می کند و در حالت پرداخت آنلاین فرم/آدرس انتقال به درگاه را برمی گرداند. در sandbox اشتراک بلافاصله فعال می شود.',
    security: [['bearerAuth' => []]],
    tags: ['Package Purchase'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['nutrition_package_id'],
            properties: [
                new OA\Property(property: 'nutrition_package_id', type: 'integer', example: 12),
                new OA\Property(property: 'gateway', type: 'string', nullable: true, example: 'zarinpal'),
                new OA\Property(property: 'discount_code', type: 'string', nullable: true, example: 'SUMMER20'),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(
            response: 200,
            description: 'Checkout created',
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(property: 'message', type: 'string', example: 'در حال انتقال به درگاه پرداخت...'),
                    new OA\Property(
                        property: 'data',
                        properties: [
                            new OA\Property(property: 'mode', type: 'string', enum: ['gateway', 'sandbox'], example: 'gateway'),
                            new OA\Property(property: 'order', type: 'object'),
                            new OA\Property(property: 'subscription', ref: '#/components/schemas/NutritionPackageSubscriptionBalance', nullable: true),
                            new OA\Property(property: 'redirectForm', type: 'object', nullable: true),
                        ],
                        type: 'object',
                    ),
                ],
                type: 'object',
            ),
        ),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Validation or payment setup error'),
    ],
)]
#[OA\Get(
    path: '/api/v1/app/nutrition/package-checkout/summary',
    operationId: 'nutritionPackageCheckoutSummary',
    description: 'اشتراک فعال پکیج تغذیه و تاریخچه سفارش های کاربر جاری را برمی گرداند.',
    security: [['bearerAuth' => []]],
    tags: ['Package Purchase'],
    parameters: [
        new OA\Parameter(
            name: 'per_page',
            description: 'تعداد سفارش ها در هر صفحه.',
            in: 'query',
            required: false,
            schema: new OA\Schema(type: 'integer', default: 10),
            example: 10,
        ),
    ],
    responses: [
        new OA\Response(
            response: 200,
            description: 'Package purchase summary',
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(
                        property: 'data',
                        properties: [
                            new OA\Property(property: 'subscription', type: 'object', nullable: true),
                            new OA\Property(property: 'orders', type: 'object'),
                        ],
                        type: 'object',
                    ),
                ],
                type: 'object',
            ),
        ),
        new OA\Response(response: 401, description: 'Unauthenticated'),
    ],
)]
#[OA\Get(
    path: '/nutrition-package-payments/{order}/callback',
    operationId: 'nutritionPackagePaymentCallback',
    description: 'Callback درگاه پرداخت پکیج تغذیه. پس از verify، کاربر به صفحه نتیجه خرید پکیج هدایت می شود.',
    tags: ['Package Purchase'],
    parameters: [
        new OA\Parameter(
            name: 'order',
            description: 'شناسه سفارش پکیج تغذیه.',
            in: 'path',
            required: true,
            schema: new OA\Schema(type: 'integer'),
            example: 45,
        ),
    ],
    responses: [
        new OA\Response(response: 302, description: 'Redirects to package purchase result page'),
        new OA\Response(response: 404, description: 'Order not found'),
    ],
)]
final class CustomerAppPackagePurchaseApi {}
