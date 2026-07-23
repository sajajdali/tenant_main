@extends('admin.layouts.app')

@section('title', 'تنظیمات سایت')

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">تنظیمات سایت</h5>
                    <p class="text-muted mb-0">تنظیمات خرید و تمدید پشتیبانی سامانه‌های نوبت‌دهی را از اینجا مدیریت کنید.</p>
                </div>
                <div class="card-body">
                    <form method="POST" action="{{ route('admin.system-settings.update') }}">
                        @csrf
                        @method('PUT')

                        <div class="row g-3">
                            <div class="col-12">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" role="switch" id="enabled" name="enabled" value="1" @checked(old('enabled', $supportPaymentSettings['enabled'] ?? false))>
                                    <label class="form-check-label" for="enabled">امکان خرید و تمدید پشتیبانی فعال باشد</label>
                                </div>
                            </div>
                            <div class="col-12">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" role="switch" id="sandbox_enabled" name="sandbox_enabled" value="1" @checked(old('sandbox_enabled', $supportPaymentSettings['sandbox_enabled'] ?? false))>
                                    <label class="form-check-label" for="sandbox_enabled">پرداخت در حالت Sandbox باشد</label>
                                </div>
                                <div class="form-text">در حالت Sandbox، کاربر بعد از زدن «پرداخت آنلاین» بدون انتقال به بانک، تراکنش موفق می‌گیرد و پشتیبانی بلافاصله تمدید می‌شود.</div>
                            </div>

                            <div class="col-12">
                                <div class="border rounded-3 p-3">
                                    <div class="d-flex justify-content-between align-items-center gap-3">
                                        <div>
                                            <h6 class="mb-1">درگاه مستقیم</h6>
                                            <div class="form-text mt-0">
                                                درگاه مستقل برای شارژ پیامک، تمدید پشتیبانی و دامنه، خرید ماژول و فضای ذخیره‌سازی، خرید توکن و سفارش‌های لندینگ.
                                            </div>
                                        </div>
                                        <div class="form-check form-switch m-0">
                                            <input
                                                class="form-check-input"
                                                type="checkbox"
                                                role="switch"
                                                id="maliart_enabled"
                                                name="maliart_enabled"
                                                value="1"
                                                @checked(old('maliart_enabled', $maliartPaymentSettings['enabled'] ?? false))
                                            >
                                            <label class="form-check-label" for="maliart_enabled">فعال</label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="col-12">
                                <div class="border rounded-3 p-3">
                                    <h6 class="mb-3">فضای پیش‌فرض سامانه‌های جدید</h6>
                                    <label class="form-label" for="storage_default_quota_gb">حجم پیشنهادی هنگام ساخت سامانه</label>
                                    <select class="form-select" id="storage_default_quota_gb" name="storage_default_quota_gb">
                                        @foreach ($storageQuotaOptions as $quotaGb)
                                            <option value="{{ $quotaGb }}" @selected((int) old('storage_default_quota_gb', $tenantStorageSettings['default_quota_gb'] ?? 1) === (int) $quotaGb)>
                                                {{ number_format($quotaGb) }} گیگابایت
                                            </option>
                                        @endforeach
                                    </select>
                                    <div class="form-text">این مقدار در فرم «افزودن سامانه نوبت‌دهی» به‌صورت پیش‌فرض انتخاب می‌شود و مدیر همان‌جا می‌تواند آن را بیشتر کند.</div>
                                    <label class="form-label mt-3" for="storage_extra_price_per_gb_month">هزینه هر گیگ اضافه در هر ماه</label>
                                    <input
                                        type="number"
                                        min="0"
                                        class="form-control"
                                        id="storage_extra_price_per_gb_month"
                                        name="storage_extra_price_per_gb_month"
                                        value="{{ old('storage_extra_price_per_gb_month', $tenantStorageSettings['extra_price_per_gb_month'] ?? 0) }}"
                                        dir="ltr"
                                    >
                                    <div class="form-text">برای خرید وسط دوره، سیستم همین مبلغ را نسبت به روزهای باقی‌مانده پشتیبانی محاسبه می‌کند.</div>
                                </div>
                            </div>

                            <div class="col-12">
                                <label class="form-label" for="provider">درگاه فعال برای تمدید پشتیبانی</label>
                                <select id="provider" name="provider" class="form-select">
                                    @foreach($gatewayDefinitions as $gatewayKey => $gateway)
                                        <option value="{{ $gatewayKey }}" @selected(old('provider', $supportPaymentSettings['provider'] ?? 'zarinpal') === $gatewayKey)>
                                            {{ $gateway['label'] }}
                                        </option>
                                    @endforeach
                                </select>
                                <div class="form-text">کاربر تمدید پشتیبانی را با همین درگاه پرداخت می‌کند.</div>
                            </div>

                            <div class="col-12">
                                <div class="row g-3">
                                    @foreach($gatewayDefinitions as $gatewayKey => $gateway)
                                        <div class="col-12">
                                            <div class="border rounded-3 p-3">
                                                <div class="d-flex justify-content-between align-items-center mb-3">
                                                    <h6 class="mb-0">{{ $gateway['label'] }}</h6>
                                                    <div class="form-check form-switch m-0">
                                                        <input
                                                            class="form-check-input"
                                                            type="checkbox"
                                                            role="switch"
                                                            id="gateway_{{ $gatewayKey }}_enabled"
                                                            name="gateways[{{ $gatewayKey }}][enabled]"
                                                            value="1"
                                                            @checked(old("gateways.$gatewayKey.enabled", $supportPaymentSettings['gateways'][$gatewayKey]['enabled'] ?? false))
                                                        >
                                                        <label class="form-check-label" for="gateway_{{ $gatewayKey }}_enabled">فعال</label>
                                                    </div>
                                                </div>

                                                <div class="row g-3">
                                                    @foreach($gateway['fields'] as $fieldKey => $fieldMeta)
                                                        <div class="col-md-6">
                                                            <label class="form-label" for="gateway_{{ $gatewayKey }}_{{ $fieldKey }}">{{ $fieldMeta['label'] }}</label>
                                                            <input
                                                                type="text"
                                                                dir="ltr"
                                                                id="gateway_{{ $gatewayKey }}_{{ $fieldKey }}"
                                                                name="gateways[{{ $gatewayKey }}][{{ $fieldKey }}]"
                                                                class="form-control"
                                                                value="{{ old("gateways.$gatewayKey.$fieldKey", $supportPaymentSettings['gateways'][$gatewayKey][$fieldKey] ?? '') }}"
                                                            >
                                                        </div>
                                                    @endforeach
                                                </div>
                                            </div>
                                        </div>
                                    @endforeach
                                </div>
                            </div>
                        </div>

                        <div class="mt-4 d-flex gap-2">
                            <button type="submit" class="btn btn-primary">ذخیره تنظیمات</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <div class="col-12 mt-4">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">آخرین تراکنش‌های تمدید پشتیبانی</h5>
                    <p class="text-muted mb-0">آخرین ۳۰ تراکنش ثبت‌شده برای تمدید/خرید پشتیبانی در کل سیستم.</p>
                </div>
                <div class="card-body">
                    @if($latestSupportPayments->isEmpty())
                        <div class="text-center text-muted py-4">تراکنشی ثبت نشده است.</div>
                    @else
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>فاکتور</th>
                                        <th>سامانه</th>
                                        <th>پلن</th>
                                        <th>وضعیت</th>
                                        <th>درگاه</th>
                                        <th>مبلغ</th>
                                        <th>مرجع</th>
                                        <th>زمان</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach($latestSupportPayments as $payment)
                                        <tr>
                                            <td>{{ $payment->invoice_number }}</td>
                                            <td>{{ $payment->tenant?->name ?? $payment->tenant_id }}</td>
                                            <td>{{ $payment->subscriptionPackage?->name ?? '—' }}</td>
                                            <td>{{ $payment->status }}</td>
                                            <td>{{ $payment->gateway }}</td>
                                            <td>{{ number_format((int) $payment->payable_amount) }}</td>
                                            <td>{{ $payment->reference_id ?? '—' }}</td>
                                            <td>{{ $payment->created_at ? \App\Support\JalaliDate::formatDateTime($payment->created_at) : '—' }}</td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </div>
@endsection
