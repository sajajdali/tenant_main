@extends('admin.layouts.app')

@section('title', __('admin.specialized_course_reports.title'))

@php
    $formatMoney = fn (int|float $amount): string => __('admin.money.iran_toman', ['amount' => number_format((int) $amount)]);
    $formatPercent = fn (int|float $value): string => __('admin.specialized_courses.percent_value', [
        'value' => rtrim(rtrim(number_format((float) $value, 2, '.', ''), '0'), '.') ?: '0',
    ]);
@endphp

@section('content')
    <div class="row g-4">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">{{ $isTeacher ? __('admin.specialized_course_reports.my_title') : __('admin.specialized_course_reports.all_title') }}</h5>
                    <p class="text-muted mb-0">{{ __('admin.specialized_course_reports.description') }}</p>
                </div>
                <div class="card-body">
                    <form method="GET" action="{{ route('admin.specialized-course-reports.index') }}" class="row g-3">
                        <div class="col-md-3">
                            <input type="text" class="form-control" name="search" value="{{ $filters['search'] }}" placeholder="{{ __('admin.specialized_course_reports.filters.search_placeholder') }}">
                        </div>
                        <div class="col-md-2">
                            <select class="form-select" name="status">
                                <option value="">{{ __('admin.specialized_course_orders.filters.all_statuses') }}</option>
                                <option value="paid" @selected($filters['status'] === 'paid')>{{ __('admin.specialized_course_orders.status.paid') }}</option>
                                <option value="pending" @selected($filters['status'] === 'pending')>{{ __('admin.specialized_course_orders.status.pending') }}</option>
                                <option value="cancelled" @selected($filters['status'] === 'cancelled')>{{ __('admin.specialized_course_orders.status.cancelled') }}</option>
                            </select>
                        </div>
                        @unless($isTeacher)
                            <div class="col-md-2">
                                <select class="form-select" name="teacher_user_id">
                                    <option value="">{{ __('admin.specialized_course_orders.filters.all_teachers') }}</option>
                                    @foreach($teachers as $teacher)
                                        <option value="{{ $teacher->id }}" @selected((string) $filters['teacher_user_id'] === (string) $teacher->id)>{{ $teacher->name }}</option>
                                    @endforeach
                                </select>
                            </div>
                        @endunless
                        <div class="col-md-2">
                            <select class="form-select" name="specialized_course_id">
                                <option value="">{{ __('admin.specialized_course_orders.filters.all_courses') }}</option>
                                @foreach($courses as $course)
                                    <option value="{{ $course->id }}" @selected((string) $filters['specialized_course_id'] === (string) $course->id)>{{ $course->title }}</option>
                                @endforeach
                            </select>
                        </div>
                        <div class="col-md-1">
                            <input type="date" class="form-control" name="date_from" value="{{ $filters['date_from'] }}">
                        </div>
                        <div class="col-md-1">
                            <input type="date" class="form-control" name="date_to" value="{{ $filters['date_to'] }}">
                        </div>
                        <div class="col-md-1 d-grid">
                            <button type="submit" class="btn btn-primary">{{ __('admin.common.apply') }}</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        @foreach ([
            ['label' => __('admin.specialized_course_orders.summary.orders_total'), 'value' => number_format($summary['orders_total'])],
            ['label' => __('admin.specialized_course_reports.summary.paid_orders'), 'value' => number_format($summary['orders_paid'])],
            ['label' => __('admin.specialized_course_orders.summary.gross_sales'), 'value' => $formatMoney($summary['gross_sales'])],
            ['label' => __('admin.specialized_course_reports.summary.teacher_commission_total'), 'value' => $formatMoney($summary['teacher_commission_total'])],
            ['label' => __('admin.specialized_course_orders.summary.sales_expert_commission_total'), 'value' => $formatMoney($summary['sales_expert_commission_total'])],
            ['label' => __('admin.specialized_course_orders.summary.sales_manager_commission_total'), 'value' => $formatMoney($summary['sales_manager_commission_total'])],
        ] as $item)
            <div class="col-md-6 col-xl-4">
                <div class="card h-100">
                    <div class="card-body">
                        <div class="text-muted mb-1">{{ $item['label'] }}</div>
                        <h3 class="mb-0">{{ $item['value'] }}</h3>
                    </div>
                </div>
            </div>
        @endforeach

        <div class="col-xl-7">
            <div class="card h-100">
                <div class="card-header">
                    <h5 class="mb-1">{{ __('admin.specialized_course_reports.by_course.title') }}</h5>
                    <p class="text-muted mb-0">{{ __('admin.specialized_course_reports.by_course.description') }}</p>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>{{ __('admin.specialized_course_orders.columns.course') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.teacher') }}</th>
                                    <th>{{ __('admin.specialized_course_reports.columns.orders_count') }}</th>
                                    <th>{{ __('admin.specialized_course_reports.columns.sales') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.teacher_share') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.sales_expert') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.sales_manager') }}</th>
                                    <th>{{ __('admin.specialized_course_reports.columns.average_percent') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse($courseBreakdown as $row)
                                    <tr>
                                        <td>{{ $row['course_title'] }}</td>
                                        <td>{{ $row['teacher_name'] }}</td>
                                        <td>{{ number_format($row['orders_count']) }}</td>
                                        <td>{{ $formatMoney($row['gross_sales']) }}</td>
                                        <td>{{ $formatMoney($row['teacher_commission_total']) }}</td>
                                        <td>{{ $formatMoney($row['sales_expert_commission_total']) }}</td>
                                        <td>{{ $formatMoney($row['sales_manager_commission_total']) }}</td>
                                        <td>{{ $formatPercent($row['average_commission_percent']) }}</td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="8" class="text-center text-muted py-4">{{ __('admin.specialized_course_reports.empty_filtered') }}</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-xl-5">
            <div class="card h-100">
                <div class="card-header">
                    <h5 class="mb-1">{{ __('admin.specialized_course_reports.by_teacher.title') }}</h5>
                    <p class="text-muted mb-0">{{ __('admin.specialized_course_reports.by_teacher.description') }}</p>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>{{ __('admin.specialized_course_orders.columns.teacher') }}</th>
                                    <th>{{ __('admin.specialized_course_reports.columns.orders_count') }}</th>
                                    <th>{{ __('admin.specialized_course_reports.columns.sales') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.teacher_share') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.sales_expert') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.sales_manager') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse($teacherBreakdown as $row)
                                    <tr>
                                        <td>{{ $row['teacher_name'] }}</td>
                                        <td>{{ number_format($row['orders_count']) }}</td>
                                        <td>{{ $formatMoney($row['gross_sales']) }}</td>
                                        <td>{{ $formatMoney($row['teacher_commission_total']) }}</td>
                                        <td>{{ $formatMoney($row['sales_expert_commission_total']) }}</td>
                                        <td>{{ $formatMoney($row['sales_manager_commission_total']) }}</td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="6" class="text-center text-muted py-4">{{ $isTeacher ? __('admin.specialized_course_reports.by_teacher.teacher_empty') : __('admin.specialized_course_reports.by_teacher.empty') }}</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">{{ __('admin.specialized_course_reports.orders.title') }}</h5>
                    <p class="text-muted mb-0">{{ __('admin.specialized_course_reports.orders.description') }}</p>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>{{ __('admin.specialized_course_orders.columns.order_number') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.course') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.buyer') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.teacher') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.payable_amount') }}</th>
                                    <th>{{ __('admin.specialized_course_reports.columns.percent') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.teacher_share') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.sales_expert') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.sales_manager') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.status') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse($orders as $order)
                                    @php($breakdown = is_array($order->meta_json['commission_breakdown'] ?? null) ? $order->meta_json['commission_breakdown'] : [])
                                    <tr>
                                        <td dir="ltr">{{ $order->order_number }}</td>
                                        <td>{{ $order->course_title_snapshot ?: ($order->course?->title ?? '—') }}</td>
                                        <td>
                                            <div>{{ $order->buyer_name ?: '—' }}</div>
                                            <div class="small text-muted" dir="ltr">{{ $order->buyer_mobile ?: '—' }}</div>
                                        </td>
                                        <td>{{ $order->teacher_name_snapshot ?: ($order->teacher?->name ?? '—') }}</td>
                                        <td>{{ $formatMoney($order->payable_amount) }}</td>
                                        <td>
                                            <div>{{ $formatPercent($order->teacher_commission_percent) }}</div>
                                            <div class="small text-muted">{{ data_get($breakdown, 'teacher_commission_label', __('admin.specialized_course_orders.commission.teacher_share')) }}</div>
                                        </td>
                                        <td>
                                            <div>{{ $formatMoney($order->teacher_commission_amount) }}</div>
                                            @if((float) data_get($breakdown, 'teacher_direct_referral_percent', 0) > 0 || (float) data_get($breakdown, 'teacher_indirect_percent', 0) > 0)
                                                <div class="small text-muted">
                                                    {{ __('admin.specialized_course_reports.commission.direct_percent', ['percent' => $formatPercent(data_get($breakdown, 'teacher_direct_referral_percent', 0))]) }}
                                                    |
                                                    {{ __('admin.specialized_course_reports.commission.indirect_percent', ['percent' => $formatPercent(data_get($breakdown, 'teacher_indirect_percent', 0))]) }}
                                                </div>
                                            @endif
                                        </td>
                                        <td>
                                            <div>{{ $order->salesExpert?->name ?? '—' }}</div>
                                            <div class="small text-muted">{{ $formatMoney($order->sales_expert_amount) }}</div>
                                            @if((int) data_get($breakdown, 'remaining_after_teacher_amount', 0) > 0)
                                                <div class="small text-muted">{{ __('admin.specialized_course_reports.commission.from_base', ['amount' => $formatMoney((int) data_get($breakdown, 'remaining_after_teacher_amount', 0))]) }}</div>
                                            @endif
                                        </td>
                                        <td>
                                            <div>{{ $order->salesManager?->name ?? '—' }}</div>
                                            <div class="small text-muted">{{ $formatMoney($order->sales_manager_amount) }}</div>
                                            @if((int) data_get($breakdown, 'platform_amount', 0) > 0)
                                                <div class="small text-muted">{{ __('admin.specialized_course_orders.commission.platform_remaining', ['amount' => $formatMoney((int) data_get($breakdown, 'platform_amount', 0))]) }}</div>
                                            @endif
                                        </td>
                                        <td>{{ $order->status === 'paid' ? __('admin.specialized_course_orders.status.paid') : $order->status }}</td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="10" class="text-center text-muted py-4">{{ __('admin.specialized_course_reports.orders.empty') }}</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>

                    <div class="p-4">
                        {{ $orders->links() }}
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection
