@extends('admin.layouts.app')

@section('title', 'گروه‌بندی دوره‌ها')

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header d-flex align-items-center justify-content-between gap-2 flex-wrap">
                    <div>
                        <h5 class="mb-1">گروه‌بندی دوره‌ها</h5>
                        <p class="text-muted mb-0">فقط مدیر کل می‌تواند دسته‌بندی‌ها را بسازد و برای هر کدام طیف مشخص کند تا در مدیریت دوره‌ها اشتباهی پیش نیاید.</p>
                    </div>
                    <a href="{{ route('admin.specialized-course-categories.create') }}" class="btn btn-primary">افزودن گروه‌بندی</a>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>طیف</th>
                                    <th>نام</th>
                                    <th>اسلاگ</th>
                                    <th>ترتیب</th>
                                    <th>تعداد دوره</th>
                                    <th>وضعیت</th>
                                    <th>عملیات</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse($categories as $category)
                                    <tr>
                                        <td>{{ $category->audienceType?->name ?? '—' }}</td>
                                        <td>
                                            <div class="fw-semibold">{{ $category->name }}</div>
                                            <div class="small text-muted">{{ $category->description ?: 'بدون توضیح' }}</div>
                                        </td>
                                        <td dir="ltr">{{ $category->slug }}</td>
                                        <td>{{ number_format($category->sort_order) }}</td>
                                        <td>{{ number_format($category->assignments_count) }}</td>
                                        <td>
                                            <span class="badge {{ $category->is_active ? 'bg-light-success text-success' : 'bg-light-danger text-danger' }}">
                                                {{ $category->is_active ? 'فعال' : 'غیرفعال' }}
                                            </span>
                                        </td>
                                        <td>
                                            <div class="d-flex gap-2">
                                                <a href="{{ route('admin.specialized-course-categories.edit', $category) }}" class="btn btn-sm btn-light-primary">ویرایش</a>
                                                <form method="POST" action="{{ route('admin.specialized-course-categories.destroy', $category) }}" onsubmit="return confirm('گروه‌بندی حذف شود؟');">
                                                    @csrf
                                                    @method('DELETE')
                                                    <button type="submit" class="btn btn-sm btn-light-danger">حذف</button>
                                                </form>
                                            </div>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="7" class="text-center py-4 text-muted">هنوز گروه‌بندی‌ای ثبت نشده است.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>

                    <div class="mt-4">
                        {{ $categories->links() }}
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection
