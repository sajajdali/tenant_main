@extends('admin.layouts.app')

@section('title', 'راهنمای سیستم')

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
                        <div>
                            <h5 class="mb-1">راهنمای سیستم</h5>
                            <p class="text-muted mb-0">ویدئوها و توضیحات آموزشی پنل را به‌صورت مرکزی برای همه tenantها مدیریت کنید.</p>
                        </div>
                        <a href="{{ route('admin.help-topics.create') }}" class="btn btn-primary">افزودن آموزش</a>
                    </div>
                </div>
                <div class="card-body">
                    <form method="GET" action="{{ route('admin.help-topics.index') }}" class="row g-2 mb-4">
                        <div class="col-md-9">
                            <input
                                type="text"
                                name="q"
                                class="form-control"
                                value="{{ $search }}"
                                placeholder="جستجو در عنوان، کلید صفحه یا ماژول"
                            >
                        </div>
                        <div class="col-md-3 d-grid">
                            <button type="submit" class="btn btn-light-primary">جستجو</button>
                        </div>
                    </form>

                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>عنوان</th>
                                    <th>کلید صفحه</th>
                                    <th>ماژول</th>
                                    <th>طیف</th>
                                    <th>ویدئو</th>
                                    <th>نمایش</th>
                                    <th>ترتیب</th>
                                    <th>عملیات</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($topics as $topic)
                                    <tr>
                                        <td>
                                            <div class="fw-semibold">{{ $topic->title }}</div>
                                            @if ($topic->summary)
                                                <small class="text-muted">{{ \Illuminate\Support\Str::limit($topic->summary, 80) }}</small>
                                            @endif
                                        </td>
                                        <td><code dir="ltr">{{ $topic->topic_key }}</code></td>
                                        <td>{{ $topic->module_key ?: 'عمومی' }}</td>
                                        <td>
                                            @if ($topic->audienceType)
                                                <span class="badge bg-light-primary text-primary">{{ $topic->audienceType->name }}</span>
                                            @else
                                                <span class="badge bg-light-secondary text-secondary">عمومی</span>
                                            @endif
                                        </td>
                                        <td>
                                            @if ($topic->videoUrl())
                                                <a href="{{ $topic->videoUrl() }}" target="_blank" class="btn btn-sm btn-light-info">مشاهده</a>
                                            @else
                                                <span class="text-muted">ندارد</span>
                                            @endif
                                        </td>
                                        <td>
                                            <div class="d-flex flex-column gap-1">
                                                <span class="badge {{ $topic->is_active ? 'bg-light-success text-success' : 'bg-light-danger text-danger' }}">
                                                    {{ $topic->is_active ? 'فعال' : 'غیرفعال' }}
                                                </span>
                                                <small class="text-muted">
                                                    مرکز: {{ $topic->show_in_help_center ? 'بله' : 'خیر' }} |
                                                    هدر: {{ $topic->show_in_page_header ? 'بله' : 'خیر' }}
                                                </small>
                                            </div>
                                        </td>
                                        <td>{{ number_format($topic->sort_order) }}</td>
                                        <td>
                                            <div class="d-flex gap-2">
                                                <a href="{{ route('admin.help-topics.edit', $topic) }}" class="btn btn-sm btn-light-primary">ویرایش</a>
                                                <form method="POST" action="{{ route('admin.help-topics.destroy', $topic) }}" onsubmit="return confirm('این آموزش حذف شود؟');">
                                                    @csrf
                                                    @method('DELETE')
                                                    <button type="submit" class="btn btn-sm btn-light-danger">حذف</button>
                                                </form>
                                            </div>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="8" class="text-center py-4 text-muted">هنوز آموزشی ثبت نشده است.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>

                    <div class="mt-4">
                        {{ $topics->links() }}
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection
