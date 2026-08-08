<?php

declare(strict_types=1);

namespace App\OpenApi;

use OpenApi\Attributes as OA;

#[OA\Get(
    path: '/api/v1/app/nutrition/iap/cafebazaar/settings',
    operationId: 'nutritionCafeBazaarIapSettings',
    description: 'وضعیت فعال بودن پرداخت درون برنامه ای کافه بازار را برمی گرداند. اگر enabled برابر false بود، اپلیکیشن Flutter نباید مسیر بازار را شروع کند و باید از مسیر عادی package-checkout استفاده کند.',
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
                            new OA\Property(property: 'public_key_configured', type: 'boolean', example: true),
                            new OA\Property(property: 'store', type: 'string', example: 'cafebazaar'),
                            new OA\Property(property: 'paymentRoute', type: 'string', example: '/api/v1/app/nutrition/iap/cafebazaar'),
                            new OA\Property(property: 'consumeRequired', type: 'boolean', example: true),
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
    description: 'لیست پکیج های فعال قابل خرید با بازار را همراه شناسه محصول بازار برمی گرداند. قیمت پرداخت در بازار از پنل بازار خوانده می شود و این API قیمت وب سایت را مبنای شارژ بازار نمی داند.',
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
    description: 'قبل از باز کردن پرداخت بازار، اپلیکیشن باید سفارش pending بسازد. خروجی شامل order، productId و developerPayload است. همین developerPayload باید به purchaseProduct در Poolakey داده شود و بعد در verify عینا برگردد.',
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
                            new OA\Property(property: 'developerPayload', type: 'string', example: 'base64-signed-payload'),
                            new OA\Property(property: 'consumeRequired', type: 'boolean', example: true),
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
    description: 'بعد از موفق شدن purchaseProduct در Flutter، رسید بازار باید به این endpoint ارسال شود. سرور user، order، productId، developerPayload و یکتا بودن purchaseToken را کنترل می کند و فقط بعد از تایید، پکیج را paid و subscription را active می کند. سپس Flutter باید چون consumeRequired=true است، consumeProduct(purchaseToken) را در Poolakey صدا بزند.',
    security: [['bearerAuth' => []]],
    tags: ['Cafe Bazaar IAP'],
    parameters: [
        new OA\Parameter(name: 'order', description: 'شناسه سفارش pending ساخته شده قبل از پرداخت بازار.', in: 'path', required: true, schema: new OA\Schema(type: 'integer'), example: 45),
    ],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['product_id', 'purchase_token', 'developer_payload', 'signed_data', 'signature'],
            properties: [
                new OA\Property(property: 'product_id', type: 'string', example: 'nutrition_package_basic'),
                new OA\Property(property: 'purchase_token', type: 'string', example: 'bazaar-purchase-token'),
                new OA\Property(property: 'store_order_id', type: 'string', nullable: true, example: 'GPA.1234-5678'),
                new OA\Property(property: 'developer_payload', type: 'string', example: 'base64-signed-payload'),
                new OA\Property(property: 'purchase_time', nullable: true, oneOf: [new OA\Schema(type: 'integer'), new OA\Schema(type: 'string')], example: 1786180000000),
                new OA\Property(property: 'purchase_state', type: 'string', nullable: true, example: 'purchased'),
                new OA\Property(property: 'signed_data', type: 'string', description: 'رشته خام signed purchase data که بازار امضا کرده است. سرور همین رشته را با کلید عمومی RSA بازار verify می کند.', example: '{"orderId":"...","packageName":"...","productId":"nutrition_package_basic","purchaseToken":"..."}'),
                new OA\Property(property: 'raw_purchase', type: 'object', nullable: true),
                new OA\Property(property: 'signature', type: 'string', description: 'امضای base64 بازار برای signed_data.', example: 'MEUCIQD...'),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(response: 200, description: 'Bazaar purchase verified and package activated'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
        new OA\Response(response: 404, description: 'Order not found for current user'),
        new OA\Response(response: 422, description: 'Invalid product, payload, token, expired order, or disabled gateway'),
    ],
)]
#[OA\Post(
    path: '/api/v1/app/nutrition/iap/cafebazaar/purchases/recover',
    operationId: 'nutritionCafeBazaarIapRecoverPurchases',
    description: 'برای بازیابی خریدهای مصرف نشده بازار. Flutter در شروع برنامه getPurchasedProducts را از Poolakey می خواند و هر خرید مصرف نشده مربوط به پکیج را با order_id ذخیره شده قبلی به این مسیر می فرستد. بعد از موفقیت هر آیتم، consumeProduct همان purchaseToken انجام شود.',
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
                        required: ['order_id', 'product_id', 'purchase_token', 'developer_payload', 'signed_data', 'signature'],
                        properties: [
                            new OA\Property(property: 'order_id', type: 'integer', example: 45),
                            new OA\Property(property: 'product_id', type: 'string', example: 'nutrition_package_basic'),
                            new OA\Property(property: 'purchase_token', type: 'string', example: 'bazaar-purchase-token'),
                            new OA\Property(property: 'store_order_id', type: 'string', nullable: true),
                            new OA\Property(property: 'developer_payload', type: 'string'),
                            new OA\Property(property: 'purchase_time', nullable: true, oneOf: [new OA\Schema(type: 'integer'), new OA\Schema(type: 'string')]),
                            new OA\Property(property: 'purchase_state', type: 'string', nullable: true),
                            new OA\Property(property: 'signed_data', type: 'string'),
                            new OA\Property(property: 'raw_purchase', type: 'object', nullable: true),
                            new OA\Property(property: 'signature', type: 'string'),
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
#[OA\Post(
    path: '/api/v1/app/nutrition/iap/cafebazaar/purchases/consumed',
    operationId: 'nutritionCafeBazaarIapMarkConsumed',
    description: 'بعد از اینکه Flutter با موفقیت consumeProduct را در Poolakey انجام داد، purchaseToken را اینجا گزارش کند تا رسید در سرور consumed علامت بخورد. فعال شدن پکیج وابسته به این endpoint نیست؛ فعال شدن در verify انجام شده است.',
    security: [['bearerAuth' => []]],
    tags: ['Cafe Bazaar IAP'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['purchase_token'],
            properties: [
                new OA\Property(property: 'purchase_token', type: 'string', example: 'bazaar-purchase-token'),
            ],
            type: 'object',
        ),
    ),
    responses: [
        new OA\Response(response: 200, description: 'Receipt marked consumed when found'),
        new OA\Response(response: 401, description: 'Unauthenticated'),
    ],
)]
final class CustomerAppCafeBazaarIapApi {}
