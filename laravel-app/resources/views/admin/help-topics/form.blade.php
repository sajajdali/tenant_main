@extends('admin.layouts.app')

@section('title', $isEdit ? 'ویرایش آموزش' : 'افزودن آموزش')

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">{{ $isEdit ? 'ویرایش آموزش' : 'افزودن آموزش' }}</h5>
                    <p class="text-muted mb-0">هر آموزش می‌تواند عمومی باشد یا فقط برای یک طیف خاص نمایش داده شود.</p>
                </div>
                <div class="card-body">
                    <form method="POST" enctype="multipart/form-data" action="{{ $isEdit ? route('admin.help-topics.update', $topic) : route('admin.help-topics.store') }}">
                        @csrf
                        @if ($isEdit)
                            @method('PUT')
                        @endif

                        <div class="row g-3">
                            <div class="col-md-6">
                                <label class="form-label" for="title">عنوان آموزش</label>
                                <input type="text" id="title" name="title" class="form-control" value="{{ old('title', $topic->title) }}" required>
                            </div>

                            <div class="col-md-6">
                                <label class="form-label" for="topic_key">کلید صفحه / Topic Key</label>
                                <input
                                    type="text"
                                    id="topic_key"
                                    name="topic_key"
                                    class="form-control"
                                    dir="ltr"
                                    value="{{ old('topic_key', $topic->topic_key) }}"
                                    placeholder="panel/nutrition/tokens"
                                    required
                                >
                                <small class="text-muted">همین کلید از فرانت برای لینک آموزش صفحه استفاده می‌شود.</small>
                            </div>

                            <div class="col-md-4">
                                <label class="form-label" for="module_key">ماژول</label>
                                <input
                                    type="text"
                                    id="module_key"
                                    name="module_key"
                                    class="form-control"
                                    dir="ltr"
                                    value="{{ old('module_key', $topic->module_key) }}"
                                    placeholder="nutrition"
                                >
                            </div>

                            <div class="col-md-4">
                                <label class="form-label" for="audience_type_id">طیف مخاطب</label>
                                <select id="audience_type_id" name="audience_type_id" class="form-select">
                                    <option value="">عمومی برای همه طیف‌ها</option>
                                    @foreach ($audiences as $audience)
                                        <option value="{{ $audience->id }}" @selected((string) old('audience_type_id', $topic->audience_type_id) === (string) $audience->id)>
                                            {{ $audience->name }} @if($audience->slug) ({{ $audience->slug }}) @endif
                                        </option>
                                    @endforeach
                                </select>
                            </div>

                            <div class="col-md-4">
                                <label class="form-label" for="sort_order">ترتیب نمایش</label>
                                <input type="number" min="0" id="sort_order" name="sort_order" class="form-control" value="{{ old('sort_order', $topic->sort_order ?? 0) }}">
                            </div>

                            <div class="col-12">
                                <label class="form-label" for="summary">توضیح کوتاه</label>
                                <textarea id="summary" name="summary" rows="3" class="form-control">{{ old('summary', $topic->summary) }}</textarea>
                            </div>

                            <div class="col-12">
                                <label class="form-label" for="body">توضیحات کامل</label>
                                <textarea id="body" name="body" rows="8" class="form-control">{{ old('body', $topic->body) }}</textarea>
                                <small class="text-muted">این متن در صفحه جزئیات راهنما نمایش داده می‌شود.</small>
                            </div>

                            <div class="col-md-6">
                                <label class="form-label" for="video_url">لینک ویدئو</label>
                                <input
                                    type="url"
                                    id="video_url"
                                    name="video_url"
                                    class="form-control"
                                    dir="ltr"
                                    value="{{ old('video_url', $topic->video_url) }}"
                                    placeholder="https://..."
                                >
                                <small class="text-muted">اگر ویدئو را آپلود کنید، لینک خارجی همچنان می‌تواند به‌عنوان جایگزین ذخیره شود.</small>
                            </div>

                            <div class="col-md-6">
                                <label class="form-label" for="video_file">آپلود ویدئو</label>
                                <input type="file" id="video_file" name="video_file" class="form-control" accept="video/mp4,video/webm,video/quicktime,video/x-m4v">
                                @if ($topic->video_path)
                                    <small class="d-block mt-1">
                                        ویدئوی فعلی:
                                        <a href="{{ $topic->videoUrl() }}" target="_blank" dir="ltr">{{ $topic->video_path }}</a>
                                    </small>
                                @endif
                            </div>

                            <div class="col-md-6">
                                <label class="form-label" for="cover_image">تصویر کاور</label>
                                <input type="file" id="cover_image" name="cover_image" class="form-control" accept="image/*">
                                @if ($topic->coverImageUrl())
                                    <div class="mt-2">
                                        <img src="{{ $topic->coverImageUrl() }}" alt="{{ $topic->title }}" class="rounded" style="max-height: 120px;">
                                    </div>
                                @endif
                            </div>

                            <div class="col-md-6">
                                <div class="border rounded-3 p-3 h-100">
                                    <div class="form-check form-switch mb-3">
                                        <input class="form-check-input" type="checkbox" role="switch" id="is_active" name="is_active" value="1" @checked(old('is_active', $topic->is_active))>
                                        <label class="form-check-label" for="is_active">فعال باشد</label>
                                    </div>
                                    <div class="form-check form-switch mb-3">
                                        <input class="form-check-input" type="checkbox" role="switch" id="show_in_help_center" name="show_in_help_center" value="1" @checked(old('show_in_help_center', $topic->show_in_help_center))>
                                        <label class="form-check-label" for="show_in_help_center">در صفحه مرکز راهنما نمایش داده شود</label>
                                    </div>
                                    <div class="form-check form-switch">
                                        <input class="form-check-input" type="checkbox" role="switch" id="show_in_page_header" name="show_in_page_header" value="1" @checked(old('show_in_page_header', $topic->show_in_page_header))>
                                        <label class="form-check-label" for="show_in_page_header">دکمه آموزش در هدر صفحه فعال باشد</label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="mt-4 d-flex gap-2">
                            <button type="submit" class="btn btn-primary">{{ $isEdit ? 'ذخیره تغییرات' : 'ذخیره آموزش' }}</button>
                            <a href="{{ route('admin.help-topics.index') }}" class="btn btn-light-secondary">بازگشت</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
@endsection
