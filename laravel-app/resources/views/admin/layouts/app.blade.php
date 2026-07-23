<!doctype html>
@php
    $adminDir = 'rtl';
    $adminHtmlLang = 'fa';
    $adminIsRtl = true;
@endphp
<html lang="{{ $adminHtmlLang }}" dir="{{ $adminDir }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=0, minimal-ui">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>@yield('title', __('admin.layout.default_title')) | Tenant</title>
    <meta name="theme-color" content="#0f172a">
    <link rel="manifest" href="{{ asset('manifest.webmanifest') }}">
    <link rel="icon" href="{{ asset('favicon.svg') }}" type="image/svg+xml">
    <link rel="icon" href="{{ asset('favicon.png') }}" type="image/png">
    <link rel="alternate icon" href="{{ asset('favicon.ico') }}" type="image/x-icon">
    <link rel="apple-touch-icon" href="{{ asset('apple-touch-icon.png') }}">
    <link rel="stylesheet" href="{{ asset('admin-template/assets/fonts/phosphor/duotone/style.css') }}">
    <link rel="stylesheet" href="{{ asset('admin-template/assets/fonts/tabler-icons.min.css') }}">
    <link rel="stylesheet" href="{{ asset('admin-template/assets/fonts/feather.css') }}">
    <link rel="stylesheet" href="{{ asset('admin-template/assets/fonts/fontawesome.css') }}">
    <link rel="stylesheet" href="{{ asset('admin-template/assets/fonts/material.css') }}">
    <link rel="stylesheet" href="{{ asset('admin-template/assets/css/style.css') }}">
    <link rel="stylesheet" href="{{ asset('admin-template/assets/css/style-preset.css') }}">
    <style>
        body,
        .pc-container,
        .pc-header,
        .pc-sidebar,
        .card,
        .dropdown-menu,
        .table,
        .breadcrumb {
            direction: rtl;
            text-align: right;
            font-family: Tahoma, "Segoe UI", sans-serif;
        }

        .pc-container {
            margin-right: 280px;
            margin-left: 0;
        }

        .pc-sidebar {
            right: 0;
            left: auto;
            box-shadow: -1px 0 0 rgba(15, 23, 42, 0.08);
        }

        .pc-header {
            right: 280px;
            left: 0;
        }

        .pc-header .header-wrapper .me-auto {
            margin-right: 0 !important;
            margin-left: auto !important;
        }

        .pc-header .header-wrapper .ms-auto {
            margin-left: 0 !important;
            margin-right: auto !important;
        }

        .pc-navbar {
            padding-right: 0;
        }

        .pc-sidebar .pc-arrow {
            margin-right: auto;
            margin-left: 0;
            transform: rotate(180deg);
        }

        .pc-sidebar .pc-submenu {
            padding-right: 1rem;
            padding-left: 0;
        }

        .pc-sidebar .pc-micon {
            margin-left: 12px;
            margin-right: 0;
        }

        .breadcrumb {
            padding-right: 0;
        }

        .user-avtar {
            object-fit: cover;
        }

        .dashboard-stat-icon {
            width: 52px;
            height: 52px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 16px;
            font-size: 1.5rem;
        }

        .dashboard-hero {
            background: linear-gradient(135deg, #1d4ed8, #0f172a);
            color: #fff;
            overflow: hidden;
        }

        .dashboard-hero .hero-pattern {
            position: absolute;
            inset: 0;
            opacity: 0.12;
            background-image: radial-gradient(circle at 20% 30%, #fff 0, transparent 28%),
                radial-gradient(circle at 80% 20%, #fff 0, transparent 20%),
                radial-gradient(circle at 60% 80%, #fff 0, transparent 24%);
        }

        .metric-card {
            min-height: 100%;
        }

        .table td,
        .table th {
            text-align: right;
        }

        .pagination {
            justify-content: center;
        }

        @media (max-width: 1024px) {
            .pc-container {
                margin-right: 0;
            }

            .pc-header {
                right: 0;
            }
        }
    </style>
    @stack('styles')
</head>
<body data-pc-preset="preset-1" data-pc-sidebar-theme="light" data-pc-sidebar-caption="true" data-pc-direction="{{ $adminDir }}" data-pc-theme="light">
    <div class="loader-bg">
        <div class="loader-track">
            <div class="loader-fill"></div>
        </div>
    </div>

    @include('admin.partials.sidebar')
    @include('admin.partials.header')

    <div class="pc-container">
        <div class="pc-content">
            @if (session('success'))
                <div class="alert alert-success" role="alert">
                    {{ session('success') }}
                </div>
            @endif

            @if ($errors->any())
                <div class="alert alert-danger" role="alert">
                    {{ $errors->first() }}
                </div>
            @endif

            @yield('content')
        </div>
    </div>

    <script src="{{ asset('admin-template/assets/js/plugins/popper.min.js') }}"></script>
    <script src="{{ asset('admin-template/assets/js/plugins/simplebar.min.js') }}"></script>
    <script src="{{ asset('admin-template/assets/js/plugins/bootstrap.min.js') }}"></script>
    <script src="{{ asset('admin-template/assets/js/plugins/i18next.min.js') }}"></script>
    <script src="{{ asset('admin-template/assets/js/plugins/i18nextHttpBackend.min.js') }}"></script>
    <script src="{{ asset('admin-template/assets/js/icon/custom-font.js') }}"></script>
    <script src="{{ asset('admin-template/assets/js/script.js') }}"></script>
    <script src="{{ asset('admin-template/assets/js/theme.js') }}"></script>
    <script src="{{ asset('admin-template/assets/js/multi-lang.js') }}"></script>
    <script src="{{ asset('admin-template/assets/js/plugins/feather.min.js') }}"></script>
    <script>
        layout_change('light');
        layout_sidebar_change('light');
        change_box_container('false');
        layout_caption_change('true');
        layout_rtl_change('{{ $adminIsRtl ? 'true' : 'false' }}');
        preset_change('preset-1');
    </script>
    @stack('scripts')
</body>
</html>
