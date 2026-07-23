@extends('admin.layouts.app')

@section('title', $mode === 'group' ? ($isEdit ? 'ویرایش گروه ورزشی' : 'افزودن گروه ورزشی') : ($isEdit ? 'ویرایش فعالیت ورزشی' : 'افزودن فعالیت ورزشی'))

@section('content')
    <div class="row justify-content-center">
        <div class="col-12 col-xl-9">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">{{ $mode === 'group' ? ($isEdit ? 'ویرایش گروه ورزشی' : 'افزودن گروه ورزشی') : ($isEdit ? 'ویرایش فعالیت ورزشی' : 'افزودن فعالیت ورزشی') }}</h5>
                    <p class="text-muted mb-0">
                        @if ($mode === 'group')
                            گروه‌بندی ظاهر انتخاب ورزش در صفحه کاربر را مشخص می‌کند.
                        @else
                            تنظیمات این فرم روی محاسبه کالری و فیلدهای ثبت ورزش برای کاربر اثر می‌گذارد.
                        @endif
                    </p>
                </div>
                <div class="card-body">
                    <form method="POST" action="{{ $mode === 'group'
                        ? ($isEdit ? route('admin.nutrition-exercises.groups.update', $item) : route('admin.nutrition-exercises.groups.store'))
                        : ($isEdit ? route('admin.nutrition-exercises.items.update', $item) : route('admin.nutrition-exercises.items.store')) }}">
                        @csrf
                        @if ($isEdit)
                            @method('PUT')
                        @endif

                        @if ($mode === 'group')
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="form-label">عنوان گروه</label>
                                    <input type="text" name="title" class="form-control" value="{{ old('title', $item->title) }}" required>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Slug</label>
                                    <input type="text" name="slug" class="form-control" value="{{ old('slug', $item->slug) }}" required>
                                </div>
                                <div class="col-12">
                                    <label class="form-label">توضیح</label>
                                    <textarea name="description" class="form-control" rows="3">{{ old('description', $item->description) }}</textarea>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">Icon Key</label>
                                    <input type="text" name="icon_key" class="form-control" value="{{ old('icon_key', $item->icon_key) }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">رنگ اصلی</label>
                                    <input type="text" name="accent_color" class="form-control" value="{{ old('accent_color', $item->accent_color) }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">رنگ تیره</label>
                                    <input type="text" name="soft_color" class="form-control" value="{{ old('soft_color', $item->soft_color) }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">ترتیب</label>
                                    <input type="number" name="sort_order" class="form-control" value="{{ old('sort_order', $item->sort_order ?? 0) }}" min="0">
                                </div>
                                <div class="col-md-4 d-flex align-items-end">
                                    <div class="form-check form-switch">
                                        <input class="form-check-input" type="checkbox" name="is_active" value="1" id="is_active" @checked(old('is_active', $item->is_active))>
                                        <label class="form-check-label" for="is_active">فعال باشد</label>
                                    </div>
                                </div>
                            </div>
                        @else
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="form-label">گروه</label>
                                    <select name="nutrition_exercise_group_id" class="form-select" required>
                                        <option value="">انتخاب کنید</option>
                                        @foreach ($groups as $group)
                                            <option value="{{ $group->id }}" @selected(old('nutrition_exercise_group_id', $item->nutrition_exercise_group_id) == $group->id)>{{ $group->title }}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">عنوان ورزش</label>
                                    <input type="text" name="title" class="form-control" value="{{ old('title', $item->title) }}" required>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Slug</label>
                                    <input type="text" name="slug" class="form-control" value="{{ old('slug', $item->slug) }}" required>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Icon Key</label>
                                    <input type="text" name="icon_key" class="form-control" value="{{ old('icon_key', $item->icon_key) }}">
                                </div>
                                <div class="col-12">
                                    <label class="form-label">توضیح</label>
                                    <textarea name="description" class="form-control" rows="3">{{ old('description', $item->description) }}</textarea>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">برچسب کارت</label>
                                    <input type="text" name="badge_text" class="form-control" value="{{ old('badge_text', $item->badge_text) }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">کلمات جستجو</label>
                                    <input type="text" name="search_terms" class="form-control" value="{{ old('search_terms', $item->search_terms) }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">MET سبک</label>
                                    <input type="number" step="0.1" min="1" max="30" name="met_light" class="form-control" value="{{ old('met_light', $item->met_light) }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">MET متوسط</label>
                                    <input type="number" step="0.1" min="1" max="30" name="met_moderate" class="form-control" value="{{ old('met_moderate', $item->met_moderate) }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">MET شدید</label>
                                    <input type="number" step="0.1" min="1" max="30" name="met_vigorous" class="form-control" value="{{ old('met_vigorous', $item->met_vigorous) }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">شدت پیش‌فرض</label>
                                    <select name="default_intensity" class="form-select">
                                        <option value="light" @selected(old('default_intensity', $item->default_intensity) === 'light')>سبک</option>
                                        <option value="moderate" @selected(old('default_intensity', $item->default_intensity) === 'moderate')>متوسط</option>
                                        <option value="vigorous" @selected(old('default_intensity', $item->default_intensity) === 'vigorous')>شدید</option>
                                    </select>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">ترتیب</label>
                                    <input type="number" name="sort_order" class="form-control" value="{{ old('sort_order', $item->sort_order ?? 0) }}" min="0">
                                </div>
                                <div class="col-md-4 d-flex align-items-end">
                                    <div class="form-check form-switch">
                                        <input class="form-check-input" type="checkbox" name="is_active" value="1" id="exercise_is_active" @checked(old('is_active', $item->is_active))>
                                        <label class="form-check-label" for="exercise_is_active">فعال باشد</label>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="form-check form-switch mt-2">
                                        <input class="form-check-input" type="checkbox" name="supports_intensity" value="1" id="supports_intensity" @checked(old('supports_intensity', $item->supports_intensity))>
                                        <label class="form-check-label" for="supports_intensity">پشتیبانی از شدت</label>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="form-check form-switch mt-2">
                                        <input class="form-check-input" type="checkbox" name="supports_distance" value="1" id="supports_distance" @checked(old('supports_distance', $item->supports_distance))>
                                        <label class="form-check-label" for="supports_distance">پشتیبانی از مسافت</label>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="form-check form-switch mt-2">
                                        <input class="form-check-input" type="checkbox" name="supports_speed" value="1" id="supports_speed" @checked(old('supports_speed', $item->supports_speed))>
                                        <label class="form-check-label" for="supports_speed">پشتیبانی از سرعت</label>
                                    </div>
                                </div>
                            </div>
                        @endif

                        <div class="d-flex justify-content-between align-items-center mt-4">
                            <a href="{{ route('admin.nutrition-exercises.index') }}" class="btn btn-light-secondary">بازگشت</a>
                            <button type="submit" class="btn btn-primary">ذخیره</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
@endsection
