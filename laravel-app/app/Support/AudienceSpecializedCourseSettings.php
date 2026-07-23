<?php

declare(strict_types=1);

namespace App\Support;

class AudienceSpecializedCourseSettings
{
    public static function defaultsFor(?string $slug = null): array
    {
        $profile = self::profileFor($slug);

        return [
            'enabled' => false,
            'disabled' => [
                'title' => 'دوره‌های تخصصی',
                'description' => 'به زودی تو این قسمت دوره‌های تخصصی ویژه صنف شما قرار خواهد گرفت.',
            ],
            'header' => [
                'eyebrow' => $profile['header_eyebrow'],
                'title' => 'دوره‌های تخصصی',
            ],
            'search' => [
                'placeholder' => $profile['search_placeholder'],
            ],
            'access' => [
                'title' => 'عدم دسترسی',
                'description' => 'این بخش فقط برای مدیران و اعضای تخصصی همین سامانه قابل مشاهده است.',
            ],
            'labels' => [
                'course_video_label' => 'ویدیوهای مرحله‌به‌مرحله',
                'students_label' => $profile['students_label'],
                'certificate_badge' => 'گواهی‌نامه',
                'popular_badge' => 'محبوب کاربران',
                'view_course_cta' => 'مشاهده دوره',
                'purchased_badge' => 'خریداری‌شده',
                'progress_label' => 'پیشرفت',
                'continue_path_label' => 'ادامه مسیر:',
                'continue_learning_cta' => 'ادامه یادگیری',
                'learning_status_text' => 'آخرین وضعیت یادگیری ذخیره شده',
                'more_button' => 'بیشتر',
                'empty_state' => 'با فیلترهای فعلی دوره‌ای پیدا نشد. دسته‌بندی یا عبارت جستجو را تغییر بده.',
                'active_courses_suffix' => 'دوره فعال',
            ],
            'hero' => [
                'enabled' => true,
                'badge' => $profile['hero_badge'],
                'title' => $profile['hero_title'],
                'description' => $profile['hero_description'],
                'stats' => [
                    ['id' => 'hero-stat-1', 'value' => '+۳۵', 'label' => 'دوره قابل نمایش'],
                    ['id' => 'hero-stat-2', 'value' => '+۱۸', 'label' => $profile['hero_second_stat']],
                    ['id' => 'hero-stat-3', 'value' => '۴.۹', 'label' => 'رضایت کاربران'],
                ],
            ],
            'purchased' => [
                'enabled' => true,
                'title' => 'دوره‌های خریداری‌شده',
                'description' => $profile['purchased_description'],
            ],
            'carousel' => [
                'enabled' => true,
                'title' => 'پیشنهادهای منتخب',
                'description' => $profile['carousel_description'],
                'side_cards' => [
                    [
                        'id' => 'carousel-card-1',
                        'eyebrow' => 'مسیر یادگیری',
                        'title' => $profile['side_card_1_title'],
                        'description' => $profile['side_card_1_description'],
                    ],
                    [
                        'id' => 'carousel-card-2',
                        'eyebrow' => 'خروجی نهایی',
                        'title' => $profile['side_card_2_title'],
                        'description' => $profile['side_card_2_description'],
                    ],
                ],
                'slides' => [
                    [
                        'id' => 'slide-1',
                        'enabled' => true,
                        'course_id' => null,
                        'eyebrow' => 'دوره ویژه این ماه',
                        'title' => $profile['slide_1_title'],
                        'description' => $profile['slide_1_description'],
                        'cta' => 'مشاهده دوره',
                        'stat' => $profile['slide_1_stat'],
                        'image_url' => '',
                        'image_position' => 'center center',
                    ],
                    [
                        'id' => 'slide-2',
                        'enabled' => true,
                        'course_id' => null,
                        'eyebrow' => 'پرفروش این ماه',
                        'title' => $profile['slide_2_title'],
                        'description' => $profile['slide_2_description'],
                        'cta' => 'شروع یادگیری',
                        'stat' => $profile['slide_2_stat'],
                        'image_url' => '',
                        'image_position' => 'center center',
                    ],
                    [
                        'id' => 'slide-3',
                        'enabled' => true,
                        'course_id' => null,
                        'eyebrow' => 'ویژه مدیران',
                        'title' => $profile['slide_3_title'],
                        'description' => $profile['slide_3_description'],
                        'cta' => 'دیدن سرفصل‌ها',
                        'stat' => $profile['slide_3_stat'],
                        'image_url' => '',
                        'image_position' => 'center center',
                    ],
                ],
            ],
            'categories' => [
                'enabled' => true,
                'title' => 'دسته‌بندی‌های منتخب',
                'description' => 'فقط با یک نگاه مسیر آموزشی دلخواهت را پیدا کن.',
            ],
            'sections' => [
                [
                    'id' => 'featured',
                    'enabled' => true,
                    'title' => 'محبوب‌ترین دوره‌های آموزشی',
                    'description' => $profile['section_featured_description'],
                ],
                [
                    'id' => 'latest',
                    'enabled' => true,
                    'title' => 'جدیدترین دوره‌ها',
                    'description' => 'دوره‌های تازه‌منتشرشده با سرفصل‌های به‌روز و قابل اجرا.',
                ],
                [
                    'id' => 'management-focus',
                    'enabled' => true,
                    'title' => $profile['section_management_title'],
                    'description' => $profile['section_management_description'],
                ],
                [
                    'id' => 'color-focus',
                    'enabled' => true,
                    'title' => $profile['section_skill_title'],
                    'description' => $profile['section_skill_description'],
                ],
            ],
            'highlight_banner' => [
                'enabled' => true,
                'badge' => 'مسیر رشد حرفه‌ای',
                'title' => $profile['highlight_title'],
                'description' => $profile['highlight_description'],
                'items' => [
                    ['id' => 'highlight-item-1', 'label' => $profile['highlight_item_1']],
                    ['id' => 'highlight-item-2', 'label' => $profile['highlight_item_2']],
                    ['id' => 'highlight-item-3', 'label' => $profile['highlight_item_3']],
                ],
            ],
            'faq' => [
                'enabled' => true,
                'title' => 'سوالات متداول',
                'description' => $profile['faq_description'],
                'items' => [
                    [
                        'id' => 'faq-1',
                        'question' => 'این بخش الان به سیستم واقعی دوره‌ها وصل شده است؟',
                        'answer' => $profile['faq_1_answer'],
                    ],
                    [
                        'id' => 'faq-2',
                        'question' => 'چه کسانی می‌توانند این صفحه را ببینند؟',
                        'answer' => 'در این نسخه فقط مدیران و اعضای تخصصی سامانه به این بخش دسترسی دارند و برای سایر کاربران نمایش داده نمی‌شود.',
                    ],
                    [
                        'id' => 'faq-3',
                        'question' => 'بعداً چه چیزهایی به این صفحه اضافه می‌شود؟',
                        'answer' => $profile['faq_3_answer'],
                    ],
                    [
                        'id' => 'faq-4',
                        'question' => 'متن‌ها و بنرها الان واقعی هستند یا تستی؟',
                        'answer' => 'این متن‌ها به‌عنوان پیش‌فرض هر طیف قرار گرفته‌اند و هر زمان بخواهید می‌توانید از پنل مرکزی آن‌ها را تغییر دهید.',
                    ],
                ],
            ],
        ];
    }

    public static function normalize(?array $settings, ?string $slug = null): array
    {
        $defaults = self::defaultsFor($slug);
        $merged = self::mergeRecursive($defaults, is_array($settings) ? $settings : []);

        $merged['enabled'] = self::toBool(data_get($merged, 'enabled', false));
        $merged['disabled']['title'] = self::cleanText(data_get($merged, 'disabled.title'));
        $merged['disabled']['description'] = self::cleanText(data_get($merged, 'disabled.description'));
        $merged['hero']['enabled'] = self::toBool(data_get($merged, 'hero.enabled', true));
        $merged['purchased']['enabled'] = self::toBool(data_get($merged, 'purchased.enabled', true));
        $merged['carousel']['enabled'] = self::toBool(data_get($merged, 'carousel.enabled', true));
        $merged['categories']['enabled'] = self::toBool(data_get($merged, 'categories.enabled', true));
        $merged['highlight_banner']['enabled'] = self::toBool(data_get($merged, 'highlight_banner.enabled', true));
        $merged['faq']['enabled'] = self::toBool(data_get($merged, 'faq.enabled', true));

        $merged['header']['eyebrow'] = self::cleanText(data_get($merged, 'header.eyebrow'));
        $merged['header']['title'] = self::cleanText(data_get($merged, 'header.title'));
        $merged['search']['placeholder'] = self::cleanText(data_get($merged, 'search.placeholder'));
        $merged['access']['title'] = self::cleanText(data_get($merged, 'access.title'));
        $merged['access']['description'] = self::cleanText(data_get($merged, 'access.description'));

        foreach (($merged['labels'] ?? []) as $key => $value) {
            $merged['labels'][$key] = self::cleanText($value);
        }

        $merged['hero']['badge'] = self::cleanText(data_get($merged, 'hero.badge'));
        $merged['hero']['title'] = self::cleanText(data_get($merged, 'hero.title'));
        $merged['hero']['description'] = self::cleanText(data_get($merged, 'hero.description'));
        $merged['hero']['stats'] = collect($merged['hero']['stats'] ?? [])
            ->map(fn ($item, $index) => [
                'id' => (string) ($item['id'] ?? ('hero-stat-' . ($index + 1))),
                'value' => self::cleanText($item['value'] ?? ''),
                'label' => self::cleanText($item['label'] ?? ''),
            ])
            ->filter(fn (array $item) => $item['value'] !== '' || $item['label'] !== '')
            ->values()
            ->all();

        $merged['purchased']['title'] = self::cleanText(data_get($merged, 'purchased.title'));
        $merged['purchased']['description'] = self::cleanText(data_get($merged, 'purchased.description'));

        $merged['carousel']['title'] = self::cleanText(data_get($merged, 'carousel.title'));
        $merged['carousel']['description'] = self::cleanText(data_get($merged, 'carousel.description'));
        $merged['carousel']['side_cards'] = collect($merged['carousel']['side_cards'] ?? [])
            ->map(fn ($item, $index) => [
                'id' => (string) ($item['id'] ?? ('carousel-card-' . ($index + 1))),
                'eyebrow' => self::cleanText($item['eyebrow'] ?? ''),
                'title' => self::cleanText($item['title'] ?? ''),
                'description' => self::cleanText($item['description'] ?? ''),
            ])
            ->filter(fn (array $item) => $item['title'] !== '')
            ->values()
            ->all();
        $merged['carousel']['slides'] = collect($merged['carousel']['slides'] ?? [])
            ->map(fn ($item, $index) => [
                'id' => (string) ($item['id'] ?? ('slide-' . ($index + 1))),
                'enabled' => self::toBool($item['enabled'] ?? true),
                'course_id' => self::toNullableInt($item['course_id'] ?? null),
                'eyebrow' => self::cleanText($item['eyebrow'] ?? ''),
                'title' => self::cleanText($item['title'] ?? ''),
                'description' => self::cleanText($item['description'] ?? ''),
                'cta' => self::cleanText($item['cta'] ?? ''),
                'stat' => self::cleanText($item['stat'] ?? ''),
                'image_url' => self::cleanText($item['image_url'] ?? ''),
                'image_position' => self::cleanText($item['image_position'] ?? 'center center'),
            ])
            ->filter(fn (array $item) => $item['title'] !== '' || $item['course_id'] !== null)
            ->values()
            ->all();

        $merged['categories']['title'] = self::cleanText(data_get($merged, 'categories.title'));
        $merged['categories']['description'] = self::cleanText(data_get($merged, 'categories.description'));

        $merged['sections'] = collect($merged['sections'] ?? [])
            ->map(fn ($item, $index) => [
                'id' => (string) ($item['id'] ?? ('section-' . ($index + 1))),
                'enabled' => self::toBool($item['enabled'] ?? true),
                'title' => self::cleanText($item['title'] ?? ''),
                'description' => self::cleanText($item['description'] ?? ''),
            ])
            ->filter(fn (array $item) => $item['id'] !== '' && $item['title'] !== '')
            ->values()
            ->all();

        $merged['highlight_banner']['badge'] = self::cleanText(data_get($merged, 'highlight_banner.badge'));
        $merged['highlight_banner']['title'] = self::cleanText(data_get($merged, 'highlight_banner.title'));
        $merged['highlight_banner']['description'] = self::cleanText(data_get($merged, 'highlight_banner.description'));
        $merged['highlight_banner']['items'] = collect($merged['highlight_banner']['items'] ?? [])
            ->map(fn ($item, $index) => [
                'id' => (string) ($item['id'] ?? ('highlight-item-' . ($index + 1))),
                'label' => self::cleanText($item['label'] ?? ''),
            ])
            ->filter(fn (array $item) => $item['label'] !== '')
            ->values()
            ->all();

        $merged['faq']['title'] = self::cleanText(data_get($merged, 'faq.title'));
        $merged['faq']['description'] = self::cleanText(data_get($merged, 'faq.description'));
        $merged['faq']['items'] = collect($merged['faq']['items'] ?? [])
            ->map(fn ($item, $index) => [
                'id' => (string) ($item['id'] ?? ('faq-' . ($index + 1))),
                'question' => self::cleanText($item['question'] ?? ''),
                'answer' => self::cleanText($item['answer'] ?? ''),
            ])
            ->filter(fn (array $item) => $item['question'] !== '' && $item['answer'] !== '')
            ->values()
            ->all();

        return $merged;
    }

    private static function profileFor(?string $slug): array
    {
        return match ($slug) {
            'doctors' => [
                'header_eyebrow' => 'کتابخانه رشد کلینیک',
                'search_placeholder' => 'جستجو در بین دوره‌ها، مدرس‌ها و سرفصل‌های درمانی',
                'students_label' => 'فراگیر',
                'hero_badge' => 'ویژه مدیر و پزشک',
                'hero_title' => 'کتابخانه آموزش‌های تخصصی برای رشد واقعی کلینیک',
                'hero_description' => 'از استانداردسازی تجربه بیمار تا مدیریت تیم و توسعه خدمات، این صفحه می‌تواند متناسب با طیف پزشکی شخصی‌سازی شود.',
                'hero_second_stat' => 'مدرس تخصصی',
                'purchased_description' => 'لیست دوره‌های خریداری‌شده تا اعضای کلینیک سریع به ادامه مسیر آموزشی خود برگردند.',
                'carousel_description' => 'اسلایدهای منتخب برای معرفی دوره‌ها، پکیج‌ها و پیشنهادهای مهم مخصوص فضای درمانی.',
                'side_card_1_title' => 'یادگیری ساختاریافته برای تیم درمان',
                'side_card_1_description' => 'موضوعات به‌صورت مرحله‌ای و قابل اجرا در کلینیک چیده می‌شوند.',
                'side_card_2_title' => 'ارتقای کیفیت خدمت و درآمد',
                'side_card_2_description' => 'دوره‌ها روی تجربه بیمار، نظم عملیاتی و رشد مجموعه تمرکز دارند.',
                'slide_1_title' => 'استانداردسازی تجربه بیمار از پذیرش تا پیگیری',
                'slide_1_description' => 'یک مسیر آموزشی برای هماهنگ‌کردن تجربه مراجع از اولین تماس تا مراجعات بعدی.',
                'slide_1_stat' => '۱۲ جلسه کاربردی',
                'slide_2_title' => 'مهارت‌های ارتباطی و اعتمادسازی در فضای درمان',
                'slide_2_description' => 'برای تیم‌هایی که می‌خواهند رضایت بیمار و کیفیت ارتباط را حرفه‌ای‌تر مدیریت کنند.',
                'slide_2_stat' => '۸ ساعت آموزش',
                'slide_3_title' => 'مدیریت کلینیک، تیم و توسعه خدمات',
                'slide_3_description' => 'مدل‌های رشد، گزارش‌گیری، نظم عملیاتی و حفظ بیمار را قدم‌به‌قدم مرور کنید.',
                'slide_3_stat' => 'پکیج جامع مدیریتی',
                'section_featured_description' => 'منتخب‌ترین آموزش‌هایی که برای نظم عملیاتی، تجربه بیمار و رشد کلینیک بیشترین بازده را داشته‌اند.',
                'section_management_title' => 'رشد کلینیک و حفظ بیماران',
                'section_management_description' => 'برای مدیرانی که می‌خواهند کیفیت خدمت، تیم و درآمد کلینیک را حرفه‌ای‌تر بچینند.',
                'section_skill_title' => 'مهارت‌های تخصصی و تکمیلی',
                'section_skill_description' => 'آموزش‌های متمرکز روی مهارت‌های اجرایی، کیفیت ارتباط و توسعه خدمات تخصصی.',
                'highlight_title' => 'برای هر نقش، یک مسیر یادگیری منظم و قابل توسعه',
                'highlight_description' => 'از دوره‌های اجرایی تا آموزش‌های مدیریتی، هر بخش می‌تواند برای طیف پزشکی به‌صورت مستقل مدیریت شود.',
                'highlight_item_1' => 'مسیر اختصاصی پزشک و مدیر کلینیک',
                'highlight_item_2' => 'مسیر تجربه بیمار و ارتباط حرفه‌ای',
                'highlight_item_3' => 'مسیر توسعه خدمت و گزارش‌گیری',
                'faq_description' => 'پاسخ‌های پیش‌فرض مخصوص طیف پزشکی که هر زمان بخواهید قابل ویرایش هستند.',
                'faq_1_answer' => 'فعلاً این صفحه به‌صورت زیرساخت محتوایی آماده شده تا بعداً به دوره‌ها و داده‌های واقعی مخصوص طیف پزشکی وصل شود.',
                'faq_3_answer' => 'در مرحله بعد می‌توانیم جزئیات هر دوره، سرفصل‌ها، مدرس، پیشرفت کاربر، خرید و دسته‌بندی‌های واقعی را هم متصل کنیم.',
            ],
            'lawyers' => [
                'header_eyebrow' => 'کتابخانه رشد دفتر حقوقی',
                'search_placeholder' => 'جستجو در بین دوره‌ها، مدرس‌ها و سرفصل‌های حقوقی',
                'students_label' => 'فراگیر',
                'hero_badge' => 'ویژه مدیر و وکیل',
                'hero_title' => 'آموزش‌های تخصصی برای توسعه دفتر و خدمات حقوقی',
                'hero_description' => 'از توسعه مهارت‌های ارتباطی و مذاکره تا مدیریت پرونده و رشد دفتر، همه متن‌های این صفحه قابل شخصی‌سازی برای طیف وکلا هستند.',
                'hero_second_stat' => 'مدرس تخصصی',
                'purchased_description' => 'دوره‌های خریداری‌شده اینجا نمایش داده می‌شوند تا اعضای دفتر سریع ادامه مسیر را پیدا کنند.',
                'carousel_description' => 'بنرها و اسلایدهای منتخب برای معرفی پیشنهادهای آموزشی مخصوص فضای حقوقی.',
                'side_card_1_title' => 'یادگیری کاربردی برای کار روزانه دفتر',
                'side_card_1_description' => 'موضوعات آموزشی بر پایه اجرا، ارتباط با موکل و نظم پرونده طراحی می‌شوند.',
                'side_card_2_title' => 'رشد کیفیت خدمت و توسعه دفتر',
                'side_card_2_description' => 'تمرکز دوره‌ها روی اعتمادسازی، بهره‌وری تیم و توسعه خدمات حقوقی است.',
                'slide_1_title' => 'مدیریت ارتباط با موکل از تماس اول تا پیگیری',
                'slide_1_description' => 'چیدمان یک تجربه حرفه‌ای، منظم و قابل اعتماد در کل سفر موکل.',
                'slide_1_stat' => '۱۰ جلسه کاربردی',
                'slide_2_title' => 'مذاکره، پیگیری و ارائه حرفه‌ای خدمات حقوقی',
                'slide_2_description' => 'برای تیم‌هایی که می‌خواهند کیفیت ارتباط، پیگیری و نتیجه‌گیری را ارتقا دهند.',
                'slide_2_stat' => '۷ ساعت آموزش',
                'slide_3_title' => 'مدیریت دفتر، پرونده و رشد درآمد',
                'slide_3_description' => 'مسیرهای توسعه دفتر، نظم اجرایی و افزایش ارزش خدمات را مرحله‌به‌مرحله بچینید.',
                'slide_3_stat' => 'پکیج جامع مدیریتی',
                'section_featured_description' => 'منتخب‌ترین آموزش‌هایی که برای نظم کاری، تجربه موکل و رشد دفتر حقوقی بیشترین بازده را داشته‌اند.',
                'section_management_title' => 'رشد دفتر و حفظ موکل',
                'section_management_description' => 'برای مدیرانی که می‌خواهند کیفیت خدمات، تیم و درآمد دفتر را حرفه‌ای‌تر توسعه دهند.',
                'section_skill_title' => 'مذاکره، پیگیری و مهارت‌های تکمیلی',
                'section_skill_description' => 'آموزش‌های متمرکز روی مهارت‌های اجرایی، ارتباط حرفه‌ای و توسعه خدمات حقوقی.',
                'highlight_title' => 'برای هر نقش، یک مسیر یادگیری منظم و قابل توسعه',
                'highlight_description' => 'این بخش برای نمایش بنرهای مناسبتی، پکیج‌های ویژه و مسیرهای آموزشی شاخص مخصوص فضای حقوقی آماده شده است.',
                'highlight_item_1' => 'مسیر اختصاصی مدیر دفتر حقوقی',
                'highlight_item_2' => 'مسیر مذاکره و ارتباط با موکل',
                'highlight_item_3' => 'مسیر نظم پرونده و رشد خدمات',
                'faq_description' => 'پاسخ‌های پیش‌فرض مخصوص طیف وکلا که هر زمان بخواهید قابل ویرایش هستند.',
                'faq_1_answer' => 'فعلاً این صفحه به‌صورت زیرساخت محتوایی آماده شده تا بعداً به دوره‌ها و داده‌های واقعی مخصوص طیف وکلا وصل شود.',
                'faq_3_answer' => 'در مرحله بعد می‌توانیم جزئیات هر دوره، مدرس، سرفصل‌ها، پیشرفت کاربر، خرید و دسته‌بندی‌های واقعی را هم متصل کنیم.',
            ],
            'consultants' => [
                'header_eyebrow' => 'کتابخانه رشد مرکز مشاوره',
                'search_placeholder' => 'جستجو در بین دوره‌ها، مدرس‌ها و سرفصل‌های مشاوره‌ای',
                'students_label' => 'فراگیر',
                'hero_badge' => 'ویژه مدیر و مشاور',
                'hero_title' => 'آموزش‌های تخصصی برای رشد مرکز مشاوره و تجربه مراجع',
                'hero_description' => 'از مدیریت تجربه مراجع تا رشد تیم و توسعه خدمت، این صفحه می‌تواند برای طیف مشاوران کاملاً شخصی‌سازی شود.',
                'hero_second_stat' => 'مدرس تخصصی',
                'purchased_description' => 'لیست دوره‌های خریداری‌شده تا اعضای مرکز مشاوره سریع به مسیر یادگیری خود برگردند.',
                'carousel_description' => 'اسلایدهای منتخب برای معرفی مسیرهای آموزشی، پکیج‌ها و پیشنهادهای مهم مخصوص مرکز مشاوره.',
                'side_card_1_title' => 'یادگیری قدم‌به‌قدم و قابل اجرا',
                'side_card_1_description' => 'از ارتباط با مراجع تا نظم اجرایی، همه چیز به‌صورت مسیرمند چیده می‌شود.',
                'side_card_2_title' => 'رشد کیفیت خدمت و وفاداری مراجع',
                'side_card_2_description' => 'دوره‌ها روی تجربه بهتر مراجع و توسعه پایدار مرکز تمرکز دارند.',
                'slide_1_title' => 'استانداردسازی سفر مراجع از درخواست تا پیگیری',
                'slide_1_description' => 'نقطه‌های تماس اصلی با مراجع را منظم، حرفه‌ای و قابل تکرار طراحی کنید.',
                'slide_1_stat' => '۹ جلسه کاربردی',
                'slide_2_title' => 'ارتباط حرفه‌ای، پیگیری و توسعه اعتماد',
                'slide_2_description' => 'برای تیم‌هایی که می‌خواهند تجربه ارتباطی بهتری برای مراجعان خود بسازند.',
                'slide_2_stat' => '۶ ساعت آموزش',
                'slide_3_title' => 'مدیریت مرکز، تیم و رشد خدمات مشاوره',
                'slide_3_description' => 'ساختار عملیاتی، گزارش‌گیری و توسعه خدمات را مرحله‌به‌مرحله بچینید.',
                'slide_3_stat' => 'پکیج جامع مدیریتی',
                'section_featured_description' => 'منتخب‌ترین آموزش‌هایی که برای تجربه مراجع، نظم عملیاتی و رشد مرکز مشاوره بیشترین بازده را داشته‌اند.',
                'section_management_title' => 'رشد مرکز و حفظ مراجع',
                'section_management_description' => 'برای مدیرانی که می‌خواهند تیم، تجربه مراجع و درآمد مجموعه را حرفه‌ای‌تر توسعه دهند.',
                'section_skill_title' => 'مهارت‌های ارتباطی و توسعه خدمت',
                'section_skill_description' => 'آموزش‌های متمرکز روی ارتباط حرفه‌ای، فرایندها و توسعه خدمات تخصصی.',
                'highlight_title' => 'برای هر نقش، یک مسیر یادگیری منظم و قابل توسعه',
                'highlight_description' => 'این بخش برای نمایش بنرهای مناسبتی، پکیج‌های ویژه و مسیرهای آموزشی شاخص مرکز مشاوره طراحی شده است.',
                'highlight_item_1' => 'مسیر اختصاصی مدیر مرکز',
                'highlight_item_2' => 'مسیر ارتباط حرفه‌ای با مراجع',
                'highlight_item_3' => 'مسیر رشد تیم و خدمات مشاوره',
                'faq_description' => 'پاسخ‌های پیش‌فرض مخصوص طیف مشاوران که هر زمان بخواهید قابل ویرایش هستند.',
                'faq_1_answer' => 'فعلاً این صفحه به‌صورت زیرساخت محتوایی آماده شده تا بعداً به دوره‌ها و داده‌های واقعی مخصوص طیف مشاوران وصل شود.',
                'faq_3_answer' => 'در مرحله بعد می‌توانیم جزئیات هر دوره، مدرس، سرفصل‌ها، پیشرفت کاربر و خرید واقعی را هم متصل کنیم.',
            ],
            'experts' => [
                'header_eyebrow' => 'کتابخانه رشد مرکز تخصصی',
                'search_placeholder' => 'جستجو در بین دوره‌ها، مدرس‌ها و سرفصل‌های تخصصی',
                'students_label' => 'فراگیر',
                'hero_badge' => 'ویژه مدیر و کارشناس',
                'hero_title' => 'آموزش‌های تخصصی برای توسعه خدمات و رشد مرکز',
                'hero_description' => 'این صفحه برای طیف کارشناسان طوری طراحی شده که محتوای آموزشی، FAQها و سکشن‌ها را مستقل برای هر نوع خدمت کنترل کنید.',
                'hero_second_stat' => 'مدرس تخصصی',
                'purchased_description' => 'دوره‌های خریداری‌شده اینجا نمایش داده می‌شوند تا اعضای مرکز سریع به ادامه مسیر آموزشی برگردند.',
                'carousel_description' => 'بنرها و اسلایدهای منتخب برای معرفی پیشنهادهای آموزشی و مسیرهای رشد مرکز تخصصی.',
                'side_card_1_title' => 'آموزش منظم برای تیم اجرایی',
                'side_card_1_description' => 'موضوعات آموزشی بر پایه اجرا، استانداردسازی خدمت و رشد مهارت‌ها چیده می‌شوند.',
                'side_card_2_title' => 'ارتقای کیفیت خدمت و توسعه مرکز',
                'side_card_2_description' => 'تمرکز دوره‌ها روی تجربه بهتر مشتری، بهره‌وری تیم و رشد پایدار مرکز است.',
                'slide_1_title' => 'استانداردسازی تجربه مشتری از شروع تا پیگیری',
                'slide_1_description' => 'مسیر آموزش برای تیم‌هایی که می‌خواهند کیفیت ارائه خدمت را حرفه‌ای‌تر کنند.',
                'slide_1_stat' => '۱۰ جلسه کاربردی',
                'slide_2_title' => 'مهارت‌های اجرایی و ارتباط حرفه‌ای',
                'slide_2_description' => 'برای تیم‌هایی که به دنبال تجربه بهتر مشتری و اجرای یکدست‌تر خدمات هستند.',
                'slide_2_stat' => '۷ ساعت آموزش',
                'slide_3_title' => 'مدیریت مرکز، تیم و رشد خدمات تخصصی',
                'slide_3_description' => 'مدل‌های توسعه، گزارش‌گیری و افزایش بهره‌وری را قدم‌به‌قدم بچینید.',
                'slide_3_stat' => 'پکیج جامع مدیریتی',
                'section_featured_description' => 'منتخب‌ترین آموزش‌هایی که برای کیفیت خدمت، نظم اجرایی و رشد مرکز تخصصی بیشترین بازده را داشته‌اند.',
                'section_management_title' => 'رشد مرکز و حفظ مشتری',
                'section_management_description' => 'برای مدیرانی که می‌خواهند کیفیت خدمت، تیم و درآمد مجموعه را حرفه‌ای‌تر توسعه دهند.',
                'section_skill_title' => 'مهارت‌های اجرایی و توسعه خدمت',
                'section_skill_description' => 'آموزش‌های متمرکز روی استانداردسازی، مهارت اجرایی و توسعه خدمات تخصصی.',
                'highlight_title' => 'برای هر نقش، یک مسیر یادگیری منظم و قابل توسعه',
                'highlight_description' => 'این بخش برای نمایش بنرهای مناسبتی، پکیج‌های ویژه و مسیرهای آموزشی شاخص مرکز تخصصی طراحی شده است.',
                'highlight_item_1' => 'مسیر اختصاصی مدیر مرکز',
                'highlight_item_2' => 'مسیر کیفیت خدمت و ارتباط حرفه‌ای',
                'highlight_item_3' => 'مسیر توسعه تیم و خدمات',
                'faq_description' => 'پاسخ‌های پیش‌فرض مخصوص طیف کارشناسان که هر زمان بخواهید قابل ویرایش هستند.',
                'faq_1_answer' => 'فعلاً این صفحه به‌صورت زیرساخت محتوایی آماده شده تا بعداً به دوره‌ها و داده‌های واقعی مخصوص طیف کارشناسان وصل شود.',
                'faq_3_answer' => 'در مرحله بعد می‌توانیم جزئیات هر دوره، مدرس، سرفصل‌ها، پیشرفت کاربر و خرید واقعی را هم متصل کنیم.',
            ],
            default => [
                'header_eyebrow' => 'کتابخانه اختصاصی رشد سالن',
                'search_placeholder' => 'جستجو در بین دوره‌ها، مدرس‌ها و سرفصل‌ها',
                'students_label' => 'دانشجو',
                'hero_badge' => 'ویژه مدیر و آرایشگر',
                'hero_title' => 'کتابخانه آموزش‌های کاربردی برای رشد واقعی سالن',
                'hero_description' => 'این صفحه می‌تواند برای طیف آرایشگران با بنرها، FAQها و متن‌های اختصاصی مدیریت شود و محتوای هر بخش کاملاً داینامیک است.',
                'hero_second_stat' => 'مدرس حرفه‌ای',
                'purchased_description' => 'لیست دوره‌های خریداری‌شده تا کاربر سریع به ادامه آموزش‌های خودش برگردد.',
                'carousel_description' => 'اسلایدهای منتخب برای معرفی دوره‌ها که بعداً با بنرها و پیشنهادهای واقعی جایگزین می‌شوند.',
                'side_card_1_title' => 'قدم‌به‌قدم و قابل اجرا',
                'side_card_1_description' => 'پروژه‌محور و مناسب اجرا در سالن',
                'side_card_2_title' => 'افزایش مهارت و فروش',
                'side_card_2_description' => 'یادگیری برای رشد واقعی کسب‌وکار',
                'slide_1_title' => 'رنگ، لایت و تشخیص پایه مو',
                'slide_1_description' => 'از مشاوره تا اجرای حرفه‌ای رنگ و لایت را با سناریوی واقعی سالن یاد بگیرید.',
                'slide_1_stat' => '۳۸ جلسه ویدیویی',
                'slide_2_title' => 'کوتاهی حرفه‌ای مردانه و استایل مدرن',
                'slide_2_description' => 'فید، تیپر، لاین‌سازی و تحویل حرفه‌ای مشتری با استاندارد قابل اجرا در سالن.',
                'slide_2_stat' => '۱۶ ساعت آموزش',
                'slide_3_title' => 'مدیریت سالن، افزایش فروش و حفظ مشتری',
                'slide_3_description' => 'سیستم قیمت‌گذاری، تیم‌سازی، رضایت مشتری و رشد درآمد را مرحله‌به‌مرحله بچینید.',
                'slide_3_stat' => 'پکیج جامع مدیریتی',
                'section_featured_description' => 'پرفروش‌ترین و کاربردی‌ترین آموزش‌هایی که برای سالن‌ها بیشترین بازده را داشته‌اند.',
                'section_management_title' => 'رشد سالن و جذب مشتری',
                'section_management_description' => 'برای مدیرانی که می‌خواهند فروش، تیم و تجربه مشتری را حرفه‌ای‌تر بچینند.',
                'section_skill_title' => 'رنگ، لایت و ترکیب رنگ',
                'section_skill_description' => 'آموزش‌های متمرکز روی تشخیص پایه، ترکیب مواد و اجرای حرفه‌ای رنگ.',
                'highlight_title' => 'برای هر نقش، یک مسیر یادگیری منظم و قابل توسعه',
                'highlight_description' => 'این بخش برای نمایش بنرهای مناسبتی، پکیج‌های ویژه و معرفی دوره‌های شاخص طراحی شده و بعداً با محتوای واقعی شما کامل می‌شود.',
                'highlight_item_1' => 'مسیر اختصاصی مدیر سالن',
                'highlight_item_2' => 'مسیر کوتاهی و استایل',
                'highlight_item_3' => 'مسیر رنگ و خدمات تکمیلی',
                'faq_description' => 'پاسخ‌های پیش‌فرض این بخش را می‌توانید برای طیف آرایشگران از پنل مرکزی تغییر دهید.',
                'faq_1_answer' => 'فعلاً این صفحه به‌صورت UI و زیرساخت محتوایی آماده شده تا بعداً به دیتای واقعی دوره‌ها متصل شود.',
                'faq_3_answer' => 'در مرحله بعد می‌توانیم جزئیات هر دوره، مدرس، سرفصل‌ها، ویدیوها، پیشرفت کاربر، خرید و جستجوی واقعی را اضافه کنیم.',
            ],
        };
    }

    private static function mergeRecursive(array $defaults, array $overrides): array
    {
        foreach ($overrides as $key => $value) {
            if (is_array($value) && isset($defaults[$key]) && is_array($defaults[$key])) {
                $defaults[$key] = self::mergeRecursive($defaults[$key], $value);
                continue;
            }

            $defaults[$key] = $value;
        }

        return $defaults;
    }

    private static function cleanText(mixed $value): string
    {
        return trim((string) $value);
    }

    private static function toBool(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value === 1;
        }

        return in_array($value, ['1', 'true', 'on', 'yes'], true);
    }

    private static function toNullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return is_numeric($value) ? (int) $value : null;
    }
}
