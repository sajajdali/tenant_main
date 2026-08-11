# درخواست اصلاحات اپ Flutter تغذیه

این فایل برای برنامه نویس Flutter است و همه موارد زیر باید در اپ انجام شود. منطق APIها با Swagger/OpenAPI فعلی پروژه چک شده است. مسیرهای مهم Swagger:

- `Nutrition Profile`: `GET /api/v1/app/nutrition/profile`
- `Nutrition Prescriptions`: `GET /api/v1/app/nutrition/prescriptions` و `GET /api/v1/app/nutrition/prescriptions/{id}`
- `Membership`: مراحل `/api/v1/app/membership/...`

همه درخواست ها باید با هدر زیر ارسال شوند:

```http
Authorization: Bearer {token}
Accept: application/json
```

## 1. نمایش منوی پایین در صفحه «رژیم های من»

در صفحه «رژیم های من» منوی پایین اپ نمایش داده نمی شود. این صفحه باید مثل صفحه اصلی تغذیه و صفحه پروفایل، bottom navigation داشته باشد.

مسیر صفحه:

```text
/nutrition/my-diets
```

رفتار مورد انتظار:

- منوی پایین همیشه در صفحه «رژیم های من» دیده شود.
- آیتم «رژیم ها» در این صفحه active/current باشد.
- کاربر بتواند از همین صفحه به صفحه اصلی، دریافت رژیم جدید، پروفایل و پکیج ها برود.
- ساختار آیتم ها مشابه صفحه اصلی باشد:

```text
خانه -> /nutrition/profile
رژیم ها -> /nutrition/my-diets
رژیم جدید -> مسیر محاسبه شده طبق قوانین همین فایل
پروفایل -> /nutrition/membership/review?edit_only=1&from=profile_home
پکیج ها -> /nutrition/membership/my-package
```

برای آیتم «رژیم جدید» مسیر ثابت حدس زده نشود. اول `GET /api/v1/app/nutrition/profile` یا `GET /api/v1/app/nutrition/prescriptions` خوانده شود و بر اساس وضعیت کاربر مسیر انتخاب شود.

## 2. اصلاح empty state وقتی رژیم در حال تجویز است

مشکل فعلی: در صفحه لیست رژیم ها، وقتی رژیم در حال تجویز است، بالای صفحه نوشته می شود «رژیم در حال تجویز»، اما وسط صفحه نوشته می شود «هنوز رژیم نداری». این متن کاربر را گیج می کند.

API مربوط:

```http
GET /api/v1/app/nutrition/prescriptions
```

اگر پاسخ این حالت را داشت:

```json
{
  "success": true,
  "data": {
    "items": [],
    "action": {
      "type": "prescribing",
      "title": "رژیم در حال تجویز",
      "href": null,
      "disabled": true
    }
  }
}
```

رفتار مورد انتظار:

- اگر `data.items` خالی است و `data.action.type == "prescribing"`، متن وسط صفحه باید این باشد:

```text
رژیم شما در حال تجویز است
```

- در این حالت متن «هنوز رژیم نداری» نمایش داده نشود.
- دکمه CTA غیرفعال باشد، چون `action.disabled = true` و `action.href = null`.
- اگر کاربر رژیم های قبلی دارد و همزمان درخواست جدید در حال تجویز است، لیست رژیم های قبلی همچنان نمایش داده شود و فقط CTA/بنر حالت «رژیم در حال تجویز» داشته باشد.

## 3. حذف صفحه میانی مشاهده رژیم

مشکل فعلی: وقتی کاربر در منوی پایین روی «رژیم ها» می زند، لیست رژیم ها باز می شود. بعد روی یک رژیم می زند، یک صفحه میانی در Flutter باز می شود و تازه در آن صفحه باید دکمه «مشاهده» را بزند تا رژیم واقعی باز شود.

رفتار جدید:

- صفحه میانی باید کامل حذف شود.
- با tap روی هر کارت رژیم در لیست، مستقیم صفحه مشاهده همان رژیم باز شود.
- این قانون هم برای رژیم در حال استفاده است و هم برای رژیم های تمام شده.

API لیست:

```http
GET /api/v1/app/nutrition/prescriptions
```

برای هر آیتم، `id` رژیم را بردارید:

```json
{
  "id": "42",
  "usageStatus": "finished",
  "usageStatusLabel": "تمام شده"
}
```

با tap روی کارت، مستقیم جزئیات همان رژیم را بگیرید:

```http
GET /api/v1/app/nutrition/prescriptions/42
```

و مستقیم صفحه مشاهده رژیم را render کنید. برای رژیم های تاریخچه ای نباید اول به `/nutrition/my-diet` رفت، چون آن endpoint فقط رژیم فعال فعلی را می دهد. برای تاریخچه باید endpoint شناسه دار استفاده شود:

```http
GET /api/v1/app/nutrition/prescriptions/{nutritionDietPrescription}
```

قانون خطا:

- اگر `403` برگشت، رژیم متعلق به کاربر نیست.
- اگر `404` برگشت، رژیم منتشر نشده یا وجود ندارد.
- اگر رژیم `usageStatus = finished` داشت، باز هم باید قابل مشاهده باشد و فقط عملیات مخصوص رژیم فعال، مثل ثبت غذا/آب/ورزش، در صورت نیاز غیرفعال یا read-only شود.

## 4. گزینه «بیماری خاصی ندارم» باید همان لحظه submit کند

در مرحله بیماری ها، وقتی کاربر گزینه «بیماری خاصی ندارم» را می زند، نباید فقط انتخاب شود و منتظر دکمه ادامه بماند. باید همان لحظه فرم ثبت شود و کاربر به مرحله بعد برود.

صفحه:

```text
/nutrition/membership/medical-conditions
```

API ثبت:

```http
POST /api/v1/app/membership/medical-conditions
Content-Type: application/json
```

Body برای حالت «بیماری خاصی ندارم»:

```json
{
  "medicalConditions": null,
  "medicalConditionsItems": []
}
```

رفتار مورد انتظار:

- با tap روی «بیماری خاصی ندارم»، loading کوتاه روی همان گزینه یا صفحه نمایش داده شود.
- API بالا با `medicalConditionsItems: []` ارسال شود.
- در صورت موفقیت، مستقیم به مرحله بعد بروید:

```text
/nutrition/membership/medications-and-supplements
```

- اگر صفحه در حالت ویرایش پروفایل باز شده بود، بعد از ذخیره به صفحه review پروفایل برگردد:

```text
/nutrition/membership/review?edit_only=1&from=profile_home
```

در Swagger هم صریح آمده است: برای ثبت اینکه کاربر بیماری ندارد، `medicalConditionsItems` را آرایه خالی بفرستید.

## 5. اصلاح منطق «پرونده را کامل کن» در پروفایل

مشکل فعلی: در پروفایل، اپ می گوید «پرونده رو کامل کن» اگر کاربر این موارد را وارد نکرده باشد:

- بیماری خاص
- دارو یا مکمل
- غذاهای نامطلوب
- حساسیت غذایی

این موارد اختیاری هستند و خالی بودن آنها نباید باعث ناقص بودن پرونده شود.

قانون صحیح تکمیل پروفایل تغذیه:

پروفایل زمانی ناقص است که یکی از موارد اصلی زیر ناقص باشد:

```text
dietGoal
gender
athleteMode
activityLevel
birthDate
heightCm
weightKg
targetWeightKg
weeklyWeightChangeKg
preferencesCompletedAt
```

نکته مهم:

- `medicalConditions` و `medicalConditionsItems` اختیاری هستند.
- `medicationsAndSupplements` اختیاری است.
- `foodAllergies` اختیاری است.
- `dislikedFoods` اختیاری است.
- خالی بودن این فیلدها نباید باعث نمایش «پرونده را کامل کن» شود، به شرطی که مرحله preferences تکمیل شده باشد.

منبع تصمیم بهتر در API:

```http
GET /api/v1/app/nutrition/profile
```

از این بخش ها استفاده شود:

```json
{
  "data": {
    "profile": {
      "onboardingCompletedAt": "2026-06-14T12:00:00+03:30",
      "preferencesCompletedAt": "2026-06-14T12:00:00+03:30"
    },
    "dashboard": {
      "state": "has_current_prescription",
      "banner": null
    }
  }
}
```

اگر `dashboard.state == "profile_incomplete"` بود، فقط همان موقع پیام تکمیل پرونده نمایش داده شود و کاربر به `dashboard.banner.actionHref` یا اولین مرحله ناقص هدایت شود. اگر state چیز دیگری بود، به خاطر خالی بودن بیماری/دارو/حساسیت/غذاهای نامطلوب پیام تکمیل پرونده نمایش ندهید.

## 6. فعال شدن «دریافت رژیم جدید» در روز آخر رژیم

در داشبورد/صفحه اصلی تغذیه، اگر امروز روز آخر رژیم کاربر است، دکمه «دریافت رژیم جدید» باید فعال باشد و کاربر بتواند درخواست رژیم بعدی بدهد.

API اصلی:

```http
GET /api/v1/app/nutrition/profile
```

در پاسخ این API، فیلد زیر برای همین کار وجود دارد:

```json
{
  "data": {
    "dashboard": {
      "dietRenewal": {
        "hasActiveDiet": true,
        "blocked": false,
        "daysRemaining": 0,
        "endsAt": "2026-06-30",
        "prescriptionId": "42"
      }
    },
    "subscription": {
      "onlineDietRemaining": 1,
      "offlineDietRemaining": 0
    }
  }
}
```

قانون روز آخر:

- اگر `dashboard.dietRenewal.hasActiveDiet == true`
- و `dashboard.dietRenewal.daysRemaining == 0`
- و `dashboard.dietRenewal.blocked == false`

پس دکمه «دریافت رژیم جدید» باید فعال باشد.

قانون قبل از روز آخر:

- اگر `dashboard.dietRenewal.blocked == true` یا `daysRemaining > 0` و طبق سیاست فعلی هنوز اجازه ندارد، دکمه یا غیرفعال باشد یا با پیام توضیحی بگوید چند روز مانده است.
- در کد فعلی بک اند، `blocked` وقتی true می شود که بیشتر از ۲ روز تا پایان رژیم مانده باشد. اما درخواست جدید این است که حداقل در روز آخر قطعا فعال باشد. پس در Flutter معیار اصلی برای فعال بودن روز آخر، `daysRemaining == 0` باشد.

## 7. مسیر دکمه «دریافت رژیم جدید» بر اساس پکیج

وقتی کاربر روی «دریافت رژیم جدید» کلیک کرد:

### حالت A: کاربر پکیج قابل استفاده ندارد

اگر `subscription == null` یا مجموع موارد زیر صفر بود:

```text
subscription.onlineDietRemaining + subscription.offlineDietRemaining == 0
```

کاربر باید به خرید پکیج برود:

```text
/nutrition/membership/packages?direct_buy=1
```

### حالت B: کاربر پکیج قابل استفاده دارد

اگر یکی از این دو بزرگ تر از صفر بود:

```text
subscription.onlineDietRemaining > 0
subscription.offlineDietRemaining > 0
```

کاربر باید بتواند درخواست رژیم بدهد.

برای رژیم دوم به بعد مسیر صحیح:

```text
/nutrition/diet-followup/1
```

این مسیر طبق Swagger برای `ready_for_repeat_diet` و `get_repeat_diet` است و مراحل پیگیری رژیم بعدی را باز می کند.

### حالت C: درخواست رژیم در حال تجویز است

اگر `data.dietRequest.isPrescribing == true` یا `dashboard.state == "prescribing"`:

- دکمه دریافت رژیم جدید نباید درخواست جدید بسازد.
- پیام نمایش داده شود:

```text
رژیم شما در حال تجویز است
```

## 8. نکته مهم درباره `dietAction`

در روز آخر رژیم ممکن است `dashboard.dietAction` هنوز این باشد:

```json
{
  "type": "view_current_diet",
  "title": "مشاهده رژیم",
  "href": "/nutrition/my-diet",
  "disabled": false
}
```

چون رژیم تا پایان روز هنوز active است. بنابراین برای دکمه «مشاهده رژیم» از `dietAction` استفاده کنید، اما برای دکمه «دریافت رژیم جدید» فقط به `dietAction` تکیه نکنید. برای دریافت رژیم جدید، `dashboard.dietRenewal` و `subscription` را هم بررسی کنید.

Pseudo-code پیشنهادی:

```pseudo
profile = GET /api/v1/app/nutrition/profile

renewal = profile.data.dashboard.dietRenewal
subscription = profile.data.subscription
isPrescribing = profile.data.dietRequest.isPrescribing

remainingDiets =
  (subscription?.onlineDietRemaining ?? 0) +
  (subscription?.offlineDietRemaining ?? 0)

canRequestOnLastDay =
  renewal?.hasActiveDiet == true &&
  renewal?.daysRemaining == 0 &&
  renewal?.blocked == false

onTapNewDiet:
  if isPrescribing:
    show "رژیم شما در حال تجویز است"
    return

  if renewal?.hasActiveDiet == true and !canRequestOnLastDay:
    show "{daysRemaining} روز تا پایان رژیم باقی مانده است"
    return

  if remainingDiets <= 0:
    navigate("/nutrition/membership/packages?direct_buy=1")
    return

  navigate("/nutrition/diet-followup/1")
```

## 9. چک لیست تحویل

قبل از تحویل به QA این سناریوها تست شوند:

- صفحه «رژیم های من» bottom navigation دارد و آیتم رژیم ها active است.
- کاربر بدون رژیم و با `action.type = prescribing` متن «رژیم شما در حال تجویز است» می بیند، نه «هنوز رژیم نداری».
- tap روی رژیم فعال از لیست مستقیم صفحه مشاهده رژیم را باز می کند.
- tap روی رژیم تمام شده از لیست مستقیم صفحه مشاهده همان رژیم را باز می کند و صفحه میانی وجود ندارد.
- گزینه «بیماری خاصی ندارم» مستقیم `POST /api/v1/app/membership/medical-conditions` با `medicalConditionsItems: []` می زند و مرحله بعد باز می شود.
- خالی بودن بیماری، دارو/مکمل، غذاهای نامطلوب و حساسیت غذایی باعث نمایش «پرونده را کامل کن» نمی شود.
- در روز آخر رژیم، دکمه «دریافت رژیم جدید» فعال است.
- در روز آخر اگر کاربر پکیج ندارد یا موجودی رژیم پکیج صفر است، tap روی دکمه به `/nutrition/membership/packages?direct_buy=1` می رود.
- در روز آخر اگر کاربر پکیج با موجودی رژیم دارد، tap روی دکمه به `/nutrition/diet-followup/1` می رود.
- اگر رژیم در حال تجویز است، دکمه دریافت رژیم جدید درخواست جدید نمی سازد و پیام درست نشان می دهد.
