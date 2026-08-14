<!doctype html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>نتیجه پرداخت</title>
    <style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a1224;color:#fff;font-family:Tahoma,Arial,sans-serif}.card{width:min(92vw,380px);padding:32px;border:1px solid #334155;border-radius:20px;background:#111827;text-align:center}.button{display:block;margin-top:24px;padding:14px;border-radius:12px;background:#fbbf24;color:#111827;text-decoration:none;font-weight:700}.muted{color:#94a3b8;font-size:14px;line-height:2}</style>
</head>
<body><main class="card"><h1>{{ $status === 'success' ? 'پرداخت با موفقیت انجام شد' : ($status === 'failed' ? 'پرداخت ناموفق بود' : 'وضعیت پرداخت در حال بررسی است') }}</h1><p class="muted">برای ادامه، به اپلیکیشن بازگردید.</p>@if($returnUrl)<a class="button" href="{{ $returnUrl }}">بازگشت به اپلیکیشن</a>@else<p class="muted">آدرس بازگشت اپلیکیشن هنوز تنظیم نشده است.</p>@endif</main></body>
</html>
