@extends('admin.layouts.app')

@section('title', __('admin.teacher_dashboard.title'))

@php
    $formatMoney = fn (int|float $amount): string => __('admin.money.iran_toman', ['amount' => number_format((int) $amount)]);
    $formatPercent = fn (int|float $value): string => __('admin.specialized_courses.percent_value', [
        'value' => rtrim(rtrim(number_format((float) $value, 2, '.', ''), '0'), '.') ?: '0',
    ]);
@endphp

@section('content')
    <div class="row g-4">
        <div class="col-12">
            <div class="card dashboard-hero border-0 position-relative overflow-hidden">
                <div class="hero-pattern"></div>
                <div class="card-body p-4 p-lg-5 position-relative">
                    <div class="row align-items-center g-4">
                        <div class="col-lg-8">
                            <span class="badge bg-light text-dark mb-3">{{ __('admin.teacher_dashboard.badge') }}</span>
                            <h2 class="mb-3 text-white lh-base">{{ $teacher->name }}</h2>
                            <p class="mb-0 text-white text-opacity-75 lh-lg">{{ __('admin.teacher_dashboard.description') }}</p>
                        </div>
                        <div class="col-lg-4">
                            <div class="text-lg-start text-center">
                                <div class="display-6 fw-bold">{{ $formatPercent($teacher->sales_commission_percent ?? 0) }}</div>
                                <div class="text-white text-opacity-75">{{ __('admin.teacher_dashboard.direct_referral') }}</div>
                                <div class="small text-white text-opacity-75 mt-2">
                                    {{ __('admin.teacher_dashboard.indirect_referral', ['percent' => $formatPercent($teacher->teacherProfile?->commission_percent ?? 0)]) }}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="d-flex flex-wrap gap-2 mt-4">
                        <a href="{{ route('admin.specialized-course-reports.index') }}" class="btn btn-light-primary">{{ __('admin.teacher_dashboard.actions.sales_report') }}</a>
                        <a href="{{ route('admin.teacher.withdrawals') }}" class="btn btn-success">{{ __('admin.teacher_dashboard.actions.withdrawals') }}</a>
                        <a href="{{ route('admin.sales-team.customers') }}" class="btn btn-light-warning">{{ __('admin.teacher_dashboard.actions.customers') }}</a>
                        <a href="{{ route('admin.sales-team.show', $teacher) }}" class="btn btn-outline-light">{{ __('admin.teacher_dashboard.actions.referral_report') }}</a>
                    </div>
                </div>
            </div>
        </div>

        @foreach ([
            ['label' => __('admin.teacher_dashboard.metrics.courses_total'), 'value' => number_format($stats['courses_total'])],
            ['label' => __('admin.teacher_dashboard.metrics.courses_published'), 'value' => number_format($stats['courses_published'])],
            ['label' => __('admin.teacher_dashboard.metrics.orders_total'), 'value' => number_format($stats['orders_total'])],
            ['label' => __('admin.teacher_dashboard.metrics.orders_paid'), 'value' => number_format($stats['orders_paid'])],
            ['label' => __('admin.teacher_dashboard.metrics.gross_sales'), 'value' => $formatMoney($stats['gross_sales'])],
            ['label' => __('admin.teacher_dashboard.metrics.course_commission_total'), 'value' => $formatMoney($stats['course_commission_total'])],
            ['label' => __('admin.teacher_dashboard.metrics.referral_commission_total'), 'value' => $formatMoney($stats['referral_commission_total'])],
            ['label' => __('admin.teacher_dashboard.metrics.available_balance'), 'value' => $formatMoney($stats['available_balance'])],
            ['label' => __('admin.teacher_dashboard.metrics.pending_withdrawal_amount'), 'value' => $formatMoney($stats['pending_withdrawal_amount'])],
        ] as $item)
            <div class="col-md-6 col-xl-4">
                <div class="card metric-card h-100">
                    <div class="card-body">
                        <p class="text-muted mb-1">{{ $item['label'] }}</p>
                        <h3 class="mb-0">{{ $item['value'] }}</h3>
                    </div>
                </div>
            </div>
        @endforeach

        <div class="col-xl-6">
            <div class="card h-100">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <div>
                        <h5 class="mb-1">{{ __('admin.teacher_dashboard.latest_courses.title') }}</h5>
                        <p class="text-muted mb-0">{{ __('admin.teacher_dashboard.latest_courses.description') }}</p>
                    </div>
                    <a href="{{ route('admin.specialized-courses.create') }}" class="btn btn-primary btn-sm">{{ __('admin.specialized_courses.create') }}</a>
                </div>
                <div class="card-body">
                    <div class="list-group list-group-flush">
                        @forelse ($latestCourses as $course)
                            <div class="list-group-item px-0">
                                <div class="d-flex justify-content-between align-items-center gap-3">
                                    <div>
                                        <div class="fw-semibold">{{ $course->title }}</div>
                                        <div class="small text-muted">{{ $formatMoney($course->payableAmount()) }}</div>
                                    </div>
                                    <a href="{{ route('admin.specialized-courses.edit', $course) }}" class="btn btn-light-primary btn-sm">{{ __('admin.specialized_courses.actions.edit') }}</a>
                                </div>
                            </div>
                        @empty
                            <div class="text-muted">{{ __('admin.specialized_courses.empty') }}</div>
                        @endforelse
                    </div>
                </div>
            </div>
        </div>

        <div class="col-xl-6">
            <div class="card h-100">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <div>
                        <h5 class="mb-1">{{ __('admin.teacher_dashboard.latest_orders.title') }}</h5>
                        <p class="text-muted mb-0">{{ __('admin.teacher_dashboard.latest_orders.description') }}</p>
                    </div>
                    <a href="{{ route('admin.specialized-course-orders.index') }}" class="btn btn-light-primary btn-sm">{{ __('admin.teacher_dashboard.latest_orders.all') }}</a>
                </div>
                <div class="card-body">
                    <div class="list-group list-group-flush">
                        @forelse ($latestOrders as $order)
                            <div class="list-group-item px-0">
                                <div class="d-flex justify-content-between align-items-center gap-3">
                                    <div>
                                        <div class="fw-semibold">{{ $order->course_title_snapshot ?: __('admin.teacher_dashboard.latest_orders.fallback_course') }}</div>
                                        <div class="small text-muted">{{ $order->buyer_name ?: __('admin.teacher_dashboard.latest_orders.unknown_buyer') }} • {{ __('admin.teacher_dashboard.latest_orders.teacher_share_amount', ['amount' => $formatMoney($order->teacher_commission_amount)]) }}</div>
                                    </div>
                                    <span class="badge bg-light-primary text-primary">{{ $order->status === 'paid' ? __('admin.specialized_course_orders.status.paid') : $order->status }}</span>
                                </div>
                            </div>
                        @empty
                            <div class="text-muted">{{ __('admin.teacher_dashboard.latest_orders.empty') }}</div>
                        @endforelse
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection
