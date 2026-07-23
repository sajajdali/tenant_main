@php
    $specializedCourseSettings = old('specialized_course_settings', $specializedCourseSettings ?? []);
    $specializedSections = $specializedCourseSettings['sections'] ?? [];
    $heroStats = $specializedCourseSettings['hero']['stats'] ?? [];
    $carouselCards = $specializedCourseSettings['carousel']['side_cards'] ?? [];
    $carouselSlides = $specializedCourseSettings['carousel']['slides'] ?? [];
    $highlightItems = $specializedCourseSettings['highlight_banner']['items'] ?? [];
    $faqItems = $specializedCourseSettings['faq']['items'] ?? [];
    $availableCourses = collect($availableCourses ?? []);
    $labelFields = [
        'course_video_label' => 'برچسب ویدیوی کارت دوره',
        'students_label' => 'عنوان تعداد هنرجو/فراگیر',
        'certificate_badge' => 'بج گواهی‌نامه',
        'popular_badge' => 'بج محبوبیت',
        'view_course_cta' => 'متن دکمه مشاهده دوره',
        'purchased_badge' => 'بج دوره خریداری‌شده',
        'progress_label' => 'برچسب پیشرفت',
        'continue_path_label' => 'برچسب ادامه مسیر',
        'continue_learning_cta' => 'متن دکمه ادامه یادگیری',
        'learning_status_text' => 'متن وضعیت یادگیری',
        'more_button' => 'متن دکمه بیشتر',
        'empty_state' => 'پیام خالی بودن لیست',
        'active_courses_suffix' => 'پسوند تعداد دوره فعال',
    ];
    $settingsSections = [
        ['id' => 'header-access', 'title' => 'سربرگ و دسترسی', 'description' => 'متن‌های ثابت ابتدای صفحه، جستجو و عدم دسترسی'],
        ['id' => 'hero', 'title' => 'بنر معرفی', 'description' => 'عنوان اصلی مثل "کتابخانه آموزش‌های کاربردی..." و آمارها'],
        ['id' => 'purchased', 'title' => 'دوره‌های خریداری‌شده', 'description' => 'عنوان، توضیح و فعال یا غیرفعال بودن'],
        ['id' => 'carousel', 'title' => 'پیشنهادهای منتخب', 'description' => 'عنوان، توضیح، اسلایدها و فعال یا غیرفعال بودن'],
        ['id' => 'categories-sections', 'title' => 'دسته‌بندی‌ها و سکشن‌ها', 'description' => 'متن دسته‌بندی‌ها و سکشن‌های لیست دوره'],
        ['id' => 'highlight-banner', 'title' => 'بنر میانی', 'description' => 'بنر مسیر رشد و آیتم‌های کوتاه آن'],
        ['id' => 'faq', 'title' => 'سوالات متداول', 'description' => 'FAQ صفحه اصلی هر طیف'],
        ['id' => 'labels', 'title' => 'دکمه‌ها و لیبل‌ها', 'description' => 'تمام متن‌های ثابت ریز در کارت‌ها و CTAها'],
    ];
@endphp

@if (! empty($isStandalonePage))
    <style>
        .specialized-settings-nav-card {
            display: block;
            height: 100%;
            text-decoration: none;
            color: inherit;
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 18px;
            padding: 1rem;
            background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,250,252,0.98));
            transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }

        .specialized-settings-nav-card:hover {
            transform: translateY(-2px);
            border-color: rgba(37, 99, 235, 0.28);
            box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
        }

        .specialized-settings-anchor {
            scroll-margin-top: 110px;
        }
    </style>

    <div class="row g-3 mb-4">
        @foreach ($settingsSections as $item)
            <div class="col-md-6 col-xl-3">
                <a href="#{{ $item['id'] }}" class="specialized-settings-nav-card">
                    <div class="small text-primary fw-semibold mb-2">سکشن</div>
                    <div class="fw-bold mb-2">{{ $item['title'] }}</div>
                    <div class="text-muted small">{{ $item['description'] }}</div>
                </a>
            </div>
        @endforeach
    </div>

    <div class="alert alert-info d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
        <div>
            <div class="fw-bold mb-1">مدیریت محتوا از مدیریت دوره و گروه‌بندی جداست</div>
            <div class="small">خود دوره‌ها و گروه‌بندی‌ها از بخش‌های مدیریت دوره‌ها کنترل می‌شوند. این صفحه فقط متن‌های ثابت و فعال یا غیرفعال بودن سکشن‌ها را برای هر طیف مدیریت می‌کند.</div>
        </div>
        <div class="d-flex flex-wrap gap-2">
            <a href="{{ route('admin.specialized-courses.index') }}" class="btn btn-sm btn-light-primary">مدیریت دوره‌ها</a>
            <a href="{{ route('admin.specialized-course-categories.index') }}" class="btn btn-sm btn-light-secondary">مدیریت گروه‌بندی‌ها</a>
        </div>
    </div>
