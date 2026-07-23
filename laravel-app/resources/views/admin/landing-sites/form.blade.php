@extends('admin.layouts.app')

@section('title', $isEdit ? 'ویرایش لندینگ' : 'افزودن لندینگ')

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">{{ $isEdit ? 'ویرایش لندینگ' : 'افزودن لندینگ' }}</h5>
                    <p class="text-muted mb-0">نام، طیف، دامنه‌های لندینگ، تم و تنظیمات اولیه‌ی انتشار را از اینجا ثبت کنید.</p>
                </div>
                <div class="card-body">
                    <form method="POST" action="{{ $isEdit ? route('admin.landing-sites.update', $landingSite) : route('admin.landing-sites.store') }}">
                        @csrf
                        @if ($isEdit)
                            @method('PUT')
                        @endif

                        <div class="row g-3">
                            <div class="col-md-4">
                                <label class="form-label" for="name">نام لندینگ</label>
                                <input type="text" id="name" name="name" class="form-control" value="{{ old('name', $landingSite->name) }}" required>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="slug">اسلاگ</label>
                                <input type="text" id="slug" name="slug" dir="ltr" class="form-control" value="{{ old('slug', $landingSite->slug) }}">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="audience_type_id">طیف کاری</label>
                                <select id="audience_type_id" name="audience_type_id" class="form-select" required>
                                    <option value="">انتخاب کنید</option>
                                    @foreach ($audiences as $audience)
                                        <option value="{{ $audience->id }}" @selected((int) old('audience_type_id', $landingSite->audience_type_id) === (int) $audience->id)>{{ $audience->name }}</option>
                                    @endforeach
                                </select>
                            </div>

                            <div class="col-md-4">
                                <label class="form-label" for="status">وضعیت انتشار</label>
                                <select id="status" name="status" class="form-select" required>
                                    <option value="draft" @selected(old('status', $landingSite->status) === 'draft')>پیش‌نویس</option>
                                    <option value="published" @selected(old('status', $landingSite->status) === 'published')>منتشرشده</option>
                                    <option value="archived" @selected(old('status', $landingSite->status) === 'archived')>آرشیو</option>
                                </select>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="theme_mode">تم پیش‌فرض</label>
                                <select id="theme_mode" name="theme_mode" class="form-select" required>
                                    <option value="dark" @selected(old('theme_mode', $landingSite->theme_mode) === 'dark')>دارک</option>
                                    <option value="light" @selected(old('theme_mode', $landingSite->theme_mode) === 'light')>لایت</option>
                                </select>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="primary_domain">دامنه اصلی</label>
                                <input type="text" id="primary_domain" name="primary_domain" dir="ltr" class="form-control" value="{{ old('primary_domain', $domainValues['primary']) }}" placeholder="example.com" required>
                            </div>

                            <div class="col-md-6">
                                <label class="form-label" for="seo_title">عنوان سئو</label>
                                <input type="text" id="seo_title" name="seo_title" class="form-control" value="{{ old('seo_title', $seoValues['title']) }}">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="additional_domains">دامنه‌های اضافه</label>
                                <textarea id="additional_domains" name="additional_domains" rows="4" dir="ltr" class="form-control" placeholder="landing.example.com&#10;www.example.com">{{ old('additional_domains', $domainValues['additional']) }}</textarea>
                                <small class="text-muted">هر دامنه را در یک خط وارد کنید.</small>
                            </div>

                            <div class="col-12">
                                <label class="form-label" for="seo_description">توضیحات سئو</label>
                                <textarea id="seo_description" name="seo_description" rows="3" class="form-control">{{ old('seo_description', $seoValues['description']) }}</textarea>
                            </div>

                            <div class="col-md-6">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" role="switch" id="is_active" name="is_active" value="1" @checked(old('is_active', $landingSite->is_active))>
                                    <label class="form-check-label" for="is_active">فعال باشد</label>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" role="switch" id="is_default" name="is_default" value="1" @checked(old('is_default', $landingSite->is_default))>
                                    <label class="form-check-label" for="is_default">لندینگ پیش‌فرض این طیف باشد</label>
                                </div>
                            </div>
                        </div>

                        <div class="alert alert-light-primary mt-4 mb-0">
                            بعد از ذخیره، صفحه‌های پیش‌فرض لندینگ به‌صورت خودکار ساخته می‌شوند تا بعدا بتوانیم محتوای هر صفحه را جداگانه مدیریت کنیم.
                        </div>

                        <div class="mt-4 d-flex gap-2">
                            <button type="submit" class="btn btn-primary">{{ $isEdit ? 'ذخیره تغییرات' : 'ساخت لندینگ' }}</button>
                            <a href="{{ route('admin.landing-sites.index') }}" class="btn btn-light-secondary">بازگشت</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
@endsection
