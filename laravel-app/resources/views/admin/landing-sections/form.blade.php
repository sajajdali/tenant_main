@extends('admin.layouts.app')

@section('title', 'ویرایش سکشن')

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">ویرایش سکشن {{ $section->name }}</h5>
                    <p class="text-muted mb-0">نام، وضعیت، ترتیب و محتوای این سکشن از همین صفحه قابل مدیریت است. هر بخشی که آیتم تکرارشونده دارد، می‌تواند از همین‌جا مورد جدید هم بگیرد.</p>
                </div>
                <div class="card-body">
                    <form id="landing-section-form" method="POST" action="{{ route('admin.landing-sites.sections.update', [$landingSite, $section]) }}" enctype="multipart/form-data">
                        @csrf
                        @method('PUT')

                        <div class="row g-3">
                            <div class="col-md-4">
                                <label class="form-label" for="name">نام سکشن</label>
                                <input type="text" id="name" name="name" class="form-control" value="{{ old('name', $section->name) }}" required>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="status">وضعیت</label>
                                <select id="status" name="status" class="form-select">
                                    <option value="active" @selected(old('status', $section->status) === 'active')>فعال</option>
                                    <option value="inactive" @selected(old('status', $section->status) === 'inactive')>غیرفعال</option>
                                </select>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="sort_order">ترتیب نمایش</label>
                                <input type="number" min="0" id="sort_order" name="sort_order" class="form-control" value="{{ old('sort_order', $section->sort_order) }}">
                            </div>

                            @if ($isSlider)
                                <div class="col-12"><hr></div>
                                <div class="col-md-6">
                                    <label class="form-label" for="badge_text">متن badge</label>
                                    <input type="text" id="badge_text" name="badge_text" class="form-control" value="{{ old('badge_text', $sliderContent['badgeText'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="title_line_1">عنوان اصلی</label>
                                    <input type="text" id="title_line_1" name="title_line_1" class="form-control" value="{{ old('title_line_1', $sliderContent['titleLine1'] ?? '') }}">
                                </div>

                                <div class="col-md-6">
                                    <label class="form-label" for="typing_prefix">پیشوند شعار متحرک</label>
                                    <input type="text" id="typing_prefix" name="typing_prefix" class="form-control" value="{{ old('typing_prefix', $sliderContent['typingPrefix'] ?? '') }}" placeholder="مثلاً: شده بخوای">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="typing_final_text">شعار نهایی</label>
                                    <input type="text" id="typing_final_text" name="typing_final_text" class="form-control" value="{{ old('typing_final_text', $sliderContent['typingFinalText'] ?? '') }}">
                                </div>
                                <div class="col-12">
                                    <div class="d-flex align-items-center justify-content-between mb-3">
                                        <label class="form-label mb-0">شعارهای متحرک</label>
                                        <button type="button" class="btn btn-sm btn-light-primary" data-repeatable-add="#typing-items">افزودن شعار</button>
                                    </div>
                                    @php
                                        $typingItems = old('typing_items', $sliderContent['typingItems'] ?? []);
                                        if (!is_array($typingItems) || count($typingItems) === 0) $typingItems = [''];
                                    @endphp
                                    <div id="typing-items" class="d-grid gap-2">
                                        @foreach ($typingItems as $index => $typingItem)
                                            <div class="border rounded-3 d-flex gap-2 p-2" data-repeatable-item>
                                                <input type="text" name="typing_items[{{ $index }}]" class="form-control" value="{{ $typingItem }}">
                                                <button type="button" class="btn btn-light-danger" data-repeatable-remove>حذف</button>
                                            </div>
                                        @endforeach
                                    </div>
                                    <template id="typing-items-template">
                                        <div class="border rounded-3 d-flex gap-2 p-2" data-repeatable-item>
                                            <input type="text" name="typing_items[__INDEX__]" class="form-control">
                                            <button type="button" class="btn btn-light-danger" data-repeatable-remove>حذف</button>
                                        </div>
                                    </template>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label" for="hero_image_url">آدرس عکس Hero</label>
                                    <input type="text" id="hero_image_url" name="hero_image_url" dir="ltr" class="form-control" value="{{ old('hero_image_url', $sliderContent['heroImageUrl'] ?? '') }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label" for="hero_image_file">آپلود عکس Hero</label>
                                    <input type="file" id="hero_image_file" name="hero_image_file" class="form-control" accept="image/*">
                                </div>
                                @if (!empty($sliderContent['heroImageUrl']))
                                    <div class="col-md-4"><img src="{{ $sliderContent['heroImageUrl'] }}" alt="Hero" class="img-fluid rounded-3 border" style="max-height:160px"></div>
                                @endif

                                <div class="col-md-6">
                                    <label class="form-label" for="secondary_cta_text">متن دکمه نمایش دمو</label>
                                    <input type="text" id="secondary_cta_text" name="secondary_cta_text" class="form-control" value="{{ old('secondary_cta_text', $sliderContent['secondaryCtaText'] ?? '') }}">
                                </div>
                            @elseif ($isPainPoints)
                                <div class="col-12"><hr></div>
                                <div class="col-md-3">
                                    <label class="form-label" for="pain_point_1">درد 1</label>
                                    <input type="text" id="pain_point_1" name="pain_point_1" class="form-control" value="{{ old('pain_point_1', $painPointsContent['items'][0] ?? '') }}">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label" for="pain_point_2">درد 2</label>
                                    <input type="text" id="pain_point_2" name="pain_point_2" class="form-control" value="{{ old('pain_point_2', $painPointsContent['items'][1] ?? '') }}">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label" for="pain_point_3">درد 3</label>
                                    <input type="text" id="pain_point_3" name="pain_point_3" class="form-control" value="{{ old('pain_point_3', $painPointsContent['items'][2] ?? '') }}">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label" for="pain_point_4">درد 4</label>
                                    <input type="text" id="pain_point_4" name="pain_point_4" class="form-control" value="{{ old('pain_point_4', $painPointsContent['items'][3] ?? '') }}">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label" for="pain_point_5">درد 5</label>
                                    <input type="text" id="pain_point_5" name="pain_point_5" class="form-control" value="{{ old('pain_point_5', $painPointsContent['items'][4] ?? '') }}">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label" for="pain_point_6">درد 6</label>
                                    <input type="text" id="pain_point_6" name="pain_point_6" class="form-control" value="{{ old('pain_point_6', $painPointsContent['items'][5] ?? '') }}">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label" for="pain_point_7">درد 7</label>
                                    <input type="text" id="pain_point_7" name="pain_point_7" class="form-control" value="{{ old('pain_point_7', $painPointsContent['items'][6] ?? '') }}">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label" for="pain_point_8">درد 8</label>
                                    <input type="text" id="pain_point_8" name="pain_point_8" class="form-control" value="{{ old('pain_point_8', $painPointsContent['items'][7] ?? '') }}">
                                </div>
                            @elseif ($isVideoIntro)
                                <div class="col-12"><hr></div>
                                <div class="col-md-6">
                                    <label class="form-label" for="section_title">عنوان سکشن</label>
                                    <input type="text" id="section_title" name="section_title" class="form-control" value="{{ old('section_title', $videoIntroContent['title'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="button_label">متن دکمه</label>
                                    <input type="text" id="button_label" name="button_label" class="form-control" value="{{ old('button_label', $videoIntroContent['buttonLabel'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="modal_title">عنوان مودال</label>
                                    <input type="text" id="modal_title" name="modal_title" class="form-control" value="{{ old('modal_title', $videoIntroContent['modalTitle'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="video_url">آدرس فایل ویدئوی داخلی</label>
                                    <input type="text" id="video_url" name="video_url" class="form-control" dir="ltr" value="{{ old('video_url', $videoIntroContent['videoUrl'] ?? '') }}">
                                    <small class="text-muted d-block mt-1">پیشنهاد می‌شود فایل را از بخش مقابل آپلود کنید. لینک YouTube در لندینگ پخش نمی‌شود.</small>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="video_file">آپلود ویدئو</label>
                                    <input type="file" id="video_file" name="video_file" class="form-control" accept="video/mp4,video/quicktime,video/webm,video/x-m4v,video/x-msvideo,.mp4,.mov,.webm,.m4v,.avi">
                                    <small class="text-muted d-block mt-1">فرمت‌های مجاز: mp4, mov, webm, m4v, avi تا ۶۰ مگابایت</small>
                                    <div id="video-upload-info" class="mt-3 d-none">
                                        <div class="d-flex align-items-center justify-content-between gap-3 mb-2">
                                            <strong id="video-upload-name" class="small text-truncate"></strong>
                                            <span id="video-upload-percent" class="badge bg-light-primary text-primary">۰٪</span>
                                        </div>
                                        <div class="progress" style="height:10px">
                                            <div id="video-upload-bar" class="progress-bar progress-bar-striped progress-bar-animated bg-primary" role="progressbar" style="width:0%" aria-valuemin="0" aria-valuemax="100"></div>
                                        </div>
                                        <small id="video-upload-status" class="d-block mt-2 text-muted">فایل آماده آپلود است. برای شروع، ذخیره سکشن را بزنید.</small>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label" for="cover_url">آدرس کاور ویدئو</label>
                                    <input type="text" id="cover_url" name="cover_url" class="form-control" dir="ltr" value="{{ old('cover_url', $videoIntroContent['coverUrl'] ?? '') }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label" for="cover_file">آپلود کاور ویدئو</label>
                                    <input type="file" id="cover_file" name="cover_file" class="form-control" accept="image/*">
                                </div>
                                @if (!empty($videoIntroContent['coverUrl']))
                                    <div class="col-md-4"><img src="{{ $videoIntroContent['coverUrl'] }}" alt="کاور ویدئو" class="img-fluid rounded-3 border" style="max-height:160px"></div>
                                @endif
                                @if (!empty($videoIntroContent['videoUrl']))
                                    <div class="col-md-6">
                                        <label class="form-label">ویدئوی فعلی</label>
                                        <div class="border rounded-3 p-3 bg-light-subtle">
                                            <a href="{{ $videoIntroContent['videoUrl'] }}" target="_blank" rel="noopener noreferrer" dir="ltr">{{ $videoIntroContent['videoUrl'] }}</a>
                                        </div>
                                    </div>
                                @endif
                                <div class="col-12">
                                    <label class="form-label" for="section_description">توضیح سکشن</label>
                                    <textarea id="section_description" name="section_description" rows="2" class="form-control">{{ old('section_description', $videoIntroContent['description'] ?? '') }}</textarea>
                                </div>
                                <div class="col-12">
                                    <label class="form-label" for="modal_description">توضیح مودال</label>
                                    <textarea id="modal_description" name="modal_description" rows="2" class="form-control">{{ old('modal_description', $videoIntroContent['modalDescription'] ?? '') }}</textarea>
                                </div>
                            @elseif ($isBeforeAfter)
                                <div class="col-12"><hr></div>
                                <div class="col-12">
                                    <label class="form-label" for="section_title">عنوان سکشن</label>
                                    <input type="text" id="section_title" name="section_title" class="form-control" value="{{ old('section_title', $beforeAfterContent['sectionTitle'] ?? '') }}">
                                </div>
                                <div class="col-12">
                                    <div class="d-flex align-items-center justify-content-between mb-3">
                                        <label class="form-label mb-0">آیتم‌های قبل و بعد</label>
                                        <button type="button" class="btn btn-sm btn-light-primary" data-repeatable-add="#before-after-items">افزودن آیتم</button>
                                    </div>
                                    @php
                                        $beforeAfterItems = old('items', $beforeAfterContent['items'] ?? []);
                                        if (!is_array($beforeAfterItems) || count($beforeAfterItems) === 0) {
                                            $beforeAfterItems = [['title' => '', 'description' => '']];
                                        }
                                    @endphp
                                    <div id="before-after-items" class="d-grid gap-3">
                                        @foreach ($beforeAfterItems as $index => $item)
                                            <div class="border rounded-3 p-3 bg-light-subtle">
                                                <div class="d-flex align-items-center justify-content-between mb-3">
                                                    <h6 class="mb-0">آیتم {{ $index + 1 }}</h6>
                                                    <button type="button" class="btn btn-sm btn-light-danger" data-repeatable-remove>حذف</button>
                                                </div>
                                                <div class="row g-3">
                                                    <div class="col-md-4">
                                                        <label class="form-label">عنوان</label>
                                                        <input type="text" name="items[{{ $index }}][title]" class="form-control" value="{{ $item['title'] ?? '' }}">
                                                    </div>
                                                    <div class="col-md-8">
                                                        <label class="form-label">توضیح</label>
                                                        <textarea name="items[{{ $index }}][detail]" rows="2" class="form-control">{{ $item['description'] ?? ($item['detail'] ?? '') }}</textarea>
                                                    </div>
                                                </div>
                                            </div>
                                        @endforeach
                                    </div>
                                    <template id="before-after-items-template">
                                        <div class="border rounded-3 p-3 bg-light-subtle">
                                            <div class="d-flex align-items-center justify-content-between mb-3">
                                                <h6 class="mb-0">آیتم جدید</h6>
                                                <button type="button" class="btn btn-sm btn-light-danger" data-repeatable-remove>حذف</button>
                                            </div>
                                            <div class="row g-3">
                                                <div class="col-md-4">
                                                    <label class="form-label">عنوان</label>
                                                    <input type="text" name="items[__INDEX__][title]" class="form-control">
                                                </div>
                                                <div class="col-md-8">
                                                    <label class="form-label">توضیح</label>
                                                    <textarea name="items[__INDEX__][detail]" rows="2" class="form-control"></textarea>
                                                </div>
                                            </div>
                                        </div>
                                    </template>
                                </div>
                            @elseif ($isGalleryShowcase)
                                <div class="col-12"><hr></div>
                                <div class="col-12">
                                    <div class="alert alert-light-info mb-0">
                                        این سکشن هم بخش «نمونه واقعی را ببین» را مدیریت می‌کند و هم کارت کناری «اعتمادسازی اولیه» را.
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="section_title">عنوان «نمونه واقعی را ببین»</label>
                                    <input type="text" id="section_title" name="section_title" class="form-control" placeholder="مثلا: نمونه واقعی را ببین" value="{{ old('section_title', $galleryShowcaseContent['title'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="button_label">متن دکمه «نمونه واقعی را ببین»</label>
                                    <input type="text" id="button_label" name="button_label" class="form-control" placeholder="مثلا: مشاهده نمونه سایت نوبت دهی" value="{{ old('button_label', $galleryShowcaseContent['buttonLabel'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="button_url">لینک دکمه «نمونه واقعی را ببین»</label>
                                    <input type="text" id="button_url" name="button_url" dir="ltr" class="form-control" placeholder="مثلا: /booking یا https://demo.example.com" value="{{ old('button_url', $galleryShowcaseContent['buttonUrl'] ?? '') }}">
                                </div>
                                <div class="col-md-8">
                                    <label class="form-label" for="section_description">توضیح سکشن</label>
                                    <textarea id="section_description" name="section_description" rows="2" class="form-control">{{ old('section_description', $galleryShowcaseContent['description'] ?? '') }}</textarea>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label" for="image_url">آدرس تصویر</label>
                                    <input type="text" id="image_url" name="image_url" dir="ltr" class="form-control" value="{{ old('image_url', $galleryShowcaseContent['imageUrl'] ?? '') }}">
                                    <small class="text-muted d-block mt-1">اگر تصویر آپلود کنی، همین آدرس خودکار با فایل جدید جایگزین می‌شود.</small>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label" for="image_file">آپلود تصویر</label>
                                    <input type="file" id="image_file" name="image_file" class="form-control" accept="image/*">
                                    <small class="text-muted d-block mt-1">فرمت‌های مجاز: jpg, png, webp, avif تا 8 مگابایت</small>
                                </div>
                                @if (!empty($galleryShowcaseContent['imageUrl']))
                                    <div class="col-md-4">
                                        <label class="form-label">تصویر فعلی</label>
                                        <div class="border rounded-3 p-2 bg-light-subtle">
                                            <a href="{{ $galleryShowcaseContent['imageUrl'] }}" target="_blank" rel="noopener noreferrer" class="d-inline-block mb-2 small" dir="ltr">مشاهده تصویر فعلی</a>
                                            <img src="{{ $galleryShowcaseContent['imageUrl'] }}" alt="preview" class="img-fluid rounded-3 border">
                                        </div>
                                    </div>
                                @endif
                                <div class="col-md-6">
                                    <label class="form-label" for="stats_title">عنوان «اعتمادسازی اولیه»</label>
                                    <input type="text" id="stats_title" name="stats_title" class="form-control" placeholder="مثلا: اعتمادسازی اولیه" value="{{ old('stats_title', $galleryShowcaseContent['statsTitle'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="stats_description">توضیح بخش اعتمادسازی</label>
                                    <textarea id="stats_description" name="stats_description" rows="2" class="form-control">{{ old('stats_description', $galleryShowcaseContent['statsDescription'] ?? '') }}</textarea>
                                </div>
                                <div class="col-12">
                                    <div class="d-flex align-items-center justify-content-between mb-3">
                                        <label class="form-label mb-0">آیتم‌های آمار</label>
                                        <button type="button" class="btn btn-sm btn-light-primary" data-repeatable-add="#gallery-stats-items">افزودن آمار</button>
                                    </div>
                                    @php
                                        $galleryStats = old('items', $galleryShowcaseContent['stats'] ?? []);
                                        if (!is_array($galleryStats) || count($galleryStats) === 0) {
                                            $galleryStats = [['label' => '', 'value' => '']];
                                        }
                                    @endphp
                                    <div id="gallery-stats-items" class="d-grid gap-3">
                                        @foreach ($galleryStats as $index => $item)
                                            <div class="border rounded-3 p-3 bg-light-subtle">
                                                <div class="d-flex align-items-center justify-content-between mb-3">
                                                    <h6 class="mb-0">آمار {{ $index + 1 }}</h6>
                                                    <button type="button" class="btn btn-sm btn-light-danger" data-repeatable-remove>حذف</button>
                                                </div>
                                                <div class="row g-3">
                                                    <div class="col-md-6">
                                                        <label class="form-label">عنوان آمار</label>
                                                        <input type="text" name="items[{{ $index }}][label]" class="form-control" value="{{ $item['label'] ?? '' }}">
                                                    </div>
                                                    <div class="col-md-6">
                                                        <label class="form-label">مقدار آمار</label>
                                                        <input type="text" name="items[{{ $index }}][value]" class="form-control" value="{{ $item['value'] ?? '' }}">
                                                    </div>
                                                </div>
                                            </div>
                                        @endforeach
                                    </div>
                                    <template id="gallery-stats-items-template">
                                        <div class="border rounded-3 p-3 bg-light-subtle">
                                            <div class="d-flex align-items-center justify-content-between mb-3">
                                                <h6 class="mb-0">آمار جدید</h6>
                                                <button type="button" class="btn btn-sm btn-light-danger" data-repeatable-remove>حذف</button>
                                            </div>
                                            <div class="row g-3">
                                                <div class="col-md-6">
                                                    <label class="form-label">عنوان آمار</label>
                                                    <input type="text" name="items[__INDEX__][label]" class="form-control">
                                                </div>
                                                <div class="col-md-6">
                                                    <label class="form-label">مقدار آمار</label>
                                                    <input type="text" name="items[__INDEX__][value]" class="form-control">
                                                </div>
                                            </div>
                                        </div>
                                    </template>
                                </div>
                            @elseif ($isFeatureGrid)
                                <div class="col-12"><hr></div>
                                <div class="col-md-6">
                                    <label class="form-label" for="section_title">عنوان سکشن</label>
                                    <input type="text" id="section_title" name="section_title" class="form-control" value="{{ old('section_title', $featureGridContent['title'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="view_all_label">متن دکمه مشاهده همه</label>
                                    <input type="text" id="view_all_label" name="view_all_label" class="form-control" value="{{ old('view_all_label', $featureGridContent['viewAllLabel'] ?? '') }}">
                                </div>
                                <div class="col-12">
                                    <label class="form-label" for="section_description">توضیح سکشن</label>
                                    <textarea id="section_description" name="section_description" rows="2" class="form-control">{{ old('section_description', $featureGridContent['description'] ?? '') }}</textarea>
                                </div>
                                <div class="col-12">
                                    <div class="d-flex align-items-center justify-content-between mb-3">
                                        <label class="form-label mb-0">لیست امکانات</label>
                                        <button type="button" class="btn btn-sm btn-light-primary" data-repeatable-add="#feature-grid-items">افزودن امکان</button>
                                    </div>
                                    @php
                                        $featureItems = old('items', $featureGridContent['items'] ?? []);
                                        if (!is_array($featureItems) || count($featureItems) === 0) {
                                            $featureItems = [['title' => '', 'short' => '', 'detail' => '']];
                                        }
                                    @endphp
                                    <div id="feature-grid-items" class="d-grid gap-3">
                                        @foreach ($featureItems as $index => $item)
                                            <div class="border rounded-3 p-3 bg-light-subtle">
                                                <div class="d-flex align-items-center justify-content-between mb-3">
                                                    <h6 class="mb-0">امکان {{ $index + 1 }}</h6>
                                                    <button type="button" class="btn btn-sm btn-light-danger" data-repeatable-remove>حذف</button>
                                                </div>
                                                <div class="row g-3">
                                                    <div class="col-md-3">
                                                        <label class="form-label">عنوان</label>
                                                        <input type="text" name="items[{{ $index }}][title]" class="form-control" value="{{ $item['title'] ?? '' }}">
                                                    </div>
                                                    <div class="col-md-4">
                                                        <label class="form-label">خلاصه کوتاه</label>
                                                        <input type="text" name="items[{{ $index }}][short]" class="form-control" value="{{ $item['short'] ?? '' }}">
                                                    </div>
                                                    <div class="col-md-3">
                                                        <label class="form-label">لینک صفحه امکان</label>
                                                        <input type="text" name="items[{{ $index }}][url]" dir="ltr" class="form-control" value="{{ $item['url'] ?? '' }}" placeholder="/features/example">
                                                    </div>
                                                    <div class="col-md-2 d-flex align-items-end">
                                                        <div class="form-check form-switch mb-2">
                                                            <input type="checkbox" class="form-check-input" id="feature_{{ $index }}_primary" name="items[{{ $index }}][is_primary]" value="1" @checked($item['isPrimary'] ?? false)>
                                                            <label class="form-check-label" for="feature_{{ $index }}_primary">امکان اصلی</label>
                                                        </div>
                                                    </div>
                                                    <div class="col-12">
                                                        <label class="form-label">توضیح کامل</label>
                                                        <textarea name="items[{{ $index }}][detail]" rows="2" class="form-control">{{ $item['detail'] ?? '' }}</textarea>
                                                    </div>
                                                    <div class="col-12">
                                                        <label class="form-label d-block">عکس‌های این امکان</label>
                                                        <div class="row g-3">
                                                            @php
                                                                $featureImages = array_slice(array_values(array_filter($item['imageUrls'] ?? [])), 0, 5);
                                                            @endphp
                                                            @for ($imageIndex = 0; $imageIndex < 5; $imageIndex++)
                                                                <div class="col-md-6 col-xl-4">
                                                                    <label class="form-label">عکس {{ $imageIndex + 1 }}</label>
                                                                    <input type="text" name="items[{{ $index }}][image_{{ $imageIndex + 1 }}]" dir="ltr" class="form-control" placeholder="https://..." value="{{ $featureImages[$imageIndex] ?? '' }}">
                                                                    <input type="file" name="items[{{ $index }}][image_file_{{ $imageIndex + 1 }}]" class="form-control mt-2" accept="image/*">
                                                                    @if (!empty($featureImages[$imageIndex] ?? null))
                                                                        <a href="{{ $featureImages[$imageIndex] }}" target="_blank" rel="noopener noreferrer" class="d-inline-block mt-2 small" dir="ltr">مشاهده عکس فعلی</a>
                                                                    @endif
                                                                </div>
                                                            @endfor
                                                        </div>
                                                        <small class="text-muted d-block mt-2">برای هر امکان می‌توانی از ۱ تا ۵ عکس آپلود کنی. اگر فایل جدید انتخاب نکنی، عکس قبلی یا لینک فعلی حفظ می‌شود.</small>
                                                    </div>
                                                </div>
                                            </div>
                                        @endforeach
                                    </div>
                                    <template id="feature-grid-items-template">
                                        <div class="border rounded-3 p-3 bg-light-subtle">
                                            <div class="d-flex align-items-center justify-content-between mb-3">
                                                <h6 class="mb-0">امکان جدید</h6>
                                                <button type="button" class="btn btn-sm btn-light-danger" data-repeatable-remove>حذف</button>
                                            </div>
                                            <div class="row g-3">
                                                <div class="col-md-3">
                                                    <label class="form-label">عنوان</label>
                                                    <input type="text" name="items[__INDEX__][title]" class="form-control">
                                                </div>
                                                <div class="col-md-4">
                                                    <label class="form-label">خلاصه کوتاه</label>
                                                    <input type="text" name="items[__INDEX__][short]" class="form-control">
                                                </div>
                                                <div class="col-md-3">
                                                    <label class="form-label">لینک صفحه امکان</label>
                                                    <input type="text" name="items[__INDEX__][url]" dir="ltr" class="form-control" placeholder="/features/example">
                                                </div>
                                                <div class="col-md-2 d-flex align-items-end">
                                                    <div class="form-check form-switch mb-2">
                                                        <input type="checkbox" class="form-check-input" id="feature___INDEX___primary" name="items[__INDEX__][is_primary]" value="1">
                                                        <label class="form-check-label" for="feature___INDEX___primary">امکان اصلی</label>
                                                    </div>
                                                </div>
                                                <div class="col-12">
                                                    <label class="form-label">توضیح کامل</label>
                                                    <textarea name="items[__INDEX__][detail]" rows="2" class="form-control"></textarea>
                                                </div>
                                                <div class="col-12">
                                                    <label class="form-label d-block">عکس‌های این امکان</label>
                                                    <div class="row g-3">
                                                        <div class="col-md-6 col-xl-4">
                                                            <label class="form-label">عکس 1</label>
                                                            <input type="text" name="items[__INDEX__][image_1]" dir="ltr" class="form-control" placeholder="https://...">
                                                            <input type="file" name="items[__INDEX__][image_file_1]" class="form-control mt-2" accept="image/*">
                                                        </div>
                                                        <div class="col-md-6 col-xl-4">
                                                            <label class="form-label">عکس 2</label>
                                                            <input type="text" name="items[__INDEX__][image_2]" dir="ltr" class="form-control" placeholder="https://...">
                                                            <input type="file" name="items[__INDEX__][image_file_2]" class="form-control mt-2" accept="image/*">
                                                        </div>
                                                        <div class="col-md-6 col-xl-4">
                                                            <label class="form-label">عکس 3</label>
                                                            <input type="text" name="items[__INDEX__][image_3]" dir="ltr" class="form-control" placeholder="https://...">
                                                            <input type="file" name="items[__INDEX__][image_file_3]" class="form-control mt-2" accept="image/*">
                                                        </div>
                                                        <div class="col-md-6 col-xl-4">
                                                            <label class="form-label">عکس 4</label>
                                                            <input type="text" name="items[__INDEX__][image_4]" dir="ltr" class="form-control" placeholder="https://...">
                                                            <input type="file" name="items[__INDEX__][image_file_4]" class="form-control mt-2" accept="image/*">
                                                        </div>
                                                        <div class="col-md-6 col-xl-4">
                                                            <label class="form-label">عکس 5</label>
                                                            <input type="text" name="items[__INDEX__][image_5]" dir="ltr" class="form-control" placeholder="https://...">
                                                            <input type="file" name="items[__INDEX__][image_file_5]" class="form-control mt-2" accept="image/*">
                                                        </div>
                                                    </div>
                                                    <small class="text-muted d-block mt-2">برای هر امکان می‌توانی از ۱ تا ۵ عکس آپلود کنی.</small>
                                                </div>
                                            </div>
                                        </div>
                                    </template>
                                </div>
                            @elseif ($isProcessSteps)
                                <div class="col-12"><hr></div>
                                <div class="col-12">
                                    <div class="alert alert-light-info mb-0">
                                        این بخش دقیقا فقط ۳ مرحله دارد و بیشتر از این قابل اضافه شدن نیست.
                                    </div>
                                </div>
                                @php
                                    $processItems = old('items', $processStepsContent['items'] ?? []);
                                    $processItems = is_array($processItems) ? array_values(array_slice($processItems, 0, 3)) : [];
                                    while (count($processItems) < 3) {
                                        $processItems[] = ['title' => '', 'description' => ''];
                                    }
                                @endphp
                                @foreach ($processItems as $index => $item)
                                    <div class="col-md-4">
                                        <label class="form-label">عنوان مرحله {{ $index + 1 }}</label>
                                        <input type="text" name="items[{{ $index }}][title]" class="form-control" value="{{ $item['title'] ?? '' }}">
                                    </div>
                                    <div class="col-md-8">
                                        <label class="form-label">توضیح مرحله {{ $index + 1 }}</label>
                                        <textarea name="items[{{ $index }}][detail]" rows="2" class="form-control">{{ $item['description'] ?? ($item['detail'] ?? '') }}</textarea>
                                    </div>
                                @endforeach
                            @elseif ($isPlans)
                                <div class="col-12"><hr></div>
                                <div class="col-12">
                                    <div class="alert alert-light-info mb-0">
                                        این بخش ۳ کارت ثابت دارد. قیمت هر کارت از پلنی می‌آید که انتخاب می‌کنی و بقیه متن‌ها از همین فرم قابل مدیریت هستند.
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="section_title">عنوان سکشن</label>
                                    <input type="text" id="section_title" name="section_title" class="form-control" value="{{ old('section_title', $plansContent['title'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="full_page_button_label">متن دکمه صفحه کامل پلن‌ها</label>
                                    <input type="text" id="full_page_button_label" name="full_page_button_label" class="form-control" value="{{ old('full_page_button_label', $plansContent['fullPageButtonLabel'] ?? '') }}">
                                </div>
                                <div class="col-12">
                                    <label class="form-label" for="section_description">توضیح سکشن</label>
                                    <textarea id="section_description" name="section_description" rows="2" class="form-control">{{ old('section_description', $plansContent['description'] ?? '') }}</textarea>
                                </div>
                                @php
                                    $planCards = old('cards', $plansContent['cards'] ?? []);
                                    $planCards = is_array($planCards) ? array_values(array_slice($planCards, 0, 3)) : [];
                                    while (count($planCards) < 3) {
                                        $planCards[] = ['packageId' => '', 'title' => '', 'description' => '', 'badgeText' => '', 'buttonText' => 'ثبت سفارش', 'buttonVariant' => 'default', 'featured' => false, 'showOnHome' => true, 'features' => []];
                                    }
                                @endphp
                                @foreach ($planCards as $index => $card)
                                    <div class="col-12">
                                        <div class="border rounded-3 p-3 bg-light-subtle">
                                            <h6 class="mb-3">کارت پلن {{ $index + 1 }}</h6>
                                            <div class="row g-3">
                                                <div class="col-md-6">
                                                    <label class="form-label">اتصال به پلن واقعی</label>
                                                    <select name="cards[{{ $index }}][package_id]" class="form-select">
                                                        <option value="">انتخاب پلن</option>
                                                        @foreach ($packageOptions as $packageOption)
                                                            <option value="{{ $packageOption['id'] }}" @selected((string) old("cards.$index.package_id", $card['packageId'] ?? '') === (string) $packageOption['id'])>{{ $packageOption['label'] }}</option>
                                                        @endforeach
                                                    </select>
                                                </div>
                                                <div class="col-md-6">
                                                    <label class="form-label">عنوان کارت</label>
                                                    <input type="text" name="cards[{{ $index }}][title]" class="form-control" value="{{ old("cards.$index.title", $card['title'] ?? '') }}">
                                                </div>
                                                <div class="col-md-6">
                                                    <label class="form-label">توضیح کارت</label>
                                                    <textarea name="cards[{{ $index }}][description]" rows="2" class="form-control">{{ old("cards.$index.description", $card['description'] ?? '') }}</textarea>
                                                </div>
                                                <div class="col-md-3">
                                                    <label class="form-label">متن badge</label>
                                                    <input type="text" name="cards[{{ $index }}][badge_text]" class="form-control" value="{{ old("cards.$index.badge_text", $card['badgeText'] ?? '') }}">
                                                </div>
                                                <div class="col-md-3">
                                                    <label class="form-label">متن دکمه</label>
                                                    <input type="text" name="cards[{{ $index }}][button_text]" class="form-control" value="{{ old("cards.$index.button_text", $card['buttonText'] ?? 'ثبت سفارش') }}">
                                                </div>
                                                <div class="col-md-3">
                                                    <label class="form-label">استایل دکمه</label>
                                                    <select name="cards[{{ $index }}][button_variant]" class="form-select">
                                                        <option value="default" @selected(old("cards.$index.button_variant", $card['buttonVariant'] ?? 'default') === 'default')>پیش‌فرض</option>
                                                        <option value="outline" @selected(old("cards.$index.button_variant", $card['buttonVariant'] ?? 'default') === 'outline')>Outline</option>
                                                    </select>
                                                </div>
                                                <div class="col-md-3 d-flex align-items-end">
                                                    <div class="form-check form-switch">
                                                        <input class="form-check-input" type="checkbox" id="cards_{{ $index }}_featured" name="cards[{{ $index }}][featured]" value="1" @checked(old("cards.$index.featured", $card['featured'] ?? false))>
                                                        <label class="form-check-label" for="cards_{{ $index }}_featured">پیشنهادی باشد</label>
                                                    </div>
                                                </div>
                                                <div class="col-md-3 d-flex align-items-end">
                                                    <div class="form-check form-switch">
                                                        <input class="form-check-input" type="checkbox" id="cards_{{ $index }}_show_on_home" name="cards[{{ $index }}][show_on_home]" value="1" @checked(old("cards.$index.show_on_home", $card['showOnHome'] ?? true))>
                                                        <label class="form-check-label" for="cards_{{ $index }}_show_on_home">نمایش در صفحه اصلی</label>
                                                    </div>
                                                </div>
                                                @php
                                                    $cardFeatures = array_values(array_slice((array) ($card['features'] ?? []), 0, 3));
                                                @endphp
                                                <div class="col-md-4">
                                                    <label class="form-label">ویژگی 1</label>
                                                    <input type="text" name="cards[{{ $index }}][feature_1]" class="form-control" value="{{ old("cards.$index.feature_1", $cardFeatures[0] ?? '') }}">
                                                </div>
                                                <div class="col-md-4">
                                                    <label class="form-label">ویژگی 2</label>
                                                    <input type="text" name="cards[{{ $index }}][feature_2]" class="form-control" value="{{ old("cards.$index.feature_2", $cardFeatures[1] ?? '') }}">
                                                </div>
                                                <div class="col-md-4">
                                                    <label class="form-label">ویژگی 3</label>
                                                    <input type="text" name="cards[{{ $index }}][feature_3]" class="form-control" value="{{ old("cards.$index.feature_3", $cardFeatures[2] ?? '') }}">
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                @endforeach
                            @elseif ($isFaq)
                                <div class="col-12"><hr></div>
                                <div class="col-md-6">
                                    <label class="form-label" for="section_title">عنوان سکشن</label>
                                    <input type="text" id="section_title" name="section_title" class="form-control" value="{{ old('section_title', $faqContent['title'] ?? 'سوالات متداول') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="section_description">توضیح سکشن</label>
                                    <input type="text" id="section_description" name="section_description" class="form-control" value="{{ old('section_description', $faqContent['description'] ?? '') }}">
                                </div>
                                <div class="col-12">
                                    <div class="d-flex align-items-center justify-content-between mb-3">
                                        <div class="alert alert-light-info mb-0 flex-grow-1">
                                            برای هر سوال می‌توانی تعیین کنی در صفحه اصلی هم نمایش داده شود یا فقط در صفحه سوالات متداول بماند.
                                        </div>
                                        <button type="button" class="btn btn-sm btn-light-primary ms-3" data-repeatable-add="#faq-items">افزودن سوال</button>
                                    </div>
                                    @php
                                        $faqItems = old('faq_items', $faqContent['items'] ?? []);
                                        if (!is_array($faqItems) || count($faqItems) === 0) {
                                            $faqItems = [['question' => '', 'answer' => '', 'sortOrder' => 10, 'showOnHome' => true]];
                                        }
                                    @endphp
                                    <div id="faq-items" class="d-grid gap-3">
                                        @foreach ($faqItems as $index => $item)
                                            <div class="border rounded-3 p-3 bg-light-subtle">
                                                <div class="d-flex align-items-center justify-content-between mb-3">
                                                    <h6 class="mb-0">سوال {{ $index + 1 }}</h6>
                                                    <button type="button" class="btn btn-sm btn-light-danger" data-repeatable-remove>حذف</button>
                                                </div>
                                                <div class="row g-3">
                                                    <div class="col-md-8">
                                                        <label class="form-label">متن سوال</label>
                                                        <input type="text" name="faq_items[{{ $index }}][question]" class="form-control" value="{{ $item['question'] ?? '' }}">
                                                    </div>
                                                    <div class="col-md-2">
                                                        <label class="form-label">ترتیب</label>
                                                        <input type="number" min="0" name="faq_items[{{ $index }}][sort_order]" class="form-control" value="{{ $item['sortOrder'] ?? ($item['sort_order'] ?? 0) }}">
                                                    </div>
                                                    <div class="col-md-2 d-flex align-items-end">
                                                        <div class="form-check form-switch">
                                                            <input class="form-check-input" type="checkbox" id="faq_items_{{ $index }}_show_on_home" name="faq_items[{{ $index }}][show_on_home]" value="1" @checked(old("faq_items.$index.show_on_home", $item['showOnHome'] ?? false))>
                                                            <label class="form-check-label" for="faq_items_{{ $index }}_show_on_home">صفحه اصلی</label>
                                                        </div>
                                                    </div>
                                                    <div class="col-12">
                                                        <label class="form-label">پاسخ سوال</label>
                                                        <textarea name="faq_items[{{ $index }}][answer]" rows="3" class="form-control">{{ $item['answer'] ?? '' }}</textarea>
                                                    </div>
                                                </div>
                                            </div>
                                        @endforeach
                                    </div>
                                    <template id="faq-items-template">
                                        <div class="border rounded-3 p-3 bg-light-subtle">
                                            <div class="d-flex align-items-center justify-content-between mb-3">
                                                <h6 class="mb-0">سوال جدید</h6>
                                                <button type="button" class="btn btn-sm btn-light-danger" data-repeatable-remove>حذف</button>
                                            </div>
                                            <div class="row g-3">
                                                <div class="col-md-8">
                                                    <label class="form-label">متن سوال</label>
                                                    <input type="text" name="faq_items[__INDEX__][question]" class="form-control">
                                                </div>
                                                <div class="col-md-2">
                                                    <label class="form-label">ترتیب</label>
                                                    <input type="number" min="0" name="faq_items[__INDEX__][sort_order]" class="form-control" value="0">
                                                </div>
                                                <div class="col-md-2 d-flex align-items-end">
                                                    <div class="form-check form-switch">
                                                        <input class="form-check-input" type="checkbox" id="faq_items___INDEX___show_on_home" name="faq_items[__INDEX__][show_on_home]" value="1">
                                                        <label class="form-check-label" for="faq_items___INDEX___show_on_home">صفحه اصلی</label>
                                                    </div>
                                                </div>
                                                <div class="col-12">
                                                    <label class="form-label">پاسخ سوال</label>
                                                    <textarea name="faq_items[__INDEX__][answer]" rows="3" class="form-control"></textarea>
                                                </div>
                                            </div>
                                        </div>
                                    </template>
                                </div>
                            @elseif ($isFooterCta)
                                <div class="col-12"><hr></div>
                                <div class="col-12">
                                    <div class="alert alert-light-info mb-0">
                                        متن این بخش در فوتر صفحه اصلی نمایش داده می‌شود.
                                    </div>
                                </div>
                                <div class="col-12">
                                    <label class="form-label" for="section_title">متن فوتر دعوت به اقدام</label>
                                    <input type="text" id="section_title" name="section_title" class="form-control" value="{{ old('section_title', $footerCtaContent['title'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="button_label">متن دکمه</label>
                                    <input type="text" id="button_label" name="button_label" class="form-control" value="{{ old('button_label', $footerCtaContent['buttonText'] ?? 'شروع خرید پکیج') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="button_url">لینک دکمه</label>
                                    <input type="text" id="button_url" name="button_url" dir="ltr" class="form-control" value="{{ old('button_url', $footerCtaContent['buttonUrl'] ?? '/plans') }}">
                                </div>
                                <div class="col-12">
                                    <label class="form-label" for="copyright_text">متن کپی‌رایت</label>
                                    <input type="text" id="copyright_text" name="copyright_text" class="form-control" value="{{ old('copyright_text', $footerCtaContent['copyrightText'] ?? '© پله — تمامی حقوق محفوظ است.') }}">
                                </div>
                            @else
                                <div class="col-12">
                                    <div class="alert alert-light-warning mb-0">
                                        ویرایش محتوای کامل این سکشن در گام بعدی روی همین ساختار اضافه می‌شود. فعلا نام، وضعیت و ترتیب این سکشن از لیست اصلی قابل کنترل است.
                                    </div>
                                </div>
                            @endif
                        </div>

                        <div class="mt-4 d-flex gap-2">
                            <button type="submit" class="btn btn-primary">ذخیره سکشن</button>
                            <a href="{{ route('admin.landing-sites.sections.index', $landingSite) }}" class="btn btn-light-secondary">بازگشت</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
@endsection

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            const form = document.getElementById('landing-section-form');
            const videoInput = document.getElementById('video_file');
            const uploadInfo = document.getElementById('video-upload-info');
            const uploadName = document.getElementById('video-upload-name');
            const uploadPercent = document.getElementById('video-upload-percent');
            const uploadBar = document.getElementById('video-upload-bar');
            const uploadStatus = document.getElementById('video-upload-status');

            if (form && videoInput && uploadInfo) {
                videoInput.addEventListener('change', function () {
                    const file = videoInput.files && videoInput.files[0];
                    if (!file) {
                        uploadInfo.classList.add('d-none');
                        return;
                    }
                    const extension = (file.name.split('.').pop() || '').toLowerCase();
                    if (!['mp4', 'mov', 'webm', 'm4v', 'avi'].includes(extension)) {
                        videoInput.value = '';
                        alert('فرمت فایل ویدئو مجاز نیست. فایل MP4، MOV، WebM، M4V یا AVI انتخاب کنید.');
                        return;
                    }
                    if (file.size > 60 * 1024 * 1024) {
                        videoInput.value = '';
                        alert('حجم ویدئو نباید بیشتر از ۶۰ مگابایت باشد.');
                        return;
                    }
                    uploadInfo.classList.remove('d-none');
                    uploadName.textContent = file.name + ' — ' + (file.size / 1024 / 1024).toFixed(1) + ' MB';
                    uploadPercent.textContent = '۰٪';
                    uploadBar.style.width = '0%';
                    uploadStatus.textContent = 'فایل آماده آپلود است. برای شروع، ذخیره سکشن را بزنید.';
                });

                form.addEventListener('submit', function (event) {
                    const file = videoInput.files && videoInput.files[0];
                    if (!file) return;
                    event.preventDefault();
                    const submitButton = form.querySelector('button[type="submit"]');
                    if (submitButton) submitButton.disabled = true;
                    uploadInfo.classList.remove('d-none');
                    uploadStatus.textContent = 'در حال آپلود ویدئو؛ این صفحه را نبندید...';
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', form.action, true);
                    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                    xhr.upload.addEventListener('progress', function (progressEvent) {
                        if (!progressEvent.lengthComputable) return;
                        const percent = Math.min(100, Math.round((progressEvent.loaded / progressEvent.total) * 100));
                        uploadBar.style.width = percent + '%';
                        uploadBar.setAttribute('aria-valuenow', String(percent));
                        uploadPercent.textContent = new Intl.NumberFormat('fa-IR').format(percent) + '٪';
                        uploadStatus.textContent = percent < 100 ? 'در حال ارسال فایل...' : 'فایل ارسال شد؛ در حال ذخیره‌سازی...';
                    });
                    xhr.addEventListener('load', function () {
                        if (xhr.status >= 200 && xhr.status < 400) {
                            uploadBar.classList.remove('progress-bar-animated');
                            uploadBar.classList.add('bg-success');
                            uploadStatus.className = 'd-block mt-2 text-success';
                            uploadStatus.textContent = 'ویدئو با موفقیت آپلود و ذخیره شد.';
                            window.setTimeout(function () { window.location.href = xhr.responseURL || window.location.href; }, 700);
                            return;
                        }
                        if (submitButton) submitButton.disabled = false;
                        uploadBar.classList.add('bg-danger');
                        uploadStatus.className = 'd-block mt-2 text-danger';
                        uploadStatus.textContent = xhr.status === 413 ? 'حجم فایل بیشتر از محدودیت سرور است.' : 'آپلود انجام نشد. لطفاً دوباره تلاش کنید.';
                    });
                    xhr.addEventListener('error', function () {
                        if (submitButton) submitButton.disabled = false;
                        uploadStatus.className = 'd-block mt-2 text-danger';
                        uploadStatus.textContent = 'ارتباط هنگام آپلود قطع شد. دوباره تلاش کنید.';
                    });
                    xhr.send(new FormData(form));
                });
            }

            document.querySelectorAll('[data-repeatable-add]').forEach(function (button) {
                button.addEventListener('click', function () {
                    const targetSelector = button.getAttribute('data-repeatable-add');
                    if (!targetSelector) return;

                    const container = document.querySelector(targetSelector);
                    const template = document.querySelector(`${targetSelector}-template`);
                    if (!container || !template) return;

                    const nextIndex = container.children.length;
                    const html = template.innerHTML.replaceAll('__INDEX__', String(nextIndex));
                    container.insertAdjacentHTML('beforeend', html);
                });
            });

            document.addEventListener('click', function (event) {
                const button = event.target.closest('[data-repeatable-remove]');
                if (!button) return;

                const item = button.closest('.border.rounded-3');
                if (item) {
                    item.remove();
                }
            });
        });
    </script>
@endpush
