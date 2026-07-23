@extends('admin.layouts.app')

@section('title', 'مدیریت پرداخت‌ها')

@php
    $statusMeta = [
        'paid' => ['label' => 'موفق', 'class' => 'bg-light-success text-success'],
        'pending' => ['label' => 'در انتظار', 'class' => 'bg-light-warning text-warning'],
        'failed' => ['label' => 'ناموفق', 'class' => 'bg-light-danger text-danger'],
        'cancelled' => ['label' => 'لغو شده', 'class' => 'bg-light-secondary text-secondary'],
    ];
@endphp

@section('content')
    <div class="row mb-4">
        <div class="col-md-6">
            <h2 class="mb-1">مدیریت پرداخت‌ها</h2>
            <p class="text-muted mb-0">لیست پرداخت‌های مرکزی و خرید اولیه با تفکیک شارژ پیامک، تمدید، پلاگین و خرید اولیه در کل سامانه.</p>
        </div>
    </div>

    <div class="row g-3 mb-4">
        <div class="col-xl col-md-6">
            <div class="card">
                <div class="card-body">
                    <div class="text-muted">کل تراکنش‌ها</div>
                    <h3 class="mt-2 mb-0">{{ number_format($stats['total']) }}</h3>
                </div>
            </div>
        </div>
        <div class="col-xl col-md-6">
            <div class="card">
                <div class="card-body">
                    <div class="text-muted">موفق</div>
                    <h3 class="mt-2 mb-0 text-success">{{ number_format($stats['paid']) }}</h3>
                </div>
            </div>
        </div>
        <div class="col-xl col-md-6">
            <div class="card">
                <div class="card-body">
                    <div class="text-muted">در انتظار</div>
                    <h3 class="mt-2 mb-0 text-warning">{{ number_format($stats['pending']) }}</h3>
                </div>
            </div>
        </div>
        <div class="col-xl col-md-6">
            <div class="card">
                <div class="card-body">
                    <div class="text-muted">ناموفق/لغو شده</div>
                    <h3 class="mt-2 mb-0 text-danger">{{ number_format($stats['failed'] + $stats['cancelled']) }}</h3>
                </div>
            </div>
        </div>
    </div>

    <div class="row g-3 mb-4">
        @foreach($stats['breakdown'] as $item)
            <div class="col-xl-3 col-md-6">
                <div class="card h-100">
                    <div class="card-body">
                        <div class="text-muted">{{ $item['label'] }}</div>
                        <h4 class="mt-2 mb-1">{{ __('admin.money.iran_toman', ['amount' => number_format($item['amount'])]) }}</h4>
                        <small class="text-muted">{{ __('admin.payments.successful_payment_count', ['count' => number_format($item['count'])]) }}</small>
                    </div>
                </div>
            </div>
        @endforeach
    </div>

    <div class="card mb-4">
        <div class="card-body">
            <form method="GET" action="{{ route('admin.payments.index') }}">
                <div class="row g-3">
                    <div class="col-lg-3 col-md-6">
                        <label class="form-label">جستجو</label>
                        <input
                            type="text"
                            class="form-control"
                            name="q"
                            value="{{ $filters['q'] }}"
                            placeholder="فاکتور، مرجع، نام سامانه..."
                        >
                    </div>
                    <div class="col-lg-2 col-md-6">
                        <label class="form-label">وضعیت</label>
                        <select name="status" class="form-select">
                            <option value="">همه</option>
                            @foreach($statusOptions as $item)
                                <option value="{{ $item }}" @selected($filters['status'] === $item)>{{ $item }}</option>
                            @endforeach
                        </select>
                    </div>
                    <div class="col-lg-2 col-md-6">
                        <label class="form-label">نوع پرداخت</label>
                        <select name="type" class="form-select">
                            <option value="">همه</option>
                            @foreach($typeOptions as $item)
                                <option value="{{ $item['key'] }}" @selected($filters['type'] === $item['key'])>{{ $item['label'] }}</option>
                            @endforeach
                        </select>
                    </div>
                    <div class="col-lg-2 col-md-6">
                        <label class="form-label">درگاه</label>
                        <select name="gateway" class="form-select">
                            <option value="">همه</option>
                            @foreach($gatewayOptions as $item)
                                <option value="{{ $item }}" @selected($filters['gateway'] === $item)>{{ $item }}</option>
                            @endforeach
                        </select>
                    </div>
                    <div class="col-lg-2 col-md-6">
                        <label class="form-label">حالت</label>
                        <select name="sandbox" class="form-select">
                            <option value="">همه</option>
                            <option value="1" @selected($filters['sandbox'] === '1')>سندباکس</option>
                            <option value="0" @selected($filters['sandbox'] === '0')>واقعی</option>
                        </select>
                    </div>
                    <div class="col-lg-1 col-md-6 d-flex align-items-end">
                        <button class="btn btn-primary w-100" type="submit">فیلتر</button>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <div class="card">
        <div class="card-body">
            @if($payments->isEmpty())
                <div class="text-center text-muted py-5">پرداختی برای نمایش وجود ندارد.</div>
            @else
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead>
                            <tr>
                                <th>فاکتور</th>
                                <th>سامانه</th>
                                <th>نوع</th>
                                <th>وضعیت</th>
                                <th>درگاه</th>
                                <th>مبلغ</th>
                                <th>کد تخفیف</th>
                                <th>مرجع/Authority</th>
                                <th>کاربر ثبت‌کننده</th>
                                <th>زمان</th>
                            </tr>
                        </thead>
                        <tbody>
                                @foreach($payments as $payment)
                                @php
                                    $meta = $statusMeta[$payment['status']] ?? ['label' => $payment['status'], 'class' => 'bg-light-secondary text-secondary'];
                                    $discount = $payment['discount'] ?? null;
                                @endphp
                                <tr>
                                    <td>
                                        <div>{{ $payment['invoice_number'] }}</div>
                                        <small class="text-muted">{{ $payment['source_label'] ?? '—' }}</small>
                                    </td>
                                    <td>{{ $payment['tenant_name'] ?? '—' }}</td>
                                    <td>{{ $payment['payment_type_label'] ?? $payment['payment_type'] }}</td>
                                    <td>
                                        <span class="badge {{ $meta['class'] }}">{{ $meta['label'] }}</span>
                                    </td>
                                    <td>
                                        {{ $payment['gateway_label'] ?: '—' }}
                                        @if($payment['sandbox_mode'])
                                            <span class="badge bg-light-warning text-warning ms-1">Sandbox</span>
                                        @endif
                                        @if($payment['admin_manual'])
                                            <span class="badge bg-light-info text-info ms-1">ثبت دستی</span>
                                        @endif
                                    </td>
                                    <td>
                                        <div>{{ number_format((int) $payment['payable_amount']) }}</div>
                                        @if((int) $payment['discount_amount'] > 0)
                                            <small class="text-success">{{ __('admin.payments.discount_amount', ['amount' => __('admin.money.iran_toman', ['amount' => number_format((int) $payment['discount_amount'])])]) }}</small>
                                        @endif
                                        @if(!$payment['revenue_effective'])
                                            <small class="d-block text-muted">{{ __('admin.payments.not_revenue_effective') }}</small>
                                        @endif
                                    </td>
                                    <td>
                                        @if(is_array($discount) && !empty($discount['code']))
                                            <div dir="ltr" class="fw-semibold">{{ $discount['code'] }}</div>
                                            <small class="text-muted">
                                                {{ ($discount['discountType'] ?? null) === 'percent' ? __('admin.payments.discount.type_percent') : __('admin.payments.discount.type_fixed') }}
                                                |
                                                @if(($discount['discountType'] ?? null) === 'percent')
                                                    {{ __('admin.payments.discount.percent_value', ['value' => number_format((int) ($discount['discountValue'] ?? 0))]) }}
                                                @else
                                                    {{ __('admin.money.iran_toman', ['amount' => number_format((int) ($discount['discountValue'] ?? 0))]) }}
                                                @endif
                                            </small>
                                        @else
                                            —
                                        @endif
                                    </td>
                                    <td>
                                        <div>{{ $payment['reference_id'] ?: '—' }}</div>
                                        @if($payment['authority'])
                                            <small class="text-muted">Auth: {{ $payment['authority'] }}</small>
                                        @endif
                                    </td>
                                    <td>
                                        <div>{{ $payment['initiated_by_name'] ?: '—' }}</div>
                                        @if($payment['initiated_by_mobile'])
                                            <small class="text-muted">{{ $payment['initiated_by_mobile'] }}</small>
                                        @endif
                                    </td>
                                    <td>
                                        <div>{{ $payment['created_at'] ? \App\Support\JalaliDate::formatDateTime($payment['created_at']) : '—' }}</div>
                                        @if($payment['paid_at'])
                                            <small class="text-success">پرداخت: {{ \App\Support\JalaliDate::formatDateTime($payment['paid_at']) }}</small>
                                        @endif
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>

                @if($payments->hasPages())
                    <div class="mt-4">
                        {{ $payments->onEachSide(1)->links() }}
                    </div>
                @endif
            @endif
        </div>
    </div>
@endsection
