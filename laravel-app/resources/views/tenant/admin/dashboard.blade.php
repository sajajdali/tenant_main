<!doctype html>
@php
    $locale = app()->getLocale();
    $localeConfig = config("localization.supported.{$locale}", config('localization.supported.fa', []));
    $dir = $localeConfig['dir'] ?? 'rtl';
    $htmlLang = $localeConfig['html_lang'] ?? $locale;
@endphp
<html lang="{{ $htmlLang }}" dir="{{ $dir }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ __('tenant.admin_dashboard.title_prefix') }} | {{ $tenant->name }}</title>
    <link rel="stylesheet" href="{{ asset('admin-template/assets/fonts/tabler-icons.min.css') }}">
    <link rel="stylesheet" href="{{ asset('admin-template/assets/css/style.css') }}">
    <link rel="stylesheet" href="{{ asset('admin-template/assets/css/style-preset.css') }}">
    <style>
        body {
            direction: {{ $dir }};
            text-align: start;
            font-family: Tahoma, "Segoe UI", sans-serif;
            background: #f8fafc;
        }
    </style>
</head>
<body>
    <div class="container py-5">
        <div class="row justify-content-center">
            <div class="col-xl-8">
                <div class="card">
                    <div class="card-body p-4 p-lg-5">
                        <div class="d-flex justify-content-between align-items-center mb-4">
                            <div>
                                <h2 class="mb-1">{{ __('tenant.admin_dashboard.heading', ['name' => $tenant->name]) }}</h2>
                                <p class="text-muted mb-0">{{ __('tenant.admin_dashboard.login_success') }}</p>
                            </div>
                            <form method="POST" action="{{ route('tenant.admin.logout') }}">
                                @csrf
                                <button type="submit" class="btn btn-outline-danger">{{ __('tenant.admin_dashboard.logout') }}</button>
                            </form>
                        </div>

                        <div class="alert alert-light-primary mb-4">
                            {{ __('tenant.admin_dashboard.placeholder') }}
                        </div>

                        <div class="row g-3">
                            <div class="col-md-6">
                                <div class="card border">
                                    <div class="card-body">
                                        <div class="text-muted mb-1">{{ __('tenant.admin_dashboard.domain') }}</div>
                                        <div dir="ltr" class="fw-semibold">{{ request()->getHost() }}</div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="card border">
                                    <div class="card-body">
                                        <div class="text-muted mb-1">{{ __('tenant.admin_dashboard.database') }}</div>
                                        <div dir="ltr" class="fw-semibold">{{ $tenant->getAttributes()['database'] ?? '-' }}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="mt-4">
                            <a href="{{ route('tenant.home') }}" class="btn btn-primary">{{ __('tenant.admin_dashboard.back') }}</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
