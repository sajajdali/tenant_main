<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Landing\Models\LandingPage;
use App\Domain\Landing\Models\LandingSite;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class LandingPageController extends Controller
{
    public function index(LandingSite $landingSite): View
    {
        return view('admin.landing-pages.index', [
            'landingSite' => $landingSite->load(['pages.sections']),
            'pages' => $landingSite->pages()->withCount('sections')->orderBy('sort_order')->get(),
        ]);
    }

    public function edit(LandingSite $landingSite, LandingPage $page): View
    {
        abort_unless((int) $page->landing_site_id === (int) $landingSite->id, 404);

        return view('admin.landing-pages.form', [
            'landingSite' => $landingSite,
            'page' => $page->loadCount('sections'),
            'isAboutPage' => $page->page_key === 'about',
            'isPlansPage' => $page->page_key === 'plans',
            'isFaqPage' => $page->page_key === 'faq',
            'isContactPage' => $page->page_key === 'contact',
            'pageSettings' => array_merge(
                $this->defaultPageSettings($page->page_key),
                $page->settings_json ?? []
            ),
        ]);
    }

    public function update(Request $request, LandingSite $landingSite, LandingPage $page): RedirectResponse
    {
        abort_unless((int) $page->landing_site_id === (int) $landingSite->id, 404);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => [
                'required',
                'string',
                'max:255',
                Rule::unique('landing_pages', 'slug')->ignore($page->id),
            ],
            'status' => ['required', 'string', Rule::in(['draft', 'published', 'archived'])],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'seo_title' => ['nullable', 'string', 'max:255'],
            'seo_description' => ['nullable', 'string', 'max:1000'],
            'badge_text' => ['nullable', 'string', 'max:255'],
            'page_title' => ['nullable', 'string', 'max:255'],
            'intro_line_1' => ['nullable', 'string', 'max:1000'],
            'intro_line_2' => ['nullable', 'string', 'max:1000'],
            'intro_line_3' => ['nullable', 'string', 'max:1000'],
            'intro_line_4' => ['nullable', 'string', 'max:1000'],
            'intro_line_5' => ['nullable', 'string', 'max:1000'],
            'step_one_title' => ['nullable', 'string', 'max:255'],
            'step_one_description' => ['nullable', 'string', 'max:1000'],
            'step_two_title' => ['nullable', 'string', 'max:255'],
            'step_two_description' => ['nullable', 'string', 'max:1000'],
            'summary_title' => ['nullable', 'string', 'max:255'],
            'matrix_open_label' => ['nullable', 'string', 'max:255'],
            'matrix_close_label' => ['nullable', 'string', 'max:255'],
            'cta_title' => ['nullable', 'string', 'max:255'],
            'cta_description' => ['nullable', 'string', 'max:1000'],
            'cta_primary_text' => ['nullable', 'string', 'max:255'],
            'cta_secondary_text' => ['nullable', 'string', 'max:255'],
            'phone_modal_title' => ['nullable', 'string', 'max:255'],
            'phone_modal_description' => ['nullable', 'string', 'max:1000'],
            'footer_text' => ['nullable', 'string', 'max:255'],
            'loading_text' => ['nullable', 'string', 'max:255'],
            'faq_badge_text' => ['nullable', 'string', 'max:255'],
            'faq_page_title' => ['nullable', 'string', 'max:255'],
            'faq_intro_line_1' => ['nullable', 'string', 'max:1000'],
            'faq_intro_line_2' => ['nullable', 'string', 'max:1000'],
            'faq_intro_line_3' => ['nullable', 'string', 'max:1000'],
            'faq_section_title' => ['nullable', 'string', 'max:255'],
            'faq_section_description' => ['nullable', 'string', 'max:1000'],
            'about_badge_text' => ['nullable', 'string', 'max:255'],
            'about_page_title' => ['nullable', 'string', 'max:255'],
            'about_intro_line_1' => ['nullable', 'string', 'max:1000'],
            'about_intro_line_2' => ['nullable', 'string', 'max:1000'],
            'about_intro_line_3' => ['nullable', 'string', 'max:1000'],
            'about_intro_line_4' => ['nullable', 'string', 'max:1000'],
            'about_intro_line_5' => ['nullable', 'string', 'max:1000'],
            'capability_1_title' => ['nullable', 'string', 'max:255'],
            'capability_1_description' => ['nullable', 'string', 'max:1000'],
            'capability_2_title' => ['nullable', 'string', 'max:255'],
            'capability_2_description' => ['nullable', 'string', 'max:1000'],
            'capability_3_title' => ['nullable', 'string', 'max:255'],
            'capability_3_description' => ['nullable', 'string', 'max:1000'],
            'capability_4_title' => ['nullable', 'string', 'max:255'],
            'capability_4_description' => ['nullable', 'string', 'max:1000'],
            'values_title' => ['nullable', 'string', 'max:255'],
            'value_1' => ['nullable', 'string', 'max:1000'],
            'value_2' => ['nullable', 'string', 'max:1000'],
            'value_3' => ['nullable', 'string', 'max:1000'],
            'value_4' => ['nullable', 'string', 'max:1000'],
            'about_cta_title' => ['nullable', 'string', 'max:255'],
            'about_cta_description' => ['nullable', 'string', 'max:1000'],
            'about_cta_primary_text' => ['nullable', 'string', 'max:255'],
            'about_cta_secondary_text' => ['nullable', 'string', 'max:255'],
            'contact_badge_text' => ['nullable', 'string', 'max:255'],
            'contact_page_title' => ['nullable', 'string', 'max:255'],
            'contact_intro_line_1' => ['nullable', 'string', 'max:1000'],
            'contact_intro_line_2' => ['nullable', 'string', 'max:1000'],
            'contact_intro_line_3' => ['nullable', 'string', 'max:1000'],
            'contact_card_title' => ['nullable', 'string', 'max:255'],
            'contact_card_description' => ['nullable', 'string', 'max:1000'],
            'contact_phone_1' => ['nullable', 'string', 'max:64'],
            'contact_phone_2' => ['nullable', 'string', 'max:64'],
            'contact_phone_3' => ['nullable', 'string', 'max:64'],
            'contact_email' => ['nullable', 'email', 'max:255'],
            'contact_province_name' => ['nullable', 'string', 'max:255'],
            'contact_city_name' => ['nullable', 'string', 'max:255'],
            'contact_address_line' => ['nullable', 'string', 'max:1000'],
            'contact_form_title' => ['nullable', 'string', 'max:255'],
            'contact_form_description' => ['nullable', 'string', 'max:1000'],
            'contact_name_label' => ['nullable', 'string', 'max:255'],
            'contact_name_placeholder' => ['nullable', 'string', 'max:255'],
            'contact_mobile_label' => ['nullable', 'string', 'max:255'],
            'contact_mobile_placeholder' => ['nullable', 'string', 'max:255'],
            'contact_email_label' => ['nullable', 'string', 'max:255'],
            'contact_email_placeholder' => ['nullable', 'string', 'max:255'],
            'contact_message_label' => ['nullable', 'string', 'max:255'],
            'contact_message_placeholder' => ['nullable', 'string', 'max:255'],
            'contact_submit_text' => ['nullable', 'string', 'max:255'],
            'contact_helper_text' => ['nullable', 'string', 'max:1000'],
            'contact_success_text' => ['nullable', 'string', 'max:1000'],
        ]);

        $settings = $page->settings_json ?? [];
        if ($page->page_key === 'about') {
            $settings = [
                'badgeText' => trim((string) ($validated['about_badge_text'] ?? '')),
                'pageTitle' => trim((string) ($validated['about_page_title'] ?? '')),
                'introLines' => array_values(array_filter([
                    trim((string) ($validated['about_intro_line_1'] ?? '')),
                    trim((string) ($validated['about_intro_line_2'] ?? '')),
                    trim((string) ($validated['about_intro_line_3'] ?? '')),
                    trim((string) ($validated['about_intro_line_4'] ?? '')),
                    trim((string) ($validated['about_intro_line_5'] ?? '')),
                ])),
                'capabilities' => [
                    ['title' => trim((string) ($validated['capability_1_title'] ?? '')), 'description' => trim((string) ($validated['capability_1_description'] ?? ''))],
                    ['title' => trim((string) ($validated['capability_2_title'] ?? '')), 'description' => trim((string) ($validated['capability_2_description'] ?? ''))],
                    ['title' => trim((string) ($validated['capability_3_title'] ?? '')), 'description' => trim((string) ($validated['capability_3_description'] ?? ''))],
                    ['title' => trim((string) ($validated['capability_4_title'] ?? '')), 'description' => trim((string) ($validated['capability_4_description'] ?? ''))],
                ],
                'valuesTitle' => trim((string) ($validated['values_title'] ?? '')),
                'values' => array_values(array_filter([
                    trim((string) ($validated['value_1'] ?? '')),
                    trim((string) ($validated['value_2'] ?? '')),
                    trim((string) ($validated['value_3'] ?? '')),
                    trim((string) ($validated['value_4'] ?? '')),
                ])),
                'ctaTitle' => trim((string) ($validated['about_cta_title'] ?? '')),
                'ctaDescription' => trim((string) ($validated['about_cta_description'] ?? '')),
                'ctaPrimaryText' => trim((string) ($validated['about_cta_primary_text'] ?? '')),
                'ctaSecondaryText' => trim((string) ($validated['about_cta_secondary_text'] ?? '')),
                'phoneModalTitle' => trim((string) ($validated['phone_modal_title'] ?? '')),
                'phoneModalDescription' => trim((string) ($validated['phone_modal_description'] ?? '')),
                'footerText' => trim((string) ($validated['footer_text'] ?? '')),
            ];
        } elseif ($page->page_key === 'plans') {
            $settings = [
                'badgeText' => trim((string) ($validated['badge_text'] ?? '')),
                'pageTitle' => trim((string) ($validated['page_title'] ?? '')),
                'introLines' => array_values(array_filter([
                    trim((string) ($validated['intro_line_1'] ?? '')),
                    trim((string) ($validated['intro_line_2'] ?? '')),
                    trim((string) ($validated['intro_line_3'] ?? '')),
                    trim((string) ($validated['intro_line_4'] ?? '')),
                    trim((string) ($validated['intro_line_5'] ?? '')),
                ])),
                'stepOneTitle' => trim((string) ($validated['step_one_title'] ?? '')),
                'stepOneDescription' => trim((string) ($validated['step_one_description'] ?? '')),
                'stepTwoTitle' => trim((string) ($validated['step_two_title'] ?? '')),
                'stepTwoDescription' => trim((string) ($validated['step_two_description'] ?? '')),
                'summaryTitle' => trim((string) ($validated['summary_title'] ?? '')),
                'matrixOpenLabel' => trim((string) ($validated['matrix_open_label'] ?? '')),
                'matrixCloseLabel' => trim((string) ($validated['matrix_close_label'] ?? '')),
                'ctaTitle' => trim((string) ($validated['cta_title'] ?? '')),
                'ctaDescription' => trim((string) ($validated['cta_description'] ?? '')),
                'ctaPrimaryText' => trim((string) ($validated['cta_primary_text'] ?? '')),
                'ctaSecondaryText' => trim((string) ($validated['cta_secondary_text'] ?? '')),
                'phoneModalTitle' => trim((string) ($validated['phone_modal_title'] ?? '')),
                'phoneModalDescription' => trim((string) ($validated['phone_modal_description'] ?? '')),
                'footerText' => trim((string) ($validated['footer_text'] ?? '')),
                'loadingText' => trim((string) ($validated['loading_text'] ?? '')),
            ];
        } elseif ($page->page_key === 'faq') {
            $settings = [
                'badgeText' => trim((string) ($validated['faq_badge_text'] ?? '')),
                'pageTitle' => trim((string) ($validated['faq_page_title'] ?? '')),
                'introLines' => array_values(array_filter([
                    trim((string) ($validated['faq_intro_line_1'] ?? '')),
                    trim((string) ($validated['faq_intro_line_2'] ?? '')),
                    trim((string) ($validated['faq_intro_line_3'] ?? '')),
                ])),
                'sectionTitle' => trim((string) ($validated['faq_section_title'] ?? '')),
                'sectionDescription' => trim((string) ($validated['faq_section_description'] ?? '')),
                'phoneModalTitle' => trim((string) ($validated['phone_modal_title'] ?? '')),
                'phoneModalDescription' => trim((string) ($validated['phone_modal_description'] ?? '')),
                'footerText' => trim((string) ($validated['footer_text'] ?? '')),
            ];
        } elseif ($page->page_key === 'contact') {
            $settings = [
                'badgeText' => trim((string) ($validated['contact_badge_text'] ?? '')),
                'pageTitle' => trim((string) ($validated['contact_page_title'] ?? '')),
                'introLines' => array_values(array_filter([
                    trim((string) ($validated['contact_intro_line_1'] ?? '')),
                    trim((string) ($validated['contact_intro_line_2'] ?? '')),
                    trim((string) ($validated['contact_intro_line_3'] ?? '')),
                ])),
                'contactCardTitle' => trim((string) ($validated['contact_card_title'] ?? '')),
                'contactCardDescription' => trim((string) ($validated['contact_card_description'] ?? '')),
                'phones' => array_values(array_filter([
                    trim((string) ($validated['contact_phone_1'] ?? '')),
                    trim((string) ($validated['contact_phone_2'] ?? '')),
                    trim((string) ($validated['contact_phone_3'] ?? '')),
                ])),
                'email' => trim((string) ($validated['contact_email'] ?? '')),
                'provinceName' => trim((string) ($validated['contact_province_name'] ?? '')),
                'cityName' => trim((string) ($validated['contact_city_name'] ?? '')),
                'addressLine' => trim((string) ($validated['contact_address_line'] ?? '')),
                'formTitle' => trim((string) ($validated['contact_form_title'] ?? '')),
                'formDescription' => trim((string) ($validated['contact_form_description'] ?? '')),
                'nameLabel' => trim((string) ($validated['contact_name_label'] ?? '')),
                'namePlaceholder' => trim((string) ($validated['contact_name_placeholder'] ?? '')),
                'mobileLabel' => trim((string) ($validated['contact_mobile_label'] ?? '')),
                'mobilePlaceholder' => trim((string) ($validated['contact_mobile_placeholder'] ?? '')),
                'emailLabel' => trim((string) ($validated['contact_email_label'] ?? '')),
                'emailPlaceholder' => trim((string) ($validated['contact_email_placeholder'] ?? '')),
                'messageLabel' => trim((string) ($validated['contact_message_label'] ?? '')),
                'messagePlaceholder' => trim((string) ($validated['contact_message_placeholder'] ?? '')),
                'submitText' => trim((string) ($validated['contact_submit_text'] ?? '')),
                'helperText' => trim((string) ($validated['contact_helper_text'] ?? '')),
                'successText' => trim((string) ($validated['contact_success_text'] ?? '')),
                'phoneModalTitle' => trim((string) ($validated['phone_modal_title'] ?? '')),
                'phoneModalDescription' => trim((string) ($validated['phone_modal_description'] ?? '')),
                'footerText' => trim((string) ($validated['footer_text'] ?? '')),
            ];
        }

        $page->update([
            'name' => trim((string) $validated['name']),
            'slug' => trim((string) $validated['slug']),
            'status' => $validated['status'],
            'sort_order' => (int) ($validated['sort_order'] ?? $page->sort_order ?? 0),
            'seo_json' => [
                'title' => trim((string) ($validated['seo_title'] ?? '')),
                'description' => trim((string) ($validated['seo_description'] ?? '')),
            ],
            'settings_json' => $settings,
        ]);

        return redirect()
            ->route('admin.landing-sites.pages.index', $landingSite)
            ->with('success', 'اطلاعات صفحه لندینگ ذخیره شد.');
    }

    private function defaultPageSettings(string $pageKey): array
    {
        return match ($pageKey) {
            'about' => [
                'badgeText' => 'ما چه تیمی هستیم؟',
                'pageTitle' => 'یک تیم حرفه ای برای ساخت سیستم های رشد محور',
                'introLines' => [
                    'ما یک تیم محصول و توسعه هستیم که روی نیاز واقعی کسب و کارهای خدماتی کار می کنیم.',
                    'هدف ما فقط ساخت یک نرم افزار نیست؛ ساخت سیستمی است که واقعاً به افزایش درآمد و نظم کمک کند.',
                    'در طراحی و پیاده سازی، تجربه کاربری، پایداری فنی و نتیجه عملیاتی را همزمان جلو می بریم.',
                    'تمرکز اصلی ما در این پروژه، رشد برند شخصی آرایشگران و سالن های زیبایی است.',
                    'هر قابلیت با منطق کسب و کاری طراحی می شود تا خروجی قابل اندازه گیری داشته باشد.',
                ],
                'capabilities' => [
                    ['title' => 'طراحی تجربه کاربری حرفه ای', 'description' => 'رابط های ساده، سریع و قابل فهم که کاربر واقعی بدون آموزش پیچیده از آن استفاده کند.'],
                    ['title' => 'پیاده سازی فنی پایدار', 'description' => 'توسعه استاندارد با تمرکز روی پرفورمنس، امنیت و مقیاس پذیری برای رشد بلندمدت کسب و کار.'],
                    ['title' => 'تحلیل و رشد کسب و کاری', 'description' => 'ما فقط ویژگی اضافه نمی کنیم؛ خروجی هر بخش را با هدف افزایش رزرو و فروش طراحی می کنیم.'],
                    ['title' => 'همراهی عملیاتی', 'description' => 'از راه اندازی اولیه تا توسعه مرحله ای، کنار تیم شما هستیم تا محصول واقعاً به نتیجه برسد.'],
                ],
                'valuesTitle' => 'ارزش های کاری ما',
                'values' => [
                    'شفافیت در مسیر توسعه و تصمیم گیری',
                    'تمرکز روی تجربه واقعی کاربر نهایی',
                    'توسعه مرحله ای با قابلیت رشد پایدار',
                    'همراهی تا رسیدن به نتیجه کسب و کاری',
                ],
                'ctaTitle' => 'می خواهی بیشتر با تیم ما آشنا شوی؟',
                'ctaDescription' => 'برای مشاوره تخصصی و بررسی سناریوی رشد کسب و کارتان با ما در ارتباط باشید.',
                'ctaPrimaryText' => 'درخواست مشاوره',
                'ctaSecondaryText' => 'بازگشت به لندینگ',
                'phoneModalTitle' => 'شماره های تماس',
                'phoneModalDescription' => 'برای مشاوره خرید و راه اندازی سریع تماس بگیرید.',
                'footerText' => 'وقتشه که کسب و کارتون رو مدرن کنید',
            ],
            'plans' => [
                'badgeText' => 'مقایسه شفاف پلن ها',
                'pageTitle' => 'اول تعداد آرایشگر، بعد مدت پلن را انتخاب کنید',
                'introLines' => [
                    'ساختار قیمت گذاری این سیستم به صورت ماتریس تعداد آرایشگر و مدت زمان تعریف شده است.',
                    'ابتدا ظرفیت مورد نیاز خودتان را انتخاب کنید تا فقط پلن های همان ظرفیت نمایش داده شود.',
                    'در مرحله بعد، مدت مناسب را انتخاب می کنید و قیمت واقعی همان ترکیب را می بینید.',
                    'این اطلاعات مستقیم از دیتابیس خوانده می شود و با seedهای شما یکپارچه است.',
                    'اگر برای انتخاب دقیق نیاز به راهنمایی دارید، تیم مشاوره کنار شماست.',
                ],
                'stepOneTitle' => 'مرحله ۱: تعداد آرایشگر',
                'stepOneDescription' => 'این انتخاب برای همه مراحل بعدی پایه تصمیم گیری است.',
                'stepTwoTitle' => 'مرحله ۲: مدت پلن',
                'stepTwoDescription' => 'مدت پلن را انتخاب کنید.',
                'summaryTitle' => 'خلاصه انتخاب شما',
                'matrixOpenLabel' => 'نمایش کل بسته ها در یک نگاه',
                'matrixCloseLabel' => 'بستن نمایش کل بسته‌ها',
                'ctaTitle' => 'آماده انتخاب پلن هستید؟',
                'ctaDescription' => 'برای نهایی سازی خرید، تعداد آرایشگر و مدت را انتخاب کنید و درخواست مشاوره بگذارید.',
                'ctaPrimaryText' => 'ادامه انتخاب پلن',
                'ctaSecondaryText' => 'تماس با مشاور',
                'phoneModalTitle' => 'شماره های تماس',
                'phoneModalDescription' => 'برای مشاوره خرید و راه اندازی سریع تماس بگیرید.',
                'footerText' => 'وقتشه که کسب و کارتون رو مدرن کنید',
                'loadingText' => 'در حال بارگذاری پلن ها...',
            ],
            'faq' => [
                'badgeText' => 'سوالات پرتکرار مشتریان',
                'pageTitle' => 'پاسخ شفاف به سوالات متداول',
                'introLines' => [
                    'قبل از خرید یا شروع همکاری، طبیعی است که سوال های دقیقی داشته باشید.',
                    'در این صفحه مهم ترین سوالات را یکجا پاسخ داده ایم تا سریع تر تصمیم بگیرید.',
                    'اگر پاسخ سوال شما اینجا نبود، از طریق صفحه تماس با ما با تیم مشاوره در ارتباط باشید.',
                ],
                'sectionTitle' => 'سوالات متداول',
                'sectionDescription' => 'روی هر سوال بزنید تا پاسخ کامل نمایش داده شود.',
                'phoneModalTitle' => 'شماره های تماس',
                'phoneModalDescription' => 'برای مشاوره خرید و راه اندازی سریع تماس بگیرید.',
                'footerText' => 'وقتشه که کسب و کارتون رو مدرن کنید',
            ],
            'contact' => [
                'badgeText' => 'در ارتباط باشید',
                'pageTitle' => 'برای مشاوره و شروع همکاری با ما تماس بگیرید',
                'introLines' => [
                    'اگر برای انتخاب پلن یا راه اندازی سیستم سوالی دارید، تیم ما کنار شماست.',
                    'می توانید تماس بگیرید یا فرم زیر را ارسال کنید تا در سریع ترین زمان با شما هماهنگ کنیم.',
                ],
                'contactCardTitle' => 'راه های ارتباطی',
                'contactCardDescription' => 'برای پاسخ سریع از این مسیرها استفاده کنید.',
                'phones' => ['0912-000-0000', '0935-000-0000', '021-0000-0000'],
                'email' => 'support@example.com',
                'provinceName' => 'تهران',
                'cityName' => 'تهران',
                'addressLine' => 'تهران، خیابان نمونه، برج نمونه، طبقه ۵',
                'formTitle' => 'فرم تماس سریع',
                'formDescription' => 'اطلاعات تماس را ثبت کنید تا تیم مشاوره با شما ارتباط بگیرد.',
                'nameLabel' => 'نام و نام خانوادگی',
                'namePlaceholder' => 'مثلاً سارا رضایی',
                'mobileLabel' => 'شماره موبایل',
                'mobilePlaceholder' => '09xxxxxxxxx',
                'emailLabel' => 'ایمیل',
                'emailPlaceholder' => 'name@example.com',
                'messageLabel' => 'پیام شما',
                'messagePlaceholder' => 'نیاز و سوال خودتان را بنویسید...',
                'submitText' => 'ارسال درخواست تماس',
                'helperText' => 'پس از ثبت فرم، تیم مشاوره در سریع ترین زمان با شما ارتباط می گیرد.',
                'successText' => 'درخواست تماس شما ثبت شد و به زودی با شما ارتباط می گیریم.',
                'phoneModalTitle' => 'شماره های تماس',
                'phoneModalDescription' => 'برای مشاوره خرید و راه اندازی سریع تماس بگیرید.',
                'footerText' => 'وقتشه که کسب و کارتون رو مدرن کنید',
            ],
            default => [],
        };
    }
}
