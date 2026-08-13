# راهنمای اتصال اپ Flutter به Laravel Reverb

این پروژه برای realtime از Laravel Reverb استفاده می‌کند. Reverb با پروتکل Pusher سازگار است، بنابراین اپ Flutter باید با کلاینت سازگار با Pusher Channels به WebSocket وصل شود.

هدف این اتصال این است که اپلیکیشن بدون refresh یا polling متوجه این اتفاق‌ها شود:

- پاسخ جدید در چت آنلاین
- تغییر وضعیت درخواست رژیم
- آماده شدن، تجویز شدن یا تایید شدن رژیم
- تغییر تعداد نوتیفیکیشن‌های خوانده‌نشده

## دیتایی که اپ Flutter لازم دارد

اپ برای اتصال به Reverb و subscribe کردن روی کانال‌های درست، باید این اطلاعات را داشته باشد.

### اطلاعات اتصال Reverb

```env
REVERB_APP_KEY=snugx8heg3dptlqkv9sp
REVERB_HOST=zodfit.com
REVERB_PORT=8081
REVERB_SCHEME=http
```

در سمت موبایل فقط `REVERB_APP_KEY` استفاده می‌شود.

این مقدارها نباید داخل اپ موبایل استفاده شوند:

```env
REVERB_APP_ID=525183
REVERB_APP_SECRET=<server-only-secret>
```

`REVERB_APP_SECRET` فقط برای بک‌اند است و نباید در Flutter، فایل config اپ، سورس اپ، یا هیچ خروجی قابل دسترسی برای کاربر قرار بگیرد.

### نکته مهم درباره آدرس Reverb

در `.env` سرور ممکن است مقدارها این‌طور باشند:

```env
REVERB_SERVER_HOST=127.0.0.1
REVERB_SERVER_PORT=8081

REVERB_HOST=127.0.0.1
REVERB_PORT=8081
REVERB_SCHEME=http
```

ولی برای موبایل، `127.0.0.1` یعنی خود گوشی، نه سرور. بنابراین اپ Flutter نباید به `127.0.0.1` وصل شود.

برای اپ Flutter باید آدرس public استفاده شود:

```env
REVERB_HOST=zodfit.com
REVERB_PORT=8081
REVERB_SCHEME=http
```

اگر بعدا Reverb پشت SSL یا reverse proxy قرار گرفت، تنظیمات کلاینت باید به شکل production امن تغییر کند:

```env
REVERB_HOST=zodfit.com
REVERB_PORT=443
REVERB_SCHEME=https
```

### اطلاعات کاربر بعد از login

بعد از login، اپ باید این اطلاعات را از API داشته باشد:

```text
tenantId
userId
authToken
```

`tenantId` و `userId` برای ساختن channel name لازم هستند.

`authToken` برای APIهای معمولی استفاده می‌شود. در وضعیت فعلی کانال‌های Reverb پروژه public هستند و برای subscribe کردن به WebSocket نیاز به auth endpoint ندارند. با این حال token همچنان برای گرفتن اطلاعات کامل از API بعد از دریافت event لازم است.

## چرخه کلی پیاده‌سازی

اپ باید بعد از login کاربر:

1. اطلاعات `tenantId` و `userId` را ذخیره کند.
2. به Reverb وصل شود.
3. روی کانال‌های مخصوص همان کاربر subscribe کند.
4. eventهای realtime را گوش کند.
5. بعد از دریافت هر event، state داخلی اپ را آپدیت کند یا API مربوطه را دوباره fetch کند.
6. بعد از logout، اتصال Reverb را قطع کند و subscriptionها را پاک کند.

## کانال‌ها و eventهایی که اپ باید گوش کند

### 1. کانال چت آنلاین کاربر

این کانال زمانی event می‌دهد که conversation چت آنلاین کاربر تغییر کند؛ مثلا کاربر پیام داده، ادمین جواب داده، وضعیت conversation تغییر کرده، یا پیام جدیدی ثبت شده است.

```text
channel: tenant.{tenantId}.online-chat.user.{userId}
event: online-chat.conversation.updated
```

نمونه channel:

```text
tenant.123.online-chat.user.45
```

Payload دریافتی:

```json
{
  "conversation": {},
  "action": "..."
}
```

فیلدها:

```text
conversation: اطلاعات conversation چت
action: نوع عملیاتی که باعث تغییر conversation شده است
```

رفتار مورد انتظار در اپ:

- اگر کاربر داخل صفحه چت است، پیام‌ها یا conversation را آپدیت کند.
- اگر payload کامل نبود یا ساختار messageها برای UI کافی نبود، conversation را از API دوباره fetch کند.
- اگر کاربر داخل صفحه چت نیست، badge یا indicator پیام جدید نشان دهد.
- اگر لازم است notification داخلی اپ نمایش داده شود، بر اساس همین event انجام شود.

نکته پیاده‌سازی:

بهتر است event فقط trigger آپدیت باشد. یعنی بعد از دریافت event، اپ API مربوط به conversation را دوباره بزند تا UI با دیتای قطعی backend هماهنگ بماند.

### 2. کانال رژیم و تغذیه کاربر

این کانال برای تغییرات مربوط به رژیم کاربر استفاده می‌شود. وقتی درخواست رژیم تغییر وضعیت بدهد، AI generation تمام شود، رژیم تجویز شود، رژیم تایید شود، یا وضعیت درخواست آپدیت شود، این event ارسال می‌شود.

```text
channel: tenant.{tenantId}.user.{userId}.nutrition
event: nutrition.diet-request.updated
```

نمونه channel:

```text
tenant.123.user.45.nutrition
```

Payload دریافتی:

```json
{
  "tenantUserId": "45",
  "dietRequest": {
    "id": "10",
    "status": "approved",
    "aiGenerationStatus": "completed",
    "aiGenerationError": null,
    "aiGeneratedAt": "2026-08-13T10:20:00+00:00",
    "updatedAt": "2026-08-13T10:21:00+00:00"
  }
}
```

فیلدها:

```text
tenantUserId: شناسه کاربر داخل tenant
dietRequest.id: شناسه درخواست رژیم
dietRequest.status: وضعیت درخواست رژیم
dietRequest.aiGenerationStatus: وضعیت تولید هوشمند رژیم
dietRequest.aiGenerationError: خطای تولید رژیم، اگر وجود داشته باشد
dietRequest.aiGeneratedAt: زمان تولید رژیم توسط AI
dietRequest.updatedAt: زمان آخرین آپدیت درخواست
```

رفتار مورد انتظار در اپ:

- اگر کاربر در صفحه رژیم، پروفایل تغذیه، یا جزئیات درخواست رژیم است، اطلاعات همان بخش را از API دوباره fetch کند.
- اگر وضعیت نشان داد رژیم آماده، تجویز، یا تایید شده، UI را به حالت آماده مشاهده رژیم ببرد.
- اگر `aiGenerationStatus` خطا داشت یا `aiGenerationError` مقدار داشت، خطای مناسب در UI نمایش داده شود.
- اگر کاربر در صفحه دیگری است، badge، snackbar، local in-app notification یا indicator مناسب نشان داده شود.

نکته پیاده‌سازی:

Payload این event خلاصه است و برای نمایش کامل رژیم کافی نیست. برای نمایش برنامه غذایی، جزئیات وعده‌ها، توضیحات، فایل‌ها یا وضعیت کامل، اپ باید بعد از دریافت event، API مربوط به رژیم یا درخواست رژیم را دوباره صدا بزند.

### 3. کانال نوتیفیکیشن‌های کاربر

این کانال زمانی event می‌دهد که inbox نوتیفیکیشن‌های کاربر تغییر کند؛ مثلا notification جدید آمده یا تعداد خوانده‌نشده‌ها تغییر کرده است.

```text
channel: tenant.{tenantId}.user.{userId}.notifications
event: user-notification.inbox-updated
```

نمونه channel:

```text
tenant.123.user.45.notifications
```

Payload دریافتی:

```json
{
  "tenantUserId": "45",
  "unreadCount": 3
}
```

فیلدها:

```text
tenantUserId: شناسه کاربر داخل tenant
unreadCount: تعداد نوتیفیکیشن‌های خوانده‌نشده
```

رفتار مورد انتظار در اپ:

- badge نوتیفیکیشن را با `unreadCount` آپدیت کند.
- اگر صفحه notification باز است، لیست notificationها را از API دوباره fetch کند.
- اگر notification جدید باید به کاربر نشان داده شود، از همین event برای trigger کردن in-app notification استفاده شود.

نکته پیاده‌سازی:

این event متن کامل notification را تضمین نمی‌کند. اگر اپ باید عنوان، متن، نوع، لینک یا action notification را نمایش دهد، باید بعد از دریافت event، لیست notificationها را از API بگیرد.

## رفتار اتصال

اپ باید اتصال Reverb را در lifecycle مناسب مدیریت کند.

### بعد از login

- اتصال Reverb برقرار شود.
- کانال‌های کاربر subscribe شوند.
- اگر اتصال موفق نبود، اپ همچنان با API معمولی کار کند.
- خطای اتصال realtime نباید مانع کار اصلی اپ شود.

### بعد از logout

- اتصال Reverb قطع شود.
- subscriptionها پاک شوند.
- state مربوط به notification، chat و nutrition کاربر قبلی پاک شود.

### هنگام قطع و وصل اینترنت

- اپ باید reconnect را مدیریت کند یا از قابلیت reconnect پکیج استفاده کند.
- بعد از reconnect بهتر است اطلاعات حساس صفحه فعلی دوباره از API fetch شود.
- اگر در زمان قطع بودن اینترنت event از دست رفت، API source of truth است.

## نکات امنیتی

در وضعیت فعلی پروژه، کانال‌های realtime از نوع public هستند. یعنی برای subscribe کردن به آن‌ها auth جداگانه لازم نیست.

با این حال اپ نباید اجازه بدهد کاربر روی channel دلخواه subscribe کند. نام channel باید فقط از `tenantId` و `userId` کاربر login شده ساخته شود.

در آینده اگر کانال‌ها private شوند، Flutter باید این موارد را اضافه کند:

```text
authEndpoint: /broadcasting/auth
Authorization: Bearer {authToken}
```

در آن حالت نام کانال‌ها احتمالا با prefix خصوصی subscribe می‌شوند و backend باید اجازه دسترسی هر user به channel خودش را بررسی کند.

## جمع‌بندی وظیفه Flutter

اپ Flutter باید:

- بعد از login به Reverb وصل شود.
- با `REVERB_APP_KEY` و آدرس public سرور websocket کار کند.
- روی کانال چت کاربر گوش کند.
- روی کانال رژیم/تغذیه کاربر گوش کند.
- روی کانال notification کاربر گوش کند.
- بعد از event چت، conversation را آپدیت یا refetch کند.
- بعد از event رژیم، وضعیت رژیم یا درخواست رژیم را refetch کند.
- بعد از event notification، badge و inbox را آپدیت کند.
- بعد از logout اتصال realtime را قطع کند.
- `REVERB_APP_SECRET` را هرگز داخل اپ قرار ندهد.
