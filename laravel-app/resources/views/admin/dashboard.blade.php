@extends('admin.layouts.app')

@section('title', __('admin.dashboard.title'))

@php
    $paymentStatuses = [
        'paid' => ['label' => __('admin.dashboard.payment_status.paid'), 'class' => 'bg-light-success text-success'],
        'pending' => ['label' => __('admin.dashboard.payment_status.pending'), 'class' => 'bg-light-warning text-warning'],
        'failed' => ['label' => __('admin.dashboard.payment_status.failed'), 'class' => 'bg-light-danger text-danger'],
        'cancelled' => ['label' => __('admin.dashboard.payment_status.cancelled'), 'class' => 'bg-light-secondary text-secondary'],
    ];
@endphp

@section('content')
    <div class="row g-4">
        <div class="col-12">
            <div class="card dashboard-hero border-0 position-relative overflow-hidden">
                <div class="hero-pattern"></div>
                <div class="card-body p-4 p-lg-5 position-relative">
                    <div class="row align-items-center g-4">
                        <div class="col-lg-8">
                            <span class="badge bg-light text-dark mb-3">{{ __('admin.dashboard.badge') }}</span>
                            <h2 class="mb-3 text-white lh-base">{{ __('admin.dashboard.hero_title') }}</h2>
                            <p class="mb-0 text-white text-opacity-75 lh-lg">
                                {{ __('admin.dashboard.hero_description') }}
                            </p>
                        </div>
                        <div class="col-lg-4 mt-4 mt-lg-0">
                            <div class="text-lg-start text-center">
                                <div class="display-6 fw-bold">{{ $todayLabel }}</div>
                                <div class="text-white text-opacity-75">{{ __('admin.dashboard.today') }}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-md-6 col-xl-4">
            <div class="card metric-card h-100">
                <div class="card-body">
                    <div class="d-flex align-items-center justify-content-between mb-4">
                        <div>
                            <p class="text-muted mb-1">{{ __('admin.dashboard.metrics.users_total') }}</p>
                            <h3 class="mb-0">{{ number_format($stats['users_total']) }}</h3>
                        </div>
                        <div class="dashboard-stat-icon bg-light-primary text-primary">
                            <i class="ph-duotone ph-users-three"></i>
                        </div>
                    </div>
                    <p class="mb-0 text-muted">{{ __('admin.dashboard.metrics.users_total_help') }}</p>
                </div>
            </div>
        </div>

        <div class="col-md-6 col-xl-4">
            <div class="card metric-card h-100">
                <div class="card-body">
                    <div class="d-flex align-items-center justify-content-between mb-4">
                        <div>
                            <p class="text-muted mb-1">{{ __('admin.dashboard.metrics.users_active') }}</p>
                            <h3 class="mb-0">{{ number_format($stats['users_active']) }}</h3>
                        </div>
                        <div class="dashboard-stat-icon bg-light-success text-success">
                            <i class="ph-duotone ph-user-circle-check"></i>
                        </div>
                    </div>
                    <p class="mb-0 text-muted">{{ __('admin.dashboard.metrics.users_active_help') }}</p>
                </div>
            </div>
        </div>

        <div class="col-md-6 col-xl-4">
            <div class="card metric-card h-100">
                <div class="card-body">
                    <div class="d-flex align-items-center justify-content-between mb-4">
                        <div>
                            <p class="text-muted mb-1">{{ __('admin.dashboard.metrics.users_inactive') }}</p>
                            <h3 class="mb-0">{{ number_format($stats['users_inactive']) }}</h3>
                        </div>
                        <div class="dashboard-stat-icon bg-light-danger text-danger">
                            <i class="ph-duotone ph-user-circle-minus"></i>
                        </div>
                    </div>
                    <p class="mb-0 text-muted">{{ __('admin.dashboard.metrics.users_inactive_help') }}</p>
                </div>
            </div>
        </div>

        <div class="col-md-6 col-xl-4">
            <a href="{{ route('admin.support-tickets.index', ['status' => 'waiting_admin']) }}" class="text-decoration-none">
                <div class="card metric-card h-100">
                    <div class="card-body">
                        <div class="d-flex align-items-center justify-content-between mb-4">
                            <div>
                                <p class="text-muted mb-1">{{ __('admin.dashboard.metrics.support_waiting_admin') }}</p>
                                <h3 class="mb-0">{{ number_format($stats['support_waiting_admin']) }}</h3>
                            </div>
                            <div class="dashboard-stat-icon bg-light-warning text-warning">
                                <i class="ph-duotone ph-lifebuoy"></i>
                            </div>
                        </div>
                        <p class="mb-0 text-muted">{{ __('admin.dashboard.metrics.support_waiting_admin_help') }}</p>
                    </div>
                </div>
            </a>
        </div>

        <div class="col-md-6 col-xl-4">
            <a href="{{ route('admin.landing-orders.index') }}" class="text-decoration-none">
                <div class="card metric-card h-100">
                    <div class="card-body">
                        <div class="d-flex align-items-center justify-content-between mb-4">
                            <div>
                                <p class="text-muted mb-1">{{ __('admin.dashboard.metrics.landing_orders_waiting_approval') }}</p>
                                <h3 class="mb-0">{{ number_format($stats['landing_orders_waiting_approval']) }}</h3>
                            </div>
                            <div class="dashboard-stat-icon bg-light-info text-info">
                                <i class="ph-duotone ph-shopping-cart"></i>
                            </div>
                        </div>
                        <p class="mb-0 text-muted">{{ __('admin.dashboard.metrics.landing_orders_waiting_approval_help') }}</p>
                    </div>
                </div>
            </a>
        </div>

        <div class="col-md-6 col-xl-4">
            <a href="{{ route('admin.sales-withdrawals.index', ['status' => 'pending']) }}" class="text-decoration-none">
                <div class="card metric-card h-100">
                    <div class="card-body">
                        <div class="d-flex align-items-center justify-content-between mb-4">
                            <div>
                                <p class="text-muted mb-1">{{ __('admin.dashboard.metrics.sales_withdrawals_pending') }}</p>
                                <h3 class="mb-0">{{ number_format($stats['sales_withdrawals_pending']) }}</h3>
                            </div>
                            <div class="dashboard-stat-icon bg-light-warning text-warning">
                                <i class="ph-duotone ph-wallet"></i>
                            </div>
                        </div>
                        <p class="mb-0 text-muted">{{ __('admin.dashboard.metrics.sales_withdrawals_pending_help') }}</p>
                    </div>
                </div>
            </a>
        </div>

        <div class="col-md-6 col-xl-4">
            <a href="{{ route('admin.payments.index', ['type' => 'domain_renewal']) }}" class="text-decoration-none">
                <div class="card metric-card h-100">
                    <div class="card-body">
                        <div class="d-flex align-items-center justify-content-between mb-4">
                            <div>
                                <p class="text-muted mb-1">{{ __('admin.dashboard.metrics.domain_renewal_requests_pending') }}</p>
                                <h3 class="mb-0">{{ number_format($stats['domain_renewal_requests_pending']) }}</h3>
                            </div>
                            <div class="dashboard-stat-icon bg-light-info text-info">
                                <i class="ph-duotone ph-globe-simple"></i>
                            </div>
                        </div>
                        <p class="mb-0 text-muted">{{ __('admin.dashboard.metrics.domain_renewal_requests_pending_help') }}</p>
                    </div>
                </div>
            </a>
        </div>

        <div class="col-md-6 col-xl-4">
            <a href="{{ route('admin.finance.index') }}" class="text-decoration-none">
                <div class="card metric-card h-100">
                    <div class="card-body">
                        <div class="d-flex align-items-center justify-content-between mb-4">
                            <div>
                                <p class="text-muted mb-1">{{ __('admin.dashboard.metrics.finance_net_current_month') }}</p>
                                <h3 class="mb-0">{{ number_format($stats['finance_net_current_month']) }}</h3>
                            </div>
                            <div class="dashboard-stat-icon bg-light-success text-success">
                                <i class="ph-duotone ph-chart-pie-slice"></i>
                            </div>
                        </div>
                        <p class="mb-0 text-muted">{{ __('admin.dashboard.metrics.finance_net_current_month_help') }}</p>
                    </div>
                </div>
            </a>
        </div>

        <div class="col-md-6 col-xl-4">
            <a href="{{ route('admin.landing-orders.index') }}" class="text-decoration-none">
                <div class="card metric-card h-100">
                    <div class="card-body">
                        <div class="d-flex align-items-center justify-content-between mb-4">
                            <div>
                                <p class="text-muted mb-1">{{ __('admin.dashboard.metrics.provision_requests_pending') }}</p>
                                <h3 class="mb-0">{{ number_format($stats['provision_requests_pending']) }}</h3>
                            </div>
                            <div class="dashboard-stat-icon bg-light-primary text-primary">
                                <i class="ph-duotone ph-globe-hemisphere-east"></i>
                            </div>
                        </div>
                        <p class="mb-0 text-muted">{{ __('admin.dashboard.metrics.provision_requests_pending_help') }}</p>
                    </div>
                </div>
            </a>
        </div>

        <div class="col-md-6 col-xl-4">
            <a href="{{ route('admin.sms-templates.index', ['status' => 'pending_review']) }}" class="text-decoration-none">
                <div class="card metric-card h-100 border-warning-subtle">
                    <div class="card-body">
                        <div class="d-flex align-items-center justify-content-between mb-4">
                            <div>
                                <p class="text-muted mb-1">{{ __('admin.dashboard.metrics.sms_templates_pending_review') }}</p>
                                <h3 class="mb-0">{{ number_format($stats['sms_templates_pending_review']) }}</h3>
                            </div>
                            <div class="dashboard-stat-icon bg-light-warning text-warning">
                                <i class="ph-duotone ph-chat-centered-text"></i>
                            </div>
                        </div>
                        <p class="mb-0 text-muted">{{ __('admin.dashboard.metrics.sms_templates_pending_review_help') }}</p>
                    </div>
                </div>
            </a>
        </div>

        <div class="col-md-6 col-xl-4">
            <a href="{{ route('admin.sms-campaigns.index', ['status' => 'pending_review']) }}" class="text-decoration-none">
                <div class="card metric-card h-100 border-info-subtle">
                    <div class="card-body">
                        <div class="d-flex align-items-center justify-content-between mb-4">
                            <div>
                                <p class="text-muted mb-1">{{ __('admin.dashboard.metrics.sms_campaigns_pending_review') }}</p>
                                <h3 class="mb-0">{{ number_format($stats['sms_campaigns_pending_review']) }}</h3>
                            </div>
                            <div class="dashboard-stat-icon bg-light-info text-info">
                                <i class="ph-duotone ph-megaphone-simple"></i>
                            </div>
                        </div>
                        <p class="mb-0 text-muted">{{ __('admin.dashboard.metrics.sms_campaigns_pending_review_help') }}</p>
                    </div>
                </div>
            </a>
        </div>

        <div class="col-12">
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center gap-2 flex-wrap">
                    <div>
                        <h5 class="mb-1">{{ __('admin.dashboard.latest_landing_orders.title') }}</h5>
                        <p class="text-muted mb-0">{{ __('admin.dashboard.latest_landing_orders.description') }}</p>
                    </div>
                    <a href="{{ route('admin.landing-orders.index') }}" class="btn btn-primary">{{ __('admin.dashboard.latest_landing_orders.view_all') }}</a>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>{{ __('admin.landing_orders.columns.order_number') }}</th>
                                    <th>{{ __('admin.landing_orders.columns.landing') }}</th>
                                    <th>{{ __('admin.landing_orders.columns.plan') }}</th>
                                    <th>{{ __('admin.landing_orders.columns.customer') }}</th>
                                    <th>{{ __('admin.landing_orders.columns.domain') }}</th>
                                    <th>{{ __('admin.landing_orders.columns.amount') }}</th>
                                    <th>{{ __('admin.landing_orders.columns.status') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($latestLandingOrders as $order)
                                    <tr style="cursor: pointer;" onclick="window.location='{{ route('admin.landing-orders.show', $order) }}'">
                                        <td dir="ltr" class="fw-semibold">{{ $order->order_number }}</td>
                                        <td>{{ $order->landingSite?->name ?? '—' }}</td>
                                        <td>
                                            <span class="badge bg-light-primary text-primary">
                                                {{ $order->subscriptionPackage?->name ?? '—' }}
                                            </span>
                                        </td>
                                        <td>{{ $order->customer_full_name ?: ($order->customer?->full_name ?? '—') }}</td>
                                        <td dir="ltr">{{ $order->requested_domain ?: '—' }}</td>
                                        <td>{{ __('admin.money.iran_toman', ['amount' => number_format($order->total_amount)]) }}</td>
                                        <td>{{ \App\Http\Controllers\Admin\LandingOrderController::statusLabel($order->status) }}</td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="7" class="text-center py-4 text-muted">{{ __('admin.dashboard.latest_landing_orders.empty') }}</td>
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
                <div class="card-header d-flex justify-content-between align-items-center gap-2 flex-wrap">
                    <div>
                        <h5 class="mb-1">{{ __('admin.dashboard.latest_domain_renewals.title') }}</h5>
                        <p class="text-muted mb-0">{{ __('admin.dashboard.latest_domain_renewals.description') }}</p>
                    </div>
                    <a href="{{ route('admin.payments.index', ['type' => 'domain_renewal']) }}" class="btn btn-primary">{{ __('admin.dashboard.latest_domain_renewals.view_all') }}</a>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>{{ __('admin.dashboard.latest_domain_renewals.columns.invoice') }}</th>
                                    <th>{{ __('admin.dashboard.latest_domain_renewals.columns.tenant') }}</th>
                                    <th>{{ __('admin.dashboard.latest_domain_renewals.columns.domain') }}</th>
                                    <th>{{ __('admin.dashboard.latest_domain_renewals.columns.amount') }}</th>
                                    <th>{{ __('admin.dashboard.latest_domain_renewals.columns.status') }}</th>
                                    <th>{{ __('admin.dashboard.latest_domain_renewals.columns.initiator') }}</th>
                                    <th>{{ __('admin.dashboard.latest_domain_renewals.columns.time') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($latestDomainRenewalRequests as $payment)
                                    @php
                                        $meta = is_array($payment->metadata) ? $payment->metadata : [];
                                        $status = $paymentStatuses[$payment->status] ?? ['label' => $payment->status, 'class' => 'bg-light-secondary text-secondary'];
                                        $domainName = trim((string) ($meta['domain_name'] ?? '')) !== ''
                                            ? (string) $meta['domain_name']
                                            : ((string) ($meta['domain_label'] ?? __('admin.dashboard.latest_domain_renewals.domain_fallback')));
                                    @endphp
                                    <tr style="cursor: pointer;" onclick="window.location='{{ route('admin.payments.index', ['type' => 'domain_renewal', 'q' => $payment->invoice_number]) }}'">
                                        <td dir="ltr" class="fw-semibold">{{ $payment->invoice_number }}</td>
                                        <td>{{ $payment->tenant?->name ?? '—' }}</td>
                                        <td dir="ltr">{{ $domainName }}</td>
                                        <td>{{ __('admin.money.iran_toman', ['amount' => number_format((int) $payment->payable_amount)]) }}</td>
                                        <td>
                                            <span class="badge {{ $status['class'] }}">{{ $status['label'] }}</span>
                                            @if($payment->sandbox_mode)
                                                <span class="badge bg-light-warning text-warning ms-1">Sandbox</span>
                                            @endif
                                        </td>
                                        <td>
                                            <div>{{ $payment->initiated_by_name ?: '—' }}</div>
                                            @if($payment->initiated_by_mobile)
                                                <small class="text-muted">{{ $payment->initiated_by_mobile }}</small>
                                            @endif
                                        </td>
                                        <td>{{ \App\Support\JalaliDate::formatDateTime($payment->created_at) }}</td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="7" class="text-center py-4 text-muted">{{ __('admin.dashboard.latest_domain_renewals.empty') }}</td>
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
