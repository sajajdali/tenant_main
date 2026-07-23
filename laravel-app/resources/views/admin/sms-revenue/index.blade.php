@extends('admin.layouts.app')

@section('title', 'درآمد پیامک')

@php
    $formatMoney = fn (int $amount): string => __('admin.money.iran_toman', ['amount' => number_format($amount)]);
@endphp

@section('content')
    <div class="row g-4">
        <div class="col-12">
            <div class="card dashboard-hero border-0 position-relative overflow-hidden">
                <div class="hero-pattern"></div>
                <div class="card-body p-4 p-lg-5 position-relative">
                    <div class="row align-items-center g-4">
                        <div class="col-lg-8">
                            <span class="badge bg-light text-dark mb-3">درآمد پیامک</span>
                            <h2 class="mb-3 text-white lh-base">مدیریت برداشت‌های درآمد پیامک به‌صورت جدا از سایر درآمدها</h2>
                            <p class="mb-0 text-white text-opacity-75 lh-lg">
                                در این بخش فقط پرداخت‌های واقعی شارژ پیامک محاسبه می‌شوند. شارژهای سندباکس داخل درآمد قابل برداشت
                                نمی‌آیند و هر برداشت ثبت‌شده از مانده قابل برداشت کسر می‌شود تا حساب درآمد پیامک با بقیه درآمدها قاطی نشود.
                            </p>
                        </div>
                        <div class="col-lg-4">
                            <div class="rounded-4 bg-white bg-opacity-10 p-4">
                                <div class="text-white text-opacity-75 mb-2">قابل برداشت فعلی</div>
                                <div class="display-6 fw-bold">{{ $formatMoney((int) $summary['availableToWithdraw']) }}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-md-6 col-xl-3">
            <div class="card metric-card h-100">
                <div class="card-body">
                    <div class="text-muted mb-2">کل درآمد واقعی پیامک</div>
                    <h3 class="mb-0">{{ $formatMoney((int) $summary['totalRevenue']) }}</h3>
                </div>
            </div>
        </div>

        <div class="col-md-6 col-xl-3">
            <div class="card metric-card h-100">
                <div class="card-body">
                    <div class="text-muted mb-2">کل برداشت‌شده</div>
                    <h3 class="mb-0 text-danger">{{ $formatMoney((int) $summary['totalWithdrawn']) }}</h3>
                </div>
            </div>
        </div>

        <div class="col-md-6 col-xl-3">
            <div class="card metric-card h-100">
                <div class="card-body">
                    <div class="text-muted mb-2">هزینه شارژ رایگان</div>
                    <h3 class="mb-0 text-warning">{{ $formatMoney((int) $summary['giftExpense']) }}</h3>
                    <small class="text-muted">این مبلغ قبل از برداشت از درآمد پیامک کم می‌شود.</small>
                </div>
            </div>
        </div>

        <div class="col-md-6 col-xl-3">
            <div class="card metric-card h-100">
                <div class="card-body">
                    <div class="text-muted mb-2">مانده قابل برداشت</div>
                    <h3 class="mb-0 text-success">{{ $formatMoney((int) $summary['availableToWithdraw']) }}</h3>
                    <small class="text-muted">درآمد واقعی پیامک پس از کسر هدیه و برداشت‌های قبلی.</small>
                </div>
            </div>
        </div>

        <div class="col-md-6 col-xl-3">
            <div class="card metric-card h-100">
                <div class="card-body">
                    <div class="text-muted mb-2">شارژهای سندباکس</div>
                    <h3 class="mb-0 text-secondary">{{ $formatMoney((int) $summary['sandboxRevenue']) }}</h3>
                    <small class="text-muted">این مبلغ داخل درآمد قابل برداشت حساب نمی‌شود.</small>
                </div>
            </div>
        </div>

        <div class="col-xl-4">
            <div class="card h-100">
                <div class="card-header">
                    <h5 class="mb-1">ثبت برداشت جدید</h5>
                    <p class="text-muted mb-0">هر بار که از درآمد پیامک برداشت کردی، از همین فرم ثبتش کن تا مانده دقیق بماند.</p>
                </div>
                <div class="card-body">
                    <form method="POST" action="{{ route('admin.sms-revenue.store') }}" class="row g-3">
                        @csrf
                        <div class="col-12">
                            <label class="form-label">مبلغ برداشت</label>
                            <input type="number" min="1" max="{{ (int) $summary['availableToWithdraw'] }}" name="amount" class="form-control" placeholder="مثلاً 500000" required>
                            <small class="text-muted">حداکثر قابل برداشت: {{ $formatMoney((int) $summary['availableToWithdraw']) }}</small>
                        </div>
                        <div class="col-12">
                            <label class="form-label">شماره پیگیری / مرجع</label>
                            <input type="text" name="reference" class="form-control" placeholder="اختیاری">
                        </div>
                        <div class="col-12">
                            <label class="form-label">توضیح</label>
                            <textarea name="note" rows="4" class="form-control" placeholder="مثلاً برداشت برای شارژ پنل اصلی پیامک"></textarea>
                        </div>
                        <div class="col-12 d-grid">
                            <button type="submit" class="btn btn-primary" @disabled((int) $summary['availableToWithdraw'] <= 0)>ثبت برداشت</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <div class="col-xl-8">
            <div class="card h-100">
                <div class="card-header">
                    <h5 class="mb-1">تاریخچه برداشت‌ها</h5>
                    <p class="text-muted mb-0">بعد از هر برداشت، مانده قابل برداشت همان لحظه کنار آن ذخیره می‌شود.</p>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>مبلغ</th>
                                    <th>مانده بعد از برداشت</th>
                                    <th>ثبت‌کننده</th>
                                    <th>شماره پیگیری</th>
                                    <th>زمان</th>
                                    <th>توضیح</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($withdrawals as $withdrawal)
                                    <tr>
                                        <td class="fw-semibold text-danger">{{ $formatMoney((int) $withdrawal['amount']) }}</td>
                                        <td>{{ $formatMoney((int) $withdrawal['availableAfter']) }}</td>
                                        <td>{{ $withdrawal['processedByName'] ?: '—' }}</td>
                                        <td>{{ $withdrawal['reference'] ?: '—' }}</td>
                                        <td>{{ $withdrawal['processedAt'] ? \App\Support\JalaliDate::formatDateTime($withdrawal['processedAt']) : '—' }}</td>
                                        <td>{{ $withdrawal['note'] ?: '—' }}</td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="6" class="text-center py-5 text-muted">هنوز هیچ برداشت درآمد پیامکی ثبت نشده است.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>

                    @if ($withdrawals->hasPages())
                        <div class="mt-4">
                            {{ $withdrawals->onEachSide(1)->links() }}
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </div>
@endsection
