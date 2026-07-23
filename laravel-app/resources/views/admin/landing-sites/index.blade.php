@extends('admin.layouts.app')

@section('title', 'لندینگ‌ها')

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <div class="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                        <div>
                            <h5 class="mb-1">مدیریت لندینگ‌ها</h5>
                            <p class="text-muted mb-0">برای هر طیف یک لندینگ مستقل با دامنه، تم و صفحه‌های پیش‌فرض می‌سازید.</p>
                        </div>
                        <a href="{{ route('admin.landing-sites.create') }}" class="btn btn-primary">افزودن لندینگ</a>
                    </div>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>نام لندینگ</th>
                                    <th>طیف</th>
                                    <th>دامنه اصلی</th>
                                    <th>تم</th>
                                    <th>صفحه‌ها</th>
                                    <th>سفارش‌ها</th>
                                    <th>سازنده</th>
                                    <th>وضعیت</th>
                                    <th>عملیات</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($landingSites as $landingSite)
                                    @php
                                        $primaryDomain = $landingSite->domains->firstWhere('is_primary', true)?->domain
                                            ?? $landingSite->domains->first()?->domain;
                                        $previewUrl = $primaryDomain
                                            ? (str_starts_with($primaryDomain, 'http://') || str_starts_with($primaryDomain, 'https://')
                                                ? $primaryDomain
                                                : 'http://' . $primaryDomain)
                                            : null;
                                    @endphp
                                    <tr>
                                        <td>
                                            <div class="fw-semibold">{{ $landingSite->name }}</div>
                                            <div class="text-muted small" dir="ltr">{{ $landingSite->slug }}</div>
                                        </td>
                                        <td>{{ $landingSite->audienceType?->name ?? '—' }}</td>
                                        <td dir="ltr">{{ $primaryDomain ?: '—' }}</td>
                                        <td>
                                            <span class="badge {{ $landingSite->theme_mode === 'light' ? 'bg-light-warning text-warning' : 'bg-light-dark text-dark' }}">
                                                {{ $landingSite->theme_mode === 'light' ? 'لایت' : 'دارک' }}
                                            </span>
                                        </td>
                                        <td>{{ number_format($landingSite->pages_count) }}</td>
                                        <td>{{ number_format($landingSite->orders_count) }}</td>
                                        <td>{{ $landingSite->createdBy?->name ?? 'سیستم' }}</td>
                                        <td>
                                            <div class="d-flex flex-column gap-1">
                                                <span class="badge {{ $landingSite->is_active ? 'bg-light-success text-success' : 'bg-light-danger text-danger' }}">
                                                    {{ $landingSite->is_active ? 'فعال' : 'غیرفعال' }}
                                                </span>
                                                <span class="text-muted small">
                                                    {{ $landingSite->status === 'published' ? 'منتشرشده' : ($landingSite->status === 'archived' ? 'آرشیو' : 'پیش‌نویس') }}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <div class="d-flex gap-2">
                                                @if ($previewUrl)
                                                    <a href="{{ $previewUrl }}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-success">مشاهده</a>
                                                @endif
                                                <a href="{{ route('admin.landing-sites.show', $landingSite) }}" class="btn btn-sm btn-light-secondary">جزئیات</a>
                                                <a href="{{ route('admin.landing-sites.edit', $landingSite) }}" class="btn btn-sm btn-light-primary">ویرایش</a>
                                                <form method="POST" action="{{ route('admin.landing-sites.destroy', $landingSite) }}" onsubmit="return confirm('لندینگ و دامنه‌های ثبت‌شده آن حذف شود؟');">
                                                    @csrf
                                                    @method('DELETE')
                                                    <button type="submit" class="btn btn-sm btn-light-danger">حذف</button>
                                                </form>
                                            </div>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="9" class="text-center py-5 text-muted">هنوز هیچ لندینگی ساخته نشده است.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>

                    <div class="mt-4">
                        {{ $landingSites->links() }}
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection
