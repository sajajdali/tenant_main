@extends('admin.layouts.app')

@section('title', __('admin.landing_orders.title'))

@section('content')
    <div class="row g-3">
        <div class="col-12">
            <div class="card">
                <div class="card-body d-flex align-items-center justify-content-between gap-3 flex-wrap">
                    <div>
                        <h4 class="mb-1">{{ __('admin.landing_orders.title') }}</h4>
                        <p class="text-muted mb-0">{{ __('admin.landing_orders.description') }}</p>
                    </div>
                    <a href="{{ route('admin.dashboard') }}" class="btn btn-light-secondary">{{ __('admin.landing_orders.back_to_dashboard') }}</a>
                </div>
            </div>
        </div>

        <div class="col-12">
            <div class="card">
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>{{ __('admin.landing_orders.columns.order_number') }}</th>
                                    <th>{{ __('admin.landing_orders.columns.landing') }}</th>
                                    <th>{{ __('admin.landing_orders.columns.plan') }}</th>
                                    <th>{{ __('admin.landing_orders.columns.customer') }}</th>
                                    <th>{{ __('admin.landing_orders.columns.discount_code') }}</th>
                                    <th>{{ __('admin.landing_orders.columns.domain') }}</th>
                                    <th>{{ __('admin.landing_orders.columns.amount') }}</th>
                                    <th>{{ __('admin.landing_orders.columns.status') }}</th>
                                    <th>{{ __('admin.landing_orders.columns.actions') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($orders as $order)
                                    @php
                                        $discount = data_get($order->meta_json, 'discount');
                                    @endphp
                                    <tr>
                                        <td dir="ltr" class="fw-semibold">{{ $order->order_number }}</td>
                                        <td>{{ $order->landingSite?->name ?? __('admin.common.not_available') }}</td>
                                        <td>
                                            <span class="badge bg-light-primary text-primary">
                                                {{ $order->subscriptionPackage?->name ?? __('admin.common.not_available') }}
                                            </span>
                                        </td>
                                        <td>{{ $order->customer_full_name ?: ($order->customer?->full_name ?? '—') }}</td>
                                        <td>
                                            @if(is_array($discount) && !empty($discount['code']))
                                                <div dir="ltr" class="fw-semibold">{{ $discount['code'] }}</div>
                                                <small class="text-muted">{{ __('admin.money.iran_toman', ['amount' => number_format((int) ($discount['discountAmount'] ?? 0))]) }}</small>
                                            @else
                                                {{ __('admin.common.not_available') }}
                                            @endif
                                        </td>
                                        <td dir="ltr">{{ $order->requested_domain ?: __('admin.common.not_available') }}</td>
                                        <td>{{ __('admin.money.iran_toman', ['amount' => number_format($order->total_amount)]) }}</td>
                                        <td>{{ \App\Http\Controllers\Admin\LandingOrderController::statusLabel($order->status) }}</td>
                                        <td>
                                            <a href="{{ route('admin.landing-orders.show', $order) }}" class="btn btn-sm btn-primary">{{ __('admin.landing_orders.view_details') }}</a>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="9" class="text-center py-4 text-muted">{{ __('admin.landing_orders.empty') }}</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>

                    @if ($orders->hasPages())
                        <div class="mt-4">
                            {{ $orders->links() }}
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </div>
@endsection
