@extends('admin.layouts.app')

@section('title', 'فرصت‌های تمدید')

@php
    use Morilog\Jalali\Jalalian;

    $formatMoney = fn (int $amount) => __('admin.money.iran_toman', ['amount' => number_format($amount)]);
    $formatJalaliDate = fn ($value) => $value ? Jalalian::fromCarbon(\Illuminate\Support\Carbon::parse($value))->format('Y/m/d') : '—';
    $filters = [
        'next_7_days' => 'تا ۷ روز آینده',
        'next_2_days' => 'تا ۲ روز آینده',
        'tomorrow' => 'فردا',
        'expired_last_7_days' => 'تا ۱ هفته گذشته',
        'expired_over_7_days' => 'بیشتر از ۱ هفته گذشته',
    ];
@endphp

@section('content')
    <div class="row g-4">
        <div class="col-12">
            <div class="page-header">
                <div class="page-block">
                    <div class="row align-items-center">
                        <div class="col-md-12">
                            <ul class="breadcrumb">
                                <li class="breadcrumb-item"><a href="{{ route('admin.dashboard') }}">داشبورد</a></li>
                                <li class="breadcrumb-item"><a href="{{ route('admin.sales-team.index') }}">تیم فروش</a></li>
                                <li class="breadcrumb-item">
                                    <a href="{{ route('admin.sales-team.show', $salesUser) }}">{{ $salesUser->name }}</a>
                                </li>
                                <li class="breadcrumb-item" aria-current="page">فرصت‌های تمدید</li>
                            </ul>
                        </div>
                        <div class="col-md-12">
                            <div class="page-header-title d-flex flex-wrap justify-content-between align-items-center gap-3">
                                <div>
                                    <h2 class="mb-1">لیست تمدیدهای {{ $salesUser->name }}</h2>
                                    <div class="text-muted">
                                        این صفحه برای پیگیری سریع مشتری‌هایی است که پشتیبانی‌شان رو به پایان است یا از تمدید جا مانده‌اند.
                                    </div>
                                </div>
                                <div class="d-flex gap-2">
                                    <a href="{{ route('admin.sales-team.show', $salesUser) }}" class="btn btn-outline-primary">بازگشت به داشبورد</a>
                                    @if (! $isScopedToCurrentUser)
                                        <a href="{{ route('admin.sales-team.renewals') }}" class="btn btn-light-secondary">فرصت‌های تمدید من</a>
                                    @endif
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-md-6 col-xl-3">
            <div class="card">
                <div class="card-body">
                    <p class="text-muted mb-1">فروش کل</p>
                    <h3 class="mb-0">{{ $formatMoney($summary['totalSales']) }}</h3>
                </div>
            </div>
        </div>
        <div class="col-md-6 col-xl-3">
            <div class="card">
                <div class="card-body">
                    <p class="text-muted mb-1">مشتری‌ها</p>
                    <h3 class="mb-0">{{ number_format($summary['totalCustomers']) }}</h3>
                </div>
            </div>
        </div>
        <div class="col-md-6 col-xl-3">
            <div class="card">
                <div class="card-body">
                    <p class="text-muted mb-1">تمدید نکرده</p>
                    <h3 class="mb-0 text-danger">{{ number_format($summary['missedRenewals']) }}</h3>
                </div>
            </div>
        </div>
        <div class="col-md-6 col-xl-3">
            <div class="card">
                <div class="card-body">
                    <p class="text-muted mb-1">پیگیری این ماه</p>
                    <h3 class="mb-0">{{ number_format($summary['monthlyFollowUps']) }}</h3>
                </div>
            </div>
        </div>

        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">فیلترهای کاربردی تمدید</h5>
                    <p class="text-muted mb-0">روی هر فیلتر بزنید تا فقط همان گروه از مشتری‌ها را ببینید و سریع برای تماس و پیگیری اقدام کنید.</p>
                </div>
                <div class="card-body">
                    <div class="d-flex flex-wrap gap-2 mb-3">
                            @foreach ($filters as $key => $label)
                            @php
                                $routeName = $isScopedToCurrentUser ? 'admin.sales-team.renewals' : 'admin.sales-team.user-renewals';
                                $routeParams = $isScopedToCurrentUser ? ['filter' => $key] : ['user' => $salesUser, 'filter' => $key];
                            @endphp
                            <a href="{{ route($routeName, $routeParams) }}" class="btn {{ $selectedFilter === $key ? 'btn-primary' : 'btn-outline-primary' }}">
                                {{ $label }}
                                <span class="badge bg-white text-dark ms-2">{{ number_format($renewalSummary[$key] ?? 0) }}</span>
                            </a>
                        @endforeach
                    </div>
                    <div class="alert alert-light border mb-0">
                        فیلتر فعال: <strong>{{ $salesTeamService->renewalFilterLabel($selectedFilter) }}</strong>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-12">
            <div class="card">
                <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div>
                        <h5 class="mb-1">جدول مشتری‌های نیازمند تمدید</h5>
                        <p class="text-muted mb-0">شماره تماس و اطلاعات تمدید اینجا آماده است تا مستقیم تماس بگیرید یا وارد داشبورد همان شخص شوید.</p>
                    </div>
                    <span class="badge bg-light-warning text-warning">{{ number_format($renewals->total()) }} مورد</span>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>مشتری</th>
                                    <th>طیف</th>
                                    <th>تاریخ پایان پشتیبانی</th>
                                    <th>وضعیت زمانی</th>
                                    <th>آخرین پیگیری</th>
                                    <th>پیگیری بعدی</th>
                                    <th>مسئول</th>
                                    <th>عملیات</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($renewals as $assignment)
                                    <tr>
                                        <td>
                                            <div class="fw-semibold">{{ $assignment->customer_name ?: '—' }}</div>
                                            <small class="text-muted" dir="ltr">{{ $assignment->customer_mobile ?: '—' }}</small>
                                        </td>
                                        <td>{{ $assignment->audienceType?->name ?? '—' }}</td>
                                        <td>{{ $formatJalaliDate($assignment->support_expires_at) }}</td>
                                        <td>
                                            <span class="badge {{ \Illuminate\Support\Carbon::parse($assignment->support_expires_at)->isFuture() || \Illuminate\Support\Carbon::parse($assignment->support_expires_at)->isToday() ? 'bg-light-warning text-warning' : 'bg-light-danger text-danger' }}">
                                                {{ $salesTeamService->renewalRelativeLabel($assignment->support_expires_at) }}
                                            </span>
                                        </td>
                                        <td>{{ $assignment->last_followed_up_at ? Jalalian::fromCarbon($assignment->last_followed_up_at)->format('Y/m/d H:i') : '—' }}</td>
                                        <td>{{ $assignment->next_follow_up_at ? Jalalian::fromCarbon($assignment->next_follow_up_at)->format('Y/m/d H:i') : '—' }}</td>
                                        <td>
                                            @if ($salesUser->role === 'sales_manager')
                                                {{ $assignment->salesExpert?->name ?? $salesUser->name }}
                                            @else
                                                {{ $salesUser->name }}
                                            @endif
                                        </td>
                                        <td>
                                            <div class="d-flex flex-wrap gap-2">
                                                @if ($assignment->customer_mobile)
                                                    <a href="tel:{{ $assignment->customer_mobile }}" class="btn btn-sm btn-success">
                                                        تماس
                                                    </a>
                                                @endif
                                                <a href="{{ route('admin.sales-team.show', $salesUser) }}" class="btn btn-sm btn-outline-primary">
                                                    داشبورد
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="8" class="text-center py-4 text-muted">در این فیلتر موردی برای نمایش وجود ندارد.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                    <div class="p-3">{{ $renewals->links() }}</div>
                </div>
            </div>
        </div>
    </div>
@endsection
