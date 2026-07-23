# راهنمای درگاه مرکزی Maliart

> این فایل مرجع اصلی کارهای AI و توسعه‌دهنده درباره پرداخت، شارژ اعتبار پیامک و اتصال `maliart.ir` است. قبل از تغییر این بخش‌ها، این فایل و سپس کدهای معرفی‌شده در بخش «نقشه کد» کامل خوانده شوند.

## جمع‌بندی وضعیت فعلی

در پروژه دو مفهوم مستقل وجود دارد:

1. **پرداخت شارژ اعتبار پیامک:** در کد Laravel به درگاه مرکزی `https://maliart.ir` متصل شده است. وقتی `MALIART_PAYMENT_ENABLED=true` باشد، خرید اعتبار پیامک از Maliart پرداخت و سپس با استعلام وضعیت تأیید می‌شود.
2. **ارسال خود پیامک:** به Maliart متصل نیست. ارسال پیامک فعلاً فقط با `KavenegarSmsProvider` و API کاوه‌نگار انجام می‌شود.

در محیط محلی بررسی‌شده در تاریخ ۱۴۰۵/۰۴/۲۱ (2026-07-12)، متغیرهای `MALIART_PAYMENT_*` در `laravel-app/.env` وجود نداشتند. در نتیجه اطلاعات اتصال Maliart در اجرای فعلی کامل نیست، هرچند پیاده‌سازی آن در کد وجود دارد.

فعال‌سازی عملیاتی از تیک مستقل «درگاه واسط Maliart» در `/admin/system-settings` انجام می‌شود. اگر هنوز تنظیمی در دیتابیس ذخیره نشده باشد، `MALIART_PAYMENT_ENABLED` فقط به‌عنوان fallback سازگاری نسخه‌های قبلی استفاده می‌شود. ارتباط ساده است و Client ID، Secret، HMAC و webhook ندارد.

## معماری و جریان پرداخت

Maliart یک برنامه PHP مستقل در پوشه `maliart-payment-standalone/` است و نباید به فایل‌ها یا دیتابیس BarberBook وابسته شود.

جریان شارژ پیامک به این صورت است:

1. پنل tenant درخواست شارژ را به `POST /api/v1/sms-top-up/pay` می‌فرستد.
2. `SmsTopUpPaymentService` یک رکورد pending در دیتابیس مرکزی می‌سازد.
3. اگر Maliart فعال باشد، `MaliartPaymentClient` یک درخواست امضاشده به `POST https://maliart.ir/payment.php?action=create` می‌فرستد.
4. Maliart تراکنش را می‌سازد، با درگاه زرین‌پال ارتباط می‌گیرد و `payment_id` و `payment_url` برمی‌گرداند.
5. مرورگر کاربر به `payment_url` هدایت می‌شود و پس از پرداخت به callback خود BarberBook بازمی‌گردد.
6. BarberBook به نتیجه مرورگر اعتماد نمی‌کند؛ با `GET /payment.php?action=status&payment_id=...` وضعیت را از Maliart استعلام می‌کند.
7. فقط اگر وضعیت `paid` و همچنین `order_id`، مبلغ و ارز دقیقاً مطابق باشند، اعتبار پیامک در تراکنش دیتابیس به tenant افزوده می‌شود. تکرار callback باعث شارژ دوباره نمی‌شود.

Maliart امکان webhook امضاشده و retry را نیز دارد، اما مسیر شارژ پیامک فعلی BarberBook تأیید نهایی را از طریق callback و endpoint استعلام انجام می‌دهد. return URL مرورگر به‌تنهایی مدرک پرداخت نیست.

## نصب سرویس مستقل روی maliart.ir

راهنمای جزئی سرویس مستقل در `maliart-payment-standalone/README.md` قرار دارد. خلاصه مراحل:

