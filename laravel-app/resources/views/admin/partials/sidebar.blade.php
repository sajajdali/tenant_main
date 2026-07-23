@php
    $roleLabel = match (auth()->user()->role) {
        'admin' => 'مدیر سیستم',
        'teacher' => 'مدرس',
        'sales_manager' => 'مدیر فروش',
        'sales_expert' => 'کارشناس فروش',
        'barber' => 'مدیر سامانه',
        default => 'کاربر',
    };
    $filterNavItems = function (array $items) use (&$filterNavItems): array {
        return collect($items)
            ->filter(function (array $item): bool {
                $roles = $item['roles'] ?? null;

                return $roles === null || in_array(auth()->user()->role, $roles, true);
            })
            ->map(function (array $item) use (&$filterNavItems): array {
                if (! empty($item['children'] ?? [])) {
                    $item['children'] = $filterNavItems($item['children']);
                }

                return $item;
            })
            ->filter(fn (array $item): bool => ($item['type'] ?? 'menu') === 'caption' || ! empty($item['route'] ?? null) || ! empty($item['children'] ?? []))
            ->values()
            ->all();
    };
    $navigationItems = $filterNavItems(config('admin-navigation'));
@endphp

<nav class="pc-sidebar">
    <div class="navbar-wrapper">
        <div class="m-header">
            <a href="{{ route('admin.dashboard') }}" class="b-brand text-primary">
                <img src="{{ asset('admin-template/assets/images/logo-dark.svg') }}" alt="Tenant" class="logo-lg" style="width: 42px; height: 42px; object-fit: contain;">
                <span class="badge bg-brand-color-2 rounded-pill ms-1">مدیریت</span>
            </a>
        </div>
        <div class="navbar-content">
            <ul class="pc-navbar">
                @foreach ($navigationItems as $item)
                    @include('admin.partials.sidebar-item', ['item' => $item, 'level' => 0])
                @endforeach
            </ul>

            <div class="card nav-action-card bg-brand-color-4">
                <div class="card-body" style="background-image: url('{{ asset('admin-template/assets/images/layout/nav-card-bg.svg') }}')">
                    <h5 class="text-dark">{{ $roleLabel }}</h5>
                    <p class="text-dark text-opacity-75 mb-3">
                        @if (in_array(auth()->user()->role, ['sales_expert', 'sales_manager'], true))
                            این پنل برای مشاهده عملکرد فروش، درآمد، پیگیری‌ها و درخواست‌های برداشت شما تنظیم شده است.
                        @else
                            منو از config ساخته می‌شود و هر صفحه یا زیرمنوی جدید را بعداً از همین مسیر اضافه می‌کنیم.
                        @endif
                    </p>
                    <a href="{{ route('admin.dashboard') }}" class="btn btn-primary">بازگشت به داشبورد</a>
                </div>
            </div>

            <div class="card pc-user-card">
                <div class="card-body">
                    <div class="d-flex align-items-center">
                        <div class="flex-shrink-0">
                            <div class="user-avtar wid-45 rounded-circle bg-light-primary d-flex align-items-center justify-content-center">
                                <i class="ph-duotone ph-user-circle f-24"></i>
                            </div>
                        </div>
                        <div class="flex-grow-1 me-3">
                            <h6 class="mb-0">{{ auth()->user()->name }}</h6>
                            <small>{{ $roleLabel }}</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</nav>
