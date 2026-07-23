@extends('admin.layouts.app')

@section('title', 'داشبورد فروش')

@php
    use Morilog\Jalali\Jalalian;

    $summary = $detail['summary'];
    $formatMoney = fn (int $amount) => __('admin.money.iran_toman', ['amount' => number_format($amount)]);
    $formatJalaliDateTime = fn ($value) => $value ? Jalalian::fromCarbon(\Illuminate\Support\Carbon::parse($value))->format('Y/m/d H:i') : '—';
    $formatJalaliDate = fn ($value) => $value ? Jalalian::fromCarbon(\Illuminate\Support\Carbon::parse($value))->format('Y/m/d') : '—';
@endphp

@push('styles')
    @vite('resources/js/admin-sales-team.js')
    <style>
        .sales-summary-grid .card {
            min-height: 100%;
        }

        .sales-followup-card {
            border: 0;
            box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
        }

        .sales-followup-card .card-header {
            padding: 1.1rem 1.25rem 0.85rem;
        }

        .sales-followup-card .card-body {
            padding: 1.15rem 1.25rem 1.25rem;
        }

        .sales-followup-card .form-label {
            display: block;
            font-size: 0.9rem;
            font-weight: 600;
            color: #0f172a;
            margin-bottom: 0.45rem;
        }

        .sales-followup-helper {
            font-size: 0.76rem;
            line-height: 1.65;
            color: #64748b;
        }

        .sales-followup-card .form-control,
        .sales-followup-card .form-select {
            min-height: 48px;
            border-radius: 14px;
            border-color: #cbd5e1;
            font-size: 0.92rem;
            padding: 0.7rem 0.9rem;
        }

        .sales-followup-card textarea.form-control {
            min-height: 126px;
            resize: vertical;
        }

        .sales-followup-card .btn-primary {
            min-height: 48px;
            padding-inline: 1.4rem;
            border-radius: 14px;
            font-size: 0.95rem;
            font-weight: 600;
        }

        .sales-followup-section {
            padding: 0.85rem 0.9rem 0.95rem;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            background: #fff;
        }

        .sales-followup-date-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(260px, 360px);
            gap: 1rem;
            align-items: start;
        }

        .sales-followup-date-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 112px;
            gap: 0.65rem;
            align-items: end;
        }

        .sales-followup-section-title {
            font-size: 0.83rem;
            font-weight: 700;
            line-height: 1.7;
            color: #0f172a;
            margin-bottom: 0.1rem;
        }

        .sales-followup-date-meta .sales-followup-helper {
            margin-bottom: 0;
        }

        .sales-followup-date-field label {
            display: block;
            font-size: 0.72rem;
            font-weight: 600;
            color: #64748b;
            margin-bottom: 0.35rem;
        }

        .sales-followup-date-field .form-control {
            min-height: 42px;
            border-radius: 12px;
            border: 1px solid #cbd5e1;
            background: #fff;
            box-shadow: none;
            font-size: 0.85rem;
            padding: 0.58rem 0.8rem;
            direction: rtl;
            text-align: right;
        }

        .sales-followup-date-field .form-control:focus {
            border-color: #60a5fa;
            box-shadow: 0 0 0 0.16rem rgba(59, 130, 246, 0.12);
        }

        .sales-followup-date-field input[type="time"] {
            direction: ltr;
            text-align: center;
            padding-inline: 0.55rem;
        }

        .sales-followup-card .card-header h5 {
            font-size: 1.02rem;
            font-weight: 700;
        }

        .sales-followup-card .card-header p {
            font-size: 0.82rem;
            line-height: 1.8;
        }

        .sales-followup-card .form-control::placeholder,
        .sales-followup-card textarea::placeholder {
            color: #94a3b8;
            font-size: 0.88rem;
        }

        .sales-trend-bar {
            height: 10px;
            border-radius: 999px;
            background: rgba(29, 78, 216, 0.12);
            overflow: hidden;
        }

        .sales-trend-bar > span {
            display: block;
            height: 100%;
            border-radius: inherit;
            background: linear-gradient(90deg, #1d4ed8, #0ea5e9);
        }

        .activity-list li:not(:last-child) {
            border-bottom: 1px dashed rgba(100, 116, 139, 0.2);
        }

        .sales-jalali-input {
            background-color: #fff;
            cursor: pointer;
        }

        @media (max-width: 767px) {
            .sales-followup-card .card-header,
            .sales-followup-card .card-body {
                padding: 0.95rem;
            }

            .sales-followup-date-row,
            .sales-followup-date-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
@endpush

@section('content')
    <div class="row g-4">
        <div class="col-12">
            <div class="page-header">
                <div class="page-block">
                    <div class="row align-items-center">
                        <div class="col-md-12">
                            <ul class="breadcrumb">
                                <li class="breadcrumb-item"><a href="{{ route('admin.dashboard') }}">داشبورد</a></li>
                                <li class="breadcrumb-item"><a href="{{ route('admin.sales-team.index') }}">تیم فروش</a></li>
                                <li class="breadcrumb-item" aria-current="page">{{ $salesUser->name }}</li>
                            </ul>
                        </div>
                        <div class="col-md-12">
                            <div class="page-header-title d-flex flex-wrap justify-content-between align-items-center gap-3">
                                <div>
                                    <h2 class="mb-1">{{ $salesUser->name }}</h2>
                                    <div class="text-muted">
                                        {{ $salesTeamService->roleLabel($salesUser->role) }} •
                                        <span dir="ltr">{{ $salesUser->mobile }}</span>
                                    </div>
                                </div>
                                <div class="d-flex gap-2">
                                    <a href="{{ route('admin.sales-team.user-renewals', $salesUser) }}" class="btn btn-warning">فرصت‌های تمدید</a>
                                    @if ($canEditCommissionConfig)
                                        <a href="{{ route('admin.users.edit', $salesUser) }}" class="btn btn-outline-primary">ویرایش درصدها</a>
                                    @endif
                                    @if ($canOpenWithdrawalArea)
                                        <a href="{{ route('admin.sales-team.withdrawals.create', $salesUser) }}" class="btn btn-success">برداشت و تسویه</a>
                                    @endif
                                    <a href="{{ route('admin.sales-team.index') }}" class="btn btn-light-secondary">بازگشت</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-12">
            <div class="card dashboard-hero border-0 position-relative overflow-hidden">
                <div class="hero-pattern"></div>
                <div class="card-body p-4 position-relative">
                    <div class="row align-items-center g-4">
                        <div class="col-lg-8">
                            <span class="badge bg-light text-dark mb-3">{{ $salesTeamService->roleLabel($salesUser->role) }}</span>
                                <h3 class="text-white mb-2">داشبورد عملکرد فروش، درآمد و پیگیری</h3>
                            <p class="mb-0 text-white text-opacity-75 lh-lg">
                                این صفحه برای ارزیابی دقیق فروش، مشتری‌ها، تمدیدها، پیگیری‌ها و پورسانت‌های {{ $salesUser->name }} طراحی شده است.
                                هر تغییری در عملکرد اینجا به‌صورت متمرکز قابل مشاهده است.
                            </p>
                        </div>
                        <div class="col-lg-4">
                            <div class="text-lg-end">
                                <div class="display-6 fw-bold text-white">{{ $formatMoney($summary['commissionAmount']) }}</div>
                                <div class="text-white text-opacity-75">جمع پورسانت ثبت‌شده</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-12 sales-summary-grid">
            <div class="row g-4">
                <div class="col-md-6 col-xl-3">
                    <div class="card">
                        <div class="card-body">
                            <p class="text-muted mb-1">فروش کل</p>
                            <h3 class="mb-2">{{ $formatMoney($summary['totalSales']) }}</h3>
                            <small class="text-muted">{{ __('admin.sales_team.this_month', ['amount' => $formatMoney($summary['monthlySales'])]) }}</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-xl-3">
                    <div class="card">
                        <div class="card-body">
                            <p class="text-muted mb-1">مشتری‌ها</p>
                            <h3 class="mb-2">{{ number_format($summary['totalCustomers']) }}</h3>
                            <small class="text-muted">{{ __('admin.sales_team.new_this_month', ['count' => number_format($summary['monthlyCustomers'])]) }}</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-xl-3">
                    <div class="card">
                        <div class="card-body">
                            <p class="text-muted mb-1">پیگیری‌ها</p>
                            <h3 class="mb-2">{{ number_format($summary['followUpsCount']) }}</h3>
                            <small class="text-muted">{{ __('admin.sales_team.registered_this_month', ['count' => number_format($summary['monthlyFollowUps'])]) }}</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-xl-3">
                    <div class="card">
                        <div class="card-body">
                            <p class="text-muted mb-1">تمدید نکرده</p>
                            <h3 class="mb-2">{{ number_format($summary['missedRenewals']) }}</h3>
                            <small class="text-muted">مشتری فعال: {{ number_format($summary['activeAssignments']) }}</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-xl-3">
                    <div class="card border-success-subtle">
                        <div class="card-body">
                            <p class="text-muted mb-1">موجودی قابل برداشت</p>
                            <h3 class="mb-2 text-success">{{ $formatMoney($summary['availableBalance']) }}</h3>
                            <small class="text-muted">{{ __('admin.sales_team.pending_deposit', ['amount' => $formatMoney($summary['pendingWithdrawalAmount'])]) }}</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-xl-3">
                    <div class="card">
                        <div class="card-body">
                            <p class="text-muted mb-1">درخواست‌های برداشت</p>
                            <h3 class="mb-2">{{ number_format($summary['withdrawalRequestsCount']) }}</h3>
                            <small class="text-muted">در صف: {{ number_format($summary['pendingWithdrawalRequestsCount']) }}</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-xl-3">
                    <div class="card bg-light-primary border-0">
                        <div class="card-body d-flex flex-column justify-content-between gap-3">
                            <div>
                                <p class="text-muted mb-1">برداشت و تسویه</p>
                                <h5 class="mb-1">{{ $formatMoney($summary['paidWithdrawalAmount']) }}</h5>
                                <small class="text-muted">جمع مبالغ واریزشده به این شخص</small>
                            </div>
                            @if ($canOpenWithdrawalArea)
                                <a href="{{ route('admin.sales-team.withdrawals.create', $salesUser) }}" class="btn btn-primary">
                                    درخواست برداشت
                                </a>
                            @else
                                <span class="text-muted small">برداشت فقط برای خود شخص یا مدیر کل باز است.</span>
                            @endif
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-xl-8">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">روند فروش ۶ ماه اخیر</h5>
                    <p class="text-muted mb-0">برای تشخیص افت یا رشد عملکرد، فروش خالص هر ماه اینجا دیده می‌شود.</p>
                </div>
                <div class="card-body">
                    <div class="row g-3">
                        @php $maxTrend = max(1, $detail['monthlyTrend']->max('amount')); @endphp
                        @foreach ($detail['monthlyTrend'] as $month)
                            <div class="col-12">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <span class="fw-semibold">{{ $month['label'] }}</span>
                                    <span class="text-muted">{{ $formatMoney($month['amount']) }}</span>
                                </div>
                                <div class="sales-trend-bar">
                                    <span style="width: {{ min(100, (int) round(($month['amount'] / $maxTrend) * 100)) }}%"></span>
                                </div>
                            </div>
                        @endforeach
                    </div>
                </div>
            </div>
        </div>

        <div class="col-xl-4">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">وضعیت قیف فروش</h5>
                    <p class="text-muted mb-0">نمایی سریع از توزیع مشتری‌ها در مراحل مختلف.</p>
                </div>
                <div class="card-body">
                    <ul class="list-unstyled mb-0 activity-list">
                        @foreach ($summary['pipeline'] as $status => $count)
                            <li class="py-3 d-flex align-items-center justify-content-between">
                                <span>{{ $salesTeamService->statusLabel($status) }}</span>
                                <span class="badge bg-light-primary text-primary">{{ number_format($count) }}</span>
                            </li>
                        @endforeach
                    </ul>
                </div>
            </div>

            @if ($salesUser->role === 'sales_manager')
                <div class="card mt-4">
                    <div class="card-header">
                        <h5 class="mb-1">زیرمجموعه‌های مدیر فروش</h5>
                        <p class="text-muted mb-0">کارشناسانی که زیر نظر این مدیر فروش کار می‌کنند.</p>
                    </div>
                    <div class="card-body">
                        @forelse ($detail['managedExperts'] as $expert)
                            <div class="d-flex align-items-center justify-content-between py-2 border-bottom">
                                <div>
                                    <div class="fw-semibold">{{ $expert->name }}</div>
                                    <small class="text-muted" dir="ltr">{{ $expert->mobile }}</small>
                                </div>
                                <a href="{{ route('admin.sales-team.show', $expert) }}" class="btn btn-sm btn-light-primary">داشبورد</a>
                            </div>
                        @empty
                            <div class="text-muted">برای این مدیر فروش هنوز کارشناس زیرمجموعه تعریف نشده است.</div>
                        @endforelse
                    </div>
                </div>
            @endif
        </div>

        <div class="col-xl-6">
            <div class="card sales-followup-card">
                <div class="card-header">
                    <h5 class="mb-1">ثبت پیگیری جدید</h5>
                    <p class="text-muted mb-0">تماس، نتیجه و زمان‌های پیگیری را در این فرم ثبت کنید.</p>
                </div>
                <div class="card-body">
                    <form method="POST" action="{{ route('admin.sales-team.follow-ups.store', $salesUser) }}">
                        @csrf
                        <div class="row g-3">
                            <div class="col-12">
                                <label class="form-label" for="sales_customer_assignment_id">مشتری</label>
                                <div class="sales-followup-helper mb-2">مشتری مربوط به این پیگیری را انتخاب کنید.</div>
                                <select class="form-select" id="sales_customer_assignment_id" name="sales_customer_assignment_id" required>
                                    <option value="">انتخاب مشتری</option>
                                    @foreach ($assignmentOptions as $assignment)
                                        <option value="{{ $assignment->id }}">
                                            {{ $assignment->customer_name ?: 'بدون نام' }} - {{ $assignment->customer_mobile ?: 'بدون موبایل' }}
                                        </option>
                                    @endforeach
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="follow_up_type">نوع پیگیری</label>
                                <div class="sales-followup-helper mb-2">نوع فعالیت را مشخص کنید.</div>
                                <select class="form-select" id="follow_up_type" name="follow_up_type" required>
                                    <option value="call">تماس</option>
                                    <option value="whatsapp">واتساپ</option>
                                    <option value="sms">پیامک</option>
                                    <option value="meeting">جلسه</option>
                                    <option value="note">یادداشت</option>
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="result_status">نتیجه / وضعیت جدید</label>
                                <div class="sales-followup-helper mb-2">اگر وضعیت مشتری تغییر کرده، ثبتش کنید.</div>
                                <select class="form-select" id="result_status" name="result_status">
                                    <option value="">بدون تغییر وضعیت</option>
                                    <option value="new">جدید</option>
                                    <option value="contacted">تماس گرفته شده</option>
                                    <option value="qualified">واجد شرایط</option>
                                    <option value="won">خرید اول انجام شده</option>
                                    <option value="renewed">تمدید کرده</option>
                                    <option value="renewal_due">نزدیک تمدید</option>
                                    <option value="renewal_missed">تمدید نکرده</option>
                                    <option value="lost">از دست رفته</option>
                                </select>
                            </div>
                            <div class="col-12">
                                <label class="form-label" for="summary">خلاصه پیگیری</label>
                                <div class="sales-followup-helper mb-2">یک خلاصه کوتاه و واضح بنویسید.</div>
                                <input type="text" class="form-control" id="summary" name="summary" placeholder="مثلاً تماس گرفته شد و درخواست دمو داشت" required>
                            </div>
                            <div class="col-12">
                                <label class="form-label" for="details">توضیحات</label>
                                <div class="sales-followup-helper mb-2">جزئیات مهم مکالمه و نیاز مشتری را وارد کنید.</div>
                                <textarea class="form-control" id="details" name="details" rows="4" placeholder="جزئیات مکالمه، نیاز مشتری، اعتراض‌ها و ..."></textarea>
                            </div>
                            <div class="col-12">
                                <div class="d-grid gap-3">
                                    <div class="sales-followup-section">
                                        <div class="sales-followup-date-row">
                                            <div class="sales-followup-date-meta">
                                                <div class="sales-followup-section-title">زمان انجام این پیگیری</div>
                                                <div class="sales-followup-helper">تاریخ و ساعت واقعی ثبت این تماس یا جلسه.</div>
                                            </div>
                                            <div class="sales-followup-date-grid">
                                                <div class="sales-followup-date-field">
                                                    <label for="followed_at_display">تاریخ</label>
                                                    <input type="text" class="form-control sales-jalali-input" id="followed_at_display" placeholder="انتخاب تاریخ" autocomplete="off" data-jdp data-jdp-only-date>
                                                </div>
                                                <div class="sales-followup-date-field">
                                                    <label for="followed_at_time">ساعت</label>
                                                    <input type="time" class="form-control" id="followed_at_time" value="{{ old('followed_at') ? \Illuminate\Support\Carbon::parse(old('followed_at'))->format('H:i') : '' }}">
                                                </div>
                                            </div>
                                            <input type="hidden" id="followed_at" name="followed_at" value="{{ old('followed_at') }}">
                                        </div>
                                    </div>
                                    <div class="sales-followup-section">
                                        <div class="sales-followup-date-row">
                                            <div class="sales-followup-date-meta">
                                                <div class="sales-followup-section-title">زمان برنامه‌ریزی اولیه</div>
                                                <div class="sales-followup-helper">اگر قبلاً زمان‌بندی شده، تاریخ و ساعتش را وارد کنید.</div>
                                            </div>
                                            <div class="sales-followup-date-grid">
                                                <div class="sales-followup-date-field">
                                                    <label for="scheduled_for_display">تاریخ</label>
                                                    <input type="text" class="form-control sales-jalali-input" id="scheduled_for_display" placeholder="انتخاب تاریخ" autocomplete="off" data-jdp data-jdp-only-date>
                                                </div>
                                                <div class="sales-followup-date-field">
                                                    <label for="scheduled_for_time">ساعت</label>
                                                    <input type="time" class="form-control" id="scheduled_for_time" value="{{ old('scheduled_for') ? \Illuminate\Support\Carbon::parse(old('scheduled_for'))->format('H:i') : '' }}">
                                                </div>
                                            </div>
                                            <input type="hidden" id="scheduled_for" name="scheduled_for" value="{{ old('scheduled_for') }}">
                                        </div>
                                    </div>
                                    <div class="sales-followup-section">
                                        <div class="sales-followup-date-row">
                                            <div class="sales-followup-date-meta">
                                                <div class="sales-followup-section-title">زمان پیگیری بعدی</div>
                                                <div class="sales-followup-helper">اگر ادامه پیگیری لازم است، زمان بعدی را ثبت کنید.</div>
                                            </div>
                                            <div class="sales-followup-date-grid">
                                                <div class="sales-followup-date-field">
                                                    <label for="next_follow_up_at_display">تاریخ</label>
                                                    <input type="text" class="form-control sales-jalali-input" id="next_follow_up_at_display" placeholder="انتخاب تاریخ" autocomplete="off" data-jdp data-jdp-only-date>
                                                </div>
                                                <div class="sales-followup-date-field">
                                                    <label for="next_follow_up_at_time">ساعت</label>
                                                    <input type="time" class="form-control" id="next_follow_up_at_time" value="{{ old('next_follow_up_at') ? \Illuminate\Support\Carbon::parse(old('next_follow_up_at'))->format('H:i') : '' }}">
                                                </div>
                                            </div>
                                            <input type="hidden" id="next_follow_up_at" name="next_follow_up_at" value="{{ old('next_follow_up_at') }}">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="mt-4">
                            <button type="submit" class="btn btn-primary">ثبت پیگیری</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <div class="col-xl-6">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">پیگیری‌های اخیر و برنامه‌های بعدی</h5>
                    <p class="text-muted mb-0">آخرین فعالیت‌های ثبت‌شده و مشتری‌هایی که نوبت پیگیری‌شان رسیده یا نزدیک است.</p>
                </div>
                <div class="card-body">
                    <div class="row g-4">
                        <div class="col-lg-7">
                            <h6 class="mb-3">پیگیری‌های اخیر</h6>
                            <ul class="list-unstyled mb-0 activity-list">
                                @forelse ($detail['recentFollowUps'] as $followUp)
                                    <li class="py-3">
                                        <div class="d-flex justify-content-between gap-3">
                                            <div>
                                                <div class="fw-semibold">{{ $followUp->summary }}</div>
                                                <div class="text-muted small">
                                                    {{ $followUp->assignment?->customer_name ?: 'مشتری نامشخص' }} •
                                                    {{ $salesTeamService->followUpTypeLabel($followUp->follow_up_type) }}
                                                    @if ($followUp->result_status)
                                                        • {{ $salesTeamService->statusLabel($followUp->result_status) }}
                                                    @endif
                                                </div>
                                            </div>
                                            <div class="text-muted small text-nowrap">{{ $formatJalaliDateTime($followUp->followed_at) }}</div>
                                        </div>
                                    </li>
                                @empty
                                    <li class="py-3 text-muted">هنوز پیگیری ثبت نشده است.</li>
                                @endforelse
                            </ul>
                        </div>
                        <div class="col-lg-5">
                            <h6 class="mb-3">پیگیری‌های آینده</h6>
                            <ul class="list-unstyled mb-0 activity-list">
                                @forelse ($detail['upcomingFollowUps'] as $assignment)
                                    <li class="py-3">
                                        <div class="fw-semibold">{{ $assignment->customer_name ?: 'بدون نام' }}</div>
                                        <div class="text-muted small">
                                            {{ $assignment->customer_mobile ?: 'بدون موبایل' }} •
                                            {{ $salesTeamService->statusLabel($assignment->status) }}
                                        </div>
                                        <div class="small mt-1 text-primary">{{ $formatJalaliDateTime($assignment->next_follow_up_at) }}</div>
                                    </li>
                                @empty
                                    <li class="py-3 text-muted">پیگیری برنامه‌ریزی‌شده‌ای وجود ندارد.</li>
                                @endforelse
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-xl-6">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">جزئیات درآمد، فروش‌ها و پورسانت‌ها</h5>
                    <p class="text-muted mb-0">اینجا دقیقاً مشخص است درآمد این شخص از کدام خریدها و تمدیدها ساخته شده و سهم پورسانت هر مورد چقدر بوده است.</p>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>منبع</th>
                                    <th>مشتری</th>
                                    <th>فروش خالص</th>
                                    <th>پورسانت</th>
                                    <th>تاریخ</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($detail['recentCommissions'] as $ledger)
                                    <tr>
                                        <td>{{ $ledger->source_label ?: $ledger->source_type }}</td>
                                        <td>
                                            <div>{{ $ledger->customer_name ?: '—' }}</div>
                                            <small class="text-muted">{{ $ledger->customer_mobile ?: '—' }}</small>
                                        </td>
                                        <td>{{ $formatMoney((int) $ledger->net_amount) }}</td>
                                        <td>
                                            @if ($salesUser->role === 'sales_manager')
                                                {{ $formatMoney((int) $ledger->sales_manager_amount) }}
                                            @else
                                                {{ $formatMoney((int) $ledger->sales_expert_amount) }}
                                            @endif
                                        </td>
                                        <td>{{ $formatJalaliDateTime($ledger->occurred_at) }}</td>
                                    </tr>
                                    @if($ledger->source_type === 'specialized_course_order')
                                        @php($meta = is_array($ledger->meta_json) ? $ledger->meta_json : [])
                                        <tr class="table-light">
                                            <td colspan="5">
                                                <div class="small text-muted">
                                                    دوره: {{ data_get($meta, 'course_title', '—') }} |
                                                    {{ __('admin.sales_team.order_total_amount', ['amount' => $formatMoney((int) data_get($meta, 'order_payable_amount', 0))]) }} |
                                                    {{ __('admin.sales_team.teacher_share', ['amount' => $formatMoney((int) data_get($meta, 'teacher_commission_amount', 0))]) }} |
                                                    نوع محاسبه مدرس: {{ data_get($meta, 'teacher_commission_label', '—') }} |
                                                    {{ __('admin.sales_team.sales_commission_base', ['amount' => $formatMoney((int) data_get($meta, 'sales_commission_base_amount', 0))]) }} |
                                                    {{ __('admin.sales_team.platform_remaining', ['amount' => $formatMoney((int) data_get($meta, 'platform_amount', 0))]) }}
                                                </div>
                                            </td>
                                        </tr>
                                    @endif
                                @empty
                                    <tr>
                                        <td colspan="5" class="text-center py-4 text-muted">هنوز فروش ثبت‌شده‌ای وجود ندارد.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-xl-6">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">مشتری‌ها و وضعیت تمدید</h5>
                    <p class="text-muted mb-0">نمایی از مشتری‌های متصل به این شخص و آخرین وضعیت آن‌ها.</p>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>مشتری</th>
                                    <th>وضعیت</th>
                                    <th>آخرین خرید</th>
                                    <th>انقضای پشتیبانی</th>
                                    <th>پیگیری بعدی</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($detail['assignments'] as $assignment)
                                    <tr>
                                        <td>
                                            <div class="fw-semibold">{{ $assignment->customer_name ?: '—' }}</div>
                                            <small class="text-muted">{{ $assignment->customer_mobile ?: ($assignment->tenant_id ?: '—') }}</small>
                                        </td>
                                        <td>
                                            <span class="badge bg-light-primary text-primary">
                                                {{ $salesTeamService->statusLabel($assignment->status) }}
                                            </span>
                                        </td>
                                        <td>{{ $formatJalaliDateTime($assignment->last_purchased_at) }}</td>
                                        <td>{{ $formatJalaliDate($assignment->support_expires_at) }}</td>
                                        <td>{{ $formatJalaliDateTime($assignment->next_follow_up_at) }}</td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="5" class="text-center py-4 text-muted">هنوز مشتری‌ای برای این شخص ثبت نشده است.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                    <div class="p-3">
                        {{ $detail['assignments']->links() }}
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection
