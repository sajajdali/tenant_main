# نقشه راه API نسخه کاربر برای دریافت رژیم

این سند منبع حقیقت موقت برای طراحی و پیاده سازی API رسمی نسخه کاربر است. اگر تاریخچه گفتگو پاک شد، از روی همین سند باید بتوان ادامه کار را فهمید و بدون کثیف کردن کنترلرهای فعلی جلو رفت.

## هدف

ساخت یک API کامل، مستند، قابل توسعه و قابل تحویل به برنامه نویس اپلیکیشن برای استفاده از امکانات نسخه کاربر، با شروع از سناریوی دریافت رژیم تغذیه.

API باید:

- برای مصرف اپلیکیشن خارجی مناسب باشد.
- قرارداد خروجی و خطاهای ثابت داشته باشد.
- با Swagger/OpenAPI مستند شود.
- کنترلرهای فعلی پنل و وب را کثیف نکند.
- منطق موجود پروژه را تا جای ممکن reuse کند.
- قابل گسترش برای سایر امکانات کاربر در آینده باشد.

## وضعیت فعلی پروژه

پروژه Laravel چند tenant است و routeهای tenant در `routes/tenant.php` تعریف شده اند.

در حال حاضر APIهای کاربر تغذیه زیر این مسیر هستند:

```text
/api/v1/nutrition/...
```

و با middleware زیر کار می کنند:

```text
web
auth:tenant_web
InitializeTenancyByDomain
PreventAccessFromCentralDomains
```

احراز هویت OTP فعلی در `TenantOtpAuthApiController` پس از verify کاربر را با session وارد می کند:

```php
Auth::guard('tenant_web')->login($user, $remember);
```

این برای SPA داخلی قابل استفاده است، ولی برای اپلیکیشن موبایل یا توسعه دهنده بیرونی ایده آل نیست؛ چون وابسته به cookie/session/CSRF می شود. API رسمی بیرونی باید token-based باشد.

## تصمیم معماری

کنترلرهای فعلی نباید با annotationهای Swagger یا logic جدید سنگین شوند.

مسیر حرفه ای:

```text
App\Http\Controllers\Api\V1\Customer\...
App\Http\Requests\Api\V1\Customer\...
App\Http\Resources\Api\V1\Customer\...
App\Services\...
docs/openapi/...
```

کنترلرهای جدید فقط نقش API adapter داشته باشند:

- request validation
- گرفتن کاربر authenticated
- صدا زدن سرویس یا منطق reuse شده
- برگرداندن response استاندارد با Resource

منطق اصلی نباید داخل کنترلر جدید تکثیر شود. اگر منطق فعلی داخل کنترلر قدیمی گیر کرده، باید مرحله ای به Service منتقل شود و هر دو کنترلر از همان Service استفاده کنند.

## احراز هویت پیشنهادی

برای API رسمی اپلیکیشن:

```http
Authorization: Bearer <token>
```

پیشنهاد اجرایی:

- اضافه کردن auth token اختصاصی یا استفاده از Laravel Sanctum، اگر با tenancy پروژه بدون مشکل سازگار شود.
- endpoint verify OTP باید علاوه بر user، `accessToken` و اطلاعات expiry برگرداند.
- logout باید token فعلی را revoke کند.
- APIهای nutrition رسمی با guard/token جدید محافظت شوند، نه session.

نمونه response verify:

```json
{
  "success": true,
  "message": "ورود با موفقیت انجام شد.",
  "data": {
    "accessToken": "...",
    "tokenType": "Bearer",
    "expiresAt": "2026-07-13T12:00:00+03:30",
    "user": {}
  }
}
```

## قرارداد پاسخ استاندارد

همه پاسخ های موفق:

```json
{
  "success": true,
  "message": null,
  "data": {},
  "meta": {}
}
```

همه خطاها:

```json
{
  "success": false,
  "message": "Validation failed.",
  "errors": {
    "field": ["..."]
  }
}
```

کدهای خطای مهم:

- `401`: احراز هویت نشده
- `403`: دسترسی ندارد
- `404`: پیدا نشد
- `422`: خطای اعتبارسنجی یا business rule
- `423`: دسترسی کاربر یا tenant قفل است
- `429`: محدودیت تعداد درخواست
- `500`: خطای داخلی

## Scope فاز اول: دریافت رژیم کاربر

فاز اول فقط نسخه کاربر است، نه پنل مدیر.

### وضعیت مرحله درخواست رژیم اول

مرحله درخواست رژیم اول در API رسمی app شامل این ترتیب است:

```text
GET/POST /api/v1/app/membership/mindset
GET      /api/v1/app/nutrition/diet-templates
GET      /api/v1/app/nutrition/diet-requests/options
POST     /api/v1/app/nutrition/diet-requests/preview
GET      /api/v1/app/nutrition/diet-requests
POST     /api/v1/app/nutrition/diet-requests
```

- پنج سؤال `mindset` فقط پیش از اولین رژیم الزامی هستند.
- `options` موجودی کل، مصرف‌شده و باقی‌مانده هر دو روش آنلاین/کارشناس و مسیر مرحله بعد را بدون تغییر داده برمی‌گرداند.
- `preview` همان اطلاعات صفحه تأیید سایت را می‌سازد و تمام قواعد را بدون ساخت درخواست یا مصرف سهمیه بررسی می‌کند.
- فقط `POST /diet-requests` تأیید نهایی است و یک سهمیه از روش انتخابی مصرف می‌کند.
- در درخواست `ai` انتخاب یک الگوی نهایی فعال الزامی است.
- در درخواست `expert` توضیح کاربر اختیاری است و الگوی رژیم ارسال نمی‌شود.
- وزن جدید، هر ۱۳ پاسخ بازخورد رژیم قبلی و توضیح بیماری/دارو برای رژیم دوم به بعد در schemaهای follow-up همین preview/confirm الزامی هستند.
- Swagger این مرحله با tag انگلیسی `Diet Request Flow` در `app/OpenApi/CustomerAppFirstDietRequestApi.php` نگهداری می‌شود.

endpointهای حداقلی:

```text
POST /api/v1/app/auth/login
POST /api/v1/app/auth/verify
GET  /api/v1/app/auth/me
POST /api/v1/app/auth/logout

GET  /api/v1/app/membership
GET  /api/v1/app/membership/profile
POST /api/v1/app/membership/profile
GET  /api/v1/app/membership/goal
POST /api/v1/app/membership/goal
GET  /api/v1/app/membership/activity
POST /api/v1/app/membership/activity
GET  /api/v1/app/membership/birth-date
POST /api/v1/app/membership/birth-date
GET  /api/v1/app/membership/height
POST /api/v1/app/membership/height
GET  /api/v1/app/membership/weight
POST /api/v1/app/membership/weight
GET  /api/v1/app/membership/target-weight
POST /api/v1/app/membership/target-weight
GET  /api/v1/app/membership/result
POST /api/v1/app/membership/result
GET  /api/v1/app/membership/medical-conditions
POST /api/v1/app/membership/medical-conditions
GET  /api/v1/app/membership/medications-and-supplements
POST /api/v1/app/membership/medications-and-supplements
GET  /api/v1/app/membership/allergies
POST /api/v1/app/membership/allergies
GET  /api/v1/app/membership/disliked-foods
POST /api/v1/app/membership/disliked-foods
GET  /api/v1/app/membership/packages
GET  /api/v1/app/membership/mindset
POST /api/v1/app/membership/mindset

GET  /api/v1/app/nutrition/profile
POST /api/v1/app/nutrition/profile
POST /api/v1/app/nutrition/profile/target-weight
POST /api/v1/app/nutrition/profile/preferences
POST /api/v1/app/nutrition/profile/mindset
POST /api/v1/app/nutrition/profile/package-selection

GET  /api/v1/app/nutrition/diet-templates
GET  /api/v1/app/nutrition/package-checkout/summary
POST /api/v1/app/nutrition/package-checkout/preview
POST /api/v1/app/nutrition/package-checkout/pay

GET  /api/v1/app/nutrition/diet-requests
POST /api/v1/app/nutrition/diet-requests

GET  /api/v1/app/nutrition/prescriptions
GET  /api/v1/app/nutrition/prescriptions/current
GET  /api/v1/app/nutrition/prescriptions/{id}

POST   /api/v1/app/nutrition/prescriptions/current/meal-log
DELETE /api/v1/app/nutrition/prescriptions/current/meal-log/{id}
POST   /api/v1/app/nutrition/prescriptions/current/water-log
GET    /api/v1/app/nutrition/exercises
POST   /api/v1/app/nutrition/prescriptions/current/exercise-log
DELETE /api/v1/app/nutrition/prescriptions/current/exercise-log/{id}
```

