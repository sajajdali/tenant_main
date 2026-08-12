# راهنمای پیاده سازی Flutter بر اساس Swagger تغذیه

این سند برای برنامه نویس اپ Flutter است. منطق APIها با Swagger/OpenAPI پروژه هماهنگ شده و چند مورد لازم نیز به Swagger اضافه شده است.

## 1. صفحه لیست پکیج ها

Endpoint اصلی:

```http
GET /api/v1/app/membership/packages
```

در پاسخ این endpoint فیلد `data.activePackageNotice` اضافه شده است.

اگر `activePackageNotice != null` بود، بالای صفحه لیست پکیج ها یک بنر کاملا واضح نمایش بدهید:

```text
شما یک پکیج فعال دارید
این پکیج تا ۴ روز دیگر اعتبار دارد.
```

شرط نمایش این بنر فقط خود `activePackageNotice` است. این فیلد فقط وقتی پر می شود که پکیج کاربر هم از نظر تاریخ فعال باشد و هم موجودی رژیم داشته باشد:

- `status = active`
- `startsAt` نرسیده به آینده نباشد.
- `endsAt` تمام نشده باشد.
- حداقل یکی از `onlineDietRemaining` یا `offlineDietRemaining` بزرگ تر از صفر باشد.

اگر پکیج تاریخ دارد ولی موجودی رژیم ندارد، بنر نباید نمایش داده شود. هدف این است کاربر وقتی هنوز پکیج قابل استفاده دارد، اشتباهی پکیج جدید نخرد؛ با این حال خرید جدید همچنان مجاز است.

## 2. قانون خرید پکیج جدید

Endpoint وب/درگاه:

```http
POST /api/v1/app/nutrition/package-checkout/pay
```

Endpoint بازار:

```http
POST /api/v1/app/nutrition/iap/cafebazaar/package-orders
POST /api/v1/app/nutrition/iap/cafebazaar/package-orders/{order}/verify
```

قانون مهم: خرید پکیج جدید به پکیج قبلی اضافه نمی شود. وقتی پرداخت موفق شد، پکیج فعال قبلی `expired` می شود و پکیج جدید از همان تاریخ خرید شروع می شود.

مثال: کاربر پکیجی دارد که ۶ روز دیگر تمام می شود. امروز پکیج ۳۰ روزه می خرد. تاریخ پایان جدید باید ۳۰ روز بعد از امروز باشد، نه ۳۶ روز بعد.

اگر پکیج فعال قبلی بیش از ۱۰ روز اعتبار داشته باشد، سرور ممکن است خطای `422` روی `replace_active_subscription` بدهد. در این حالت اپ باید یک modal تأیید نشان دهد که خرید جدید جایگزین پکیج فعلی می شود. اگر کاربر تأیید کرد، همان درخواست را با این فیلد تکرار کنید:

```json
{
  "nutrition_package_id": 12,
  "replace_active_subscription": true
}
```

## 3. صفحه مشاهده رژیم

Endpoint رژیم فعلی:

```http
GET /api/v1/app/nutrition/prescriptions/current?date=2026-08-12
```

Endpoint رژیم از تاریخچه:

```http
GET /api/v1/app/nutrition/prescriptions/{id}?date=2026-08-12
```

در کارت هر غذا، فیلد مقدار از این فیلدها می آید:

- `quantity_text` در `contentSnapshot.day_plans[].meals[]`
- `quantity_text` در `contentSnapshot.meal_slots[].options[]`
- `quantityText` در `mealLogs[]`

نمایش مقدار باید جدول دو ستونه باشد، نه متن پشت سر هم. ستون راست عنوان و ستون چپ مقدار:

| عنوان | مقدار |
| --- | --- |
| مقدار | ۱۵۰ گرم مرغ، ۶ قاشق برنج |
| کالری | ۵۶۰ |
| پروتئین | ۴۲ گرم |

همه راهنمایی های رژیم در `contentSnapshot.guidance_sections` باید در شروع بسته باشند. هر آیتم با یک فلش کوچک نمایش داده شود و فقط با کلیک کاربر باز شود.

## 4. کلیک روی «وعده بعدی» در داشبورد

Endpoint داشبورد:

```http
GET /api/v1/app/nutrition/profile
```

اگر داشبورد رژیم فعال دارد، اطلاعات روز از این بخش ها می آید:

- `data.dashboard.activeDate`
- `data.dashboard.dailyCalories`
- `data.dashboard.days`
- `data.prescription.current.contentSnapshot`

وقتی کاربر روی «وعده بعدی صبحانه/ناهار/شام» کلیک کرد، نباید مثل دکمه «مشاهده کل رژیم» رفتار کند. باید صفحه رژیم را در حالت خلوت باز کنید:

```text
/nutrition/my-diet?date=2026-08-12&focusMealSlot=lunch&compact=meal_only
```

در این حالت فقط این موارد نمایش داده شود:

- جدول خلاصه همان روز: کالری، پروتئین، چربی، کربوهیدرات، فیبر و موارد موجود در `dailyMacroSummary` یا `dashboard.dailyCalories`.
- فقط همان وعده ای که `focusMealSlot` دارد.
- هیچ توضیح اضافه، راهنمایی، بخش های دیگر رژیم، وعده های دیگر یا متن های طولانی نمایش داده نشود.

بعد از لود صفحه، با اسکرول نرم به همان وعده بروید. اگر `focusMealSlot=breakfast` بود، صفحه باید روی صبحانه قرار بگیرد؛ اگر `lunch` بود، روی ناهار.

## 5. وقتی رژیم تمام شد

در داشبورد از این endpoint استفاده کنید:

```http
GET /api/v1/app/nutrition/profile
```

اگر `data.prescription.current == null` و رژیم قبلی تمام شده، دکمه «دریافت رژیم جدید» باید دیده شود. مسیر دکمه را از `data.dashboard.dietAction.href` یا `data.dashboard.banner.actionHref` بخوانید.

حالت های مهم:

- `state = needs_package`: دکمه خرید/دریافت پکیج.
- `state = ready_for_repeat_diet`: دکمه دریافت رژیم جدید و مسیر معمولا `/nutrition/diet-followup/1`.
- `state = prescribing`: دکمه غیرفعال، متن «رژیم شما در حال تجویز است».

## 6. صفحه ورزش

لیست ورزش ها:

```http
GET /api/v1/app/nutrition/exercises
```

ثبت ورزش:

```http
POST /api/v1/app/nutrition/prescriptions/current/exercise-log
```

بعد از ثبت موفق ورزش، به جای toast ساده یک modal باز شود:

```text
ورزش شما با موفقیت ثبت شد
```

Modal یک دکمه «تأیید» داشته باشد و با زدن آن بسته شود.

مشکل UI سرچ: پس زمینه فیلد سرچ در صفحه ورزش نباید قرمز باشد. آن را با تم صفحه هماهنگ کنید؛ حالت عادی سفید/خنثی، border ملایم، و فقط در حالت خطا رنگ قرمز نمایش داده شود.

## 7. نوتیفیکیشن ها

لیست اعلان ها:

```http
GET /api/v1/app/notifications?status=all&page=1&per_page=30
```

تعداد خوانده نشده:

```http
GET /api/v1/app/notifications/unread-count
```

جزئیات یک اعلان:

```http
GET /api/v1/app/notifications/{notification}
```

خوانده شده کردن یک اعلان:

```http
POST /api/v1/app/notifications/{notification}/read
```

خوانده شده کردن همه:

```http
POST /api/v1/app/notifications/read-all
```

رفتار UI:

- صفحه اعلان ها باید لیست `data.items` را نشان دهد.
- روی هر اعلان که کلیک شد، جزئیات همان اعلان باز شود.
- بعد از باز شدن موفق جزئیات، اگر `isRead=false` بود، endpoint خوانده شدن همان اعلان را صدا بزنید.
- badge زنگ اعلان از `unread-count` خوانده شود.
- اگر لیست خالی بود، empty state نمایش داده شود.

## چک لیست تحویل Flutter

- بنر پکیج فعال فقط با `activePackageNotice` نمایش داده شود.
- خرید پکیج جدید تاریخ قبلی را تمدید نکند؛ پیام جایگزینی برای کاربر واضح باشد.
- مقدار غذاها در جدول دو ستونه نمایش داده شود.
- راهنماهای رژیم در ابتدا بسته باشند و با فلش باز شوند.
- کلیک روی وعده بعدی فقط همان وعده را باز کند و اسکرول نرم به همان وعده انجام شود.
- دکمه دریافت رژیم جدید بعد از پایان رژیم از `dashboard.dietAction` نمایش داده شود.
- سرچ ورزش رنگ قرمز نداشته باشد مگر حالت خطا.
- ثبت ورزش modal موفقیت داشته باشد.
- لیست و جزئیات نوتیفیکیشن با APIهای بالا کامل پیاده سازی شود.
