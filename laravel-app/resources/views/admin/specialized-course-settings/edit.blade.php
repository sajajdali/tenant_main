@extends('admin.layouts.app')

@section('title', 'تنظیمات دوره‌ها')

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <div class="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between gap-3">
                        <div>
                            <h5 class="mb-1">تنظیمات دوره‌های تخصصی</h5>
                            <p class="text-muted mb-0">طیف را انتخاب کن و متن‌های هر سکشن را برای همان طیف تنظیم کن. فعال یا غیرفعال بودن همه بخش‌ها هم از همین صفحه مدیریت می‌شود.</p>
                        </div>
                        <div class="d-flex flex-wrap gap-2">
                            <a href="{{ route('admin.specialized-course-settings.index') }}" class="btn btn-light-secondary">همه طیف‌ها</a>
                            <a href="{{ route('admin.audience-types.edit', $audience) }}" class="btn btn-light-primary">ویرایش خود طیف</a>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <form method="POST" action="{{ route('admin.specialized-course-settings.update', $audience) }}">
                        @csrf
                        @method('PUT')

                        <div class="row g-3 mb-4">
                            <div class="col-lg-5">
                                <label class="form-label">طیف انتخاب‌شده</label>
                                <select class="form-select" onchange="if (this.value) window.location.href = this.value;">
                                    @foreach ($audiences as $item)
                                        <option value="{{ route('admin.specialized-course-settings.edit', $item) }}" @selected((int) $item->id === (int) $audience->id)>
                                            {{ $item->name }}{{ $item->is_active ? '' : ' - غیرفعال' }}
                                        </option>
                                    @endforeach
                                </select>
                            </div>
                            <div class="col-lg-7">
                                <div class="rounded-3 border bg-light p-3 h-100">
                                    <div class="small text-muted mb-1">پیش‌فرض این طیف</div>
                                    <div class="fw-bold mb-2">{{ $audience->name }}</div>
                                    <div class="text-muted small">اگر فیلدی را تغییر ندهی، همین صفحه از پیش‌فرض مخصوص همین طیف استفاده می‌کند. الان هم این فرم با همان پیش‌فرض‌ها برای `{{ $audience->slug }}` پر شده است.</div>
                                </div>
                            </div>
                        </div>

                        @include('admin.specialized-course-settings.partials.form-fields', [
                            'specializedCourseSettings' => $specializedCourseSettings,
                            'isStandalonePage' => true,
                        ])

                        <div class="mt-4 d-flex gap-2">
                            <button type="submit" class="btn btn-primary">ذخیره تنظیمات این طیف</button>
                            <a href="{{ route('admin.specialized-course-settings.index') }}" class="btn btn-light-secondary">بازگشت</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
@endsection
