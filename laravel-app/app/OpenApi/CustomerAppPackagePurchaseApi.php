<?php

declare(strict_types=1);

namespace App\OpenApi;

use OpenApi\Attributes as OA;

#[OA\Post(
    path: '/api/v1/app/nutrition/package-checkout/preview',
    operationId: 'nutritionPackageCheckoutPreview',
    description: 'پیش نمایش خرید پکیج تغذیه را برمی گرداند و هر دو وضعیت پرداخت را جدا اعلام می کند: settings.enabled/settings.enabledGateways برای وب اپلیکیشن و درگاه پرداخت آنلاین است، و settings.cafebazaarEnabled برای اپلیکیشن Android نصب شده از کافه بازار است. فعال بودن بازار نباید درگاه پرداخت آنلاین را غیرفعال کند. اگر کلاینت وب بود از /package-checkout/pay استفاده شود؛ اگر کلاینت Android و نصب شده از بازار بود و settings.cafebazaarEnabled=true بود، از مسیر جداگانه /api/v1/app/nutrition/iap/cafebazaar استفاده شود. تخفیف وب در مسیر بازار اعمال نمی شود. UX: با tap روی کارت هر پکیج، preview و سپس pay همان پکیج را شروع کنید؛ CTAهای ادامه/مشاهده فاکتور را حذف نکنید، اما انتخاب کارت نباید به آن ها وابسته باشد.',
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
                            new OA\Property(
                                property: 'settings',
                                properties: [
                                    new OA\Property(property: 'enabled', description: 'فعال بودن پرداخت آنلاین/درگاه اصلی برای وب اپلیکیشن.', type: 'boolean', example: true),
                                    new OA\Property(property: 'sandboxEnabled', type: 'boolean', example: false),
                                    new OA\Property(property: 'provider', type: 'string', nullable: true, example: 'zarinpal'),
                                    new OA\Property(property: 'enabledGateways', description: 'درگاه های قابل استفاده برای مسیر وب/درگاه اصلی.', type: 'array', items: new OA\Items(type: 'string'), example: ['zarinpal']),
                                    new OA\Property(property: 'cafebazaarEnabled', description: 'فعال بودن پرداخت درون برنامه ای بازار برای Flutter Android نصب شده از بازار. این مقدار مستقل از درگاه اصلی است.', type: 'boolean', example: true),
                                    new OA\Property(property: 'cafebazaarRoute', type: 'string', example: '/api/v1/app/nutrition/iap/cafebazaar'),
                                    new OA\Property(property: 'gatewayOptions', type: 'array', items: new OA\Items(type: 'object')),
                                ],
                                type: 'object',
                            ),
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
    description: 'سفارش خرید پکیج تغذیه برای مسیر وب/درگاه پرداخت آنلاین را ایجاد می کند. قرارداد اجباری برای mode=gateway: سرور همیشه data.paymentUrl را به‌صورت URL کامل HTTPS برمی گرداند و Flutter/Web فقط همان URL را با مرورگر سیستم یا WebView باز می کند؛ کلاینت نباید نام یا سازوکار درگاه، callback، token، پارامترهای فرم، redirectForm یا verify را مدیریت کند. اگر درگاه برای ورود نیازمند POST/form باشد، سرور باید paymentUrl را به یک صفحه واسط امن خودش بدهد تا فرم را server-side/در همان صفحه submit کند. redirectForm فقط برای سازگاری نسخه های قدیمی optional است و کلاینت جدید نباید از آن استفاده کند. بازگشت درگاه به callback سرور می رود، سرور پرداخت را verify می کند و سپس به صفحه وب نتیجه هدایت می کند؛ آن صفحه دکمه «بازگشت به اپلیکیشن» دارد. این endpoint همچنان برای وب اپلیکیشن استفاده می شود، حتی اگر بازار هم فعال باشد. این endpoint برای پرداخت درون برنامه ای بازار نیست؛ Android نصب شده از بازار باید از مسیرهای Cafe Bazaar IAP استفاده کند. قانون بسیار مهم تمدید/جایگزینی: اگر کاربر پکیج فعال قبلی داشته باشد، خرید موفق پکیج جدید، همه subscription های فعال قبلی همان کاربر را expired می کند و subscription جدید با startsAt برابر تاریخ خرید و endsAt برابر تاریخ خرید + durationDays پکیج جدید ساخته می شود. اعتبار پکیج جدید به روزهای باقی مانده پکیج قبلی اضافه نمی شود. اگر پکیج قبلی بیش از ۱۰ روز اعتبار داشته باشد، سرور بدون replace_active_subscription=true خطای 422 می دهد تا Flutter تأیید کاربر را بگیرد.',
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
                new OA\Property(property: 'replace_active_subscription', description: 'اگر کاربر پکیج فعال با بیش از ۱۰ روز اعتبار باقی مانده دارد، برای تأیید جایگزینی و شروع پکیج جدید از تاریخ خرید باید true ارسال شود.', type: 'boolean', nullable: true, example: true),
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
                            new OA\Property(property: 'paymentUrl', description: 'برای mode=gateway اجباری و URL کامل HTTPS است. Flutter/Web باید آن را باز کند. برای mode=sandbox مقدار null است.', type: 'string', format: 'uri', nullable: true, example: 'https://tenant.example.com/nutrition-package-payments/45/redirect?token=opaque-one-time-token'),
                            new OA\Property(property: 'redirectForm', description: 'فقط سازگاری نسخه های قدیمی؛ کلاینت Flutter جدید نباید آن را پردازش کند.', type: 'object', nullable: true),
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
    path: '/api/v1/app/nutrition/package-checkout/orders/{order}',
    operationId: 'nutritionPackageCheckoutOrderStatus',
    description: 'وضعیت قطعی یک سفارش پکیج را فقط برای مالک همان سفارش برمی گرداند. Flutter پس از بازگشت از بانک باید این endpoint را با Bearer token صدا بزند؛ query صفحه بازگشت معیار موفقیت نیست.',
    security: [['bearerAuth' => []]],
    tags: ['Package Purchase'],
    parameters: [new OA\Parameter(name: 'order', in: 'path', required: true, schema: new OA\Schema(type: 'integer'), example: 45)],
    responses: [new OA\Response(response: 200, description: 'Verified order status'), new OA\Response(response: 401, description: 'Unauthenticated'), new OA\Response(response: 404, description: 'Order not found or not owned by current user')],
)]
#[OA\Get(
    path: '/nutrition-package-payments/{order}/callback',
    operationId: 'nutritionPackagePaymentCallback',
    description: 'Callback درگاه پرداخت پکیج تغذیه؛ فقط برای درگاه پرداخت آنلاین است و Flutter/Web هرگز نباید آن را صدا بزند. سرور بدون اعتماد به query/browser result، تراکنش را verify می کند و سپس با 302 به صفحه وب نتیجه /nutrition/membership/package-result هدایت می کند. نتیجه موفق شامل status=success، order، invoice، reference و endsAt است و نتیجه ناموفق status=failed و tracking دارد.',
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
#[OA\Get(
    path: '/nutrition/membership/package-result',
    operationId: 'nutritionPackagePaymentResultPage',
    description: 'صفحه وب نتیجه پرداخت پکیج، که فقط از callback تأییدشده سرور باز می شود. این صفحه باید وضعیت success/failed/pending، شناسه پیگیری غیرحساس و دکمه «بازگشت به اپلیکیشن» را نمایش دهد. دکمه ابتدا deep link ثبت‌شده اپلیکیشن را باز می کند و اگر قابل باز شدن نبود، کاربر را در همین صفحه وب نگه می دارد؛ پرداخت فقط با query تأیید نمی شود و داده نهایی با GET /api/v1/app/nutrition/package-checkout/summary تازه‌سازی می شود.',
    tags: ['Package Purchase'],
    parameters: [
        new OA\Parameter(name: 'status', in: 'query', required: true, schema: new OA\Schema(type: 'string', enum: ['success', 'failed', 'pending']), example: 'success'),
        new OA\Parameter(name: 'order', in: 'query', required: false, schema: new OA\Schema(type: 'integer'), example: 45),
        new OA\Parameter(name: 'invoice', in: 'query', required: false, schema: new OA\Schema(type: 'string'), example: 'NP-20260814-000045'),
        new OA\Parameter(name: 'reference', in: 'query', required: false, schema: new OA\Schema(type: 'string'), example: '123456'),
    ],
    responses: [new OA\Response(response: 200, description: 'HTML payment result page')],
)]
final class CustomerAppPackagePurchaseApi {}