1. محتوای `maliart-payment-standalone/` را در document root دامنه دارای HTTPS معتبر آپلود کنید.
2. یک دیتابیس مستقل بسازید و `payment-app/database/schema.sql` را اجرا کنید. اگر نصب قدیمی است، migrationهای همان پوشه را نیز اجرا کنید.
3. فایل `.env` را از `.env.example` بسازید و دیتابیس، Merchant ID زرین‌پال و تنظیمات production/sandbox را تکمیل کنید.
4. مطمئن شوید فقط `payment.php` endpoint عمومی اصلی است و فایل `.env`، کد برنامه، storage و SQL از وب قابل دریافت نیستند.
5. cleanup دیتابیس را زمان‌بندی کنید.
6. ابتدا با sandbox و secret آزمایشی کل جریان را تست کنید؛ سپس Merchant ID واقعی و production را فعال کنید.

## فعال‌سازی در BarberBook

اطلاعات اتصال را فقط در `laravel-app/.env` سرور وارد کنید؛ secret را در Git ثبت نکنید:

```dotenv
# fallback قدیمی؛ در نسخه فعلی تیک اصلی از /admin/system-settings کنترل می‌شود
MALIART_PAYMENT_ENABLED=false
MALIART_PAYMENT_BASE_URL=https://maliart.ir
MALIART_PAYMENT_TIMEOUT_SECONDS=20
```

سپس cache تنظیمات Laravel را پاک کنید:

```bash
cd laravel-app
php artisan optimize:clear
```

اگر queue worker یا Octane فعال است، پس از تغییر env آن‌ها را restart کنید. سپس در `/admin/system-settings` تیک مستقل «درگاه واسط Maliart» را فعال کنید. فعال شدن Maliart سراسری است و مسیر شارژ اعتبار پیامک و سفارش‌های لندینگ Maliart را بر درگاه‌های مرکزی مستقیم مقدم می‌کند.

## دامنه‌های مختلف tenant

هر درخواست create آدرس `return_url` همان tenant را ارسال می‌کند. Maliart آدرس را همراه تراکنش ذخیره می‌کند و پس از نتیجه پرداخت، `payment_id`، `order_id` و status را به query آن اضافه کرده و مرورگر را به همان دامنه برمی‌گرداند. نیازی به ثبت دامنه‌ها در allowlist نیست و دامنه محلی HTTP نیز برای توسعه پذیرفته می‌شود.

سایت tenant پس از بازگشت به پارامتر status مرورگر اعتماد نمی‌کند. BarberBook با `payment_id` به endpoint status در Maliart درخواست می‌زند و فقط پس از تطبیق وضعیت `paid`، شماره سفارش، مبلغ و ارز، عملیات را نهایی می‌کند.

## تنظیمات مرتبط با شارژ و ارسال پیامک

اتصال پرداخت و ارسال پیامک را با هم اشتباه نگیرید:

- Maliart فقط پول خرید اعتبار را دریافت می‌کند.
- پس از پرداخت معتبر، `SmsCreditService` موجودی داخلی tenant را افزایش می‌دهد.
- هنگام ارسال، موجودی داخلی مصرف می‌شود و `SmsProviderManager` پیام را به provider ارسال می‌کند.
- provider موجود فعلی فقط `kavenegar` است و به API key مرکزی و sender tenant نیاز دارد.
- اگر هدف این است که خود پیامک‌ها نیز از `maliart.ir` ارسال شوند، باید یک API مستقل SMS در Maliart، قرارداد request/response، احراز هویت، گزارش delivery، idempotency، خطاها و یک `MaliartSmsProvider` در Laravel طراحی و پیاده‌سازی شود. چنین قابلیتی اکنون وجود ندارد.

## تست اتصال

ابتدا تست واحد client را اجرا کنید:

```bash
cd laravel-app
php artisan test --filter=MaliartPaymentClientTest
```

سپس در محیط sandbox این سناریوها را end-to-end بررسی کنید:

1. خرید اعتبار پیامک حداقل ۱۰٬۰۰۰ تومان و هدایت به `maliart.ir`.
2. پرداخت موفق و افزایش دقیق موجودی tenant فقط یک بار.
3. لغو پرداخت و عدم افزایش موجودی.
4. refresh یا تکرار callback و عدم شارژ دوباره.
5. timeout یا قطع Maliart و نمایش خطای کنترل‌شده.
6. مغایرت مبلغ، ارز یا order ID و رد شدن پرداخت.
7. استعلام یک `payment_id` معتبر از endpoint status.
8. بررسی لاگ‌های Laravel و `payment-app/storage/logs` بدون ثبت secret یا اطلاعات حساس.

برای بررسی سریع تنظیمات runtime می‌توان از Tinker استفاده کرد، ولی secret را چاپ نکنید:

```bash
php artisan tinker
```

```php
config('services.maliart_payment.enabled');
config('services.maliart_payment.base_url');
filled(config('services.maliart_payment.secret'));
```

خروجی مورد انتظار به‌ترتیب `true`، `https://maliart.ir` و `true` است.

## عیب‌یابی

- اگر درخواست‌ها هنوز به درگاه قبلی یا sandbox داخلی می‌روند، مقدار runtime مربوط به `enabled` را بررسی و config cache و workerها را restart کنید.
- خطای «تنظیم نشده» معمولاً به معنی خالی بودن base URL، client ID یا secret است.
- پاسخ 401/403 معمولاً از عدم تطابق client ID/secret، ساعت سرور، canonical URI یا امضا است.
- خطای اتصال معمولاً از DNS، TLS، firewall یا timeout است.
- پرداخت موفق بدون افزایش اعتبار باید با رکورد `tenant_subscription_payments`، `maliart_payment_id`، پاسخ status و تطابق amount/currency/order ID بررسی شود.
- اگر پرداخت شارژ می‌شود اما پیامک ارسال نمی‌شود، مشکل در Maliart نیست؛ تنظیمات Kavenegar، sender، فعال بودن SMS tenant، queue worker و موجودی داخلی را بررسی کنید.

## نقشه کد

- تنظیمات Laravel: `laravel-app/config/services.php` و `laravel-app/.env.example`
- client و امضای Maliart: `laravel-app/app/Services/Payments/MaliartPaymentClient.php`
- پرداخت و افزایش اعتبار SMS: `laravel-app/app/Services/SmsTopUpPaymentService.php`
- callback شارژ: `laravel-app/app/Http/Controllers/Tenant/SmsTopUpPaymentController.php`
- routeها: `laravel-app/routes/tenant.php`
- provider ارسال SMS: `laravel-app/app/Services/Sms/SmsProviderManager.php` و `Providers/KavenegarSmsProvider.php`
- سرویس مستقل درگاه: `maliart-payment-standalone/`
- تست client: `laravel-app/tests/Unit/MaliartPaymentClientTest.php`

## قواعد تغییرات آینده برای AI

قبل از کدنویسی این حوزه:

1. این سند و `maliart-payment-standalone/README.md` را کامل بخوان.
2. مشخص کن درخواست مربوط به «پرداخت اعتبار» است یا «تحویل پیامک».
3. secret و credential را هرگز در کد، تست، log، پاسخ API یا commit قرار نده.
4. callback را idempotent نگه دار و فقط پس از استعلام server-to-server و تطبیق مبلغ، ارز و order اعتبار بده.
5. تغییر tenant-facing را مطابق `AGENTS.md` در هر چهار locale و RTL/LTR اعمال کن.
6. برای پرداخت، tenant، authorization، callback و خطاها تست اضافه یا به‌روزرسانی کن.
7. قبل از تحویل حداقل تست هدفمند، `npm run check` (اگر TypeScript تغییر کرده) و بررسی syntax/diff را اجرا کن.
