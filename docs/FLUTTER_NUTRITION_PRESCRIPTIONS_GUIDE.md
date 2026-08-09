# Flutter Nutrition Prescriptions Guide

این راهنما برای پیاده سازی صفحه «رژیم های من» در اپ Flutter است. منبع اصلی این توضیحات Swagger/OpenAPI پروژه است، مخصوصا تگ `Nutrition Prescriptions`.

## هدف صفحه

صفحه «رژیم های من» باید همیشه لیست رژیم های منتشرشده کاربر را نمایش بدهد. اگر کاربر هیچ رژیمی نداشته باشد، لیست باید به صورت empty state نمایش داده شود، اما همچنان دکمه/هدایت مناسب از `data.action` خوانده شود.

این صفحه فقط برای نمایش تاریخچه نیست؛ کنار لیست، backend به اپ می گوید کاربر الان باید چه کاری انجام بدهد:

- مشاهده رژیم فعلی
- صبر کردن چون رژیم در حال تجویز است
- خرید بسته
- دریافت رژیم اول
- دریافت رژیم بعدی

## Endpoint لیست رژیم ها

```http
GET /api/v1/app/nutrition/prescriptions
Authorization: Bearer {token}
```

این API لیست کامل رژیم های منتشرشده کاربر جاری را برمی گرداند.

## پاسخ کلی

```json
{
  "success": true,
  "data": {
    "items": [],
    "action": {
      "type": "needs_package",
      "title": "خرید بسته و دریافت رژیم",
      "href": "/nutrition/membership/packages?direct_buy=1",
      "disabled": false
    }
  }
}
```

## قانون مهم نمایش

`data.items` همیشه وجود دارد.

- اگر کاربر رژیم داشته باشد، `items` شامل رژیم هاست.
- اگر کاربر هیچ رژیمی نداشته باشد، `items` آرایه خالی است.
- در هر دو حالت باید صفحه لیست رژیم ها نمایش داده شود.
- `data.action` جایگزین لیست نیست؛ فقط CTA یا دکمه اصلی صفحه را مشخص می کند.

## ساختار هر رژیم

هر آیتم داخل `data.items` یک `NutritionPrescription` کامل است. برای کارت لیست رژیم ها این فیلدها مهم هستند:

```json
{
  "id": "42",
  "requestId": "18",
  "nutritionDietTemplateId": "7",
  "dietName": "رژیم کاهش وزن",
  "deliveryChannel": "ai",
  "prescriptionMode": "daily_prescription",
  "status": "active",
  "statusLabel": "فعال",
  "expired": false,
  "usageStatus": "in_use",
  "usageStatusLabel": "در حال استفاده",
  "currentWeightKg": 86.5,
  "targetWeightKg": 78,
  "weeklyWeightChangeKg": 0.5,
  "startedAt": "2026-06-16",
  "endsAt": "2026-06-30",
  "durationDays": 15,
  "isCurrent": true,
  "currentStatus": "active",
  "currentStatusLabel": "فعال",
  "summaryText": "برنامه ۱۵ روزه کاهش وزن",
  "publishedAt": "2026-06-15T10:00:00+03:30"
}
```

## فیلدهای پیشنهادی برای کارت رژیم

برای هر کارت رژیم این موارد را نمایش دهید:

| عنوان در UI | فیلد |
| --- | --- |
| نام رژیم | `dietName` |
| وزن موقع رژیم | `currentWeightKg` |
| تاریخ شروع | `startedAt` |
| تاریخ پایان | `endsAt` |
| مدت رژیم | `durationDays` |
| وضعیت استفاده | `usageStatusLabel` |
| فعال/غیرفعال | `currentStatusLabel` |
| خلاصه | `summaryText` |

برای متن های وضعیت از labelهای backend استفاده کنید و سمت Flutter حدس نزنید:

- `statusLabel`
- `usageStatusLabel`
- `currentStatusLabel`