اگر تصمیم گرفته شد URL فعلی حفظ شود، می توان به جای `/api/v1/app/...` همان `/api/v1/...` را نگه داشت؛ اما برای جلوگیری از تداخل با APIهای web/session فعلی، prefix جدید `app` تمیزتر است.

## Swagger/OpenAPI

مستندات Swagger نباید کنترلرهای فعلی را شلوغ کند.

پیشنهاد:

```text
laravel-app/docs/openapi/nutrition-user-api.yaml
```

این فایل باید OpenAPI 3.x باشد و شامل موارد زیر شود:

- servers با tenant domain
- Bearer auth security scheme
- tags
- schemas مشترک مثل `ApiSuccess`, `ApiError`, `User`, `NutritionProfile`, `DietRequest`, `Prescription`
- examples برای request و response
- validation rules مهم
- business errors مهم مثل نداشتن پروفایل، نداشتن subscription فعال، داشتن درخواست رژیم فعال

در صورت نیاز به UI، می توان Swagger UI را جداگانه از روی همین yaml نمایش داد.

## پکیج های انتخاب شده

این پکیج ها نصب و publish شده اند:

- `laravel/sanctum`: برای Bearer token و personal access token.
- `darkaonline/l5-swagger`: برای Swagger/OpenAPI UI و generation.
- dependencyهای همراه نصب شده توسط Composer شامل `zircote/swagger-php` و `swagger-api/swagger-ui`.

فایل های publish شده:

```text
config/sanctum.php
config/l5-swagger.php
resources/views/vendor/l5-swagger/
database/migrations/2026_06_13_100406_create_personal_access_tokens_table.php
database/migrations/tenant/2026_06_13_100406_create_personal_access_tokens_table.php
```

نکته tenancy: چون API نسخه کاربر با `TenantUser` کار می کند، جدول `personal_access_tokens` باید در دیتابیس tenant هم وجود داشته باشد. برای همین علاوه بر migration مرکزی publish شده توسط Sanctum، یک migration مشابه در `database/migrations/tenant` اضافه شده است.

## مراحل اجرایی پیشنهادی

1. ساخت ساختار route رسمی API کاربر
   - فایل یا بخش route جدا برای API app
   - حفظ tenancy middleware
   - جدا کردن prefix از APIهای داخلی فعلی

2. پیاده سازی token auth
   - انتخاب روش token
   - ساخت migration/model در صورت نیاز
   - verify OTP با خروجی token
   - middleware/guard برای resolve کردن `TenantUser`
   - logout و revoke token

3. ساخت response استاندارد
   - helper/trait/base response class
   - یکدست کردن success/error/meta
   - handler مناسب برای ValidationException و AuthenticationException برای مسیرهای API رسمی

4. ساخت لایه API برای profile تغذیه
   - FormRequestها
   - Resourceها
   - انتقال منطق قابل reuse به Service در صورت نیاز
   - تست feature برای happy path و خطاهای اصلی

5. ساخت لایه API برای package و checkout summary/preview/pay
   - reuse از `NutritionPackagePaymentService`
   - مستندسازی redirect/payment behavior

6. ساخت لایه API برای diet requests
   - ثبت درخواست رژیم AI یا expert
   - لیست درخواست ها
   - business rules فعلی حفظ شود

