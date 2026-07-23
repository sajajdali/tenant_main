# I18N Architecture

این سند قانون معماری چندزبانه‌سازی پروژه است. هدف این است که اضافه کردن زبان‌هایی مثل عربی و آلمانی بعدا به refactor بزرگ نیاز نداشته باشد و تا حد ممکن در حد اضافه کردن ترجمه و فعال کردن یک flag انجام شود.

## مرز قطعی دامنه

- چندزبانه‌سازی فقط برای سطح tenant است: سایت هر tenant، اپ React رزرو/مشتری، پنل tenant، APIهای tenant و پیام‌های validation/email/SMS/notification/invoice/exception مربوط به tenant.
- پنل مدیریت کل Laravel در مسیر `/admin`، namespace `App\Http\Controllers\Admin`، `resources/views/admin` و view ورود `resources/views/auth/admin-login.blade.php` عمداً فقط فارسی و RTL است.
- locale انتخاب‌شده tenant نباید هیچ اثری روی پنل مدیریت کل، controllerهای مرکزی یا پیام‌های مدیریت پلتفرم داشته باشد.
- متن جدید مخصوص پنل مدیریت کل نباید به `en/ar/de` منتقل شود و لازم نیست translation key چندزبانه داشته باشد؛ فارسی مستقیم در کد انحصاری central admin مجاز است.
- Swagger/OpenAPI و تمام مستندات API نیز عمداً فارسی-only و خارج از scope چندزبانه‌سازی هستند: `laravel-app/app/OpenApi/`، `config/l5-swagger.php`، Swagger UI، schema/summary/description/example و فایل generated specification.
- استثنای Swagger فقط مربوط به مستندات است. response واقعی API tenant، validation، exception و payload قابل مشاهده مشتری همچنان باید locale-aware و چندزبانه باشند.
- زیرسیستم Landing Builder در `/admin/landing-sites` نیز فعلاً کاملاً فارسی-only است: UI مدیریت، page/section/SEO ذخیره‌شده، دامنه عمومی landing، صفحات React با پیشوند `landing-*` و APIهای auth/contact/order اختصاصی landing.
- برای این landingها فعلاً translation field/table، language switch یا متن `en/ar/de` ساخته نمی‌شود. این استثنا شامل سایت عادی booking/store/nutrition هر tenant نیست.
- پیش از مهاجرت هر متن Laravel باید ownership آن مشخص شود: `central admin` یا `tenant-facing`. فقط دسته دوم وارد migration i18n می‌شود.

## هدف اصلی

- متن‌های کاربرمحور نباید داخل component، Blade، Controller یا Service hardcode شوند.
- هر متن جدید در هر ماژول یا قابلیت جدید باید همان لحظه برای همه زبان‌های ثبت‌شده فعلی (`fa`, `en`, `ar`, `de`) اضافه شود؛ حتی اگر `ar/de` هنوز selectable نیستند، key متن جدید نباید فقط برای فارسی/انگلیسی وجود داشته باشد.
- زبان‌ها، کشورها، جهت صفحه، calendar، numbering system و currency باید از registry/config مرکزی بیایند.
- زبان جدید تا وقتی ترجمه و QA کامل نشده نباید در UI قابل انتخاب شود.
- RTL/LTR باید از metadata زبان بیاید، نه از کلاس‌ها یا شرط‌های پراکنده.
- واحد پول و نوع تقویم نباید در component/controller حدس زده شود؛ formatter و metadata مرکزی تنها مرجع هستند.

## منابع مرکزی

React:

- `client/src/i18n/registry.ts`: منبع مرکزی زبان‌ها و کشورها.
- `client/src/i18n/messages/{locale}.ts`: متن‌های هر زبان.
- `client/src/i18n/messages/index.ts`: تنها محل import/export و load پیام‌ها. این فایل فقط fallback فارسی را sync نگه می‌دارد و زبان فعال را per-locale با dynamic import لود می‌کند تا `en/ar/de` همزمان وارد bundle اصلی نشوند.
- `client/src/i18n/locale.tsx`: provider، `useLocale`, `useT`, و `useFormat`.
- `client/src/i18n/format.ts`: formatter مشترک تاریخ، عدد، مبلغ و درصد.
- `client/src/i18n/ltr-text.tsx`: نمایش امن phone/code/url/id.

Laravel:

- `laravel-app/config/localization.php`: منبع مرکزی locale/country سمت backend.
- `laravel-app/app/Support/TenantLocale.php`: resolve/apply/meta برای tenant locale.
- `laravel-app/lang/{locale}`: پیام‌های backend، validation، API، email و SMS.

## مدل فعال‌سازی زبان

هر locale دو flag دارد:

- `enabled`: یعنی کد می‌تواند این زبان را بشناسد و metadata آن معتبر است.
- `selectable`: یعنی مدیر tenant می‌تواند آن را در تنظیمات انتخاب کند.

زبان‌های آینده مثل `ar` و `de` باید از الان در registry/config ثبت شوند، اما تا تکمیل ترجمه‌ها و QA، `enabled: false` و `selectable: false` بمانند.

## قوانین مبلغ و تقویم

- `fa/IR`: جهت `rtl`، تقویم Jalali/Shamsi، و نمایش مبلغ طبق قرارداد فعلی محصول برای تومان/ریال ایران.
- `en`: جهت `ltr`، تقویم Gregorian، و نمایش مبلغ با `USD`.
- `ar/SA`: جهت `rtl`، تقویم Hijri lunar، و نمایش مبلغ با `SAR`/ریال سعودی. دلیل انتخاب `SAR` این است که کشور عربی ثبت‌شده فعلی `SA` است و با ریال/تومان ایران اشتباه نمی‌شود.
- `de/DE`: جهت `ltr`، تقویم Gregorian، و نمایش مبلغ با `EUR`.
- localeهای آینده به صورت پیش‌فرض Gregorian هستند مگر در `client/src/i18n/registry.ts` و `laravel-app/config/localization.php` صراحتا calendar دیگری ثبت شود.
- تبدیل مبلغ باید explicit و تست‌شده باشد. تغییر فقطِ symbol یا suffix بدون تبدیل مقدار مجاز نیست، چون باعث نمایش مبلغ غلط می‌شود.
- هر UI/API که مبلغ یا تاریخ نمایش می‌دهد باید از formatter مشترک استفاده کند و test/verify همان locale را در checklist ثبت کند.

## اضافه کردن زبان جدید

1. زبان را در `client/src/i18n/registry.ts` اضافه کنید.
2. زبان را در `laravel-app/config/localization.php` اضافه کنید.
3. جهت، کشور، calendar، numbering system و currency همان زبان را در metadata مرکزی ثبت کنید.
4. فایل پیام React را بسازید، مثلا `client/src/i18n/messages/de.ts`.
5. فایل پیام را فقط از loader مرکزی `client/src/i18n/messages/index.ts` اضافه/load کنید؛ componentها و utilityها حق import مستقیم فایل locale را ندارند.
6. فایل‌های `laravel-app/lang/{locale}` را بسازید.
7. هیچ متن جدیدی را مستقیم در UI یا backend ننویسید.
8. خروجی تاریخ/عدد/مبلغ را با formatter مشترک و locale جدید verify کنید.
9. وقتی ترجمه و QA کامل شد، `enabled` و بعد `selectable` را فعال کنید.
10. checklist را در `docs/I18N_MIGRATION_CHECKLIST.md` به‌روز کنید.

## قوانین React

- برای متن از `useT()` استفاده کنید.
- هر key جدید React باید همزمان در همه فایل‌های پیام ثبت‌شده فعلی (`client/src/i18n/messages/fa.ts`, `en.ts`, `ar.ts`, `de.ts`) وجود داشته باشد و فقط از loader مرکزی `client/src/i18n/messages/index.ts` استفاده شود.
- برای تاریخ، عدد، مبلغ و درصد از `useFormat()` استفاده کنید.
- برای phone/code/url/id از `PhoneText`, `CodeText`, `UrlText`, `IdText` استفاده کنید.
- گزینه‌های زبان و کشور نباید دستی نوشته شوند؛ از `SELECTABLE_LOCALES` و `SELECTABLE_COUNTRIES` بیایند.
- keyهای ترجمه باید typed باشند؛ زبان جدید باید تمام keyهای پایه را داشته باشد.
- currency/calendar را در component شرطی نکنید؛ formatter باید بر اساس locale meta خروجی بدهد.

## قوانین Laravel

- validation/API/exception/email/SMS مربوط به tenant باید از `lang/{locale}` بیاید.
- هر متن جدید tenant-facing Laravel شامل validation، API message، exception، email، SMS، notification، label، placeholder و Blade tenant باید همزمان در همه localeهای پشتیبانی‌شده همان domain ثبت شود.
- central admin همیشه `fa/rtl` است و از locale tenant استفاده نمی‌کند.
- فایل‌ها و پیام‌های انحصاری central admin از audit/migration چندزبانه خارج‌اند.
- annotationها، schemaها و UI مربوط به Swagger/OpenAPI فارسی باقی می‌مانند و translation key چندزبانه نمی‌گیرند.
- `LandingSitePublicController` locale خروجی landing builder را صریح روی `fa` نگه می‌دارد؛ locale tenant یا query/header نباید آن را تغییر دهد.
- locale فعال از `TenantLocale` خوانده شود.
- فقط locale/countryهای selectable در تنظیمات tenant ذخیره شوند.
- shellهای HTML باید `lang`, `dir`, و `og:locale` را از locale meta بگیرند.
- API، validation، invoice، SMS و emailهایی که تاریخ یا مبلغ قابل مشاهده دارند باید از config/formatter locale-aware استفاده کنند.

## محتوای دیتابیس

ترجمه متن‌های دیتابیس با فایل i18n حل نمی‌شود. سرویس‌ها، دسته‌بندی‌ها، محصولات، مقاله‌ها، landing sections، SMS templates و محتوای nutrition باید مدل ترجمه جدا داشته باشند. تصمیم نهایی بین JSON translation fields و translation tables در Phase 11 checklist ثبت می‌شود.

## معیار تکمیل قبل از selectable شدن زبان

- همه keyهای React برای آن زبان موجود باشد.
- فایل‌های Laravel lang برای پیام‌های قابل نمایش تکمیل شده باشد.
- صفحات اصلی در RTL/LTR یا LTR درست دیده شوند.
- formatter تاریخ/عدد/مبلغ درست خروجی بدهد.
- تقویم و currency همان locale طبق قوانین مبلغ و تقویم بالا verify شده باشد.
- audit hardcoded text خطای مهم نداشته باشد.
- smoke test روی home، booking، settings و `/panel/professionals` انجام شده باشد.

## اجرای Audit

- دستور اصلی audit سمت React/Laravel: `npm run audit:i18n`.
- این دستور در زمان مهاجرت informational است و fail کننده نیست؛ خروجی آن باید در `docs/I18N_MIGRATION_CHECKLIST.md` ثبت شود.
- audit متن فارسی/عربی خارج از مسیرهای مجاز، `dir="rtl"` ثابت، کلاس‌های فیزیکی، formatter/currency/calendar مستقیم، optionهای زبان/کشور hardcoded و import مستقیم فایل‌های message را گزارش می‌کند.
- مسیرهای central admin، Swagger/OpenAPI و Landing Builder شامل `laravel-app/app/Http/Controllers/Admin/`, `laravel-app/resources/views/admin/`, `laravel-app/app/OpenApi/`, `laravel-app/resources/views/vendor/l5-swagger/`, `laravel-app/config/l5-swagger.php`, `laravel-app/app/{Domain,Http/Controllers,Services}/Landing/` و فایل‌های React اختصاصی `landing-*` از scope audit مهاجرت خارج‌اند، چون عمداً فارسی-only هستند.
- مسیرهای مجاز برای متن ترجمه‌شده tenant شامل `client/src/i18n/`, `laravel-app/lang/`, `laravel-app/config/localization.php` و docs هستند.
- اگر یک finding مربوط به محتوای دیتابیس، fixture، mock/demo یا مقدار فنی LTR باشد، همان مورد باید در Progress Notes با دلیل باقی ماندن ثبت شود.
