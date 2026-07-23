@extends('admin.layouts.app')

@section('title', 'صفحه‌های لندینگ')

@section('content')
    <div class="row g-3">
        <div class="col-12">
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-3">
                    <div>
                        <h5 class="mb-1">صفحه‌های لندینگ</h5>
                        <p class="text-muted mb-0">{{ $landingSite->name }} - مدیریت صفحه‌های داخلی لندینگ از این بخش انجام می‌شود.</p>
                    </div>
                    <div class="d-flex gap-2">
                        <a href="{{ route('admin.landing-sites.sections.index', $landingSite) }}" class="btn btn-light-primary">سکشن‌های صفحه اصلی</a>
                        <a href="{{ route('admin.landing-sites.show', $landingSite) }}" class="btn btn-light-secondary">بازگشت به لندینگ</a>
                    </div>
                </div>
                <div class="card-body">
                    <div class="alert alert-light-info mb-4">
                        این بخش برای مدیریت صفحه‌های داخلی مثل درباره ما، امکانات سیستم، مقایسه پلن‌ها، سوالات متداول و تماس با ما در نظر گرفته شده است.
                    </div>

                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>نام صفحه</th>
                                    <th>کلید</th>
                                    <th>اسلاگ</th>
                                    <th>وضعیت</th>
                                    <th>تعداد سکشن</th>
                                    <th>ترتیب</th>
                                    <th>عملیات</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($pages as $page)
                                    <tr>
                                        <td class="fw-semibold">{{ $page->name }}</td>
                                        <td><span class="badge bg-light-secondary text-secondary" dir="ltr">{{ $page->page_key }}</span></td>
                                        <td dir="ltr">{{ $page->slug }}</td>
                                        <td>
                                            <span class="badge {{ $page->status === 'published' ? 'bg-light-success text-success' : ($page->status === 'archived' ? 'bg-light-danger text-danger' : 'bg-light-warning text-warning') }}">
                                                {{ $page->status === 'published' ? 'منتشرشده' : ($page->status === 'archived' ? 'آرشیو' : 'پیش‌نویس') }}
                                            </span>
                                        </td>
                                        <td>{{ number_format($page->sections_count) }}</td>
                                        <td>{{ number_format($page->sort_order) }}</td>
                                        <td>
                                            <a href="{{ route('admin.landing-sites.pages.edit', [$landingSite, $page]) }}" class="btn btn-sm btn-light-primary">ویرایش صفحه</a>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="7" class="text-center py-4 text-muted">هنوز صفحه‌ای برای این لندینگ ساخته نشده است.</td>
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
