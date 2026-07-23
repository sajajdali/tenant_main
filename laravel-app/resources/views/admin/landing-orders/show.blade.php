@extends('admin.layouts.app')

@section('title', __('admin.landing_orders.show_title'))

@section('content')
    @php
        $latestPayment = $order->payments->sortByDesc('id')->first();
        $provisionRequest = $order->provisionRequest;
        $usesOwnDomain = (bool) data_get($order->meta_json, 'usesOwnDomain', false);
        $discount = data_get($order->meta_json, 'discount');
    @endphp

    <div class="row g-3">
        <div class="col-12">
            <div class="card">
                <div class="card-body d-flex align-items-center justify-content-between gap-3 flex-wrap">
                    <div>
                        <div class="d-flex align-items-center gap-2 flex-wrap mb-2">
                            <h4 class="mb-0">{{ $order->order_number }}</h4>
                            <span class="badge bg-light-primary text-primary">{{ $order->subscriptionPackage?->name ?? __('admin.landing_orders.fallbacks.no_plan') }}</span>
                            <span class="badge bg-light-secondary text-secondary">{{ \App\Http\Controllers\Admin\LandingOrderController::statusLabel($order->status) }}</span>
                        </div>
                        <p class="text-muted mb-0">
                            {{ $order->landingSite?->name ?? __('admin.landing_orders.fallbacks.no_landing') }}
                            @if($order->landingSite?->audienceType?->name)
                                - {{ $order->landingSite->audienceType->name }}
                            @endif
                        </p>
                    </div>
                    <div class="d-flex gap-2">
                        <a href="{{ route('admin.landing-orders.index') }}" class="btn btn-light-secondary">{{ __('admin.landing_orders.back') }}</a>
                        @if($order->landingSite)
                            <a href="{{ route('admin.landing-sites.show', $order->landingSite) }}" class="btn btn-light-primary">{{ __('admin.landing_orders.related_landing') }}</a>
                        @endif
                    </div>
                </div>
            </div>
        </div>

        <div class="col-lg-4">
            <div class="card h-100">
                <div class="card-header"><h5 class="mb-0">{{ __('admin.landing_orders.summary.title') }}</h5></div>
                <div class="card-body">
                    <div class="mb-3">
                        <div class="text-muted small">{{ __('admin.landing_orders.summary.selected_plan') }}</div>
                        <div class="fw-semibold">{{ $order->subscriptionPackage?->name ?? __('admin.common.not_available') }}</div>
                    </div>
                    <div class="mb-3">
                        <div class="text-muted small">{{ __('admin.landing_orders.summary.duration') }}</div>
                        <div>{{ __('admin.common.days', ['count' => number_format($order->duration_days)]) }}</div>
                    </div>
                    <div class="mb-3">
                        <div class="text-muted small">{{ __('admin.landing_orders.summary.user_limit') }}</div>
                        <div>{{ $order->requested_user_limit ? number_format($order->requested_user_limit) : __('admin.common.unlimited') }}</div>
                    </div>
                    <div class="mb-3">
                        <div class="text-muted small">{{ __('admin.landing_orders.summary.final_amount') }}</div>
                        <div class="fw-bold text-primary">{{ __('admin.money.iran_toman', ['amount' => number_format($order->total_amount)]) }}</div>
                    </div>
                    <div class="mb-3">
                        <div class="text-muted small">{{ __('admin.landing_orders.summary.discount_code') }}</div>
                        @if(is_array($discount) && !empty($discount['code']))
                            <div class="fw-semibold" dir="ltr">{{ $discount['code'] }}</div>
                            <div class="small text-muted">
                                {{ ($discount['discountType'] ?? null) === 'percent' ? __('admin.landing_orders.discount.type_percent') : __('admin.landing_orders.discount.type_fixed') }}
                                |
                                {{ __('admin.landing_orders.discount.value') }}:
                                @if(($discount['discountType'] ?? null) === 'percent')
                                    {{ __('admin.landing_orders.discount.percent_value', ['value' => number_format((int) ($discount['discountValue'] ?? 0))]) }}
                                @else
                                    {{ __('admin.money.iran_toman', ['amount' => number_format((int) ($discount['discountValue'] ?? 0))]) }}
                                @endif
                                |
                                {{ __('admin.landing_orders.discount.applied_amount') }}: {{ __('admin.money.iran_toman', ['amount' => number_format((int) ($discount['discountAmount'] ?? 0))]) }}
                            </div>
                        @else
                            <div>{{ __('admin.common.not_available') }}</div>
                        @endif
                    </div>
                    <div class="mb-3">
                        <div class="text-muted small">{{ __('admin.landing_orders.summary.domain_registration') }}</div>
                        <div>{{ $usesOwnDomain ? __('admin.landing_orders.domain_registration.own_domain') : __('admin.landing_orders.domain_registration.managed') }}</div>
                    </div>
                    <div>
                        <div class="text-muted small">{{ __('admin.landing_orders.summary.order_date') }}</div>
                        <div>{{ optional($order->created_at)->format('Y/m/d H:i') ?: __('admin.common.not_available') }}</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-lg-4">
            <div class="card h-100">
                <div class="card-header"><h5 class="mb-0">{{ __('admin.landing_orders.customer.title') }}</h5></div>
                <div class="card-body">
                    <div class="mb-3"><div class="text-muted small">{{ __('admin.landing_orders.customer.full_name') }}</div><div class="fw-semibold">{{ $order->customer_full_name ?: __('admin.common.not_available') }}</div></div>
                    <div class="mb-3"><div class="text-muted small">{{ __('admin.landing_orders.customer.mobile') }}</div><div dir="ltr">{{ $order->customer_mobile ?: __('admin.common.not_available') }}</div></div>
                    <div class="mb-3"><div class="text-muted small">{{ __('admin.landing_orders.customer.email') }}</div><div dir="ltr">{{ $order->customer_email ?: __('admin.common.not_available') }}</div></div>
                    <div class="mb-3"><div class="text-muted small">{{ __('admin.landing_orders.customer.gender') }}</div><div>{{ $order->customer_gender === 'male' ? __('admin.landing_orders.customer.male') : ($order->customer_gender === 'female' ? __('admin.landing_orders.customer.female') : __('admin.common.not_available')) }}</div></div>
                    <div class="mb-3"><div class="text-muted small">{{ __('admin.landing_orders.customer.national_code') }}</div><div dir="ltr">{{ $order->customer_national_code ?: __('admin.common.not_available') }}</div></div>
                    <div class="mb-3"><div class="text-muted small">{{ __('admin.landing_orders.customer.city_province') }}</div><div>{{ $order->customer_city_name ? $order->customer_city_name . __('admin.common.location_separator') . $order->customer_province_name : ($order->customer_province_name ?: __('admin.common.not_available')) }}</div></div>
                    <div><div class="text-muted small">{{ __('admin.landing_orders.customer.address') }}</div><div style="white-space: pre-wrap;">{{ $order->customer_address_line ?: __('admin.common.not_available') }}</div></div>
                </div>
            </div>
        </div>

        <div class="col-lg-4">
            <div class="card h-100">
                <div class="card-header"><h5 class="mb-0">{{ __('admin.landing_orders.payment_domain.title') }}</h5></div>
                <div class="card-body">
                    <div class="mb-3">
                        <div class="text-muted small">{{ __('admin.landing_orders.payment_domain.requested_domain') }}</div>
                        <div dir="ltr" class="fw-semibold">{{ $order->requested_domain ?: __('admin.common.not_available') }}</div>
                    </div>
                    <div class="mb-3">
                        <div class="text-muted small">{{ __('admin.landing_orders.payment_domain.domain_status') }}</div>
                        <div>{{ $order->requested_domain_whois_status ?: __('admin.common.not_available') }}</div>
                    </div>
                    <div class="mb-3">
                        <div class="text-muted small">{{ __('admin.landing_orders.payment_domain.setup_fee') }}</div>
                        <div>{{ __('admin.money.iran_toman', ['amount' => number_format($order->setup_fee_amount)]) }}</div>
                    </div>
                    <div class="mb-3">
                        <div class="text-muted small">{{ __('admin.landing_orders.payment_domain.domain_price') }}</div>
                        <div>{{ __('admin.money.iran_toman', ['amount' => number_format($order->domain_price_amount)]) }}</div>
                    </div>
                    <div class="mb-3">
                        <div class="text-muted small">{{ __('admin.landing_orders.payment_domain.sms_credit_gift') }}</div>
                        <div>{{ __('admin.money.iran_toman', ['amount' => number_format((int) data_get($order->meta_json, 'pricing.smsCreditGiftAmount', 0))]) }}</div>
                    </div>
                    <div class="mb-3">
                        <div class="text-muted small">{{ __('admin.landing_orders.payment_domain.discount_amount') }}</div>
                        <div>{{ __('admin.money.iran_toman', ['amount' => number_format((int) $order->discount_amount)]) }}</div>
                    </div>
                    <div class="mb-3">
                        <div class="text-muted small">{{ __('admin.landing_orders.payment_domain.payment_id') }}</div>
                        <div dir="ltr">{{ $latestPayment?->reference_id ?: ($latestPayment?->invoice_number ?: __('admin.common.not_available')) }}</div>
                    </div>
                    <div>
                        <div class="text-muted small">{{ __('admin.landing_orders.payment_domain.gateway') }}</div>
                        <div>{{ $latestPayment?->gateway ?: __('admin.common.not_available') }}</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-lg-6">
            <div class="card h-100">
                <div class="card-header"><h5 class="mb-0">{{ __('admin.landing_orders.invoice_items.title') }}</h5></div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-sm align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>{{ __('admin.landing_orders.columns.title') }}</th>
                                    <th>{{ __('admin.landing_orders.columns.type') }}</th>
                                    <th>{{ __('admin.landing_orders.columns.amount') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach($order->items as $item)
                                    <tr>
                                        <td>
                                            <div class="fw-semibold">{{ $item->title }}</div>
                                            @if($item->description)
                                                <div class="text-muted small">{{ $item->description }}</div>
                                            @endif
                                        </td>
                                        <td>{{ $item->type }}</td>
                                        <td class="{{ (int) $item->total_amount < 0 ? 'text-danger' : '' }}">{{ __('admin.money.iran_toman', ['amount' => number_format($item->total_amount)]) }}</td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-lg-6">
            <div class="card h-100">
                <div class="card-header"><h5 class="mb-0">{{ __('admin.landing_orders.provision.title') }}</h5></div>
                <div class="card-body">
                    @if($provisionRequest)
                        <div class="mb-3"><div class="text-muted small">{{ __('admin.landing_orders.provision.status') }}</div><div class="fw-semibold">{{ $provisionRequest->status }}</div></div>
                        <div class="mb-3"><div class="text-muted small">{{ __('admin.landing_orders.provision.requested_domain') }}</div><div dir="ltr">{{ $provisionRequest->requested_domain ?: __('admin.common.not_available') }}</div></div>
                        <div class="mb-3"><div class="text-muted small">{{ __('admin.landing_orders.provision.assigned_to') }}</div><div>{{ $provisionRequest->assignedTo?->name ?? __('admin.landing_orders.fallbacks.not_assigned') }}</div></div>
                        <div class="mb-3"><div class="text-muted small">{{ __('admin.landing_orders.provision.tenant_id') }}</div><div dir="ltr">{{ $provisionRequest->tenant_id ?: __('admin.common.not_available') }}</div></div>
                        <div class="mb-3"><div class="text-muted small">{{ __('admin.landing_orders.provision.customer_note') }}</div><div style="white-space: pre-wrap;">{{ $provisionRequest->customer_note ?: __('admin.common.not_available') }}</div></div>
                        <div><div class="text-muted small">{{ __('admin.landing_orders.provision.admin_note') }}</div><div style="white-space: pre-wrap;">{{ $provisionRequest->admin_note ?: __('admin.common.not_available') }}</div></div>
                    @else
                        <div class="text-muted">{{ __('admin.landing_orders.provision.empty') }}</div>
                    @endif
                </div>
            </div>
        </div>
    </div>
@endsection
