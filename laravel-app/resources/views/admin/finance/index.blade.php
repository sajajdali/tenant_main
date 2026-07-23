@extends('admin.layouts.app')

@section('title', __('admin.finance.title'))

@php
    $formatMoney = fn (int $amount): string => __('admin.money.iran_toman', ['amount' => number_format($amount)]);
@endphp

@section('content')
    <div class="row g-4">
        <div class="col-12">
            <div class="card dashboard-hero border-0 position-relative overflow-hidden">
                <div class="hero-pattern"></div>
                <div class="card-body p-4 p-lg-5 position-relative">
                    <div class="row g-4 align-items-center">
                        <div class="col-lg-8">
                            <span class="badge bg-light text-dark mb-3">{{ __('admin.finance.badge') }}</span>
                            <h2 class="mb-3 text-white lh-base">{{ __('admin.finance.hero_title') }}</h2>
                            <p class="mb-0 text-white text-opacity-75 lh-lg">
                                {{ __('admin.finance.hero_description') }}
                            </p>
                        </div>
                        <div class="col-lg-4">
                            <div class="rounded-4 bg-white bg-opacity-10 p-4">
                                <div class="text-white text-opacity-75 mb-2">{{ __('admin.finance.current_month_net_revenue') }}</div>
                                <div class="display-6 fw-bold">{{ $formatMoney((int) $periods['current_month']['netRevenue']) }}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        @foreach ($periods as $period)
            <div class="col-md-6 col-xl-4">
                <div class="card metric-card h-100">
                    <div class="card-header">
                        <h5 class="mb-1">{{ $period['label'] }}</h5>
                        <p class="text-muted mb-0">{{ __('admin.finance.summary.title') }}</p>
                    </div>
                    <div class="card-body">
                        <div class="d-flex justify-content-between mb-3">
                            <span class="text-muted">{{ __('admin.finance.summary.gross_total') }}</span>
                            <strong>{{ $formatMoney((int) $period['grossTotal']) }}</strong>
                        </div>
                        <div class="d-flex justify-content-between mb-3">
                            <span class="text-muted">{{ __('admin.finance.summary.total_costs') }}</span>
                            <strong class="text-danger">{{ $formatMoney((int) $period['costs']['total_costs']) }}</strong>
                        </div>
                        <div class="d-flex justify-content-between pt-3 border-top">
                            <span class="fw-semibold">{{ __('admin.finance.summary.net_revenue') }}</span>
                            <strong class="{{ (int) $period['netRevenue'] >= 0 ? 'text-success' : 'text-danger' }}">{{ $formatMoney((int) $period['netRevenue']) }}</strong>
                        </div>
                    </div>
                </div>
            </div>
        @endforeach

        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">{{ __('admin.finance.revenue_by_source.title') }}</h5>
                    <p class="text-muted mb-0">{{ __('admin.finance.revenue_by_source.description') }}</p>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>{{ __('admin.finance.columns.source') }}</th>
                                    <th>{{ __('admin.finance.columns.current_month') }}</th>
                                    <th>{{ __('admin.finance.columns.previous_month') }}</th>
                                    <th>{{ __('admin.finance.columns.total') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach ($revenueLabels as $key => $label)
                                    <tr>
                                        <td>{{ $label }}</td>
                                        <td>{{ $formatMoney((int) $periods['current_month']['grossRevenue'][$key]) }}</td>
                                        <td>{{ $formatMoney((int) $periods['previous_month']['grossRevenue'][$key]) }}</td>
                                        <td>{{ $formatMoney((int) $periods['total']['grossRevenue'][$key]) }}</td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-xl-6">
            <div class="card h-100">
                <div class="card-header">
                    <h5 class="mb-1">{{ __('admin.finance.initial_breakdown.title') }}</h5>
                    <p class="text-muted mb-0">{{ __('admin.finance.initial_breakdown.description') }}</p>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>{{ __('admin.finance.columns.section') }}</th>
                                    <th>{{ __('admin.finance.columns.current_month') }}</th>
                                    <th>{{ __('admin.finance.columns.previous_month') }}</th>
                                    <th>{{ __('admin.finance.columns.total') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach ($initialBreakdownLabels as $key => $label)
                                    <tr>
                                        <td>{{ $label }}</td>
                                        <td>{{ $formatMoney((int) $periods['current_month']['initialBreakdown'][$key]) }}</td>
                                        <td>{{ $formatMoney((int) $periods['previous_month']['initialBreakdown'][$key]) }}</td>
                                        <td>{{ $formatMoney((int) $periods['total']['initialBreakdown'][$key]) }}</td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-xl-6">
            <div class="card h-100">
                <div class="card-header">
                    <h5 class="mb-1">{{ __('admin.finance.costs.title') }}</h5>
                    <p class="text-muted mb-0">{{ __('admin.finance.costs.description') }}</p>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>{{ __('admin.finance.columns.cost') }}</th>
                                    <th>{{ __('admin.finance.columns.current_month') }}</th>
                                    <th>{{ __('admin.finance.columns.previous_month') }}</th>
                                    <th>{{ __('admin.finance.columns.total') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach ($costLabels as $key => $label)
                                    <tr>
                                        <td>{{ $label }}</td>
                                        <td>{{ $formatMoney((int) $periods['current_month']['costs'][$key]) }}</td>
                                        <td>{{ $formatMoney((int) $periods['previous_month']['costs'][$key]) }}</td>
                                        <td>{{ $formatMoney((int) $periods['total']['costs'][$key]) }}</td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection
