# طرح اجرایی ماژول لندینگ اختصاصی

## وضعیت

- وضعیت فعلی: مدیریت مرکزی، نصب اختصاصی tenant، ورود از لینک، پنل مدیریت و اتصال پرداخت پکیج تغذیه آماده شده است؛ هنوز برای هیچ tenant واقعی فعال نشده است.
- نام نمایشی: `لندینگ اختصاصی`
- slug پیشنهادی: `custom-landing`
- فعال سازی: فقط دستی از ادمین مرکزی، برای tenantهای انتخابی.
- فروشگاه ماژول ها: این ماژول نباید برای خرید یا فعال سازی توسط tenant نمایش داده شود.

## مرز قطعی ماژول

این ماژول مستقل است و نباید از هیچ کدام از اجزای زیر استفاده کند:

- `SalesWalletService`
- `sales_wallet_transactions`
- `sales_commission_ledgers`
- `sales_customer_assignments`
- تیم فروش، نقش های فروش، کد تخفیف و درخواست برداشت فعلی
- `LandingCustomer` مرکزی

کاربر نهایی باید همان `TenantUser` موجود در دیتابیس tenant باشد. شخصی که لینک اختصاصی دارد در این سند «همکار لندینگ» نامیده می شود؛ عنوان فارسی رابط را بعدا می توان «همکار»، «نماینده» یا «معرف» انتخاب کرد.

## نصب فقط برای tenant فعال شده

مکانیزم فعلی `TenantFeatureModuleManager` برای این هدف مناسب است:

1. ماژول `custom-landing` در `feature_modules` تعریف می شود، اما metadata آن `tenant_self_service: false` خواهد داشت.
2. registry ماژول در `laravel-app/config/tenant_modules.php` یک مسیر migration اختصاصی می گیرد:

   ```php
   'custom-landing' => [
       'label' => 'لندینگ اختصاصی',
       'meta_key' => 'customLanding',
       'route_prefix' => 'custom-landing',
       'migration_path' => database_path('migrations/tenant/modules/custom-landing'),
       'seeder' => null,
   ],
   ```

3. ادمین مرکزی از صفحه tenant، ماژول را فعال می کند.
4. در همان لحظه، `TenantFeatureModuleManager::installIfNeeded()` با اتصال همان tenant، فقط migrationهای پوشه بالا را اجرا می کند.
5. برای tenantهای غیرفعال، این پوشه هرگز در migration عمومی tenant اجرا نمی شود؛ بنابراین هیچ کدام از جدول های ماژول را ندارند.
6. metadata رکورد `tenant_feature_modules` وضعیت `installed` و زمان اجرای migration را نگه می دارد؛ فعال سازی مجدد، جدول ها را دوباره ایجاد نمی کند.
7. غیرفعال سازی تنها دسترسی و منو را می بندد؛ داده های همکاران، سهم ها و تسویه ها پاک نمی شوند.

نکته: مسیر migration اختصاصی باید زیر `database/migrations/tenant/modules/custom-landing` باشد، نه زیر migrationهای عمومی tenant.

## داده های tenant

همه جدول های زیر فقط در دیتابیس tenant دارای ماژول ساخته می شوند.

### `custom_landing_partners`

- `id`
- `name`
- `mobile`
- `status`: `active` یا `inactive`
- `public_token`: توکن غیرقابل حدس و یکتا برای لینک عمومی
- `first_payment_percent`
- `recurring_payment_percent`
- `bank_card_number` و `iban` در صورت نیاز به ثبت اطلاعات تسویه
- `notes`
- `created_by_user_id`
- timestamps و soft delete

### `custom_landing_attributions`

- `id`
- `custom_landing_partner_id`
- `tenant_user_id`
- `public_token_snapshot`
- `landed_at`
- `registered_at`
- `first_paid_at`
- timestamps
- unique روی `tenant_user_id`

هر کاربر نهایی تنها یک مالک معرفی دارد. این انتساب بعد از OTP ایجاد می شود و در پنل قابل تغییر مستقیم نیست؛ فقط یک عملیات مدیریتی صریح و audit شده می تواند آن را اصلاح کند.

### `custom_landing_commissions`

- `id`
- `custom_landing_partner_id`
- `tenant_user_id`
- `source_type` و `source_id` برای منبع پرداخت
- `payment_kind`: `first_payment` یا `recurring_payment`
- `gross_amount`
- `commission_percent_snapshot`
- `commission_amount`
- `status`: `credited` یا `reversed`
- `paid_at`
- `reversed_at` و `reversal_note` در صورت برگشت پرداخت
- timestamps
- unique روی `source_type` و `source_id`

درصد و مبلغ در لحظه پرداخت snapshot می شوند؛ تغییر درصد همکار روی سابقه اثر نمی گذارد.

### `custom_landing_settlements`

- `id`
- `custom_landing_partner_id`
- `amount`
- `payment_method`
- `payment_reference`
- `paid_at`
- `note`
- `recorded_by_user_id`
- timestamps

موجودی همکار یک فیلد قابل ویرایش نیست:

```text
جمع سهم هاي credited - جمع سهم هاي reversed - جمع تسويه ها
```

## جریان عمومی لینک و ورود

```text
/join/{public_token}
  -> صفحه ورود اختصاصی همان پروژه
  -> ارسال و تایید OTP با TenantOtpAuthApiController
  -> ورود به اپلیکیشن tenant
  -> ساخت attribution فقط در صورت نداشتن attribution قبلی
```

- token در session نگه داری می شود تا بین صفحه ورود و تایید OTP از دست نرود.
- token فقط نماینده همکار است و هرگز شناسه داخلی یا اطلاعات محرمانه را فاش نمی کند.
- ورود مستقیم به اپلیکیشن بدون token، attribution نمی سازد.
- ورود با token دوم برای کاربر منتسب شده، مالک او را عوض نمی کند.

## جریان مالی مستقل

هر سرویس پرداختی که برای این پروژه واجد سهم باشد، پس از تغییر قطعی وضعیت به `paid` این سرویس را صدا می زند:

```text
CustomLandingCommissionService::recordPaidPurchase(...)
```

کار سرویس:

1. attribution کاربر را پیدا می کند.
2. با بررسی اولین پرداخت موفق، نوع پرداخت را تعیین می کند.
3. درصد snapshot همکار را انتخاب می کند.
4. با کلید یکتای منبع پرداخت، یک commission ثبت می کند.
5. اجرای دوباره callback هیچ ردیف تکراری ایجاد نمی کند.
6. برگشت پرداخت، commission را حذف نمی کند؛ آن را `reversed` می کند.

پیش از پیاده سازی باید برای هر tenant تعیین شود کدام پرداخت ها سهم دارند: خرید پکیج، تمدید، خرید اعتبار، فروشگاه یا ترکیبی از آن ها.

## صفحات پنل tenant

این منوها فقط وقتی `custom-landing` فعال است دیده می شوند:

- داشبورد: همکار فعال، کاربران جذب شده، پرداخت اول، سهم ثبت شده، تسویه شده و موجودی قابل پرداخت
- همکاران: ساخت، ویرایش، غیرفعال سازی، درصدها و کپی لینک عمومی
- کاربران جذب شده: کاربر، همکار، تاریخ ورود، وضعیت اولین پرداخت و مجموع پرداخت واجد سهم
- سهم ها: منبع پرداخت، مبلغ، درصد snapshot، سهم و وضعیت
- تسویه ها: ثبت پرداخت دستی، شماره پیگیری، توضیح و مانده همکار

همه routeهای API با middleware `tenant.module:custom-landing` محافظت می شوند. منوی React با `activeFeatureModules` نمایش داده می شود.

## دسترسی ها

- ادمین مرکزی: فقط فعال/غیرفعال کردن ماژول برای tenant و مشاهده audit آن.
- مدیر اصلی tenant: مدیریت کامل همکاران، سهم ها و تسویه ها.
- سایر نقش های tenant: در نسخه اول دسترسی ندارند، مگر مجوز جدا تعریف شود.
- همکار لندینگ: در نسخه اول پنل ندارد؛ فقط لینک اختصاصی دارد. پنل مستقل همکار در صورت نیاز آینده، پروژه جداگانه خواهد بود.

## مراحل اجرا

- [x] بررسی زیرساخت ماژول، ورود OTP tenant و پرداخت های موجود
- [x] تصمیم معماری: کاملا مستقل از سیستم فروش و کیف پول فعلی
- [x] تصمیم نصب: migration اختصاصی فقط هنگام فعال سازی tenant
- [x] افزودن تعریف ماژول مخفی از فروشگاه و registry آن
- [x] ساخت migrationهای `tenant/modules/custom-landing`
- [x] اجرای migration مرکزی و ثبت ماژول `custom-landing` در دیتابیس مرکزی در ۱۴۰۵/۰۵/۰۸
- [x] آماده سازی اجرای migration اختصاصی در زمان فعال سازی tenant
- [x] ساخت مدل ها، relationها و سرویس محاسبه سهم مستقل
- [x] افزودن middleware و APIهای پنل
- [x] اتصال OTP عمومی به attribution بر اساس token
- [x] اتصال پرداخت پکیج تغذیه به سرویس commission
- [x] ساخت صفحه React پنل، ساخت همکار و کپی لینک
- [x] ساخت صفحه عمومی `/join/{token}` با ورود OTP و ورود به اپلیکیشن
- [ ] افزودن تست های migration اختصاصی، attribution، پرداخت تکراری، برگشت و تسویه
- [ ] فعال سازی و اجرای migration روی tenantهای انتخاب شده توسط مدیر
- [ ] اتصال سایر پرداخت های واجد سهم پس از مشخص شدن نوع پرداخت هر tenant

## دامنه پرداخت اجراشده

در این مرحله فقط `NutritionPackageOrder` پس از پرداخت قطعی، سهم پرداخت اول یا بعدی را ثبت می کند. ساختار `CustomLandingCommissionService` در عمل داخل `CustomLandingService` قرار دارد و برای اضافه شدن پرداخت های دیگر آماده است، اما فروشگاه، نوبت دهی و شارژ اعتبار عمدا هنوز به آن وصل نشده اند.

## پرسش های لازم پیش از شروع کدنویسی

1. عنوان فارسی شخص صاحب لینک چه باشد: «همکار»، «نماینده»، «معرف» یا «مشتری»؟
2. برای هر یک از دو tenant، کدام نوع پرداخت ها مشمول سهم هستند؟
3. امکان اصلاح دستی attribution با audit لازم است یا انتساب کاملا غیرقابل تغییر باشد؟
4. تسویه فقط ثبت دستی توسط مدیر tenant است یا همکار باید درخواست تسویه هم داشته باشد؟
