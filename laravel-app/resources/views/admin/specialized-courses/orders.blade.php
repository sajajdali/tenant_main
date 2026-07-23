@extends('admin.layouts.app')

@section('title', __('admin.specialized_course_orders.title'))

@php
    $formatMoney = fn (int|float $amount): string => __('admin.money.iran_toman', ['amount' => number_format((int) $amount)]);
    $formatPercent = fn (int|float $value): string => __('admin.specialized_courses.percent_value', [
        'value' => rtrim(rtrim(number_format((float) $value, 2, '.', ''), '0'), '.') ?: '0',
    ]);
@endphp

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            const tenantField = document.getElementById('manual_grant_tenant_id');
            const tenantUserField = document.getElementById('manual_grant_tenant_user_id');
            const tenantUserHint = document.getElementById('manual_grant_tenant_user_hint');
            const courseField = document.getElementById('manual_grant_course_id');
            const commissionToggle = document.getElementById('manual_grant_apply_commissions');
            const commissionBox = document.getElementById('manual_grant_commission_box');
            const commissionAmountField = document.getElementById('manual_grant_commission_base_amount');
            const courseAmountLabel = document.getElementById('manual_grant_course_amount_label');
            const courseAudienceHint = document.getElementById('manual_grant_course_audience_hint');
            const numberFormatter = new Intl.NumberFormat(document.documentElement.lang || undefined);

            const syncCommissionUi = () => {
                if (!commissionBox || !commissionToggle) {
                    return;
                }

                commissionBox.style.display = commissionToggle.checked ? '' : 'none';
            };

            const syncCourseAmount = () => {
                if (!courseField) {
                    return;
                }

                const option = courseField.options[courseField.selectedIndex];
                const amount = option?.dataset.payableAmount || '0';
                const audience = option?.dataset.audienceName || @js(__('admin.specialized_course_orders.filters.all_audiences'));

                if (courseAmountLabel) {
                    courseAmountLabel.textContent = @js(__('admin.money.iran_toman', ['amount' => '__AMOUNT__'])).replace('__AMOUNT__', numberFormatter.format(Number(amount || 0)));
                }

                if (courseAudienceHint) {
                    courseAudienceHint.textContent = @js(__('admin.specialized_course_orders.manual_grant.course_audience_value', ['audience' => '__AUDIENCE__'])).replace('__AUDIENCE__', audience);
                }

                if (commissionAmountField && (!commissionAmountField.value || commissionAmountField.dataset.autofilled === '1')) {
                    commissionAmountField.value = amount;
                    commissionAmountField.dataset.autofilled = '1';
                }
            };

            const filterCoursesByTenant = () => {
                if (!tenantField || !courseField) {
                    return;
                }

                const tenantOption = tenantField.options[tenantField.selectedIndex];
                const audienceId = tenantOption?.dataset.audienceId || '';
                let hasVisibleSelected = false;

                Array.from(courseField.options).forEach((option, index) => {
                    if (index === 0) {
                        option.hidden = false;
                        return;
                    }

                    const courseAudienceId = option.dataset.audienceId || '';
                    const visible = !audienceId || !courseAudienceId || audienceId === courseAudienceId;
                    option.hidden = !visible;

                    if (visible && option.selected) {
                        hasVisibleSelected = true;
                    }
                });

                if (!hasVisibleSelected) {
                    courseField.value = '';
                }

                syncCourseAmount();
            };

            const loadTenantUsers = async () => {
                if (!tenantField || !tenantUserField) {
                    return;
                }

                const tenantId = tenantField.value;
                tenantUserField.innerHTML = `<option value="">${@js(__('admin.specialized_course_orders.manual_grant.select_tenant_first'))}</option>`;

                if (!tenantId) {
                    if (tenantUserHint) {
                        tenantUserHint.textContent = @js(__('admin.specialized_course_orders.manual_grant.tenant_user_hint'));
                    }

                    return;
                }

                tenantUserField.innerHTML = `<option value="">${@js(__('admin.specialized_course_orders.manual_grant.loading_users'))}</option>`;

                try {
                    const url = new URL(@json(route('admin.specialized-course-orders.tenant-users')), window.location.origin);
                    url.searchParams.set('tenant_id', tenantId);

                    const response = await fetch(url.toString(), {
                        headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                        credentials: 'same-origin',
                    });

                    const payload = await response.json();
                    const items = Array.isArray(payload.data) ? payload.data : [];
                    tenantUserField.innerHTML = `<option value="">${@js(__('admin.specialized_course_orders.manual_grant.select_user'))}</option>`;

                    items.forEach((item) => {
                        const option = document.createElement('option');
                        option.value = item.id;
                        option.textContent = `${item.name} - ${item.mobile} (${item.role})`;
                        tenantUserField.appendChild(option);
                    });

                    if (tenantUserHint) {
                        tenantUserHint.textContent = items.length > 0
                            ? @js(__('admin.specialized_course_orders.manual_grant.users_loaded'))
                            : @js(__('admin.specialized_course_orders.manual_grant.no_users'));
                    }

                    const oldValue = tenantUserField.dataset.oldValue || '';
                    if (oldValue) {
                        tenantUserField.value = oldValue;
                        tenantUserField.dataset.oldValue = '';
                    }
                } catch (error) {
                    tenantUserField.innerHTML = `<option value="">${@js(__('admin.specialized_course_orders.manual_grant.users_load_error_option'))}</option>`;

                    if (tenantUserHint) {
                        tenantUserHint.textContent = @js(__('admin.specialized_course_orders.manual_grant.users_load_error'));
                    }
                }
            };

            tenantField?.addEventListener('change', () => {
                filterCoursesByTenant();
                void loadTenantUsers();
            });
            courseField?.addEventListener('change', syncCourseAmount);
            commissionToggle?.addEventListener('change', syncCommissionUi);
            commissionAmountField?.addEventListener('input', () => {
                commissionAmountField.dataset.autofilled = '0';
            });

            syncCommissionUi();
            filterCoursesByTenant();
            syncCourseAmount();
            if (tenantField?.value) {
                void loadTenantUsers();
            }
        });
    </script>