## وضعیت استفاده رژیم

فیلدهای مربوط:

```json
{
  "expired": false,
  "usageStatus": "in_use",
  "usageStatusLabel": "در حال استفاده"
}
```

مقادیر ممکن:

| `usageStatus` | `usageStatusLabel` | معنی |
| --- | --- | --- |
| `in_use` | `در حال استفاده` | رژیم هنوز تمام نشده است |
| `finished` | `تمام شده` | تاریخ پایان رژیم گذشته است |

نکته مهم: روز پایان رژیم هنوز «در حال استفاده» حساب می شود. مثلا اگر `endsAt = 2026-06-30` باشد، در همان روز هنوز `in_use` است و از روز بعد `finished` می شود.

## وضعیت فعال بودن رژیم

فیلدهای مربوط:

```json
{
  "isCurrent": true,
  "currentStatus": "active",
  "currentStatusLabel": "فعال"
}
```

مقادیر ممکن:

| `currentStatus` | `currentStatusLabel` | معنی |
| --- | --- | --- |
| `active` | `فعال` | این رژیم رژیم فعلی و قابل استفاده کاربر است |
| `inactive` | `غیر فعال` | رژیم فعلی نیست یا تاریخ آن گذشته است |

## Action کنار لیست

در پاسخ لیست، `data.action` همیشه وجود دارد:

```json
{
  "type": "get_repeat_diet",
  "title": "دریافت رژیم",
  "href": "/nutrition/diet-followup/1",
  "disabled": false
}
```

این action باید برای دکمه اصلی صفحه استفاده شود. مثلا بالای لیست یا داخل empty state.

## مقادیر ممکن `action.type`

### `view_current_diet`

کاربر رژیم فعال دارد. دکمه باید کاربر را به صفحه رژیم فعلی ببرد.

```json
{
  "type": "view_current_diet",
  "title": "مشاهده رژیم فعلی",
  "href": "/nutrition/my-diet",
  "disabled": false
}
```

رفتار Flutter:

- دکمه فعال باشد.
- با کلیک، مسیر `href` باز شود.
- لیست رژیم ها همچنان نمایش داده شود.

### `prescribing`

کاربر درخواست رژیم داده و رژیم هنوز آماده/منتشر نشده است.

```json
{
  "type": "prescribing",
  "title": "رژیم در حال تجویز",
  "href": null,
  "disabled": true
}
```

رفتار Flutter:

- دکمه disabled باشد.
- پیام «رژیم در حال تجویز» نمایش داده شود.
- اگر کاربر رژیم های قبلی دارد، لیست قبلی ها همچنان نمایش داده شود.

### `needs_package`

کاربر پکیج قابل استفاده ندارد. یعنی برای گرفتن رژیم باید اول بسته بخرد.

```json
{
  "type": "needs_package",
  "title": "خرید بسته و دریافت رژیم",
  "href": "/nutrition/membership/packages?direct_buy=1",
  "disabled": false
}
```

رفتار Flutter:

- دکمه فعال باشد.
- با کلیک، صفحه خرید بسته باز شود.
- اگر `items` خالی است، empty state بگوید برای دریافت رژیم باید بسته تهیه شود.
- اگر `items` خالی نیست، تاریخچه رژیم ها نمایش داده شود و CTA خرید بسته هم نمایش داده شود.

### `get_first_diet`

کاربر پکیج قابل استفاده دارد، اما هنوز هیچ رژیمی ندارد.

رفتار Flutter:

- دکمه فعال باشد.
- با کلیک، مسیر `href` باز شود.
- اگر `items` خالی است، empty state باید کاربر را برای دریافت اولین رژیم راهنمایی کند.

مسیر ممکن است بسته به وضعیت پروفایل/ذهنیت کاربر متفاوت باشد، پس همیشه از `href` backend استفاده کنید.

### `get_repeat_diet`

کاربر قبلا رژیم داشته و الان باید رژیم بعدی را بگیرد. معمولا وقتی رژیم قبلی تمام شده و کاربر پکیج قابل استفاده دارد.

```json
{
  "type": "get_repeat_diet",
  "title": "دریافت رژیم",
  "href": "/nutrition/diet-followup/1",
  "disabled": false
}
```

رفتار Flutter:

- دکمه فعال باشد.
- با کلیک، مسیر `href` باز شود.
- لیست رژیم های قبلی همچنان نمایش داده شود.

## منطق کلی UI

1. صفحه «رژیم های من» باز می شود.
2. API زیر را صدا بزنید:

```http
GET /api/v1/app/nutrition/prescriptions
```

3. مقدار `data.items` را همیشه render کنید.
4. اگر `items` خالی بود، empty state نمایش دهید.
5. مقدار `data.action` را برای CTA اصلی صفحه بخوانید.
6. اگر `action.disabled = true`، دکمه را disabled کنید.
7. اگر `action.href` مقدار داشت، روی کلیک همان مسیر را باز کنید.
8. اگر `action.href = null`، دکمه نباید navigation انجام دهد.
9. برای وضعیت ها از labelهای backend استفاده کنید:

```text
statusLabel
usageStatusLabel
currentStatusLabel
```

## باز کردن جزئیات یک رژیم از لیست

وقتی کاربر روی یک رژیم از لیست کلیک کرد:

```http
GET /api/v1/app/nutrition/prescriptions/{nutritionDietPrescription}
Authorization: Bearer {token}
```

مثال:

```http
GET /api/v1/app/nutrition/prescriptions/42
```

پاسخ:

```json
{
  "success": true,
  "data": {
    "prescription": {}
  }
}
```

این endpoint مالکیت رژیم را بررسی می کند. اگر رژیم متعلق به کاربر نباشد `403` می دهد. اگر رژیم منتشر نشده یا وجود نداشته باشد `404` می دهد.

## گرفتن رژیم فعال فعلی

برای صفحه رژیم فعلی:

```http
GET /api/v1/app/nutrition/prescriptions/current
Authorization: Bearer {token}
```

اگر رژیم فعال وجود داشته باشد:

```json
{
  "success": true,
  "data": {
    "prescription": {}
  }
}
```

اگر رژیم فعال وجود نداشته باشد:

```json
{
  "success": true,
  "data": {
    "prescription": null
  }
}
```

## نکات مهم برای AI/Flutter

- هرگز مسیر بعدی را سمت Flutter حدس نزنید؛ همیشه از `data.action.href` استفاده کنید.
- هرگز وضعیت فارسی را سمت Flutter نسازید؛ از `usageStatusLabel` و `currentStatusLabel` استفاده کنید.
- `items` و `action` دو مفهوم جدا هستند. حتی اگر `items` پر باشد، باز هم `action` را نمایش دهید.
- اگر کاربر رژیم نداشته باشد، `items = []` است ولی `action` مشخص می کند باید به خرید بسته برود یا دریافت رژیم.
- اگر کاربر پکیج دارد و رژیم قبلی تمام شده، action معمولا `get_repeat_diet` است و مسیر آن `/nutrition/diet-followup/1` است.
- اگر کاربر پکیج ندارد، action از نوع `needs_package` است و مسیر خرید بسته را می دهد.
- اگر کاربر درخواست رژیم داده و هنوز آماده نشده، action از نوع `prescribing` است و دکمه باید غیرفعال باشد.

## خلاصه پیاده سازی پیشنهادی

```pseudo
response = GET /api/v1/app/nutrition/prescriptions

items = response.data.items
action = response.data.action

renderPrescriptionList(items)
renderPrimaryAction(action)

if action.disabled:
    disableButton()
else if action.href != null:
    onClick => navigate(action.href)

if items.isEmpty:
    showEmptyState(action.title)
```

