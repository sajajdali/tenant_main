<!DOCTYPE html>
@php
    $welcomeLocaleMeta = \App\Support\TenantLocale::configFor(app()->getLocale());
    $welcomeDir = (string) ($welcomeLocaleMeta['dir'] ?? 'rtl');
    $welcomeHtmlLang = (string) ($welcomeLocaleMeta['html_lang'] ?? app()->getLocale());
@endphp
<html lang="{{ $welcomeHtmlLang }}" dir="{{ $welcomeDir }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>BarberBook</title>
        <style>
            :root {
                color-scheme: dark;
                font-family: Tahoma, Arial, sans-serif;
            }

            * {
                box-sizing: border-box;
            }

            body {
                margin: 0;
                min-height: 100vh;
                display: grid;
                place-items: center;
                background:
                    radial-gradient(circle at top, rgba(245, 158, 11, 0.18), transparent 30%),
                    linear-gradient(180deg, #111827 0%, #0f172a 100%);
                color: #f8fafc;
            }

            .card {
                width: min(92vw, 680px);
                padding: 32px;
                border: 1px solid rgba(148, 163, 184, 0.24);
                border-radius: 28px;
                background: rgba(15, 23, 42, 0.78);
                box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
                backdrop-filter: blur(10px);
            }

            h1 {
                margin: 0 0 12px;
                font-size: 32px;
                line-height: 1.4;
            }

            p {
                margin: 0;
                line-height: 2;
                color: rgba(226, 232, 240, 0.82);
            }

            .actions {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                margin-top: 24px;
            }

            .button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-height: 48px;
                padding: 0 20px;
                border-radius: 999px;
                border: 1px solid rgba(245, 158, 11, 0.36);
                background: rgba(245, 158, 11, 0.14);
                color: #f8fafc;
                text-decoration: none;
            }

            .button.secondary {
                border-color: rgba(148, 163, 184, 0.28);
                background: rgba(15, 23, 42, 0.38);
            }
        </style>
    </head>
    <body>
        <main class="card">
            <h1>{{ __('admin.welcome.title') }}</h1>
            <p>
                {{ __('admin.welcome.description') }}
            </p>

            <div class="actions">
                @if (Route::has('login'))
                    <a class="button" href="{{ route('login') }}">{{ __('admin.welcome.login') }}</a>
                @endif
                <a class="button secondary" href="{{ url('/') }}">{{ __('admin.welcome.home') }}</a>
            </div>
        </main>
    </body>
</html>
