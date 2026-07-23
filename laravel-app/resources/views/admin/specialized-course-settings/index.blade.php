@extends('admin.layouts.app')

@section('title', 'تنظیمات دوره‌ها')

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <div class="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
                        <div>
                            <h5 class="mb-1">تنظیمات دوره‌های تخصصی</h5>
                            <p class="text-muted mb-0">اول طیف را انتخاب کن، بعد متن‌های ثابت و فعال یا غیرفعال بودن هر سکشن را به‌صورت جداگانه تنظیم کن.</p>
                        </div>
                        <div class="d-flex flex-wrap gap-2">
                            <a href="{{ route('admin.specialized-courses.index') }}" class="btn btn-light-primary">مدیریت دوره‌ها</a>
                            <a href="{{ route('admin.specialized-course-categories.index') }}" class="btn btn-light-secondary">گروه‌بندی دوره‌ها</a>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div class="row g-3">
                        @forelse ($audiences as $audience)
                            @php
                                $courseSettings = \App\Support\AudienceSpecializedCourseSettings::normalize($audience->specialized_course_settings, $audience->slug);
                            @endphp
                            <div class="col-md-6 col-xl-4">
                                <div class="card border shadow-none h-100 mb-0">
                                    <div class="card-body d-flex flex-column">
                                        <div class="d-flex align-items-start justify-content-between gap-3 mb-3">
                                            <div>
                                                <div class="small text-muted mb-1">طیف</div>
                                                <h5 class="mb-1">{{ $audience->name }}</h5>
                                                <div class="text-muted small">{{ $audience->plural_label }}</div>
                                            </div>
                                            <span class="badge {{ $audience->is_active ? 'bg-light-success text-success' : 'bg-light-danger text-danger' }}">
                                                {{ $audience->is_active ? 'فعال' : 'غیرفعال' }}
                                            </span>
                                        </div>
                                        <div class="mb-3">
                                            <span class="badge {{ ($courseSettings['enabled'] ?? false) ? 'bg-light-success text-success' : 'bg-light-warning text-warning' }}">
                                                دوره‌های تخصصی: {{ ($courseSettings['enabled'] ?? false) ? 'فعال' : 'غیرفعال' }}
                                            </span>
                                        </div>

                                        <div class="rounded-3 bg-light p-3 mb-3">
                                            <div class="small text-muted mb-2">بخش‌های قابل تنظیم</div>
                                            <div class="d-flex flex-wrap gap-2">
                                                <span class="badge bg-light-primary text-primary">بنر اصلی</span>
                                                <span class="badge bg-light-primary text-primary">پیشنهادهای منتخب</span>
                                                <span class="badge bg-light-primary text-primary">سوالات متداول</span>
                                                <span class="badge bg-light-primary text-primary">متن‌های ثابت</span>
                                            </div>
                                        </div>

                                        <div class="mt-auto d-flex gap-2">
                                            <a href="{{ route('admin.specialized-course-settings.edit', $audience) }}" class="btn btn-primary">تنظیم این طیف</a>
                                            <a href="{{ route('admin.audience-types.edit', $audience) }}" class="btn btn-light-secondary">ویرایش خود طیف</a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        @empty
                            <div class="col-12">
                                <div class="alert alert-warning mb-0">هنوز هیچ طیفی ثبت نشده است. اول یک طیف بساز، بعد تنظیمات دوره‌ها را برایش انجام بده.</div>
                            </div>
                        @endforelse
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection
