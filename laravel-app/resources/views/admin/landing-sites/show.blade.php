@extends('admin.layouts.app')

@section('title', 'جزئیات لندینگ')

@section('content')
    <div class="row g-3">
        <div class="col-12">
            <div class="card">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                        @php
                            $primaryDomain = $landingSite->domains->firstWhere('is_primary', true)?->domain
                                ?? $landingSite->domains->first()?->domain;
                            $previewUrl = $primaryDomain
                                ? (str_starts_with($primaryDomain, 'http://') || str_starts_with($primaryDomain, 'https://')
                                    ? $primaryDomain
                                    : 'http://' . $primaryDomain)
                                : null;
                        @endphp
                        <div>
                            <div class="d-flex align-items-center gap-2 flex-wrap mb-2">
                                <h4 class="mb-0">{{ $landingSite->name }}</h4>
                                <span class="badge {{ $landingSite->is_active ? 'bg-light-success text-success' : 'bg-light-danger text-danger' }}">
                                    {{ $landingSite->is_active ? 'فعال' : 'غیرفعال' }}
                                </span>
                                <span class="badge bg-light-secondary text-secondary">
                                    {{ $landingSite->status === 'published' ? 'منتشرشده' : ($landingSite->status === 'archived' ? 'آرشیو' : 'پیش‌نویس') }}
                                </span>
                            </div>
                            <p class="text-muted mb-2">{{ $landingSite->audienceType?->name ?? 'بدون طیف' }} - تم {{ $landingSite->theme_mode === 'light' ? 'لایت' : 'دارک' }}</p>
                            <div class="text-muted small" dir="ltr">{{ $landingSite->slug }}</div>
                        </div>
                        <div class="d-flex gap-2">
                            @if ($previewUrl)
                                <a href="{{ $previewUrl }}" target="_blank" rel="noopener noreferrer" class="btn btn-success">مشاهده لندینگ</a>
                            @endif
                            <a href="{{ route('admin.landing-sites.edit', $landingSite) }}" class="btn btn-primary">ویرایش لندینگ</a>
                            <a href="{{ route('admin.landing-sites.settings.edit', $landingSite) }}" class="btn btn-light-primary">تنظیمات کلی و سئو</a>
                            <a href="{{ route('admin.landing-sites.sections.index', $landingSite) }}" class="btn btn-light-primary">مدیریت سکشن‌ها</a>
                            <a href="{{ route('admin.landing-sites.features.index', $landingSite) }}" class="btn btn-light-primary">صفحات امکانات</a>
                            <a href="{{ route('admin.landing-sites.pages.index', $landingSite) }}" class="btn btn-light-primary">صفحه‌های لندینگ</a>
                            <a href="{{ route('admin.landing-sites.contact-submissions.index', $landingSite) }}" class="btn btn-light-primary">فرم‌های تماس</a>
                            <a href="{{ route('admin.landing-sites.index') }}" class="btn btn-light-secondary">بازگشت</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-lg-4">
            <div class="card h-100">
                <div class="card-header">
                    <h5 class="mb-0">دامنه‌ها</h5>
                </div>
                <div class="card-body">
                    @forelse ($landingSite->domains as $domain)
                        <div class="border rounded p-3 mb-3">
                            <div class="d-flex align-items-center justify-content-between gap-2">
                                <div dir="ltr" class="fw-semibold">{{ $domain->domain }}</div>
                                @if ($domain->is_primary)
                                    <span class="badge bg-light-primary text-primary">اصلی</span>
                                @endif
                            </div>
                            <div class="text-muted small mt-2">
                                وضعیت: {{ $domain->status === 'active' ? 'فعال' : $domain->status }}
                            </div>
                        </div>
                    @empty
                        <p class="text-muted mb-0">هنوز دامنه‌ای برای این لندینگ ثبت نشده است.</p>
                    @endforelse
                </div>
            </div>
        </div>

        <div class="col-lg-4">
            <div class="card h-100">
                <div class="card-header">
                    <h5 class="mb-0">صفحه‌های لندینگ</h5>
                </div>
                <div class="card-body">
                    @forelse ($landingSite->pages as $page)
                        <div class="border rounded p-3 mb-3">
                            <div class="d-flex align-items-center justify-content-between gap-2">
                                <div>
                                    <div class="fw-semibold">{{ $page->name }}</div>
                                    <div class="text-muted small mt-1" dir="ltr">{{ $page->slug }} / {{ $page->page_key }}</div>
                                </div>
                                <a href="{{ route('admin.landing-sites.pages.edit', [$landingSite, $page]) }}" class="btn btn-sm btn-light-primary">ویرایش</a>
                            </div>
                        </div>
                    @empty
                        <p class="text-muted mb-0">هنوز صفحه‌ای ساخته نشده است.</p>
                    @endforelse
                    @if ($landingSite->pages->isNotEmpty())
                        <a href="{{ route('admin.landing-sites.pages.index', $landingSite) }}" class="btn btn-light-secondary w-100 mt-2">مدیریت همه صفحه‌ها</a>
                    @endif
                </div>
            </div>
        </div>

        <div class="col-lg-4">
            <div class="card h-100">
                <div class="card-header">
                    <h5 class="mb-0">اطلاعات تکمیلی</h5>
                </div>
                <div class="card-body">
                    <div class="mb-3">
                        <div class="text-muted small">عنوان سئو</div>
                        <div>{{ data_get($landingSite->seo_json, 'title', '—') ?: '—' }}</div>
                    </div>
                    <div class="mb-3">
                        <div class="text-muted small">توضیحات سئو</div>
                        <div>{{ data_get($landingSite->seo_json, 'description', '—') ?: '—' }}</div>
                    </div>
                    <div class="mb-3">
                        <div class="text-muted small">سازنده</div>
                        <div>{{ $landingSite->createdBy?->name ?? 'سیستم' }}</div>
                    </div>
                    <div class="mb-0">
                        <div class="text-muted small">آخرین ویرایش</div>
                        <div>{{ $landingSite->updatedBy?->name ?? '—' }}</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-12">
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center gap-2 flex-wrap">
                    <h5 class="mb-0">آخرین فرم‌های تماس</h5>
                    <a href="{{ route('admin.landing-sites.contact-submissions.index', $landingSite) }}" class="btn btn-sm btn-light-primary">مشاهده همه</a>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>تاریخ ثبت</th>
                                    <th>نام</th>
                                    <th>موبایل</th>
                                    <th>ایمیل</th>
                                    <th>پیام</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($latestContactSubmissions as $submission)
                                    <tr>
                                        <td>{{ optional($submission->submitted_at)->format('Y/m/d H:i') ?: '—' }}</td>
                                        <td>{{ $submission->full_name }}</td>
                                        <td dir="ltr">{{ $submission->mobile }}</td>
                                        <td dir="ltr">{{ $submission->email ?: '—' }}</td>
                                        <td style="min-width: 320px;">
                                            <div class="text-wrap" style="white-space: pre-wrap;">{{ $submission->message }}</div>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="5" class="text-center py-4 text-muted">هنوز فرم تماسی ثبت نشده است.</td>
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
                <div class="card-header">
                    <h5 class="mb-0">آخرین سفارش‌های این لندینگ</h5>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>شماره سفارش</th>
                                    <th>مشتری</th>
                                    <th>دامنه</th>
                                    <th>پلن</th>
                                    <th>مبلغ</th>
                                    <th>وضعیت</th>
                                    <th>عملیات</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($latestOrders as $order)
                                    <tr>
                                        <td dir="ltr">{{ $order->order_number }}</td>
                                        <td>{{ $order->customer_full_name ?: ($order->customer?->full_name ?? '—') }}</td>
                                        <td dir="ltr">{{ $order->requested_domain ?: '—' }}</td>
                                        <td>{{ $order->subscriptionPackage?->name ?? '—' }}</td>
                                        <td>{{ __('admin.money.iran_toman', ['amount' => number_format($order->total_amount)]) }}</td>
                                        <td>{{ \App\Http\Controllers\Admin\LandingOrderController::statusLabel($order->status) }}</td>
                                        <td>
                                            <a href="{{ route('admin.landing-orders.show', $order) }}" class="btn btn-sm btn-light-primary">جزئیات</a>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="7" class="text-center py-4 text-muted">هنوز سفارشی برای این لندینگ ثبت نشده است.</td>
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
