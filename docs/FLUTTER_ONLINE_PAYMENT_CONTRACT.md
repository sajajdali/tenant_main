# قرارداد Flutter: خرید پکیج و پرداخت آنلاین

این قرارداد فقط برای پرداخت آنلاین پکیج تغذیه است. Flutter نام درگاه، SDK، callback، فرم POST یا verify را پردازش نمی‌کند.

## تنظیم مدیر

«فعال‌سازی تنظیمات اپلیکیشن اندروید» را روشن و `آدرس وب اپلیکیشن` را وارد کنید؛ مانند `https://app.zodfit.com/payment-result`. پس از callback بانک، صفحهٔ نتیجهٔ سایت دکمهٔ بازگشت به `https://app.zodfit.com/payment-result?order=45` را نشان می‌دهد. `order` فقط شناسهٔ سفارش است و نشانهٔ موفقیت پرداخت نیست.

## جریان Flutter

1. `POST /api/v1/app/nutrition/package-checkout/preview` را با `nutrition_package_id` بزنید.
2. پس از تأیید کاربر، `POST /api/v1/app/nutrition/package-checkout/pay` را بزنید و فقط `data.paymentUrl` را باز کنید.
3. callback و verify کاملاً سمت سرور است. پس از بازگشت به وب‌اپ، `order` را از URL بخوانید.
4. با Bearer token این route را صدا بزنید: `GET /api/v1/app/nutrition/package-checkout/orders/{order}`.
5. فقط اگر `data.order.status` برابر `paid` بود موفقیت را نمایش دهید؛ سپس `GET /api/v1/app/nutrition/package-checkout/summary` را refresh کنید.

## Swagger

| Route | کاربرد |
| --- | --- |
| `POST /api/v1/app/nutrition/package-checkout/preview` | پیش‌نمایش مبلغ تومان |
| `POST /api/v1/app/nutrition/package-checkout/pay` | ساخت سفارش و دریافت URL بانک |
| `GET /api/v1/app/nutrition/package-checkout/orders/{order}` | وضعیت امن سفارش کاربر جاری |
| `GET /api/v1/app/nutrition/package-checkout/summary` | اشتراک و تاریخچه سفارش |

`GET /nutrition-package-payments/{order}/callback` فقط مقصد بانک است و Flutter هرگز آن را صدا نمی‌زند.

## مبالغ Maliart

تمام مبلغ‌های محصول و API داخلی تومان هستند. سرور برای Maliart مبلغ را در ۱۰ ضرب و با `currency=IRR` ارسال می‌کند؛ هنگام verify نیز مبلغ ریالی را به تومان تبدیل و با سفارش مقایسه می‌کند. Flutter نباید تبدیل مبلغ انجام دهد.
