@extends('admin.layouts.app')

@section('title', $isEdit ? 'ویرایش گروه‌بندی دوره' : 'افزودن گروه‌بندی دوره')

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">{{ $isEdit ? 'ویرایش گروه‌بندی دوره' : 'افزودن گروه‌بندی دوره' }}</h5>
                    <p class="text-muted mb-0">برای هر گروه‌بندی، طیف هدف را مشخص کنید تا دسته‌بندی‌های دوره‌ها دقیق و تفکیک‌شده باقی بمانند.</p>
                </div>
                <div class="card-body">
                    <form method="POST" action="{{ $isEdit ? route('admin.specialized-course-categories.update', $category) : route('admin.specialized-course-categories.store') }}">
                        @csrf
                        @if($isEdit)
                            @method('PUT')
                        @endif

                        <div class="row g-3">
                            <div class="col-md-6">
                                <label class="form-label" for="audience_type_id">طیف</label>
                                <select id="audience_type_id" name="audience_type_id" class="form-select" required>
                                    <option value="">انتخاب طیف</option>
                                    @foreach($audiences as $audience)
                                        <option value="{{ $audience->id }}" @selected((string) old('audience_type_id', $category->audience_type_id) === (string) $audience->id)>{{ $audience->name }}</option>
                                    @endforeach
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="name">نام گروه‌بندی</label>
                                <input type="text" id="name" name="name" class="form-control" value="{{ old('name', $category->name) }}" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="slug">اسلاگ</label>
                                <input type="text" id="slug" name="slug" class="form-control" dir="ltr" value="{{ old('slug', $category->slug) }}">
                            </div>
                            <div class="col-md-8">
                                <label class="form-label" for="description">توضیح</label>
                                <input type="text" id="description" name="description" class="form-control" value="{{ old('description', $category->description) }}">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="sort_order">ترتیب نمایش</label>
                                <input type="number" min="0" id="sort_order" name="sort_order" class="form-control" value="{{ old('sort_order', $category->sort_order ?? 0) }}">
                            </div>
                            <div class="col-12">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" role="switch" id="is_active" name="is_active" value="1" @checked(old('is_active', $category->is_active))>
                                    <label class="form-check-label" for="is_active">فعال باشد</label>
                                </div>
                            </div>
                        </div>

                        <div class="mt-4 d-flex gap-2">
                            <button type="submit" class="btn btn-primary">{{ $isEdit ? 'ذخیره تغییرات' : 'ذخیره گروه‌بندی' }}</button>
                            <a href="{{ route('admin.specialized-course-categories.index') }}" class="btn btn-light-secondary">بازگشت</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
@endsection
