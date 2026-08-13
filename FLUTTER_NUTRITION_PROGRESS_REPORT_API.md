# راهنمای پیاده سازی صفحه گزارش پیشرفت در Flutter

## هدف

این سند قرارداد کامل صفحه «گزارش پیشرفت» اپ کاربر را توضیح می دهد. داده صفحه فقط از API زیر دریافت می شود و لازم نیست Flutter داده ها را از چند endpoint جمع کند:

`GET /api/v1/app/nutrition/progress-report`

این endpoint در Swagger با operationId زیر ثبت شده است:

`customerNutritionProgressReport`

تمام تاریخ های خروجی میلادی و با قالب `YYYY-MM-DD` هستند. نمایش جلالی، اعداد فارسی، واحد کیلوگرم و متن های رابط کاربری مسئولیت Flutter است. API عددهای وزن و BMI را به صورت عدد برمی گرداند؛ Flutter نباید آن ها را از رشته parse کند.

## احراز هویت و درخواست

درخواست فقط برای کاربر لاگین شده است و باید هدر زیر را داشته باشد:

`Authorization: Bearer <Sanctum token>`

پارامتر اختیاری `period` فقط نمودار وزن و آمار همان نمودار را فیلتر می کند:

| مقدار | کاربرد |
| --- | --- |
| `all` | کل دوره ثبت وزن کاربر؛ مقدار پیش فرض |
| `6m` | شش ماه اخیر |
| `4m` | چهار ماه اخیر |
| `3m` | سه ماه اخیر |

نمونه ها:

`GET /api/v1/app/nutrition/progress-report?period=all`

`GET /api/v1/app/nutrition/progress-report?period=6m`

در ورود اولیه صفحه با `period=all` درخواست بزنید. با لمس هر تب بازه نمودار، درخواست تازه با همان مقدار `period` بزنید؛ تا رسیدن پاسخ، نمودار قبلی را با loading سبک نگه دارید یا skeleton نشان دهید. در بازگشت به صفحه یا دریافت event مربوط به رژیم/وزن، endpoint را دوباره دریافت کنید.

## پاسخ موفق

در پاسخ `200` ساختار بیرونی همیشه به این شکل است:

```json
{
  "success": true,
  "message": null,
  "data": {
    "summary": {},
    "projection": {},
    "weightChart": {},
    "activity": {},
    "dietAdherence": {},
    "prescriptions": [],
    "bmi": {},
    "insights": [],
    "actions": {},
    "nullables": {}
  },
  "meta": {}
}
```

کلیدهای داخل `data` همیشه وجود دارند. نبود داده با حذف کلید جبران نمی شود؛ در عوض مقدارهای nullable، آرایه خالی، و `available: false` و `reason` برمی گردند. Flutter نباید برای هیچ بخش از `data` فرض کند مقدار حتماً غیر null است.

## ۱. کارت بالای صفحه: `summary`

این بخش برای وزن شروع، وزن فعلی، وزن هدف، تغییر وزن و نوار پیشرفت است. برخلاف نمودار، این بخش همیشه از **کل تاریخچه وزن** حساب می شود و با تغییر `period` تغییر نمی کند.

```json
{
  "available": true,
  "reason": null,
  "goal": "lose-weight",
  "startWeightKg": 86.0,
  "startWeightRecordedOn": "2026-03-10",
  "currentWeightKg": 78.5,
  "currentWeightRecordedOn": "2026-08-13",
  "targetWeightKg": 68.0,
  "weightChangeKg": 7.5,
  "direction": "lost",
  "completionPercentage": 41.7,
  "remainingToTargetKg": 10.5,
  "averageWeeklyChangeKg": 0.33
}
```

معنی فیلدها:

- `goal`: یکی از `lose-weight`، `gain-weight`، `maintain-weight` یا `null`.
- `startWeightKg`: اولین وزن ثبت شده کاربر در کل تاریخچه.
- `currentWeightKg`: آخرین وزن ثبت شده. در صورتی که هنوز لاگ وزن وجود نداشته باشد، ممکن است از وزن پروفایل پر شود، اما `available` همچنان false می ماند چون مبنای روند وجود ندارد.
- `targetWeightKg`: هدف ثبت شده در پروفایل؛ در نبود آن ممکن است هدف آخرین رژیم استفاده شود؛ در غیر این صورت `null` است.
- `weightChangeKg`: همیشه `startWeightKg - currentWeightKg` است. عدد مثبت یعنی کاهش وزن، عدد منفی یعنی افزایش وزن.
- `direction`: `lost`، `gained`، `unchanged` یا `null`.
- `completionPercentage`: درصد رسیدن از وزن شروع به وزن هدف، بین ۰ تا ۱۰۰. اگر وزن شروع یا وزن هدف موجود نباشد `null` است.
- `remainingToTargetKg`: فاصله مطلق وزن فعلی تا هدف؛ اگر هدف نباشد `null` است.
- `averageWeeklyChangeKg`: تغییر وزن واقعی میانگین در هفته؛ عدد مثبت یعنی روند کاهش وزن، عدد منفی یعنی روند افزایش وزن. با یک رکورد وزن یا دو رکورد هم تاریخ، `null` است.

منطق UI:

- اگر `available=false`، به جای عدد اصلی و درصد، empty state این کارت را نشان دهید؛ علت قابل نمایش از `reason` است. مقدار reason فعلی: `insufficient_weight_history`.
- هر فیلد nullable را مستقل بررسی کنید. مثلاً می توان وزن فعلی را نشان داد اما در نبود `targetWeightKg` نوار پیشرفت و متن «مانده تا هدف» را پنهان کرد.
- برای متن کاهش/افزایش از `direction` استفاده کنید، نه فقط علامت عدد.
- اگر `completionPercentage` برابر `100` باشد، نوار را کامل نشان دهید؛ هرگز سمت Flutter آن را بیشتر از ۱۰۰ نکنید.

## ۲. کارت تاریخ تقریبی هدف: `projection`

```json
{
  "available": true,
  "reason": null,
  "estimatedTargetDate": "2026-11-01",
  "weeklyChangeKg": 0.33,
  "message": null
}
```

`estimatedTargetDate` فقط یک برآورد مبتنی بر سرعت واقعی تغییر وزن است، نه تاریخ قطعی تجویز رژیم.

حالت ها:

- `available=true`: تاریخ را نمایش دهید و `weeklyChangeKg` را برای متن کمکی استفاده کنید.
- `available=false` و `reason=insufficient_projection_data`: داده کافی برای برآورد نیست؛ تاریخ نمایش ندهید.
- `available=false` و `reason=weight_trend_moves_away_from_target`: روند فعلی کاربر او را از هدف دور می کند؛ تاریخ جعلی نمایش ندهید.
- `estimatedTargetDate` و `message` در حالت بدون داده `null` هستند.

## ۳. نمودار وزن: `weightChart`

این بخش دقیقاً برای نمودار روند وزن و تب های کل دوره، شش ماه، چهار ماه و سه ماه است.

```json
{
  "selectedPeriod": "6m",
  "periods": [
    { "key": "all", "label": "کل دوره" },
    { "key": "6m", "label": "۶ ماه" },
    { "key": "4m", "label": "۴ ماه" },
    { "key": "3m", "label": "۳ ماه" }
  ],
  "available": true,
  "reason": null,
  "range": { "from": "2026-02-13", "to": "2026-08-13" },
  "points": [
    {
      "id": "15",
      "recordedOn": "2026-06-01",
      "recordedAt": "2026-06-01 10:15:00",
      "weightKg": 80.2,
      "source": "prescription_checkin",
      "prescriptionId": "42"
    }
  ],
  "targetWeightKg": 68.0,
  "statistics": {
    "last30DaysChangeKg": 1.6,
    "bestMonth": { "month": "2026-07", "weightChangeKg": 1.8 },
    "periodChangeKg": 4.2,
    "measurementCount": 11
  }
}
```

نکات دقیق نمودار:

- `selectedPeriod` باید با تب انتخاب شده یکی باشد. از این مقدار به عنوان مرجع state استفاده کنید، نه صرفاً مقدار محلی Flutter.
- `points` به ترتیب صعودی تاریخ هستند.
- برای هر روز فقط آخرین ثبت وزن همان روز برمی گردد؛ بنابراین یک نقطه در روز رسم کنید و نقاط هم تاریخ را تکراری نکنید.
- `recordedOn` محور زمانی نمودار است. `recordedAt` برای tooltip یا جزئیات است و nullable است.
- `source` یکی از `profile`، `diet_request`، `manual` و `prescription_checkin` است. نمایش آن اختیاری است، اما نباید موجب فیلتر یا حذف نقطه شود.
- `prescriptionId` nullable است؛ فقط وقتی وزن به یک نسخه رژیم وصل باشد مقدار دارد.
- خط هدف را فقط وقتی `targetWeightKg` غیر null است رسم کنید.
- هیچ interpolation یا نقطه ساختگی بین دو رکورد وزن نسازید. فقط `points` واقعی را رسم کنید.
- برای `period=all`، تمام رکوردهای وزن از اولین تا آخرین ثبت برمی گردند. برای بازه های دیگر فقط رکوردهای داخل بازه برمی گردند.

آمار نمودار:

- `last30DaysChangeKg`: تغییر وزن ۳۰ روز اخیر، مثبت یعنی کاهش وزن؛ با داده ناکافی `null`.
- `bestMonth`: ماهی که بهترین کاهش وزن ثبت شده دارد. `month` در قالب `YYYY-MM` است. اگر داده کافی برای محاسبه ماهانه نباشد کل آبجکت `null` است.
- `periodChangeKg`: تغییر وزن فقط در بازه انتخاب شده، نه کل دوره؛ با کمتر از دو نقطه `null`.
- `measurementCount`: تعداد نقاط واقعی نمودار بعد از حذف تکراری های یک روز.

حالت خالی نمودار:

```json
{
  "available": false,
  "reason": "no_weight_logs_in_period",
  "range": { "from": null, "to": null },
  "points": [],
  "targetWeightKg": null,
  "statistics": {
    "last30DaysChangeKg": null,
    "bestMonth": null,
    "periodChangeKg": null,
    "measurementCount": 0
  }
}
```

در این حالت نمودار خالی با CTA یا متن ثبت وزن نمایش دهید؛ chart library نباید با لیست خالی crash کند.

## ۴. ورزش: `activity`

```json
{
  "available": true,
  "reason": null,
  "sessionCount": 12,
  "totalDurationMinutes": 420,
  "caloriesBurned": 1346
}
```

- `sessionCount`: تعداد دفعات ثبت ورزش در کل تاریخچه.
- `totalDurationMinutes`: مجموع مدت ورزش به دقیقه.
- `caloriesBurned`: مجموع کالری ثبت شده ورزش.
- اگر جدول یا داده ورزش در دسترس نباشد `available=false` است. reason می تواند `exercise_logs_not_available` یا `no_exercise_logs` باشد؛ مقدارهای عددی در این حالت صفر هستند، اما صفر را به معنی موفقیت یا عملکرد ضعیف تفسیر نکنید.

## ۵. پایبندی رژیم: `dietAdherence`

```json
{
  "available": false,
  "reason": "scheduled_meal_total_not_recorded",
  "percentage": null,
  "loggedMealCount": 18,
  "loggedDayCount": 7
}
```

در وضعیت فعلی سرور تعداد وعده برنامه ریزی شده قابل اتکا برای محاسبه درصد پایبندی را نگه نمی دارد؛ بنابراین Flutter نباید درصدی مثل ۷۸٪ بسازد.

- فقط وقتی `available=true` شود `percentage` را به صورت درصد نمایش دهید.
- اگر `available=false`، درصد و progress bar را به حالت نامشخص ببرید؛ با این حال می توانید `loggedMealCount` و `loggedDayCount` را به عنوان آمار ثبت وعده نشان دهید.
- reason فعلی ممکن است `meal_logs_not_available` یا `scheduled_meal_total_not_recorded` باشد.

## ۶. تاریخچه رژیم های دریافتی: `prescriptions`

این آرایه همیشه وجود دارد و اگر کاربر رژیمی دریافت نکرده باشد `[]` است. فقط رژیم های منتشرشده در آن می آیند.

```json
{
  "id": "42",
  "title": "رژیم کاهش وزن متعادل",
  "status": "active",
  "deliveryChannel": "ai",
  "startedAt": "2026-06-01",
  "endsAt": "2026-06-30",
  "isCurrent": true,
  "startWeightKg": 82.0,
  "endWeightKg": 80.4,
  "targetWeightKg": 68.0,
  "weightChangeKg": 1.6,
  "measurementCount": 4
}
```

- `title`: نام تمپلیت رژیم؛ اگر نام موجود نباشد مقدار پیش فرض «رژیم دریافتی» است.
- `status`: وضعیت نسخه رژیم، مانند `draft`، `active`، `completed`، `cancelled` یا `archived`.
- `deliveryChannel`: `ai` یا `expert`.
- `startedAt` و `endsAt` nullable هستند.
- `startWeightKg` و `endWeightKg`: به ترتیب اولین و آخرین ثبت وزن در بازه همان رژیم. با داده ناکافی ممکن است یکی یا هر دو null باشند.
- `weightChangeKg`: فقط با حداقل دو نقطه وزن در بازه رژیم محاسبه می شود؛ مثبت یعنی کاهش وزن.
- `measurementCount`: تعداد اندازه گیری های وزن مربوط به آن دوره.
- برای رفتن به رژیم فعال، اولویت با `actions.viewCurrentDiet` است؛ به `isCurrent` به تنهایی برای navigation تکیه نکنید.

## ۷. تغییر BMI: `bmi`

```json
{
  "available": true,
  "reason": null,
  "heightCm": 168,
  "start": { "value": 30.5, "category": "obesity" },
  "current": { "value": 27.8, "category": "overweight" },
  "target": { "value": 24.1, "category": "normal" }
}
```

`start`، `current` و `target` هر کدام می توانند مستقل از دیگری `null` باشند. `category` یکی از `underweight`، `normal`، `overweight` و `obesity` است.

اگر قد کاربر ثبت نشده باشد:

```json
{
  "available": false,
  "reason": "no_height",
  "heightCm": null,
  "start": null,
  "current": null,
  "target": null
}
```

در این حالت کارت BMI را با وضعیت تکمیل اطلاعات نشان دهید، نه عدد صفر.

## ۸. نکته های گزارش: `insights`

این آرایه همیشه پنج آیتم با کلیدهای زیر دارد و ترتیب آن ثابت است:

1. `most_effective_diet`
2. `heart_health`
3. `daily_calorie_goal`
4. `consistency`
5. `exercise`

ساختار همه آیتم ها حداقل شامل `key`، `available` و `reason` است. بسته به نوع آن، فیلدهای زیر نیز وجود دارند:

- `most_effective_diet`: `prescriptionId` و `weightChangeKg`.
- `consistency`: `averageWeeklyChangeKg`.
- `exercise`: `caloriesBurned`.

قواعد نمایش:

- وقتی `available=true`، متن insight را از مقدارهای دریافتی بسازید.
- وقتی `available=false`، مقدار null را به صفر تبدیل نکنید. کارت را به صورت اطلاعات ناکافی/داده ثبت نشده نمایش دهید یا بنا به طراحی آن را کم رنگ کنید.
- `heart_health` در حال حاضر با `reason=no_health_measurements` برمی گردد، چون فشار خون یا شاخص سلامت قلب ثبت نمی شود.
- `daily_calorie_goal` در حال حاضر با `reason=daily_goal_adherence_not_calculated` برمی گردد؛ درصد ساختگی نسازید.
- `most_effective_diet` در نبود دو اندازه گیری وزن در هیچ رژیم، با `reason=insufficient_prescription_weight_history` است.
- `consistency` در نبود روند وزن با `reason=insufficient_weight_history` است.

## ۹. دکمه های پایین صفحه: `actions`

```json
{
  "viewCurrentDiet": {
    "prescriptionId": "42",
    "href": "/nutrition/my-diets/42"
  },
  "getNewDiet": {
    "href": "/nutrition/diet-requests/preview"
  }
}
```

- `viewCurrentDiet` اگر رژیم جاری وجود نداشته باشد `null` است. در آن حالت دکمه «مشاهده رژیم فعلی» را پنهان یا disabled کنید.
- `getNewDiet` همیشه آبجکت دارد و `href` آن مسیر شروع درخواست رژیم است.
- `href` قرارداد deep-link داخلی است. Flutter باید آن را به route داخلی متناظر نگاشت کند و قرار نیست URL وب را در WebView باز کند.

## ۱۰. `nullables`

این آبجکت توضیح سطح بالای بخش های ناقص است:

```json
{
  "profile": null,
  "weightHistory": null,
  "targetWeightKg": null,
  "bmi": null
}
```

اگر داده مربوطه وجود نداشته باشد، مقدار هر کلید یک reason است:

| کلید | reason ممکن |
| --- | --- |
| `profile` | `no_profile` |
| `weightHistory` | `no_weight_logs` |
| `targetWeightKg` | `no_target_weight` |
| `bmi` | `no_height` |

از `nullables` برای انتخاب empty state کلی صفحه استفاده کنید؛ اما برای هر کارت، اولویت با `available` و `reason` همان کارت است.

## خطاها و رفتار پیشنهادی

| کد | علت | رفتار Flutter |
| --- | --- | --- |
| `200` | دریافت موفق | صفحه را با `data` رندر کنید. |
| `401` | توکن ارسال نشده یا منقضی است | session را refresh کنید یا کاربر را به ورود ببرید. |
| `422` | مقدار `period` نامعتبر است | درخواست را با `all` تکرار کنید؛ فقط مقادیر تعریف شده مجازند. |
| `423` | دسترسی کاربر به بخش رژیم بسته است | پیام پاسخ را نمایش دهید و ورود به این صفحه را متوقف کنید. |
| خطای شبکه/timeout | اینترنت یا سرور در دسترس نیست | داده cache شده را با برچسب قدیمی نمایش دهید؛ در نبود cache empty/error state و دکمه تلاش مجدد نشان دهید. |

## حالت های مهم صفحه

### کاربر تازه وارد و بدون داده

- `prescriptions` برابر `[]` است.
- `weightChart.points` برابر `[]` و `available=false` است.
- `summary.available=false` است.
- BMI فقط اگر قد و وزن لازم موجود باشد قابل نمایش است.
- دکمه درخواست رژیم از `actions.getNewDiet` قابل استفاده است.

### کاربر دارای یک وزن ثبت شده

- وزن فعلی قابل نمایش است.
- نمودار یک نقطه دارد، اما روند، تغییر ۳۰ روز، تغییر دوره، سرعت هفتگی و پیش بینی هدف ممکن است `null` باشند.
- Flutter نباید با یک نقطه نمودار خط روند یا درصد تغییر جعلی بسازد.

### کاربر با داده وزن، اما بدون وزن هدف

- نمودار و روند وزن نمایش داده می شوند.
- خط هدف، درصد پیشرفت، مانده تا هدف و تاریخ هدف نمایش داده نمی شوند.
- `nullables.targetWeightKg` مقدار `no_target_weight` دارد.

### کاربر با رژیم، اما بدون لاگ وزن طی آن رژیم

- کارت رژیم در `prescriptions` نمایش داده می شود.
- وزن شروع ممکن است از داده نسخه رژیم پر باشد.
- `endWeightKg` و `weightChangeKg` ممکن است null باشند؛ به جای آن ها «اندازه گیری کافی نیست» نشان دهید.

### کاربر با بازه انتخابی بدون لاگ وزن

- ممکن است summary کل دوره داده داشته باشد ولی `weightChart` برای بازه ۳ یا ۴ یا ۶ ماه خالی باشد.
- در این حالت summary را حذف نکنید؛ فقط نمودار آن بازه empty state می گیرد.

## نکات فنی نهایی

- همه وزن ها بر حسب کیلوگرم و همه کالری ها بر حسب kcal هستند.
- مقادیر وزن ممکن است اعشاری باشند؛ حداقل با یک رقم اعشار نمایش داده شوند، بدون تغییر مقدار اصلی.
- تاریخ خروجی از سرور میلادی است. تبدیل به جلالی فقط در UI انجام شود.
- داده endpoint منبع اصلی صفحه است؛ بعد از ثبت وزن، ثبت ورزش، تأیید رژیم یا دریافت event Reverb مربوط به رژیم، endpoint را دوباره fetch کنید.
- برای خالی بودن، از مقدار `0` به جای `null` استفاده نکنید. صفر یک داده معتبر است و با داده ناموجود تفاوت دارد.
- به کلیدهایی غیر از کلیدهای Swagger وابسته نشوید. `message` در پاسخ موفق ممکن است null باشد و برای متن کارت ها استفاده نمی شود.
