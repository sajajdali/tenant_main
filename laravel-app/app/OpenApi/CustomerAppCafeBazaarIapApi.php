<?php

declare(strict_types=1);

namespace App\OpenApi;

use OpenApi\Attributes as OA;

#[OA\Get(
    path: '/api/v1/app/nutrition/iap/cafebazaar/settings',
    operationId: 'nutritionCafeBazaarIapSettings',
    description: 'وضعیت فعال بودن پرداخت درون برنامه ای کافه بازار را برمی گرداند. Flutter فقط در Android نصب‌شده از بازار و وقتی enabled=true و server_api_configured=true است از این جریان استفاده کند. اعتبارسنجی و consume فقط در سرور انجام می‌شود.',
    security: [['bearerAuth' => []]],
    tags: ['Cafe Bazaar IAP'],
    responses: [
        new OA\Response(
            response: 200,
            description: 'Cafe Bazaar IAP settings',
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(
                        property: 'data',
                        properties: [
                            new OA\Property(property: 'enabled', type: 'boolean', example: true),
                            new OA\Property(property: 'server_api_configured', type: 'boolean', example: true),
                            new OA\Property(property: 'packageName', type: 'string', example: 'ir.example.nutrition'),
                            new OA\Property(property: 'store', type: 'string', example: 'cafebazaar'),
                            new OA\Property(property: 'paymentRoute', type: 'string', example: '/api/v1/app/nutrition/iap/cafebazaar'),
                            new OA\Property(property: 'consumeRequired', type: 'boolean', example: false, description: 'مصرف توسط backend انجام شده است؛ Flutter نباید consume کند.'),
                            new OA\Property(property: 'discountSupported', type: 'boolean', example: false),
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
    path: '/api/v1/app/nutrition/iap/cafebazaar/packages',
    operationId: 'nutritionCafeBazaarIapPackages',
    description: 'لیست پکیج های فعال قابل خرید با بازار را همراه شناسه محصول بازار (cafebazaarProductId) برمی گرداند. مدیر ابتدا محصول مصرفی را در پنل کافه بازار ایجاد می کند و سپس همان شناسه را در فیلد «شناسه محصول بازار» هر پکیج وارد می کند. این لیست مخصوص Flutter Android نصب شده از بازار است. وب اپلیکیشن برای نمایش/پرداخت پکیج ها از مسیرهای عادی پکیج و package-checkout استفاده می کند. قیمت پرداخت در بازار از پنل بازار خوانده می شود و این API قیمت وب سایت را مبنای شارژ بازار نمی داند.',
    security: [['bearerAuth' => []]],
    tags: ['Cafe Bazaar IAP'],
    responses: [
        new OA\Response(
            response: 200,
            description: 'Cafe Bazaar package products',
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(
                        property: 'data',
                        properties: [
                            new OA\Property(property: 'settings', type: 'object'),
                            new OA\Property(
                                property: 'items',
                                type: 'array',
                                items: new OA\Items(
                                    properties: [
                                        new OA\Property(property: 'id', type: 'string', example: '12'),
                                        new OA\Property(property: 'name', type: 'string', example: 'پکیج رژیم آنلاین یک ماهه'),
                                        new OA\Property(property: 'cafebazaarProductId', type: 'string', nullable: true, example: 'nutrition_package_basic'),
                                        new OA\Property(property: 'onlineDietCount', type: 'integer', example: 2),
                                        new OA\Property(property: 'offlineDietCount', type: 'integer', example: 0),
                                        new OA\Property(property: 'durationDays', type: 'integer', example: 30),
                                    ],
                                    type: 'object',
                                ),
                            ),
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
#[OA\Post(
    path: '/api/v1/app/nutrition/iap/cafebazaar/package-orders',
    operationId: 'nutritionCafeBazaarIapCreateOrder',
    description: 'قبل از باز کردن پرداخت بازار، اپلیکیشن باید سفارش pending بسازد. خروجی شامل order و productId است. productId را به SDK Bazaar بدهید و order.id را برای verify نگه دارید. اگر کاربر پکیج فعال با بیش از ۱۰ روز اعتبار باقی مانده دارد، سرور بدون replace_active_subscription=true خطای 422 می دهد؛ Flutter باید به کاربر توضیح دهد که خرید جدید پکیج قبلی را جایگزین می کند، نه تمدید تجمعی، سپس در صورت تأیید کاربر دوباره با replace_active_subscription=true درخواست بزند.',
    security: [['bearerAuth' => []]],
    tags: ['Cafe Bazaar IAP'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['nutrition_package_id'],
            properties: [
                new OA\Property(property: 'nutrition_package_id', type: 'integer', example: 12),
                new OA\Property(property: 'replace_active_subscription', type: 'boolean', nullable: true, example: false),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(
            response: 200,
            description: 'Pending Bazaar order created',
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'success', type: 'boolean', example: true),
                    new OA\Property(property: 'message', type: 'string', example: 'سفارش پرداخت بازار ساخته شد.'),
                    new OA\Property(
                        property: 'data',
                        properties: [
                            new OA\Property(property: 'order', type: 'object'),
                            new OA\Property(property: 'store', type: 'string', example: 'cafebazaar'),
                            new OA\Property(property: 'productId', type: 'string', example: 'nutrition_package_basic'),
                            new OA\Property(property: 'consumeRequired', type: 'boolean', example: false),
                            new OA\Property(property: 'discountSupported', type: 'boolean', example: false),
                        ],
                        type: 'object',
                    ),
                ],
                type: 'object',
            ),
        ),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Bazaar disabled, product id missing, or active package replacement confirmation required'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/nutrition/iap/cafebazaar/package-orders/{order}/verify',
    operationId: 'nutritionCafeBazaarIapVerifyOrder',
    description: 'پس از موفقیت purchaseProduct در Flutter، فقط package_name، product_id و purchase_token را ارسال کنید. سرور نام پکیج و شناسه محصول را با تنظیمات/سفارش مقایسه می‌کند، سپس با API رسمی Bazaar اعتبارسنجی می‌کند. فقط اگر purchaseState=0 باشد، سرور خودش خرید را با API consume مصرف کرده و پکیج را فعال می‌کند؛ consumptionState فقط برای ثبت و عیب‌یابی نگهداری می‌شود. Flutter نباید consumeProduct، signed_data، signature یا کلید Bazaar را استفاده/ارسال کند. پاسخ data.bazaarValidation و data.bazaarConsume پاسخ‌های واقعی Bazaar هستند.',
    security: [['bearerAuth' => []]],
    tags: ['Cafe Bazaar IAP'],
    parameters: [
        new OA\Parameter(name: 'order', description: 'شناسه سفارش pending ساخته شده قبل از پرداخت بازار.', in: 'path', required: true, schema: new OA\Schema(type: 'integer'), example: 45),
    ],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['package_name', 'product_id', 'purchase_token'],
            properties: [
                new OA\Property(property: 'package_name', type: 'string', example: 'ir.example.nutrition'),
                new OA\Property(property: 'product_id', type: 'string', example: 'nutrition_package_basic'),
                new OA\Property(property: 'purchase_token', type: 'string', example: 'bazaar-purchase-token'),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(response: 200, description: 'Bazaar purchase verified and package activated'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 404, description: 'Order not found for current user'),
        new OA\Response(response: 422, description: 'Invalid package/product/token, cancelled or already-consumed purchase, Bazaar API failure, expired order, or disabled gateway'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/nutrition/iap/cafebazaar/purchases/recover',
    operationId: 'nutritionCafeBazaarIapRecoverPurchases',
    description: 'برای retry خریدی که Flutter بعد از پرداخت آن بسته/قطع شده است. هر آیتم همان داده‌های verify را دارد؛ سرور خودش validate و consume می‌کند. Flutter نباید consumeProduct را صدا بزند.',
    security: [['bearerAuth' => []]],
    tags: ['Cafe Bazaar IAP'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['purchases'],
            properties: [
                new OA\Property(
                    property: 'purchases',
                    type: 'array',
                    items: new OA\Items(
                        required: ['order_id', 'package_name', 'product_id', 'purchase_token'],
                        properties: [
                            new OA\Property(property: 'order_id', type: 'integer', example: 45),
                            new OA\Property(property: 'package_name', type: 'string', example: 'ir.example.nutrition'),
                            new OA\Property(property: 'product_id', type: 'string', example: 'nutrition_package_basic'),
                            new OA\Property(property: 'purchase_token', type: 'string', example: 'bazaar-purchase-token'),
                        ],
                        type: 'object',
                    ),
                ),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(response: 200, description: 'Recovered purchases checked'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 422, description: 'Invalid recovered purchase'),
    ],
)]
final class CustomerAppCafeBazaarIapApi {}
