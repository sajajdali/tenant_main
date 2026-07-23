@extends('admin.layouts.app')

@section('title', 'ثبت مشتری‌های فروش')

@php
    use Morilog\Jalali\Jalalian;

    $formatMoney = fn (int $amount) => __('admin.money.iran_toman', ['amount' => number_format($amount)]);
    $formatJalaliDateTime = fn ($value) => $value ? Jalalian::fromCarbon(\Illuminate\Support\Carbon::parse($value))->format('Y/m/d H:i') : '—';
    $statuses = [
        'all' => 'همه',
        'pending' => 'هنوز خرید نکرده',
        'purchased' => 'خرید کرده',
        'renewal_due' => 'نزدیک تمدید',
        'renewal_missed' => 'تمدید نکرده',
    ];
@endphp

@push('styles')
    @vite('resources/js/admin-sales-team.js')
    <style>
        .sales-jalali-input {
            background-color: #fff;
            cursor: pointer;
        }

        .sales-customer-form-card {
            border: 0;
            background: linear-gradient(135deg, #eff6ff, #ffffff);
        }

        .sales-customer-table td,
        .sales-customer-table th {
            white-space: nowrap;
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
                                <li class="breadcrumb-item" aria-current="page">ثبت مشتری‌ها</li>
                            </ul>
                        </div>
                        <div class="col-md-12">
                            <div class="page-header-title d-flex flex-wrap justify-content-between align-items-center gap-3">
                                <div>
                                    <h2 class="mb-1">ثبت مشتری‌های فروش</h2>
                                    <div class="text-muted">شماره مشتری را ثبت کنید تا بعداً خرید، تمدید و پورسانت او در همین صفحه قابل رهگیری باشد.</div>
                                </div>
                                <div class="d-flex gap-2">
                                    <a href="{{ route('admin.sales-team.index') }}" class="btn btn-outline-primary">داشبورد فروش</a>
                                    @if (in_array(auth()->user()->role, ['sales_manager', 'sales_expert'], true))
                                        <a href="{{ route('admin.sales-team.renewals') }}" class="btn btn-warning">فرصت‌های تمدید</a>
                                    @endif
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-xl-5">
            <div class="card sales-customer-form-card h-100">
                <div class="card-header border-0">
                    <h5 class="mb-1">افزودن مشتری جدید</h5>
                    <p class="text-muted mb-0">هر مشتری فقط یک‌بار قابل ثبت است؛ اگر این شماره قبلاً در سیستم باشد، ثبت جدید انجام نمی‌شود.</p>
                </div>
                <div class="card-body">
                    <form method="POST" action="{{ route('admin.sales-team.customers.store') }}">
                        @csrf
                        <div class="row g-3">
                            <div class="col-12">
                                <label class="form-label" for="customer_name">نام مشتری</label>
                                <input type="text" class="form-control" id="customer_name" name="customer_name" value="{{ old('customer_name') }}" placeholder="مثلاً علی رضایی">
                            </div>
                            <div class="col-12">
                                <label class="form-label" for="customer_mobile">شماره موبایل</label>
                                <input type="text" class="form-control" id="customer_mobile" name="customer_mobile" value="{{ old('customer_mobile') }}" placeholder="09xxxxxxxxx" required dir="ltr">
                            </div>
                            <div class="col-12">
                                <label class="form-label" for="audience_type_id">طیف کاری</label>
                                <select class="form-select" id="audience_type_id" name="audience_type_id">
                                    <option value="">بدون انتخاب</option>
                                    @foreach ($audienceTypes as $audienceType)
                                        <option value="{{ $audienceType->id }}" @selected((string) old('audience_type_id') === (string) $audienceType->id)>{{ $audienceType->name }}</option>
                                    @endforeach
                                </select>
                            </div>
                            <div class="col-12">
                                <label class="form-label" for="notes">یادداشت اولیه</label>
                                <textarea class="form-control" id="notes" name="notes" rows="4" placeholder="مثلاً از اینستاگرام آمده، درخواست دمو داشته و باید فردا تماس بگیریم">{{ old('notes') }}</textarea>
                            </div>
                            <div class="col-12">
                                <label class="form-label" for="next_follow_up_at">پیگیری بعدی</label>
                                <div class="row g-2">
                                    <div class="col-8">
                                        <input type="text" class="form-control sales-jalali-input" id="next_follow_up_at_display" placeholder="تاریخ شمسی" autocomplete="off" data-jdp data-jdp-only-date>
                                    </div>
                                    <div class="col-4">
                                        <input type="time" class="form-control" id="next_follow_up_at_time" value="{{ old('next_follow_up_at') ? \Illuminate\Support\Carbon::parse(old('next_follow_up_at'))->format('H:i') : '' }}">
                                    </div>
                                </div>
                                <input type="hidden" id="next_follow_up_at" name="next_follow_up_at" value="{{ old('next_follow_up_at') }}">
                            </div>
                            <div class="col-12">
                                <button type="submit" class="btn btn-primary w-100">ثبت مشتری در پنل فروش</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <div class="col-xl-7">
            <div class="row g-4">
                <div class="col-md-6 col-xl-6">
                    <div class="card h-100">
                        <div class="card-body">
                            <p class="text-muted mb-1">کل مشتری‌های ثبت‌شده</p>
                            <h3 class="mb-2">{{ number_format($overview['total']) }}</h3>
                            <small class="text-muted">همه شماره‌هایی که توسط تیم فروش ثبت شده‌اند</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-xl-6">
                    <div class="card h-100 border-warning-subtle">
                        <div class="card-body">
                            <p class="text-muted mb-1">هنوز خرید نکرده</p>
                            <h3 class="mb-2 text-warning">{{ number_format($overview['pending']) }}</h3>
                            <small class="text-muted">برای پیگیری و تبدیل به خرید آماده‌اند</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-xl-6">
                    <div class="card h-100 border-success-subtle">
                        <div class="card-body">
                            <p class="text-muted mb-1">خرید انجام شده</p>
                            <h3 class="mb-2 text-success">{{ number_format($overview['purchased']) }}</h3>
                            <small class="text-muted">خریدهای شناسایی‌شده و متصل به تیم فروش</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-xl-6">
                    <div class="card h-100 border-danger-subtle">
                        <div class="card-body">
                            <p class="text-muted mb-1">تمدید از دست‌رفته</p>
                            <h3 class="mb-2 text-danger">{{ number_format($overview['renewalMissed']) }}</h3>
                            <small class="text-muted">مشتری‌هایی که فرصت تمدیدشان گذشته است</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-12">
            <div class="card">
                <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div>
                        <h5 class="mb-1">لیست مشتری‌های ثبت‌شده</h5>
                        <p class="text-muted mb-0">از این جدول می‌توانید بفهمید چه کسی خرید کرده، چه کسی هنوز در انتظار پیگیری است و پورسانت هر خرید چه‌قدر بوده است.</p>
                    </div>
                    <form method="GET" action="{{ route('admin.sales-team.customers') }}" class="d-flex flex-wrap gap-2">
                        <input type="text" class="form-control" name="search" value="{{ $search }}" placeholder="جستجو نام یا موبایل" style="min-width: 220px;">
                        <select class="form-select" name="status" style="min-width: 180px;">
                            @foreach ($statuses as $key => $label)
                                <option value="{{ $key }}" @selected($selectedStatus === $key)>{{ $label }}</option>
                            @endforeach
                        </select>
                        <button type="submit" class="btn btn-primary">اعمال فیلتر</button>
                    </form>
                </div>
                <div class="card-body p-0">
                    <div class="d-flex flex-wrap gap-2 p-3 border-bottom">
                        @foreach ($statuses as $key => $label)
                            <a href="{{ route('admin.sales-team.customers', array_filter(['status' => $key, 'search' => $search ?: null])) }}" class="btn {{ $selectedStatus === $key ? 'btn-primary' : 'btn-outline-primary' }}">
                                {{ $label }}
                            </a>
                        @endforeach
                    </div>
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0 sales-customer-table">
                            <thead>
                                <tr>
                                    <th>مشتری</th>
                                    <th>وضعیت</th>
                                    <th>طیف</th>
                                    <th>مسئول فروش</th>
                                    <th>اولین خرید</th>
                                    <th>پیگیری بعدی</th>
                                    <th>پورسانت ثبت‌شده</th>
                                    <th>عملیات</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($assignments as $assignment)
                                    @php
                                        $salesExpertAmount = (int) ($assignment->sales_expert_commission_total ?? 0);
                                        $salesManagerAmount = (int) ($assignment->sales_manager_commission_total ?? 0);
                                        $commissionTotal = $salesExpertAmount + $salesManagerAmount;
                                    @endphp
                                    <tr>
                                        <td>
                                            <div class="fw-semibold">{{ $assignment->customer_name ?: 'بدون نام' }}</div>
                                            <small class="text-muted" dir="ltr">{{ $assignment->customer_mobile ?: '—' }}</small>
                                        </td>
                                        <td>
                                            <span class="badge {{ $assignment->first_purchased_at ? 'bg-light-success text-success' : 'bg-light-warning text-warning' }}">
                                                {{ $salesTeamService->statusLabel($assignment->status) }}
                                            </span>
                                            @if ($assignment->first_purchased_at)
                                                <div class="small text-success mt-1">خرید شناسایی شده</div>
                                            @else
                                                <div class="small text-muted mt-1">در انتظار خرید</div>
                                            @endif
                                        </td>
                                        <td>{{ $assignment->audienceType?->name ?? '—' }}</td>
                                        <td>
                                            <div>{{ $salesTeamService->customerOwnershipLabel($assignment) }}</div>
                                            @if ($assignment->salesManager?->name && $assignment->salesExpert?->name)
                                                <small class="text-muted">مدیر: {{ $assignment->salesManager->name }}</small>
                                            @endif
                                        </td>
                                        <td>{{ $formatJalaliDateTime($assignment->first_purchased_at) }}</td>
                                        <td>{{ $formatJalaliDateTime($assignment->next_follow_up_at) }}</td>
                                        <td>
                                            <div>{{ $formatMoney($commissionTotal) }}</div>
                                            @if ($assignment->sales_expert_percent || $assignment->sales_manager_percent)
                                                <small class="text-muted">
                                                    {{ __('admin.sales_team.sales_expert_percent', ['percent' => __('admin.sales_team.percent_value', ['value' => $assignment->sales_expert_percent ?: 0])]) }}
                                                    |
                                                    {{ __('admin.sales_team.sales_manager_percent', ['percent' => __('admin.sales_team.percent_value', ['value' => $assignment->sales_manager_percent ?: 0])]) }}
                                                </small>
                                            @endif
                                        </td>
                                        <td>
                                            <div class="d-flex flex-wrap gap-2">
                                                @if ($assignment->customer_mobile)
                                                    <a href="tel:{{ $assignment->customer_mobile }}" class="btn btn-sm btn-success">تماس</a>
                                                @endif
                                                @if ($assignment->salesExpert)
                                                    <a href="{{ route('admin.sales-team.show', $assignment->salesExpert) }}" class="btn btn-sm btn-outline-primary">داشبورد فروشنده</a>
                                                @elseif ($assignment->salesManager)
                                                    <a href="{{ route('admin.sales-team.show', $assignment->salesManager) }}" class="btn btn-sm btn-outline-primary">داشبورد فروشنده</a>
                                                @endif
                                            </div>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="8" class="text-center py-5 text-muted">هنوز مشتری‌ای در این بخش ثبت نشده است.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                    <div class="p-3">{{ $assignments->links() }}</div>
                </div>
            </div>
        </div>
    </div>
@endsection