@endpush

@section('content')
    <div class="row g-4">
        <div class="col-12">
            <div class="row g-3">
                <div class="col-md-6 col-xl-3">
                    <div class="card h-100">
                        <div class="card-body">
                            <div class="text-muted mb-1">{{ __('admin.specialized_course_orders.summary.orders_total') }}</div>
                            <h3 class="mb-0">{{ number_format($summary['orders_total']) }}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-xl-3">
                    <div class="card h-100">
                        <div class="card-body">
                            <div class="text-muted mb-1">{{ __('admin.specialized_course_orders.summary.orders_paid') }}</div>
                            <h3 class="mb-0">{{ number_format($summary['orders_paid']) }}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-xl-3">
                    <div class="card h-100">
                        <div class="card-body">
                            <div class="text-muted mb-1">{{ __('admin.specialized_course_orders.summary.gross_sales') }}</div>
                            <h3 class="mb-0">{{ $formatMoney($summary['gross_sales']) }}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-xl-3">
                    <div class="card h-100">
                        <div class="card-body">
                            <div class="text-muted mb-1">{{ __('admin.specialized_course_orders.summary.teacher_commission_total') }}</div>
                            <h3 class="mb-0">{{ $formatMoney($summary['teacher_commission_total']) }}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-xl-3">
                    <div class="card h-100">
                        <div class="card-body">
                            <div class="text-muted mb-1">{{ __('admin.specialized_course_orders.summary.sales_expert_commission_total') }}</div>
                            <h3 class="mb-0">{{ $formatMoney($summary['sales_expert_commission_total']) }}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-xl-3">
                    <div class="card h-100">
                        <div class="card-body">
                            <div class="text-muted mb-1">{{ __('admin.specialized_course_orders.summary.sales_manager_commission_total') }}</div>
                            <h3 class="mb-0">{{ $formatMoney($summary['sales_manager_commission_total']) }}</h3>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-12">
            @unless($isTeacher)
                <div class="card">
                    <div class="card-header">
                        <h5 class="mb-1">{{ __('admin.specialized_course_orders.manual_grant.title') }}</h5>
                        <p class="text-muted mb-0">{{ __('admin.specialized_course_orders.manual_grant.description') }}</p>
                    </div>
                    <div class="card-body">
                        <form method="POST" action="{{ route('admin.specialized-course-orders.manual-grants.store') }}" class="row g-3">
                            @csrf
                            <div class="col-md-4">
                                <label class="form-label" for="manual_grant_tenant_id">{{ __('admin.specialized_course_orders.manual_grant.tenant') }}</label>
                                <select class="form-select" id="manual_grant_tenant_id" name="tenant_id" required>
                                    <option value="">{{ __('admin.common.select') }}</option>
                                    @foreach($tenants as $tenant)
                                        <option value="{{ $tenant->id }}" data-audience-id="{{ $tenant->audience_type_id }}" @selected((string) old('tenant_id') === (string) $tenant->id)>
                                            {{ $tenant->name }} {{ $tenant->audienceType?->name ? '('.$tenant->audienceType->name.')' : '' }}
                                        </option>
                                    @endforeach
                                </select>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="manual_grant_tenant_user_id">{{ __('admin.specialized_course_orders.manual_grant.tenant_user') }}</label>
                                <select class="form-select" id="manual_grant_tenant_user_id" name="tenant_user_id" data-old-value="{{ old('tenant_user_id') }}" required>
                                    <option value="">{{ __('admin.specialized_course_orders.manual_grant.select_tenant_first') }}</option>
                                </select>
                                <small class="text-muted d-block mt-2" id="manual_grant_tenant_user_hint">{{ __('admin.specialized_course_orders.manual_grant.tenant_user_hint') }}</small>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="manual_grant_course_id">{{ __('admin.specialized_course_orders.manual_grant.course') }}</label>
                                <select class="form-select" id="manual_grant_course_id" name="specialized_course_id" required>
                                    <option value="">{{ __('admin.common.select') }}</option>
                                    @foreach($courses as $course)
                                        <option
                                            value="{{ $course->id }}"
                                            data-audience-id="{{ $course->audience_type_id }}"
                                            data-audience-name="{{ $course->audienceType?->name ?? __('admin.specialized_course_orders.manual_grant.no_audience') }}"
                                            data-payable-amount="{{ $course->payableAmount() }}"
                                            @selected((string) old('specialized_course_id') === (string) $course->id)
                                        >
                                            {{ $course->title }} - {{ $course->teacher?->name ?? __('admin.specialized_course_orders.manual_grant.no_teacher') }}
                                        </option>
                                    @endforeach
                                </select>
                                <small class="text-muted d-block mt-2" id="manual_grant_course_audience_hint">{{ __('admin.specialized_course_orders.manual_grant.course_audience_hint') }}</small>
                            </div>

                            <div class="col-12">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" role="switch" id="manual_grant_apply_commissions" name="apply_commissions" value="1" @checked(old('apply_commissions'))>
                                    <label class="form-check-label" for="manual_grant_apply_commissions">{{ __('admin.specialized_course_orders.manual_grant.apply_commissions') }}</label>
                                </div>
                                <small class="text-muted d-block mt-2">{{ __('admin.specialized_course_orders.manual_grant.apply_commissions_help') }}</small>
                            </div>

                            <div class="col-12" id="manual_grant_commission_box" style="{{ old('apply_commissions') ? '' : 'display:none;' }}">
                                <div class="border rounded-3 p-3 bg-light">
                                    <div class="row g-3 align-items-end">
                                        <div class="col-md-6">
                                            <div class="fw-semibold mb-1">{{ __('admin.specialized_course_orders.manual_grant.default_course_amount') }}</div>
                                            <div class="text-primary fw-bold" id="manual_grant_course_amount_label">{{ $formatMoney(0) }}</div>
                                            <div class="small text-muted mt-2">{{ __('admin.specialized_course_orders.manual_grant.commission_base_help') }}</div>
                                        </div>
                                        <div class="col-md-6">
                                            <label class="form-label" for="manual_grant_commission_base_amount">{{ __('admin.specialized_course_orders.manual_grant.commission_base_amount') }}</label>
                                            <div class="input-group">
                                                <input type="number" min="0" class="form-control" id="manual_grant_commission_base_amount" name="commission_base_amount" value="{{ old('commission_base_amount') }}" data-autofilled="{{ old('commission_base_amount') ? '0' : '1' }}">
                                                <span class="input-group-text">{{ __('admin.money.iran_toman_unit') }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="col-12">
                                <button type="submit" class="btn btn-primary">{{ __('admin.specialized_course_orders.manual_grant.submit') }}</button>
                            </div>
                        </form>
                    </div>
                </div>
            @endunless
        </div>

        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
                        <div>
                            <h5 class="mb-1">{{ $isTeacher ? __('admin.specialized_course_orders.my_orders') : __('admin.specialized_course_orders.all_orders') }}</h5>
                            <p class="text-muted mb-0">{{ __('admin.specialized_course_orders.list_description') }}</p>
                        </div>
                        <a href="{{ route('admin.specialized-course-reports.index') }}" class="btn btn-light-primary">{{ __('admin.specialized_course_orders.full_report') }}</a>
                    </div>
                </div>
                <div class="card-body">
                    <form method="GET" action="{{ route('admin.specialized-course-orders.index') }}" class="row g-3 mb-4">
                        <div class="col-md-3">
                            <input type="text" class="form-control" name="search" value="{{ $filters['search'] }}" placeholder="{{ __('admin.specialized_course_orders.filters.search_placeholder') }}">
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
                            <button class="btn btn-primary" type="submit">{{ __('admin.common.apply') }}</button>
                        </div>
                    </form>
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>{{ __('admin.specialized_course_orders.columns.order_number') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.course') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.buyer') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.teacher') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.payable_amount') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.teacher_share') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.sales_expert') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.sales_manager') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.status') }}</th>
                                    <th>{{ __('admin.specialized_course_orders.columns.date') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($orders as $order)
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
                                            <div>{{ $formatMoney($order->teacher_commission_amount) }}</div>
                                            <div class="small text-muted">
                                                {{ $formatPercent($order->teacher_commission_percent) }}
                                                • {{ data_get($breakdown, 'teacher_commission_label', __('admin.specialized_course_orders.commission.teacher_share')) }}
                                            </div>
                                        </td>
                                        <td>
                                            <div>{{ $order->salesExpert?->name ?? '—' }}</div>
                                            <div class="small text-muted">
                                                {{ $formatMoney($order->sales_expert_amount) }}
                                                @if((float) $order->sales_expert_percent > 0)
                                                    • {{ __('admin.specialized_course_orders.commission.percent_from_remaining', ['percent' => $formatPercent($order->sales_expert_percent)]) }}
                                                @endif
                                            </div>
                                            @if((int) data_get($breakdown, 'remaining_after_teacher_amount', 0) > 0)
                                                <div class="small text-muted">{{ __('admin.specialized_course_orders.commission.calculation_base', ['amount' => $formatMoney((int) data_get($breakdown, 'remaining_after_teacher_amount', 0))]) }}</div>
                                            @endif
                                        </td>
                                        <td>
                                            <div>{{ $order->salesManager?->name ?? '—' }}</div>
                                            <div class="small text-muted">
                                                {{ $formatMoney($order->sales_manager_amount) }}
                                                @if((float) $order->sales_manager_percent > 0)
                                                    • {{ __('admin.specialized_course_orders.commission.percent_from_remaining', ['percent' => $formatPercent($order->sales_manager_percent)]) }}
                                                @endif
                                            </div>
                                            @if((int) data_get($breakdown, 'platform_amount', 0) > 0)
                                                <div class="small text-muted">{{ __('admin.specialized_course_orders.commission.platform_remaining', ['amount' => $formatMoney((int) data_get($breakdown, 'platform_amount', 0))]) }}</div>
                                            @endif
                                        </td>
                                        <td>{{ $order->status }}</td>
                                        <td>{{ optional($order->created_at)->format('Y/m/d H:i') }}</td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="10" class="text-center py-4 text-muted">{{ __('admin.specialized_course_orders.empty') }}</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>

                    <div class="mt-4">
                        {{ $orders->links() }}
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection
