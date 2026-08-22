# اتصال Flutter به پرداخت درون‌برنامه‌ای کافه‌بازار

این راهنما فقط برای نسخه Android که از کافه‌بازار نصب شده است و فقط برای خرید پکیج‌های تغذیه است. پرداخت وب، درگاه‌های دیگر و کلیدهای سرور Bazaar بخشی از این جریان نیستند.

## تنظیم اولیه مدیر

در تنظیمات پرداخت، «درگاه پرداخت بازار برای اپلیکیشن» را فعال کنید و این دو مقدار را ثبت کنید:

- `packageName`: نام package واقعی APK، مانند `ir.example.nutrition`
- `Pishkhan API token`

توکن API پیشخوان را از پیشخوان بازار → «API پیشخوان بازار» دریافت کنید. این توکن فقط روی سرور ذخیره می‌شود و API تنظیمات آن را برنمی‌گرداند. برای هر پکیج تغذیه فعال نیز مقدار `cafebazaarProductId` را برابر Product ID محصول **مصرفی** همان پکیج در پنل Bazaar قرار دهید. قیمت خرید، قیمت تعریف‌شده در Bazaar است؛ قیمت وب را برای خرید Bazaar نمایش/مبنا قرار ندهید.

## امنیت و قانون قطعی

Flutter فقط خرید را با SDK/کتابخانه Bazaar انجام می‌دهد. اعتبارسنجی و مصرف فقط در backend انجام می‌شود. Flutter نباید توکن API پیشخوان، درخواست مستقیم به `pardakht.cafebazaar.ir`، `consumeProduct`، `signed_data` یا `signature` را ارسال یا نگهداری کند.

سرور این ترتیب را اجرا می‌کند:

1. شناسه کاربر از Bearer token API خود سامانه و سفارش pending از URL خوانده می‌شود.
2. `package_name` با تنظیمات سرور و `product_id` با شناسه محصول ثبت‌شده برای پکیج سفارش مقایسه می‌شود.
3. سرور با هدر `CAFEBAZAAR-PISHKHAN-API-SECRET`، `validate` را فراخوانی می‌کند.
4. فقط `purchaseState = 0` موفق تلقی می‌شود؛ `consumptionState` برای ثبت و عیب‌یابی نگهداری می‌شود.
5. سرور `consume` را فراخوانی می‌کند؛ فقط پس از پاسخ موفق آن، پکیج و subscription فعال می‌شود.
6. توکن خرید یکتا است و برای سفارش/کاربر دیگر دوباره قابل استفاده نیست. تکرار همان درخواست پس از موفقیت idempotent است و همان نتیجه قبلی را برمی‌گرداند.

## مسیرهای Swagger که Flutter استفاده می‌کند

Base URL همان دامنه tenant است. همه مسیرهای زیر به `Authorization: Bearer <tenant-access-token>` نیاز دارند.

1. `GET /api/v1/app/nutrition/iap/cafebazaar/settings`

ابتدا چک کنید `data.enabled` و `data.server_api_configured` هر دو `true` باشند. `data.packageName` را برای مرحله نهایی استفاده کنید.

2. `GET /api/v1/app/nutrition/iap/cafebazaar/packages`

کارت‌های پکیج را از `data.items` نمایش دهید. فقط آیتمی را بخرید که `cafebazaarProductId` خالی نیست. همان شناسه را به SDK Bazaar بدهید.

3. `POST /api/v1/app/nutrition/iap/cafebazaar/package-orders`

پیش از باز کردن خرید Bazaar سفارش pending بسازید:

```json
{ "nutrition_package_id": 12, "replace_active_subscription": false }
```

`data.order.id` را امن در حافظه/ذخیره موقت نگه دارید. `data.productId` باید دقیقاً با Product ID ارسالی به SDK برابر باشد. اگر پاسخ `422` شامل `replace_active_subscription` بود، به کاربر اعلام کنید پکیج جدید اعتبار قبلی را جمع نمی‌کند و جایگزین می‌کند؛ پس از تأیید، همان درخواست را با `true` تکرار کنید.

4. SDK Bazaar

با Product ID خروجی مرحله قبل، جریان خرید محصول مصرفی Bazaar را شروع کنید. پس از خرید موفق، فقط `purchaseToken` را از نتیجه SDK بردارید. در صورت لغو، pending، خطای SDK یا نبود token، endpoint سرور را صدا نزنید و پکیج را فعال ندانید.

5. `POST /api/v1/app/nutrition/iap/cafebazaar/package-orders/{order}/verify`

این endpoint نهایی و تنها endpoint لازم برای تایید و consume است. `order` همان `data.order.id` مرحله 3 است.

```json
{
  "package_name": "ir.example.nutrition",
  "product_id": "nutrition_package_basic",
  "purchase_token": "token-returned-by-bazaar-sdk"
}
```

در پاسخ 200، `data.order` و `data.subscription` نشان می‌دهند پکیج فعال شده است. `data.bazaarValidation` پاسخ validate Bazaar و `data.bazaarConsume` پاسخ consume Bazaar هستند و برای لاگ/عیب‌یابی در دسترس‌اند. نمونه موفق validate مطابق Bazaar:

```json
{
  "consumptionState": 0,
  "purchaseState": 0,
  "kind": "androidpublisher#inappPurchase",
  "developerPayload": "something",
  "purchaseTime": 1414181378566
}
```

Flutter فقط موفقیت HTTP 200 endpoint خودمان را معیار نمایش موفقیت قرار دهد؛ consume دیگری انجام ندهد. مقدار `consumptionState` در validate برای رد کردن خرید تازه استفاده نمی‌شود؛ معیار تأیید خرید `purchaseState: 0` است.

## مدیریت خطا و retry

- `401`: کاربر لاگین نیست یا access token tenant منقضی است؛ ورود/refresh سپس درخواست را تکرار کنید.
- `404`: سفارش متعلق به این کاربر نیست/یافت نشد، یا Bazaar package/product/token را پیدا نکرده است. خرید را موفق نشان ندهید.
- `422`: نام پکیج یا Product ID نادرست است؛ خرید لغو/ناموفق است؛ قبلاً consume شده؛ سفارش منقضی شده؛ یا تنظیمات/ارتباط Bazaar مشکل دارد. پیام `errors` را ثبت کنید؛ فقط خطاهای موقتی شبکه را با همان `order` و همان token retry کنید.
- timeout یا قطع شبکه: نتیجه را نامعلوم نگه دارید، token و order را نگه دارید و endpoint verify را با همان داده دوباره صدا بزنید. هرگز خرید جدیدی با token قبلی ایجاد نکنید.

## بازیابی پس از بسته‌شدن اپ

اگر خرید SDK انجام شد اما پاسخ نهایی backend دریافت نشد، `order.id` و `purchaseToken` را locally تا زمان دریافت 200 نگه دارید. در شروع بعدی اپ، همان verify را retry کنید. مسیر batch `POST /purchases/recover` نیز برای صف بازیابی موجود است؛ هر آیتم `order_id`، `package_name`، `product_id` و `purchase_token` دارد. برای جریان عادی، endpoint verify تکی را ترجیح دهید.

## چک‌لیست QA

- APK واقعاً با همان package name در Bazaar منتشر/تست شده باشد.
- هر پکیج داخلی دقیقاً یک Product ID مصرفی Bazaar داشته باشد.
- خرید موفق: validate=`purchaseState:0` و consume موفق، سپس subscription فعال.
- خرید لغوشده، product اشتباه، package اشتباه و token جعلی: هیچ subscription فعالی ایجاد نشود.
- ارسال دوباره همان verify موفق: subscription/اعتبار دوبار ساخته نشود.
- قطع شبکه پس از خرید: retry همان token و order کار کند.
- بررسی کنید هیچ secret یا access token در APK، لاگ کلاینت یا درخواست Flutter وجود ندارد.
