<?php

declare(strict_types=1);

namespace App\Support;

class LandingSectionRegistry
{
    public static function homeSections(): array
    {
        return [
            [
                'section_key' => 'slider',
                'section_type' => 'hero_slider',
                'name' => 'اسلایدر',
                'sort_order' => 10,
                'content_json' => [
                    'badgeText' => 'ویژه آرایشگران و سالن‌های زیبایی',
                    'titleLine1' => 'یک پله بالاتر باشید',
                    'titleHighlight' => 'برای آرایشگران با سایت شخصی',
                    'titleLine3' => 'و پنل کامل',
                    'typingPrefix' => 'شده بخوای',
                    'typingItems' => [
                        'حتی نصف شب هم، بدون یک تماس، نوبت بگیرن؟',
                        'محصولاتتو همون‌جا، کنار نوبت‌دهی، بفروشی؟',
                        'دیگه دنبال یادآوری نوبت مشتری‌ها نباشی؟',
                        'یه تجربه‌ی متفاوت برای مشتریت بسازی؟',
                        'حساب‌وکتاب مالی سالنتو یه‌جا ببینی؟',
                        'یه درگاه پرداخت مختص خودت داشته باشی؟',
                        'با اسم خودت، تو گوگل پیدات کنن؟',
                    ],
                    'typingFinalText' => 'متفاوت باشی، اصلاً؟',
                    'heroImageUrl' => '',
                    'heroImagePath' => '',
                    'description' => 'نوبت ها را خودکار کن، کنسلی را کم کن، مشتری های قبلی را برگردان و برای برند خودت سایت اختصاصی داشته باش.',
                    'featureChips' => [
                        'ثبت نوبت 24 ساعته',
                        'پیامک یادآوری',
                        'سایت اختصاصی برند',
                    ],
                    'primaryCtaText' => 'شروع خرید پکیج',
                    'secondaryCtaText' => 'مشاهده دموی واقعی',
                    'sideTitle' => 'سیستم رشد و نظم سالن',
                    'sideDescription' => 'آرایشگر نوبت دهی نمی خرد، نتیجه می خرد.',
                    'sideBullets' => [
                        'بی نظمی کمتر و مدیریت دقیق برنامه ها',
                        'کنسلی و فراموشی کمتر با یادآوری خودکار',
                        'بازگشت مشتری و افزایش فروش مکمل',
                    ],
                ],
            ],
            [
                'section_key' => 'pain_points',
                'section_type' => 'pain_points',
                'name' => 'دردهای مشتری',
                'sort_order' => 20,
                'content_json' => [
                    'items' => [
                        'نوبت ها هنوز با دایرکت و واتساپ مدیریت می شود',
                        'مشتری ها نوبت را فراموش می کنند یا لحظه آخری کنسل می کنند',
                        'تایم های خالی پر نمی شود و درآمد از دست می رود',
                        'برای تیم چندنفره کنترل برنامه ها سخت می شود',
                        'فروش محصول از خدمات جدا مانده و پراکنده است',
                        'برند سالن سایت اختصاصی و حضور رسمی آنلاین ندارد',
                    ],
                ],
            ],
            [
                'section_key' => 'video_intro',
                'section_type' => 'video_intro',
                'name' => 'ویدئوی معرفی',
                'sort_order' => 30,
                'content_json' => [
                    'title' => 'در ۶۰ ثانیه ببینید چطور کار می‌کند',
                    'description' => 'از ثبت نوبت تا یادآوری خودکار، همه چیز در یک ویدیوی کوتاه.',
                    'buttonLabel' => 'مشاهده ویدئو',
                    'modalTitle' => 'ویدئوی معرفی سیستم',
                    'modalDescription' => 'ویدئوی معرفی امکانات و نحوه کار سیستم',
                    'videoUrl' => '',
                    'coverUrl' => '',
                    'coverPath' => '',
                ],
            ],
            [
                'section_key' => 'before_after',
                'section_type' => 'before_after',
                'name' => 'قبل و بعد',
                'sort_order' => 40,
                'content_json' => [
                    'sectionTitle' => 'قبل و بعد از راه اندازی سیستم',
                    'items' => [
                        ['title' => 'قبل از سیستم:', 'description' => 'دایرکت و تماس شلوغ، خطای ثبت نوبت، فراموشی مشتری و تایم های خالی.'],
                        ['title' => 'بعد از سیستم:', 'description' => 'ثبت نوبت 24 ساعته، یادآوری خودکار، مدیریت یکپارچه تیم و برنامه روزانه.'],
                        ['title' => 'نتیجه کسب و کاری:', 'description' => 'کنسلی کمتر، بازگشت مشتری با کمپین هدفمند، فروش مکمل از فروشگاه آنلاین و برند رسمی با سایت اختصاصی.'],
                    ],
                ],
            ],
            [
                'section_key' => 'gallery_showcase',
                'section_type' => 'gallery_showcase',
                'name' => 'نمونه واقعی و اعتمادسازی اولیه',
                'sort_order' => 50,
                'content_json' => [
                    'title' => 'نمونه واقعی را ببین',
                    'description' => 'نمای واقعی صفحه نوبت دهی + فروشگاه در قالب برند شما.',
                    'imageUrl' => '/booking-app/opengraph.jpg',
                    'buttonLabel' => 'مشاهده نمونه سایت نوبت دهی',
                    'buttonUrl' => '/booking',
                    'statsTitle' => 'اعتمادسازی اولیه',
                    'statsDescription' => 'این اعداد فعلاً نمونه اند و بعداً با آمار واقعی جایگزین می شوند.',
                    'stats' => [
                        ['label' => 'افزایش رزرو ماهانه', 'value' => '+28%'],
                        ['label' => 'کاهش تماس تکراری', 'value' => '-45%'],
                        ['label' => 'افزایش فروش مکمل', 'value' => '+19%'],
                    ],
                ],
            ],
            [
                'section_key' => 'feature_grid',
                'section_type' => 'feature_grid',
                'name' => 'امکانات',
                'sort_order' => 60,
                'content_json' => [
                    'title' => 'بیش از ۵۰ ویژگی سیستم!',
                    'description' => '',
                    'viewAllLabel' => 'سایر امکانات سیستم',
                    'items' => [
                        ['title' => 'ثبت نوبت ۲۴ ساعته', 'short' => 'مشتری هر ساعت شبانه‌روز خودش نوبت می‌گیرد.', 'detail' => 'مشتری هر ساعت شبانه‌روز، حتی نیمه‌شب، می‌تواند از روی گوشی نوبت بگیرد.', 'url' => '/features/booking', 'isPrimary' => true, 'imageUrls' => []],
                        ['title' => 'یادآوری خودکار', 'short' => 'کنسلی و فراموشی نوبت به‌طور چشمگیری کم می‌شود.', 'detail' => 'یادآوری‌های خودکار احتمال فراموشی و عدم حضور مشتری را کاهش می‌دهد.', 'url' => '/features/reminder', 'isPrimary' => true, 'imageUrls' => []],
                        ['title' => 'سایت اختصاصی برند', 'short' => 'حضور آنلاین رسمی، به‌جای یک صفحه عمومی مشترک.', 'detail' => 'یک وب‌سایت رسمی با نام، هویت و دامنه اختصاصی برند خودتان داشته باشید.', 'url' => '/features/site', 'isPrimary' => true, 'imageUrls' => []],
                        ['title' => 'کمپین پیامکی هدفمند', 'short' => 'بازگردانی مشتری‌های غیرفعال با پیام‌های مناسب زمان.', 'detail' => 'مشتری‌های مناسب را انتخاب کنید و کمپین هدفمند اجرا کنید.', 'url' => '/features/campaign', 'isPrimary' => false, 'imageUrls' => []],
                        ['title' => 'مدیریت تیم و دسترسی‌ها', 'short' => 'مناسب آرایشگر مستقل تا سالن چندنفره، با نقش‌های جدا.', 'detail' => 'برنامه و سطح دسترسی اعضای تیم را یکپارچه مدیریت کنید.', 'url' => '/features/team', 'isPrimary' => false, 'imageUrls' => []],
                        ['title' => 'فروشگاه آنلاین', 'short' => 'فروش خدمات را به فروش محصول وصل کنید.', 'detail' => 'محصولات تخصصی خود را کنار خدمات به مشتریان بفروشید.', 'url' => '/features/shop', 'isPrimary' => false, 'imageUrls' => []],
                    ],
                ],
            ],
            [
                'section_key' => 'process_steps',
                'section_type' => 'process_steps',
                'name' => 'مراحل شروع',
                'sort_order' => 70,
                'content_json' => [
                    'items' => [
                        ['title' => 'درخواست دمو یا مشاوره', 'description' => 'نیاز واقعی سالن بررسی می شود و پلن مناسب پیشنهاد می گیرید.'],
                        ['title' => 'راه اندازی سایت و پنل اختصاصی', 'description' => 'ساختار نوبت دهی، تیم، پیامک و ماژول های موردنیاز شما تنظیم می شود.'],
                        ['title' => 'شروع دریافت نوبت و فروش', 'description' => 'از همان روز اول مشتری می تواند نوبت بگیرد و شما نتیجه را در پنل ببینید.'],
                    ],
                ],
            ],
            [
                'section_key' => 'plans',
                'section_type' => 'plans',
                'name' => 'پلن ها',
                'sort_order' => 80,
                'content_json' => [
                    'title' => 'مقایسه پلن ها',
                    'description' => 'تفاوت پلن ها را شفاف ببین و براساس اندازه تیم تصمیم بگیر.',
                    'fullPageButtonLabel' => 'مشاهده صفحه کامل مقایسه پلن ها',
                    'cards' => [
                        [
                            'packageId' => '',
                            'title' => 'شروع سریع',
                            'description' => 'مناسب آرایشگر مستقل',
                            'badgeText' => '',
                            'buttonText' => 'ثبت سفارش',
                            'buttonVariant' => 'default',
                            'featured' => false,
                            'showOnHome' => true,
                            'features' => ['1 کاربر', 'نوبت دهی و یادآوری', 'دامنه اختصاصی'],
                        ],
                        [
                            'packageId' => '',
                            'title' => 'حرفه ای',
                            'description' => 'مناسب سالن های رو به رشد',
                            'badgeText' => 'پیشنهادی',
                            'buttonText' => 'ثبت سفارش',
                            'buttonVariant' => 'default',
                            'featured' => true,
                            'showOnHome' => true,
                            'features' => ['3 کاربر', 'کمپین پیامکی هدفمند', 'فروشگاه آنلاین'],
                        ],
                        [
                            'packageId' => '',
                            'title' => 'رشد برند',
                            'description' => 'برای تیم های بزرگ تر',
                            'badgeText' => '',
                            'buttonText' => 'ثبت سفارش',
                            'buttonVariant' => 'outline',
                            'featured' => false,
                            'showOnHome' => true,
                            'features' => ['کاربر بیشتر / سفارشی', 'شخصی سازی گسترده', 'پشتیبانی ویژه'],
                        ],
                    ],
                ],
            ],
            [
                'section_key' => 'faq',
                'section_type' => 'faq',
                'name' => 'سوالات متداول',
                'sort_order' => 90,
                'content_json' => [
                    'title' => 'سوالات متداول',
                    'description' => '',
                    'items' => [
                        ['question' => 'این سیستم دقیقاً برای چه کسانی مناسب است؟', 'answer' => 'برای آرایشگر مستقل، سالن های کوچک و تیم های چندنفره، ناخن کار، مژه کار، میکاپ آرتیست و کسب و کارهای خدمات زیبایی مناسب است.', 'sortOrder' => 10, 'showOnHome' => true],
                        ['question' => 'مشتری های من بلدند با این سیستم کار کنند؟', 'answer' => 'بله. مسیر ورود و ثبت نوبت بسیار ساده است و کاربر با شماره موبایل وارد می شود.', 'sortOrder' => 20, 'showOnHome' => true],
                        ['question' => 'اگر یک روز تعطیل باشم یا برنامه عوض شود چه می شود؟', 'answer' => 'مدیر می تواند برنامه کاری را مدیریت کند، زمان ها را تغییر دهد و سناریوهای اطلاع رسانی را اجرا کند.', 'sortOrder' => 30, 'showOnHome' => false],
                        ['question' => 'پیامک ها خودکار است یا دستی؟', 'answer' => 'هر دو حالت وجود دارد؛ یادآوری ها می تواند خودکار باشد و کمپین های تبلیغاتی هم هدفمند ارسال می شوند.', 'sortOrder' => 40, 'showOnHome' => false],
                        ['question' => 'سایت اختصاصی با برند خودم می گیرم؟', 'answer' => 'بله، سایت با نام برند شما تنظیم می شود و امکان اتصال دامنه اختصاصی هم وجود دارد.', 'sortOrder' => 50, 'showOnHome' => false],
                        ['question' => 'اگر بخواهم بعداً ارتقا بدهم یا تیم اضافه کنم؟', 'answer' => 'در هر زمان می توانید پلن را ارتقا دهید و متناسب با تعداد کاربران و ماژول ها توسعه دهید.', 'sortOrder' => 60, 'showOnHome' => false],
                    ],
                ],
            ],
            [
                'section_key' => 'footer_cta',
                'section_type' => 'footer_cta',
                'name' => 'فوتر دعوت به اقدام',
                'sort_order' => 100,
                'content_json' => [
                    'title' => 'یک پله بالاتر باشید',
                    'buttonText' => 'شروع خرید پکیج',
                    'buttonUrl' => '/plans',
                    'copyrightText' => '© پله — تمامی حقوق محفوظ است.',
                ],
            ],
        ];
    }

    public static function homeSectionByKey(string $sectionKey): ?array
    {
        foreach (self::homeSections() as $section) {
            if ($section['section_key'] === $sectionKey) {
                return $section;
            }
        }

        return null;
    }

    public static function sliderDefaultContent(): array
    {
        return (array) (self::homeSectionByKey('slider')['content_json'] ?? []);
    }

    public static function painPointsDefaultContent(): array
    {
        return (array) (self::homeSectionByKey('pain_points')['content_json'] ?? []);
    }

    public static function videoIntroDefaultContent(): array
    {
        return (array) (self::homeSectionByKey('video_intro')['content_json'] ?? []);
    }

    public static function beforeAfterDefaultContent(): array
    {
        return (array) (self::homeSectionByKey('before_after')['content_json'] ?? []);
    }

    public static function galleryShowcaseDefaultContent(): array
    {
        return (array) (self::homeSectionByKey('gallery_showcase')['content_json'] ?? []);
    }

    public static function featureGridDefaultContent(): array
    {
        return (array) (self::homeSectionByKey('feature_grid')['content_json'] ?? []);
    }

    public static function processStepsDefaultContent(): array
    {
        return (array) (self::homeSectionByKey('process_steps')['content_json'] ?? []);
    }

    public static function plansDefaultContent(): array
    {
        return (array) (self::homeSectionByKey('plans')['content_json'] ?? []);
    }

    public static function faqDefaultContent(): array
    {
        return (array) (self::homeSectionByKey('faq')['content_json'] ?? []);
    }

    public static function footerCtaDefaultContent(): array
    {
        return (array) (self::homeSectionByKey('footer_cta')['content_json'] ?? []);
    }
}