@endif

<div class="row g-3">
    <div class="col-12 specialized-settings-anchor" id="header-access">
        <div class="card shadow-none border">
            <div class="card-header">
                <h6 class="mb-1">سربرگ صفحه و دسترسی</h6>
                <p class="text-muted mb-0 small">متن بالای صفحه، جستجو و پیام عدم دسترسی از این بخش خوانده می‌شود.</p>
            </div>
            <div class="card-body">
                <div class="row g-3">
                    <div class="col-12">
                        <div class="rounded-3 border bg-light p-3">
                            <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
                                <div>
                                    <div class="fw-bold mb-1">فعال بودن دوره‌های تخصصی برای این طیف</div>
                                    <div class="text-muted small">پیش‌فرض برای همه طیف‌ها غیرفعال است. وقتی غیرفعال باشد، کاربر پیام «به زودی» را در پنل می‌بیند.</div>
                                </div>
                                <div class="form-check form-switch mb-0">
                                    <input type="hidden" name="specialized_course_settings[enabled]" value="0">
                                    <input class="form-check-input" type="checkbox" role="switch" id="specialized_courses_enabled" name="specialized_course_settings[enabled]" value="1" @checked((bool) data_get($specializedCourseSettings, 'enabled', false))>
                                    <label class="form-check-label" for="specialized_courses_enabled">فعال باشد</label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-5">
                        <label class="form-label">عنوان حالت غیرفعال</label>
                        <input type="text" name="specialized_course_settings[disabled][title]" class="form-control" value="{{ data_get($specializedCourseSettings, 'disabled.title') }}">
                    </div>
                    <div class="col-md-7">
                        <label class="form-label">توضیح حالت غیرفعال</label>
                        <textarea name="specialized_course_settings[disabled][description]" class="form-control" rows="2">{{ data_get($specializedCourseSettings, 'disabled.description') }}</textarea>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">متن بالای عنوان</label>
                        <input type="text" name="specialized_course_settings[header][eyebrow]" class="form-control" value="{{ data_get($specializedCourseSettings, 'header.eyebrow') }}">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">عنوان اصلی صفحه</label>
                        <input type="text" name="specialized_course_settings[header][title]" class="form-control" value="{{ data_get($specializedCourseSettings, 'header.title') }}">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">متن جستجو</label>
                        <input type="text" name="specialized_course_settings[search][placeholder]" class="form-control" value="{{ data_get($specializedCourseSettings, 'search.placeholder') }}">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">عنوان عدم دسترسی</label>
                        <input type="text" name="specialized_course_settings[access][title]" class="form-control" value="{{ data_get($specializedCourseSettings, 'access.title') }}">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">توضیح عدم دسترسی</label>
                        <textarea name="specialized_course_settings[access][description]" class="form-control" rows="2">{{ data_get($specializedCourseSettings, 'access.description') }}</textarea>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="col-12 specialized-settings-anchor" id="hero">
        <div class="card shadow-none border">
            <div class="card-header">
                <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
                    <div>
                        <h6 class="mb-1">بنر معرفی بالای صفحه</h6>
                        <p class="text-muted mb-0 small">متن اصلی مثل «کتابخانه آموزش‌های کاربردی برای رشد واقعی سالن» و آمارهای کنار آن را اینجا کنترل کنید.</p>
                    </div>
                    <div class="form-check form-switch">
                        <input type="hidden" name="specialized_course_settings[hero][enabled]" value="0">
                        <input class="form-check-input" type="checkbox" role="switch" id="specialized_hero_enabled" name="specialized_course_settings[hero][enabled]" value="1" @checked((bool) data_get($specializedCourseSettings, 'hero.enabled', true))>
                        <label class="form-check-label" for="specialized_hero_enabled">نمایش این بخش</label>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <div class="row g-3">
                    <div class="col-md-4">
                        <label class="form-label">بج بنر</label>
                        <input type="text" name="specialized_course_settings[hero][badge]" class="form-control" value="{{ data_get($specializedCourseSettings, 'hero.badge') }}">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">عنوان بنر</label>
                        <input type="text" name="specialized_course_settings[hero][title]" class="form-control" value="{{ data_get($specializedCourseSettings, 'hero.title') }}">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">توضیح بنر</label>
                        <textarea name="specialized_course_settings[hero][description]" class="form-control" rows="2">{{ data_get($specializedCourseSettings, 'hero.description') }}</textarea>
                    </div>
                    @foreach ($heroStats as $index => $item)
                        <div class="col-md-4">
                            <input type="hidden" name="specialized_course_settings[hero][stats][{{ $index }}][id]" value="{{ $item['id'] ?? ('hero-stat-' . ($index + 1)) }}">
                            <label class="form-label">عدد آماری {{ $index + 1 }}</label>
                            <input type="text" name="specialized_course_settings[hero][stats][{{ $index }}][value]" class="form-control mb-2" value="{{ $item['value'] ?? '' }}" placeholder="مثلاً +۳۵">
                            <input type="text" name="specialized_course_settings[hero][stats][{{ $index }}][label]" class="form-control" value="{{ $item['label'] ?? '' }}" placeholder="توضیح آمار">
                        </div>
                    @endforeach
                </div>
            </div>
        </div>
    </div>

    <div class="col-12 specialized-settings-anchor" id="purchased">
        <div class="card shadow-none border">
            <div class="card-header">
                <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
                    <div>
                        <h6 class="mb-1">بخش دوره‌های خریداری‌شده</h6>
                        <p class="text-muted mb-0 small">عنوان و توضیح سکشن دوره‌های خریداری‌شده مخصوص همین طیف.</p>
                    </div>
                    <div class="form-check form-switch">
                        <input type="hidden" name="specialized_course_settings[purchased][enabled]" value="0">
                        <input class="form-check-input" type="checkbox" role="switch" id="specialized_purchased_enabled" name="specialized_course_settings[purchased][enabled]" value="1" @checked((bool) data_get($specializedCourseSettings, 'purchased.enabled', true))>
                        <label class="form-check-label" for="specialized_purchased_enabled">نمایش این بخش</label>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <div class="row g-3">
                    <div class="col-md-6">
                        <label class="form-label">عنوان سکشن</label>
                        <input type="text" name="specialized_course_settings[purchased][title]" class="form-control" value="{{ data_get($specializedCourseSettings, 'purchased.title') }}">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">توضیح سکشن</label>
                        <textarea name="specialized_course_settings[purchased][description]" class="form-control" rows="2">{{ data_get($specializedCourseSettings, 'purchased.description') }}</textarea>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="col-12 specialized-settings-anchor" id="carousel">
        <div class="card shadow-none border">
            <div class="card-header">
                <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
                    <div>
                        <h6 class="mb-1">اسلایدر پیشنهادهای منتخب</h6>
                        <p class="text-muted mb-0 small">برای هر اسلاید می‌توانید یک دوره واقعی انتخاب کنید. اگر عنوان، توضیح یا تصویر را خالی بگذارید از داده همان دوره استفاده می‌شود.</p>
                    </div>
                    <div class="form-check form-switch">
                        <input type="hidden" name="specialized_course_settings[carousel][enabled]" value="0">
                        <input class="form-check-input" type="checkbox" role="switch" id="specialized_carousel_enabled" name="specialized_course_settings[carousel][enabled]" value="1" @checked((bool) data_get($specializedCourseSettings, 'carousel.enabled', true))>
                        <label class="form-check-label" for="specialized_carousel_enabled">نمایش این بخش</label>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <div class="row g-3 mb-3">
                    <div class="col-md-6">
                        <label class="form-label">عنوان سکشن</label>
                        <input type="text" name="specialized_course_settings[carousel][title]" class="form-control" value="{{ data_get($specializedCourseSettings, 'carousel.title') }}">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">توضیح سکشن</label>
                        <textarea name="specialized_course_settings[carousel][description]" class="form-control" rows="2">{{ data_get($specializedCourseSettings, 'carousel.description') }}</textarea>
                    </div>
                </div>

                <div class="row g-3 mb-3">
                    @foreach ($carouselCards as $index => $item)
                        <div class="col-md-6">
                            <div class="border rounded p-3 h-100">
                                <input type="hidden" name="specialized_course_settings[carousel][side_cards][{{ $index }}][id]" value="{{ $item['id'] ?? ('carousel-card-' . ($index + 1)) }}">
                                <label class="form-label">تیتر کارت {{ $index + 1 }}</label>
                                <input type="text" name="specialized_course_settings[carousel][side_cards][{{ $index }}][eyebrow]" class="form-control mb-2" value="{{ $item['eyebrow'] ?? '' }}" placeholder="مثلاً مسیر یادگیری">
                                <input type="text" name="specialized_course_settings[carousel][side_cards][{{ $index }}][title]" class="form-control mb-2" value="{{ $item['title'] ?? '' }}" placeholder="عنوان کارت">
                                <textarea name="specialized_course_settings[carousel][side_cards][{{ $index }}][description]" class="form-control" rows="2" placeholder="توضیح کارت">{{ $item['description'] ?? '' }}</textarea>
                            </div>
                        </div>
                    @endforeach
                </div>

                <div class="row g-3">
                    @foreach ($carouselSlides as $index => $item)
                        <div class="col-12">
                            <div class="border rounded p-3">
                                <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-3">
                                    <h6 class="mb-0">اسلاید {{ $index + 1 }}</h6>
                                    <div class="form-check form-switch">
                                        <input type="hidden" name="specialized_course_settings[carousel][slides][{{ $index }}][id]" value="{{ $item['id'] ?? ('slide-' . ($index + 1)) }}">
                                        <input type="hidden" name="specialized_course_settings[carousel][slides][{{ $index }}][enabled]" value="0">
                                        <input class="form-check-input" type="checkbox" role="switch" id="slide_enabled_{{ $index }}" name="specialized_course_settings[carousel][slides][{{ $index }}][enabled]" value="1" @checked((bool) ($item['enabled'] ?? true))>
                                        <label class="form-check-label" for="slide_enabled_{{ $index }}">فعال</label>
                                    </div>
                                </div>
                                <div class="row g-3">
                                    <div class="col-md-3">
                                        <label class="form-label">دوره متصل</label>
                                        <select name="specialized_course_settings[carousel][slides][{{ $index }}][course_id]" class="form-select">
                                            <option value="">انتخاب نشده</option>
                                            @foreach ($availableCourses as $course)
                                                <option value="{{ $course->id }}" @selected((string) ($item['course_id'] ?? '') === (string) $course->id)>
                                                    {{ $course->title }}
                                                    @if ($course->teacher?->name)
                                                        | {{ $course->teacher->name }}
                                                    @endif
                                                    @if ($course->category?->name)
                                                        | {{ $course->category->name }}
                                                    @endif
                                                    @if (! $course->is_published)
                                                        | پیش‌نویس
                                                    @endif
                                                </option>
                                            @endforeach
                                        </select>
                                    </div>
                                    <div class="col-md-3">
                                        <label class="form-label">برچسب بالای اسلاید</label>
                                        <input type="text" name="specialized_course_settings[carousel][slides][{{ $index }}][eyebrow]" class="form-control" value="{{ $item['eyebrow'] ?? '' }}">
                                    </div>
                                    <div class="col-md-3">
                                        <label class="form-label">عنوان اسلاید</label>
                                        <input type="text" name="specialized_course_settings[carousel][slides][{{ $index }}][title]" class="form-control" value="{{ $item['title'] ?? '' }}">
                                    </div>
                                    <div class="col-md-3">
                                        <label class="form-label">متن دکمه</label>
                                        <input type="text" name="specialized_course_settings[carousel][slides][{{ $index }}][cta]" class="form-control" value="{{ $item['cta'] ?? '' }}">
                                    </div>
                                    <div class="col-md-3">
                                        <label class="form-label">متن آمار اسلاید</label>
                                        <input type="text" name="specialized_course_settings[carousel][slides][{{ $index }}][stat]" class="form-control" value="{{ $item['stat'] ?? '' }}">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">آدرس تصویر سفارشی</label>
                                        <input type="text" name="specialized_course_settings[carousel][slides][{{ $index }}][image_url]" class="form-control" value="{{ $item['image_url'] ?? '' }}" placeholder="اگر خالی بماند تصویر دوره استفاده می‌شود">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">موقعیت تصویر</label>
                                        <input type="text" name="specialized_course_settings[carousel][slides][{{ $index }}][image_position]" class="form-control" value="{{ $item['image_position'] ?? 'center center' }}" placeholder="مثلاً center top">
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label">توضیح اسلاید</label>
                                        <textarea name="specialized_course_settings[carousel][slides][{{ $index }}][description]" class="form-control" rows="2">{{ $item['description'] ?? '' }}</textarea>
                                        <div class="form-text">اگر این فیلدها را خالی بگذارید، عنوان، توضیح، CTA و تصویر از دوره انتخاب‌شده خوانده می‌شوند.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    @endforeach
                </div>
            </div>
        </div>
    </div>

    <div class="col-12 specialized-settings-anchor" id="categories-sections">
        <div class="card shadow-none border">
            <div class="card-header">
                <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
                    <div>
                        <h6 class="mb-1">دسته‌بندی‌ها و سکشن‌های لیست دوره‌ها</h6>
                        <p class="text-muted mb-0 small">عنوان بخش دسته‌بندی‌ها و همچنین فعال بودن هر سکشن مستقل از اینجا کنترل می‌شود.</p>
                    </div>
                    <div class="form-check form-switch">
                        <input type="hidden" name="specialized_course_settings[categories][enabled]" value="0">
                        <input class="form-check-input" type="checkbox" role="switch" id="specialized_categories_enabled" name="specialized_course_settings[categories][enabled]" value="1" @checked((bool) data_get($specializedCourseSettings, 'categories.enabled', true))>
                        <label class="form-check-label" for="specialized_categories_enabled">نمایش دسته‌بندی‌ها</label>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <div class="row g-3 mb-3">
                    <div class="col-md-6">
                        <label class="form-label">عنوان دسته‌بندی‌ها</label>
                        <input type="text" name="specialized_course_settings[categories][title]" class="form-control" value="{{ data_get($specializedCourseSettings, 'categories.title') }}">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">توضیح دسته‌بندی‌ها</label>
                        <textarea name="specialized_course_settings[categories][description]" class="form-control" rows="2">{{ data_get($specializedCourseSettings, 'categories.description') }}</textarea>
                    </div>
                </div>
                <div class="row g-3">
                    @foreach ($specializedSections as $index => $item)
                        <div class="col-md-6">
                            <div class="border rounded p-3 h-100">
                                <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
                                    <div class="fw-semibold">{{ $item['id'] ?? ('section-' . ($index + 1)) }}</div>
                                    <div class="form-check form-switch">
                                        <input type="hidden" name="specialized_course_settings[sections][{{ $index }}][id]" value="{{ $item['id'] ?? ('section-' . ($index + 1)) }}">
                                        <input type="hidden" name="specialized_course_settings[sections][{{ $index }}][enabled]" value="0">
                                        <input class="form-check-input" type="checkbox" role="switch" id="section_enabled_{{ $index }}" name="specialized_course_settings[sections][{{ $index }}][enabled]" value="1" @checked((bool) ($item['enabled'] ?? true))>
                                        <label class="form-check-label" for="section_enabled_{{ $index }}">نمایش</label>
                                    </div>
                                </div>
                                <label class="form-label">عنوان سکشن</label>
                                <input type="text" name="specialized_course_settings[sections][{{ $index }}][title]" class="form-control mb-2" value="{{ $item['title'] ?? '' }}">
                                <label class="form-label">توضیح سکشن</label>
                                <textarea name="specialized_course_settings[sections][{{ $index }}][description]" class="form-control" rows="2">{{ $item['description'] ?? '' }}</textarea>
                            </div>
                        </div>
                    @endforeach
                </div>
            </div>
        </div>
    </div>

    <div class="col-12 specialized-settings-anchor" id="highlight-banner">
        <div class="card shadow-none border">
            <div class="card-header">
                <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
                    <div>
                        <h6 class="mb-1">بنر میانی مسیر رشد</h6>
                        <p class="text-muted mb-0 small">بنر میانی بعد از لیست دوره‌ها و کارت‌های کوتاه داخل آن.</p>
                    </div>
                    <div class="form-check form-switch">
                        <input type="hidden" name="specialized_course_settings[highlight_banner][enabled]" value="0">
                        <input class="form-check-input" type="checkbox" role="switch" id="specialized_highlight_enabled" name="specialized_course_settings[highlight_banner][enabled]" value="1" @checked((bool) data_get($specializedCourseSettings, 'highlight_banner.enabled', true))>
                        <label class="form-check-label" for="specialized_highlight_enabled">نمایش این بخش</label>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <div class="row g-3">
                    <div class="col-md-4">
                        <label class="form-label">بج بنر</label>
                        <input type="text" name="specialized_course_settings[highlight_banner][badge]" class="form-control" value="{{ data_get($specializedCourseSettings, 'highlight_banner.badge') }}">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">عنوان بنر</label>
                        <input type="text" name="specialized_course_settings[highlight_banner][title]" class="form-control" value="{{ data_get($specializedCourseSettings, 'highlight_banner.title') }}">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">توضیح بنر</label>
                        <textarea name="specialized_course_settings[highlight_banner][description]" class="form-control" rows="2">{{ data_get($specializedCourseSettings, 'highlight_banner.description') }}</textarea>
                    </div>
                    @foreach ($highlightItems as $index => $item)
                        <div class="col-md-4">
                            <input type="hidden" name="specialized_course_settings[highlight_banner][items][{{ $index }}][id]" value="{{ $item['id'] ?? ('highlight-item-' . ($index + 1)) }}">
                            <label class="form-label">آیتم {{ $index + 1 }}</label>
                            <input type="text" name="specialized_course_settings[highlight_banner][items][{{ $index }}][label]" class="form-control" value="{{ $item['label'] ?? '' }}">
                        </div>
                    @endforeach
                </div>
            </div>
        </div>
    </div>

    <div class="col-12 specialized-settings-anchor" id="faq">
        <div class="card shadow-none border">
            <div class="card-header">
                <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
                    <div>
                        <h6 class="mb-1">سوالات متداول</h6>
                        <p class="text-muted mb-0 small">سوالات انتهای صفحه و توضیح بالای آن را برای همین طیف مدیریت کنید.</p>
                    </div>
                    <div class="form-check form-switch">
                        <input type="hidden" name="specialized_course_settings[faq][enabled]" value="0">
                        <input class="form-check-input" type="checkbox" role="switch" id="specialized_faq_enabled" name="specialized_course_settings[faq][enabled]" value="1" @checked((bool) data_get($specializedCourseSettings, 'faq.enabled', true))>
                        <label class="form-check-label" for="specialized_faq_enabled">نمایش این بخش</label>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <div class="row g-3 mb-3">
                    <div class="col-md-6">
                        <label class="form-label">عنوان FAQ</label>
                        <input type="text" name="specialized_course_settings[faq][title]" class="form-control" value="{{ data_get($specializedCourseSettings, 'faq.title') }}">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">توضیح FAQ</label>
                        <textarea name="specialized_course_settings[faq][description]" class="form-control" rows="2">{{ data_get($specializedCourseSettings, 'faq.description') }}</textarea>
                    </div>
                </div>
                <div class="row g-3">
                    @foreach ($faqItems as $index => $item)
                        <div class="col-12">
                            <div class="border rounded p-3">
                                <input type="hidden" name="specialized_course_settings[faq][items][{{ $index }}][id]" value="{{ $item['id'] ?? ('faq-' . ($index + 1)) }}">
                                <label class="form-label">سوال {{ $index + 1 }}</label>
                                <input type="text" name="specialized_course_settings[faq][items][{{ $index }}][question]" class="form-control mb-2" value="{{ $item['question'] ?? '' }}">
                                <textarea name="specialized_course_settings[faq][items][{{ $index }}][answer]" class="form-control" rows="2" placeholder="پاسخ سوال">{{ $item['answer'] ?? '' }}</textarea>
                            </div>
                        </div>
                    @endforeach
                </div>
            </div>
        </div>
    </div>

    <div class="col-12 specialized-settings-anchor" id="labels">
        <div class="card shadow-none border">
            <div class="card-header">
                <h6 class="mb-1">متن‌های ثابت دکمه‌ها و لیبل‌ها</h6>
                <p class="text-muted mb-0 small">برای داینامیک‌شدن کامل صفحه، متن دکمه‌ها و برچسب‌های ثابت را هم از اینجا تغییر دهید.</p>
            </div>
            <div class="card-body">
                <div class="row g-3">
                    @foreach ($labelFields as $field => $label)
                        <div class="col-md-4">
                            <label class="form-label">{{ $label }}</label>
                            <input type="text" name="specialized_course_settings[labels][{{ $field }}]" class="form-control" value="{{ data_get($specializedCourseSettings, 'labels.' . $field) }}">
                        </div>
                    @endforeach
                </div>
            </div>
        </div>
    </div>
</div>