7. ساخت لایه API برای prescriptions
   - لیست نسخه ها
   - نسخه فعلی
   - مشاهده نسخه
   - لاگ وعده، آب و ورزش

8. نوشتن OpenAPI
   - تکمیل schemas
   - examples واقعی و خوانا
   - security
   - error responses

9. تست و کنترل کیفیت
   - Feature tests برای endpointهای اصلی
   - `php artisan route:list` برای بررسی مسیرها
   - اجرای تست های مرتبط
   - بررسی عدم شکست routeهای قبلی

## پرامپت قابل استفاده برای AI یا برنامه نویس دیگر

تو در یک پروژه Laravel چند tenant کار می کنی. هدف ساخت API رسمی، تمیز، قابل توسعه و مستند برای نسخه کاربر است، با شروع از سناریوی دریافت رژیم تغذیه. پروژه فعلی routeهای tenant را در `routes/tenant.php` دارد و APIهای تغذیه فعلی زیر `/api/v1/nutrition` با `web` و `auth:tenant_web` و session کار می کنند. کنترلرهای فعلی مثل `TenantOtpAuthApiController`, `NutritionProfileController`, `NutritionDietRequestController`, `NutritionDietPrescriptionController`, `NutritionPackagePurchaseController`, `NutritionDietTemplateController`, `NutritionTokenController` و `NutritionExerciseCatalogController` وجود دارند و منطق زیادی داخل آنهاست.

مهم ترین اصل: کنترلرهای فعلی را با Swagger annotation یا تغییرات سنگین کثیف نکن. API رسمی جدید را جداگانه بساز و هر جا ممکن است منطق موجود را از طریق Service یا Resource reuse کن. اگر منطق مهمی داخل کنترلر فعلی گیر کرده، آن را مرحله ای به Service منتقل کن تا هم کنترلر قدیمی و هم کنترلر API جدید از یک منبع استفاده کنند. تغییرات باید کم ریسک و incremental باشد.

برای API رسمی کاربر یک namespace جدا پیشنهاد شده است:

```text
App\Http\Controllers\Api\V1\Customer
App\Http\Requests\Api\V1\Customer
App\Http\Resources\Api\V1\Customer
```

route پیشنهادی:

```text
/api/v1/app/auth/...
/api/v1/app/nutrition/...
```

اگر لازم شد می توان prefix را تغییر داد، ولی API رسمی باید از APIهای session-based فعلی قابل تشخیص باشد.

احراز هویت API باید token-based باشد و با header زیر کار کند:

```http
Authorization: Bearer <token>
```

OTP فعلی باید برای API رسمی طوری توسعه داده شود که endpoint verify یک access token برگرداند. APIهای app نباید به cookie/session/CSRF وابسته باشند. logout باید token فعلی را revoke کند.

همه responseها باید یک قرارداد ثابت داشته باشند:

```json
{
  "success": true,
  "message": null,
  "data": {},
  "meta": {}
}
```

خطاها:

```json
{
  "success": false,
  "message": "Validation failed.",
  "errors": {
    "field": ["..."]
  }
}
```

Scope فاز اول فقط نسخه کاربر دریافت رژیم است، نه پنل مدیر. endpointهای مورد نیاز:

```text
POST /api/v1/app/auth/login
POST /api/v1/app/auth/verify
GET  /api/v1/app/auth/me
POST /api/v1/app/auth/logout

GET  /api/v1/app/membership
GET  /api/v1/app/membership/profile
POST /api/v1/app/membership/profile
GET  /api/v1/app/membership/goal
POST /api/v1/app/membership/goal
GET  /api/v1/app/membership/activity
POST /api/v1/app/membership/activity
GET  /api/v1/app/membership/birth-date
POST /api/v1/app/membership/birth-date
GET  /api/v1/app/membership/height
POST /api/v1/app/membership/height
GET  /api/v1/app/membership/weight
POST /api/v1/app/membership/weight
GET  /api/v1/app/membership/target-weight
POST /api/v1/app/membership/target-weight
GET  /api/v1/app/membership/result
POST /api/v1/app/membership/result
GET  /api/v1/app/membership/medical-conditions
POST /api/v1/app/membership/medical-conditions
GET  /api/v1/app/membership/medications-and-supplements
POST /api/v1/app/membership/medications-and-supplements
GET  /api/v1/app/membership/allergies
POST /api/v1/app/membership/allergies
GET  /api/v1/app/membership/disliked-foods
POST /api/v1/app/membership/disliked-foods
GET  /api/v1/app/membership/packages
GET  /api/v1/app/membership/mindset
POST /api/v1/app/membership/mindset

GET  /api/v1/app/nutrition/profile
POST /api/v1/app/nutrition/profile
POST /api/v1/app/nutrition/profile/target-weight
POST /api/v1/app/nutrition/profile/preferences
POST /api/v1/app/nutrition/profile/mindset
POST /api/v1/app/nutrition/profile/package-selection

GET  /api/v1/app/nutrition/diet-templates
GET  /api/v1/app/nutrition/package-checkout/summary
POST /api/v1/app/nutrition/package-checkout/preview
POST /api/v1/app/nutrition/package-checkout/pay

GET  /api/v1/app/nutrition/diet-requests
POST /api/v1/app/nutrition/diet-requests

GET  /api/v1/app/nutrition/prescriptions
GET  /api/v1/app/nutrition/prescriptions/current
GET  /api/v1/app/nutrition/prescriptions/{id}

POST   /api/v1/app/nutrition/prescriptions/current/meal-log
DELETE /api/v1/app/nutrition/prescriptions/current/meal-log/{id}
POST   /api/v1/app/nutrition/prescriptions/current/water-log
GET    /api/v1/app/nutrition/exercises
POST   /api/v1/app/nutrition/prescriptions/current/exercise-log
DELETE /api/v1/app/nutrition/prescriptions/current/exercise-log/{id}
```

Swagger/OpenAPI باید جدا از کنترلرها نگهداری شود، ترجیحا در:

```text
docs/openapi/nutrition-user-api.yaml
```

OpenAPI باید شامل security scheme برای Bearer token، schemas مشترک، examples، validation rules و خطاهای business مهم باشد.

قبل از تغییر کد:

- routeهای فعلی در `routes/tenant.php` را بررسی کن.
- کنترلرها و سرویس های تغذیه فعلی را بخوان.
- مطمئن شو تغییرات routeهای فعلی وب و پنل را نمی شکند.
- درخت git را بررسی کن و تغییرات غیرمرتبط کاربر را revert نکن.

خروجی نهایی هر مرحله:

- کد قابل اجرا
- تست feature برای مسیرهای اصلی همان مرحله
- مستندات OpenAPI یا به روزرسانی آن
- توضیح کوتاه از فایل های تغییر کرده و تست های اجرا شده

## یادداشت نگهداری

هر تصمیم مهم، تغییر scope، endpoint جدید یا قرارداد response باید در همین فایل ثبت شود. اگر OpenAPI ساخته شد، مسیر آن هم اینجا لینک شود. این فایل باید قبل از شروع هر فاز خوانده شود.

## یادداشت 2026-06-16 - اخبار، مقالات و نظرات اپلیکیشن

برای API رسمی اپلیکیشن، endpointهای اخبار و مقالات زیر prefix تمیز `api/v1/app` اضافه شدند:

```text
GET  /api/v1/app/articles
GET  /api/v1/app/articles/{slug}
GET  /api/v1/app/articles/{slug}/comments
POST /api/v1/app/articles/{slug}/comments
```

لیست و مشاهده مقاله عمومی هستند. ثبت نظر با Bearer token و `auth:sanctum` انجام می شود. نظرهای جدید با status `pending` ذخیره می شوند و فقط نظرهای `approved` در endpoint عمومی نظرات نمایش داده می شوند.

Swagger جدا از کنترلرها در `app/OpenApi/CustomerAppArticleApi.php` نگهداری می شود تا کنترلرهای وب/پنل شلوغ نشوند.
