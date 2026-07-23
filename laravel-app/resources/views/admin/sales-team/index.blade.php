@extends('admin.layouts.app')

@section('title', 'تیم فروش')

@php
    $formatMoney = fn (int $amount) => __('admin.money.iran_toman', ['amount' => number_format($amount)]);
@endphp

@section('content')
    <div class="row g-4">
        <div class="col-12">
            <div class="card dashboard-hero border-0 position-relative overflow-hidden">
                <div class="hero-pattern"></div>
                <div class="card-body p-4 p-lg-5 position-relative">
                    <div class="row align-items-center g-4">
                        <div class="col-lg-8">
                            <span class="badge bg-light text-dark mb-3">داشبورد تیم فروش</span>
                            <h2 class="mb-3 text-white lh-base">مدیریت عملکرد کارشناسان و مدیران فروش</h2>
                            <p class="mb-0 text-white text-opacity-75 lh-lg">
                                از این بخش می‌توانید فروش، مشتری‌ها، پیگیری‌ها، تمدیدهای از دست‌رفته و روند ماهانه تیم فروش را بررسی کنید.
                                روی هر کارشناس یا مدیر فروش بزنید تا داشبورد کامل و جزئیات عملیاتی او باز شود.
                            </p>
                        </div>
                        <div class="col-lg-4">
                            <div class="d-flex flex-wrap gap-2 justify-content-lg-end">
                                <a href="{{ route('admin.sales-team.index') }}" class="btn {{ $selectedRole === '' ? 'btn-light' : 'btn-outline-light' }}">همه</a>
                                <a href="{{ route('admin.sales-team.index', ['role' => 'sales_expert']) }}" class="btn {{ $selectedRole === 'sales_expert' ? 'btn-light' : 'btn-outline-light' }}">کارشناسان فروش</a>
                                <a href="{{ route('admin.sales-team.index', ['role' => 'sales_manager']) }}" class="btn {{ $selectedRole === 'sales_manager' ? 'btn-light' : 'btn-outline-light' }}">مدیران فروش</a>
                                <a href="{{ route('admin.sales-team.index', ['role' => 'teacher']) }}" class="btn {{ $selectedRole === 'teacher' ? 'btn-light' : 'btn-outline-light' }}">مدرس‌ها</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-md-6 col-xl-3">
            <div class="card metric-card h-100">
                <div class="card-body">
                    <div class="d-flex align-items-center justify-content-between mb-4">
                        <div>
                            <p class="text-muted mb-1">فروش کل تیم</p>
                            <h3 class="mb-0">{{ $formatMoney($overview['totalSales']) }}</h3>
                        </div>
                        <div class="dashboard-stat-icon bg-light-primary text-primary">
                            <i class="ph-duotone ph-chart-line-up"></i>
                        </div>
                    </div>
                    <p class="mb-0 text-muted">جمع فروش ثبت‌شده بر اساس خرید و تمدیدهای متصل به تیم فروش</p>
                </div>
            </div>
        </div>
        <div class="col-md-6 col-xl-3">
            <div class="card metric-card h-100">
                <div class="card-body">
                    <div class="d-flex align-items-center justify-content-between mb-4">
                        <div>
                            <p class="text-muted mb-1">فروش این ماه</p>
                            <h3 class="mb-0">{{ $formatMoney($overview['monthlySales']) }}</h3>
                        </div>
                        <div class="dashboard-stat-icon bg-light-success text-success">
                            <i class="ph-duotone ph-calendar-check"></i>
                        </div>
                    </div>
                    <p class="mb-0 text-muted">خروجی همین ماه برای ارزیابی سریع عملکرد تیم</p>
                </div>
            </div>
        </div>
        <div class="col-md-6 col-xl-3">
            <div class="card metric-card h-100">
                <div class="card-body">
                    <div class="d-flex align-items-center justify-content-between mb-4">
                        <div>
                            <p class="text-muted mb-1">مشتری‌های فعال</p>
                            <h3 class="mb-0">{{ number_format($overview['totalCustomers']) }}</h3>
                        </div>
                        <div class="dashboard-stat-icon bg-light-info text-info">
                            <i class="ph-duotone ph-users"></i>
                        </div>
                    </div>
                    <p class="mb-0 text-muted">تمام مشتری‌هایی که به اعضای تیم فروش متصل شده‌اند</p>
                </div>
            </div>
        </div>
        <div class="col-md-6 col-xl-3">
            <div class="card metric-card h-100">
                <div class="card-body">
                    <div class="d-flex align-items-center justify-content-between mb-4">
                        <div>
                            <p class="text-muted mb-1">پیگیری این ماه</p>
                            <h3 class="mb-0">{{ number_format($overview['followUpsThisMonth']) }}</h3>
                        </div>
                        <div class="dashboard-stat-icon bg-light-warning text-warning">
                            <i class="ph-duotone ph-phone-call"></i>
                        </div>
                    </div>
                    <p class="mb-0 text-muted">حجم فعالیت ثبت‌شده توسط تیم فروش در ماه جاری</p>
                </div>
            </div>
        </div>
        <div class="col-md-6 col-xl-3">
            <div class="card metric-card h-100">
                <div class="card-body">
                    <div class="d-flex align-items-center justify-content-between mb-4">
                        <div>
                            <p class="text-muted mb-1">موجودی قابل برداشت</p>
                            <h3 class="mb-0">{{ $formatMoney($overview['availableBalance']) }}</h3>
                        </div>
                        <div class="dashboard-stat-icon bg-light-success text-success">
                            <i class="ph-duotone ph-wallet"></i>
                        </div>
                    </div>
                    <p class="mb-0 text-muted">جمع موجودی قابل برداشت اعضای تیم فروش در همین لحظه</p>
                </div>
            </div>
        </div>
        <div class="col-md-6 col-xl-3">
            <div class="card metric-card h-100">
                <div class="card-body">
                    <div class="d-flex align-items-center justify-content-between mb-4">
                        <div>
                            <p class="text-muted mb-1">درخواست‌های برداشت</p>
                            <h3 class="mb-0">{{ number_format($overview['pendingWithdrawalRequests']) }}</h3>
                        </div>
                        <div class="dashboard-stat-icon bg-light-danger text-danger">
                            <i class="ph-duotone ph-hand-withdraw"></i>
                        </div>
                    </div>
                    <p class="mb-0 text-muted">{{ __('admin.sales_team.pending_deposit', ['amount' => $formatMoney($overview['pendingWithdrawalAmount'])]) }}</p>
                </div>
            </div>
        </div>

        <div class="col-12">
            <div class="card">
                <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div>
                        <h5 class="mb-1">اعضای تیم فروش</h5>
                        <p class="text-muted mb-0">مدیر کل از اینجا می‌تواند عملکرد همه کارشناسان و مدیران فروش را بررسی و وارد داشبورد جزئیات آن‌ها شود.</p>
                    </div>
                    <div class="d-flex gap-2">
                        <span class="badge bg-light-primary text-primary">کارشناس/معرف: {{ number_format($overview['expertsCount']) }}</span>
                        <span class="badge bg-light-info text-info">مدیر فروش: {{ number_format($overview['managersCount']) }}</span>
                        <span class="badge bg-light-danger text-danger">تمدید نکرده: {{ number_format($overview['missedRenewals']) }}</span>
                    </div>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle">
                            <thead>
                                <tr>
                                    <th>کاربر</th>
                                    <th>نقش</th>
                                    <th>فروش کل</th>
                                    <th>این ماه</th>
                                    <th>مشتری‌ها</th>
                                    <th>پیگیری این ماه</th>
                                    <th>تمدید نکرده</th>
                                    <th>پورسانت</th>
                                    <th>کیف پول</th>
                                    <th>عملیات</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($items as $item)
                                    @php
                                        $user = $item['user'];
                                        $summary = $item['summary'];
                                    @endphp
                                    <tr>
                                        <td>
                                            <div class="d-flex flex-column">
                                                <span class="fw-semibold">{{ $user->name }}</span>
                                                <small class="text-muted" dir="ltr">{{ $user->mobile }}</small>
                                            </div>
                                        </td>
                                        <td>
                                            <span class="badge {{ $user->role === 'sales_manager' ? 'bg-light-info text-info' : ($user->role === 'teacher' ? 'bg-light-warning text-warning' : 'bg-light-primary text-primary') }}">
                                                {{ $salesTeamService->roleLabel($user->role) }}
                                            </span>
                                        </td>
                                        <td>{{ $formatMoney($summary['totalSales']) }}</td>
                                        <td>{{ $formatMoney($summary['monthlySales']) }}</td>
                                        <td>
                                            <div>{{ number_format($summary['totalCustomers']) }} مشتری</div>
                                            <small class="text-muted">{{ number_format($summary['monthlyCustomers']) }} مشتری جدید در این ماه</small>
                                        </td>
                                        <td>{{ number_format($summary['monthlyFollowUps']) }}</td>
                                        <td>
                                            <span class="badge {{ $summary['missedRenewals'] > 0 ? 'bg-light-danger text-danger' : 'bg-light-success text-success' }}">
                                                {{ number_format($summary['missedRenewals']) }}
                                            </span>
                                        </td>
                                        <td>
                                            <div>{{ $formatMoney($summary['commissionAmount']) }}</div>
                                            <small class="text-muted">{{ __('admin.sales_team.this_month', ['amount' => $formatMoney($summary['monthlyCommission'])]) }}</small>
                                        </td>
                                        <td>
                                            <div>{{ $formatMoney($summary['availableBalance']) }}</div>
                                            <small class="text-muted">{{ __('admin.sales_team.open_requests', ['count' => number_format($summary['pendingWithdrawalRequestsCount'])]) }}</small>
                                        </td>
                                        <td>
                                            <div class="d-flex flex-wrap gap-2">
                                                <a href="{{ route('admin.sales-team.show', $user) }}" class="btn btn-sm btn-primary">
                                                    مشاهده داشبورد
                                                </a>
                                                <a href="{{ route('admin.sales-team.user-renewals', $user) }}" class="btn btn-sm btn-warning">
                                                    تمدیدها
                                                </a>
                                                @if (auth()->user()->role === 'admin' || (int) auth()->id() === (int) $user->id)
                                                    <a href="{{ route('admin.sales-team.withdrawals.create', $user) }}" class="btn btn-sm btn-light-success">
                                                        برداشت‌ها
                                                    </a>
                                                @endif
                                            </div>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="10" class="text-center py-4 text-muted">هنوز کارشناس یا مدیر فروش ثبت نشده است.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection
