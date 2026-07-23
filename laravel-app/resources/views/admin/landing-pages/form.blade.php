@extends('admin.layouts.app')

@section('title', 'ویرایش صفحه لندینگ')

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">ویرایش صفحه {{ $page->name }}</h5>
                    <p class="text-muted mb-0">اطلاعات پایه، وضعیت انتشار و سئوی این صفحه را از اینجا مدیریت می‌کنی. مرحله بعد، داینامیک کردن محتوای خود صفحه روی همین ساختار است.</p>
                </div>
                <div class="card-body">
                    <form method="POST" action="{{ route('admin.landing-sites.pages.update', [$landingSite, $page]) }}">
                        @csrf
                        @method('PUT')

                        <div class="row g-3">
                            <div class="col-md-4">
                                <label class="form-label" for="name">نام صفحه</label>
                                <input type="text" id="name" name="name" class="form-control" value="{{ old('name', $page->name) }}" required>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="slug">اسلاگ</label>
                                <input type="text" id="slug" name="slug" dir="ltr" class="form-control" value="{{ old('slug', $page->slug) }}" required>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="status">وضعیت</label>
                                <select id="status" name="status" class="form-select" required>
                                    <option value="draft" @selected(old('status', $page->status) === 'draft')>پیش‌نویس</option>
                                    <option value="published" @selected(old('status', $page->status) === 'published')>منتشرشده</option>
                                    <option value="archived" @selected(old('status', $page->status) === 'archived')>آرشیو</option>
                                </select>
                            </div>

                            <div class="col-md-4">
                                <label class="form-label">کلید صفحه</label>
                                <input type="text" class="form-control" value="{{ $page->page_key }}" dir="ltr" disabled>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label">تعداد سکشن</label>
                                <input type="text" class="form-control" value="{{ number_format($page->sections_count) }}" disabled>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="sort_order">ترتیب نمایش</label>
                                <input type="number" min="0" id="sort_order" name="sort_order" class="form-control" value="{{ old('sort_order', $page->sort_order) }}">
                            </div>

                            <div class="col-md-6">
                                <label class="form-label" for="seo_title">عنوان سئو</label>
                                <input type="text" id="seo_title" name="seo_title" class="form-control" value="{{ old('seo_title', data_get($page->seo_json, 'title', '')) }}">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="seo_description">توضیحات سئو</label>
                                <textarea id="seo_description" name="seo_description" rows="2" class="form-control">{{ old('seo_description', data_get($page->seo_json, 'description', '')) }}</textarea>
                            </div>

                            @if ($isAboutPage)
                                <div class="col-12"><hr></div>
                                <div class="col-md-4">
                                    <label class="form-label" for="about_badge_text">متن badge</label>
                                    <input type="text" id="about_badge_text" name="about_badge_text" class="form-control" value="{{ old('about_badge_text', $pageSettings['badgeText'] ?? '') }}">
                                </div>
                                <div class="col-md-8">
                                    <label class="form-label" for="about_page_title">عنوان صفحه</label>
                                    <input type="text" id="about_page_title" name="about_page_title" class="form-control" value="{{ old('about_page_title', $pageSettings['pageTitle'] ?? '') }}">
                                </div>
                                @for ($i = 0; $i < 5; $i++)
                                    <div class="col-12">
                                        <label class="form-label" for="about_intro_line_{{ $i + 1 }}">متن مقدمه {{ $i + 1 }}</label>
                                        <input type="text" id="about_intro_line_{{ $i + 1 }}" name="about_intro_line_{{ $i + 1 }}" class="form-control" value="{{ old('about_intro_line_'.($i + 1), $pageSettings['introLines'][$i] ?? '') }}">
                                    </div>
                                @endfor
                                @php $aboutCapabilities = array_values($pageSettings['capabilities'] ?? []); @endphp
                                @for ($i = 0; $i < 4; $i++)
                                    <div class="col-md-6">
                                        <label class="form-label" for="capability_{{ $i + 1 }}_title">عنوان توانمندی {{ $i + 1 }}</label>
                                        <input type="text" id="capability_{{ $i + 1 }}_title" name="capability_{{ $i + 1 }}_title" class="form-control" value="{{ old('capability_'.($i + 1).'_title', $aboutCapabilities[$i]['title'] ?? '') }}">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label" for="capability_{{ $i + 1 }}_description">توضیح توانمندی {{ $i + 1 }}</label>
                                        <input type="text" id="capability_{{ $i + 1 }}_description" name="capability_{{ $i + 1 }}_description" class="form-control" value="{{ old('capability_'.($i + 1).'_description', $aboutCapabilities[$i]['description'] ?? '') }}">
                                    </div>
                                @endfor
                                <div class="col-12">
                                    <label class="form-label" for="values_title">عنوان ارزش‌ها</label>
                                    <input type="text" id="values_title" name="values_title" class="form-control" value="{{ old('values_title', $pageSettings['valuesTitle'] ?? '') }}">
                                </div>
                                @php $aboutValues = array_values($pageSettings['values'] ?? []); @endphp
                                @for ($i = 0; $i < 4; $i++)
                                    <div class="col-md-6">
                                        <label class="form-label" for="value_{{ $i + 1 }}">متن ارزش {{ $i + 1 }}</label>
                                        <input type="text" id="value_{{ $i + 1 }}" name="value_{{ $i + 1 }}" class="form-control" value="{{ old('value_'.($i + 1), $aboutValues[$i] ?? '') }}">
                                    </div>
                                @endfor
                                <div class="col-md-6">
                                    <label class="form-label" for="about_cta_title">عنوان CTA</label>
                                    <input type="text" id="about_cta_title" name="about_cta_title" class="form-control" value="{{ old('about_cta_title', $pageSettings['ctaTitle'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="about_cta_description">توضیح CTA</label>
                                    <input type="text" id="about_cta_description" name="about_cta_description" class="form-control" value="{{ old('about_cta_description', $pageSettings['ctaDescription'] ?? '') }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label" for="about_cta_primary_text">متن دکمه اصلی</label>
                                    <input type="text" id="about_cta_primary_text" name="about_cta_primary_text" class="form-control" value="{{ old('about_cta_primary_text', $pageSettings['ctaPrimaryText'] ?? '') }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label" for="about_cta_secondary_text">متن دکمه دوم</label>
                                    <input type="text" id="about_cta_secondary_text" name="about_cta_secondary_text" class="form-control" value="{{ old('about_cta_secondary_text', $pageSettings['ctaSecondaryText'] ?? '') }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label" for="footer_text">متن فوتر</label>
                                    <input type="text" id="footer_text" name="footer_text" class="form-control" value="{{ old('footer_text', $pageSettings['footerText'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="phone_modal_title">عنوان مودال تماس</label>
                                    <input type="text" id="phone_modal_title" name="phone_modal_title" class="form-control" value="{{ old('phone_modal_title', $pageSettings['phoneModalTitle'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="phone_modal_description">توضیح مودال تماس</label>
                                    <input type="text" id="phone_modal_description" name="phone_modal_description" class="form-control" value="{{ old('phone_modal_description', $pageSettings['phoneModalDescription'] ?? '') }}">
                                </div>
                            @elseif ($isPlansPage)
                                <div class="col-12"><hr></div>
                                <div class="col-md-4">
                                    <label class="form-label" for="badge_text">متن badge</label>
                                    <input type="text" id="badge_text" name="badge_text" class="form-control" value="{{ old('badge_text', $pageSettings['badgeText'] ?? '') }}">
                                </div>
                                <div class="col-md-8">
                                    <label class="form-label" for="page_title">عنوان صفحه</label>
                                    <input type="text" id="page_title" name="page_title" class="form-control" value="{{ old('page_title', $pageSettings['pageTitle'] ?? '') }}">
                                </div>

                                @for ($i = 0; $i < 5; $i++)
                                    <div class="col-12">
                                        <label class="form-label" for="intro_line_{{ $i + 1 }}">متن مقدمه {{ $i + 1 }}</label>
                                        <input type="text" id="intro_line_{{ $i + 1 }}" name="intro_line_{{ $i + 1 }}" class="form-control" value="{{ old('intro_line_'.($i + 1), $pageSettings['introLines'][$i] ?? '') }}">
                                    </div>
                                @endfor

                                <div class="col-md-6">
                                    <label class="form-label" for="step_one_title">عنوان مرحله اول</label>
                                    <input type="text" id="step_one_title" name="step_one_title" class="form-control" value="{{ old('step_one_title', $pageSettings['stepOneTitle'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="step_one_description">توضیح مرحله اول</label>
                                    <input type="text" id="step_one_description" name="step_one_description" class="form-control" value="{{ old('step_one_description', $pageSettings['stepOneDescription'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="step_two_title">عنوان مرحله دوم</label>
                                    <input type="text" id="step_two_title" name="step_two_title" class="form-control" value="{{ old('step_two_title', $pageSettings['stepTwoTitle'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="step_two_description">توضیح مرحله دوم</label>
                                    <input type="text" id="step_two_description" name="step_two_description" class="form-control" value="{{ old('step_two_description', $pageSettings['stepTwoDescription'] ?? '') }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label" for="summary_title">عنوان خلاصه انتخاب</label>
                                    <input type="text" id="summary_title" name="summary_title" class="form-control" value="{{ old('summary_title', $pageSettings['summaryTitle'] ?? '') }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label" for="matrix_open_label">متن دکمه باز کردن ماتریس</label>
                                    <input type="text" id="matrix_open_label" name="matrix_open_label" class="form-control" value="{{ old('matrix_open_label', $pageSettings['matrixOpenLabel'] ?? '') }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label" for="matrix_close_label">متن دکمه بستن ماتریس</label>
                                    <input type="text" id="matrix_close_label" name="matrix_close_label" class="form-control" value="{{ old('matrix_close_label', $pageSettings['matrixCloseLabel'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="cta_title">عنوان CTA</label>
                                    <input type="text" id="cta_title" name="cta_title" class="form-control" value="{{ old('cta_title', $pageSettings['ctaTitle'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="cta_description">توضیح CTA</label>
                                    <input type="text" id="cta_description" name="cta_description" class="form-control" value="{{ old('cta_description', $pageSettings['ctaDescription'] ?? '') }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label" for="cta_primary_text">متن دکمه اصلی CTA</label>
                                    <input type="text" id="cta_primary_text" name="cta_primary_text" class="form-control" value="{{ old('cta_primary_text', $pageSettings['ctaPrimaryText'] ?? '') }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label" for="cta_secondary_text">متن دکمه دوم CTA</label>
                                    <input type="text" id="cta_secondary_text" name="cta_secondary_text" class="form-control" value="{{ old('cta_secondary_text', $pageSettings['ctaSecondaryText'] ?? '') }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label" for="loading_text">متن بارگذاری</label>
                                    <input type="text" id="loading_text" name="loading_text" class="form-control" value="{{ old('loading_text', $pageSettings['loadingText'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="phone_modal_title">عنوان مودال تماس</label>
                                    <input type="text" id="phone_modal_title" name="phone_modal_title" class="form-control" value="{{ old('phone_modal_title', $pageSettings['phoneModalTitle'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="phone_modal_description">توضیح مودال تماس</label>
                                    <input type="text" id="phone_modal_description" name="phone_modal_description" class="form-control" value="{{ old('phone_modal_description', $pageSettings['phoneModalDescription'] ?? '') }}">
                                </div>
                                <div class="col-12">
                                    <label class="form-label" for="footer_text">متن فوتر</label>
                                    <input type="text" id="footer_text" name="footer_text" class="form-control" value="{{ old('footer_text', $pageSettings['footerText'] ?? '') }}">
                                </div>
                            @elseif ($isFaqPage)
                                <div class="col-12"><hr></div>
                                <div class="col-md-4">
                                    <label class="form-label" for="faq_badge_text">متن badge</label>
                                    <input type="text" id="faq_badge_text" name="faq_badge_text" class="form-control" value="{{ old('faq_badge_text', $pageSettings['badgeText'] ?? '') }}">
                                </div>
                                <div class="col-md-8">
                                    <label class="form-label" for="faq_page_title">عنوان صفحه</label>
                                    <input type="text" id="faq_page_title" name="faq_page_title" class="form-control" value="{{ old('faq_page_title', $pageSettings['pageTitle'] ?? '') }}">
                                </div>
                                @for ($i = 0; $i < 3; $i++)
                                    <div class="col-12">
                                        <label class="form-label" for="faq_intro_line_{{ $i + 1 }}">متن مقدمه {{ $i + 1 }}</label>
                                        <input type="text" id="faq_intro_line_{{ $i + 1 }}" name="faq_intro_line_{{ $i + 1 }}" class="form-control" value="{{ old('faq_intro_line_'.($i + 1), $pageSettings['introLines'][$i] ?? '') }}">
                                    </div>
                                @endfor
                                <div class="col-md-6">
                                    <label class="form-label" for="faq_section_title">عنوان سکشن سوالات</label>
                                    <input type="text" id="faq_section_title" name="faq_section_title" class="form-control" value="{{ old('faq_section_title', $pageSettings['sectionTitle'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="faq_section_description">توضیح سکشن سوالات</label>
                                    <input type="text" id="faq_section_description" name="faq_section_description" class="form-control" value="{{ old('faq_section_description', $pageSettings['sectionDescription'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="phone_modal_title">عنوان مودال تماس</label>
                                    <input type="text" id="phone_modal_title" name="phone_modal_title" class="form-control" value="{{ old('phone_modal_title', $pageSettings['phoneModalTitle'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="phone_modal_description">توضیح مودال تماس</label>
                                    <input type="text" id="phone_modal_description" name="phone_modal_description" class="form-control" value="{{ old('phone_modal_description', $pageSettings['phoneModalDescription'] ?? '') }}">
                                </div>
                                <div class="col-12">
                                    <label class="form-label" for="footer_text">متن فوتر</label>
                                    <input type="text" id="footer_text" name="footer_text" class="form-control" value="{{ old('footer_text', $pageSettings['footerText'] ?? '') }}">
                                </div>
                            @elseif ($isContactPage)
                                <div class="col-12"><hr></div>
                                <div class="col-md-4">
                                    <label class="form-label" for="contact_badge_text">متن badge</label>
                                    <input type="text" id="contact_badge_text" name="contact_badge_text" class="form-control" value="{{ old('contact_badge_text', $pageSettings['badgeText'] ?? '') }}">
                                </div>
                                <div class="col-md-8">
                                    <label class="form-label" for="contact_page_title">عنوان صفحه</label>
                                    <input type="text" id="contact_page_title" name="contact_page_title" class="form-control" value="{{ old('contact_page_title', $pageSettings['pageTitle'] ?? '') }}">
                                </div>
                                @for ($i = 0; $i < 3; $i++)
                                    <div class="col-12">
                                        <label class="form-label" for="contact_intro_line_{{ $i + 1 }}">متن مقدمه {{ $i + 1 }}</label>
                                        <input type="text" id="contact_intro_line_{{ $i + 1 }}" name="contact_intro_line_{{ $i + 1 }}" class="form-control" value="{{ old('contact_intro_line_'.($i + 1), $pageSettings['introLines'][$i] ?? '') }}">
                                    </div>
                                @endfor
                                <div class="col-md-6">
                                    <label class="form-label" for="contact_card_title">عنوان باکس راه‌های ارتباطی</label>
                                    <input type="text" id="contact_card_title" name="contact_card_title" class="form-control" value="{{ old('contact_card_title', $pageSettings['contactCardTitle'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="contact_card_description">توضیح باکس راه‌های ارتباطی</label>
                                    <input type="text" id="contact_card_description" name="contact_card_description" class="form-control" value="{{ old('contact_card_description', $pageSettings['contactCardDescription'] ?? '') }}">
                                </div>
                                @for ($i = 0; $i < 3; $i++)
                                    <div class="col-md-4">
                                        <label class="form-label" for="contact_phone_{{ $i + 1 }}">شماره تماس {{ $i + 1 }}</label>
                                        <input type="text" id="contact_phone_{{ $i + 1 }}" name="contact_phone_{{ $i + 1 }}" dir="ltr" class="form-control" value="{{ old('contact_phone_'.($i + 1), $pageSettings['phones'][$i] ?? '') }}">
                                    </div>
                                @endfor
                                <div class="col-md-4">
                                    <label class="form-label" for="contact_email">ایمیل</label>
                                    <input type="email" id="contact_email" name="contact_email" dir="ltr" class="form-control" value="{{ old('contact_email', $pageSettings['email'] ?? '') }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label" for="contact_province_name">استان</label>
                                    <input type="text" id="contact_province_name" name="contact_province_name" class="form-control" value="{{ old('contact_province_name', $pageSettings['provinceName'] ?? '') }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label" for="contact_city_name">شهر</label>
                                    <input type="text" id="contact_city_name" name="contact_city_name" class="form-control" value="{{ old('contact_city_name', $pageSettings['cityName'] ?? '') }}">
                                </div>
                                <div class="col-12">
                                    <label class="form-label" for="contact_address_line">آدرس</label>
                                    <input type="text" id="contact_address_line" name="contact_address_line" class="form-control" value="{{ old('contact_address_line', $pageSettings['addressLine'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="contact_form_title">عنوان فرم</label>
                                    <input type="text" id="contact_form_title" name="contact_form_title" class="form-control" value="{{ old('contact_form_title', $pageSettings['formTitle'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="contact_form_description">توضیح فرم</label>
                                    <input type="text" id="contact_form_description" name="contact_form_description" class="form-control" value="{{ old('contact_form_description', $pageSettings['formDescription'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="contact_name_label">برچسب فیلد نام</label>
                                    <input type="text" id="contact_name_label" name="contact_name_label" class="form-control" value="{{ old('contact_name_label', $pageSettings['nameLabel'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="contact_name_placeholder">Placeholder نام</label>
                                    <input type="text" id="contact_name_placeholder" name="contact_name_placeholder" class="form-control" value="{{ old('contact_name_placeholder', $pageSettings['namePlaceholder'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="contact_mobile_label">برچسب فیلد موبایل</label>
                                    <input type="text" id="contact_mobile_label" name="contact_mobile_label" class="form-control" value="{{ old('contact_mobile_label', $pageSettings['mobileLabel'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="contact_mobile_placeholder">Placeholder موبایل</label>
                                    <input type="text" id="contact_mobile_placeholder" name="contact_mobile_placeholder" class="form-control" value="{{ old('contact_mobile_placeholder', $pageSettings['mobilePlaceholder'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="contact_email_label">برچسب فیلد ایمیل</label>
                                    <input type="text" id="contact_email_label" name="contact_email_label" class="form-control" value="{{ old('contact_email_label', $pageSettings['emailLabel'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="contact_email_placeholder">Placeholder ایمیل</label>
                                    <input type="text" id="contact_email_placeholder" name="contact_email_placeholder" class="form-control" value="{{ old('contact_email_placeholder', $pageSettings['emailPlaceholder'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="contact_message_label">برچسب فیلد پیام</label>
                                    <input type="text" id="contact_message_label" name="contact_message_label" class="form-control" value="{{ old('contact_message_label', $pageSettings['messageLabel'] ?? '') }}">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="contact_message_placeholder">Placeholder پیام</label>
                                    <input type="text" id="contact_message_placeholder" name="contact_message_placeholder" class="form-control" value="{{ old('contact_message_placeholder', $pageSettings['messagePlaceholder'] ?? '') }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label" for="contact_submit_text">متن دکمه ثبت</label>
                                    <input type="text" id="contact_submit_text" name="contact_submit_text" class="form-control" value="{{ old('contact_submit_text', $pageSettings['submitText'] ?? '') }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label" for="phone_modal_title">عنوان مودال تماس</label>
                                    <input type="text" id="phone_modal_title" name="phone_modal_title" class="form-control" value="{{ old('phone_modal_title', $pageSettings['phoneModalTitle'] ?? '') }}">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label" for="footer_text">متن فوتر</label>
                                    <input type="text" id="footer_text" name="footer_text" class="form-control" value="{{ old('footer_text', $pageSettings['footerText'] ?? '') }}">
                                </div>
                                <div class="col-12">
                                    <label class="form-label" for="contact_helper_text">متن راهنمای فرم</label>
                                    <input type="text" id="contact_helper_text" name="contact_helper_text" class="form-control" value="{{ old('contact_helper_text', $pageSettings['helperText'] ?? '') }}">
                                </div>
                                <div class="col-12">
                                    <label class="form-label" for="contact_success_text">متن موفقیت بعد از ارسال</label>
                                    <input type="text" id="contact_success_text" name="contact_success_text" class="form-control" value="{{ old('contact_success_text', $pageSettings['successText'] ?? '') }}">
                                </div>
                                <div class="col-12">
                                    <label class="form-label" for="phone_modal_description">توضیح مودال تماس</label>
                                    <input type="text" id="phone_modal_description" name="phone_modal_description" class="form-control" value="{{ old('phone_modal_description', $pageSettings['phoneModalDescription'] ?? '') }}">
                                </div>
                            @endif
                        </div>

                        <div class="alert alert-light-primary mt-4 mb-0">
                            بعد از این مرحله، محتوای خود صفحه را هم به صورت سکشن‌محور روی همین صفحه مدیریت می‌کنیم.
                        </div>

                        <div class="mt-4 d-flex gap-2">
                            <button type="submit" class="btn btn-primary">ذخیره اطلاعات صفحه</button>
                            <a href="{{ route('admin.landing-sites.pages.index', $landingSite) }}" class="btn btn-light-secondary">بازگشت</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
@endsection
