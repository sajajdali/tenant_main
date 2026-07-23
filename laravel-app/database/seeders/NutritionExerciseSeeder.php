<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\NutritionExercise;
use App\Models\NutritionExerciseGroup;
use Illuminate\Database\Seeder;

class NutritionExerciseSeeder extends Seeder
{
    public function run(): void
    {
        $groups = collect([
            ['slug' => 'cardio-running', 'title' => 'دویدن و هوازی', 'description' => 'فعالیت‌های بالا برنده ضربان قلب برای چربی‌سوزی و استقامت.', 'icon_key' => 'Flame', 'accent_color' => '#f97316', 'soft_color' => '#431407', 'sort_order' => 10],
            ['slug' => 'walking-daily', 'title' => 'پیاده روی و فعالیت روزانه', 'description' => 'ورزش‌های روزمره و کم‌فشار برای شروع یا بازیابی.', 'icon_key' => 'Footprints', 'accent_color' => '#14b8a6', 'soft_color' => '#042f2e', 'sort_order' => 20],
            ['slug' => 'strength-gym', 'title' => 'بدنسازی و قدرتی', 'description' => 'تمرین‌های مقاومتی، باشگاهی و فرم‌دهی عضلات.', 'icon_key' => 'Dumbbell', 'accent_color' => '#ef4444', 'soft_color' => '#450a0a', 'sort_order' => 30],
            ['slug' => 'ball-sports', 'title' => 'ورزش های توپی', 'description' => 'ورزش‌های تیمی و توپی با تحرک متنوع و هیجان بالا.', 'icon_key' => 'Volleyball', 'accent_color' => '#3b82f6', 'soft_color' => '#172554', 'sort_order' => 40],
            ['slug' => 'water-sports', 'title' => 'ورزش های آبی', 'description' => 'فعالیت‌های آبی برای استقامت، تنفس و فرم بدن.', 'icon_key' => 'Waves', 'accent_color' => '#06b6d4', 'soft_color' => '#083344', 'sort_order' => 50],
            ['slug' => 'combat', 'title' => 'رزمی', 'description' => 'تمرین‌های انفجاری و قدرتی با درگیری کامل بدن.', 'icon_key' => 'Shield', 'accent_color' => '#e11d48', 'soft_color' => '#4c0519', 'sort_order' => 60],
            ['slug' => 'cycling', 'title' => 'دوچرخه سواری', 'description' => 'دوچرخه، اسپینینگ و تمرین‌های هوازی سرعتی.', 'icon_key' => 'Bike', 'accent_color' => '#84cc16', 'soft_color' => '#1a2e05', 'sort_order' => 70],
            ['slug' => 'mind-body', 'title' => 'یوگا و کششی', 'description' => 'تمرین‌های آرام، تعادلی و انعطاف‌پذیری.', 'icon_key' => 'Flower2', 'accent_color' => '#22c55e', 'soft_color' => '#052e16', 'sort_order' => 80],
            ['slug' => 'outdoor', 'title' => 'طبیعت و کوه', 'description' => 'کوه‌پیمایی، طبیعت‌گردی و چالش‌های فضای باز.', 'icon_key' => 'Mountain', 'accent_color' => '#8b5cf6', 'soft_color' => '#2e1065', 'sort_order' => 90],
            ['slug' => 'dance-fun', 'title' => 'رقص و ریتمیک', 'description' => 'حرکت‌های موزون، شاد و پرکالری برای کل بدن.', 'icon_key' => 'Music4', 'accent_color' => '#ec4899', 'soft_color' => '#500724', 'sort_order' => 100],
            ['slug' => 'racket-precision', 'title' => 'راکتی و دقتی', 'description' => 'ورزش‌های راکتی، مهارتی و هدف‌محور با تحرک یا تمرکز بالا.', 'icon_key' => 'CircleDot', 'accent_color' => '#0ea5e9', 'soft_color' => '#082f49', 'sort_order' => 110],
            ['slug' => 'winter-ice', 'title' => 'زمستانی و یخی', 'description' => 'ورزش‌های برفی، یخی و سرسره‌ای برای تعادل، سرعت و استقامت.', 'icon_key' => 'MountainSnow', 'accent_color' => '#38bdf8', 'soft_color' => '#0c4a6e', 'sort_order' => 120],
            ['slug' => 'adventure-motor', 'title' => 'ماجراجویی و مهارتی', 'description' => 'ورزش‌های چالشی، موتورمحور و تکنیکی در فضای باز یا پیست.', 'icon_key' => 'Gauge', 'accent_color' => '#f43f5e', 'soft_color' => '#4c0519', 'sort_order' => 130],
        ])->mapWithKeys(function (array $group): array {
            $model = NutritionExerciseGroup::query()->updateOrCreate(
                ['slug' => $group['slug']],
                [
                    'title' => $group['title'],
                    'description' => $group['description'],
                    'icon_key' => $group['icon_key'],
                    'accent_color' => $group['accent_color'],
                    'soft_color' => $group['soft_color'],
                    'sort_order' => $group['sort_order'],
                    'is_active' => true,
                ],
            );

            return [$group['slug'] => $model];
        });

        $exercises = [
            ['group' => 'cardio-running', 'slug' => 'walking-fast', 'title' => 'پیاده روی تند', 'description' => 'پیاده‌روی سریع برای بالا بردن ضربان قلب.', 'icon_key' => 'PersonStanding', 'badge_text' => 'شروع عالی', 'search_terms' => 'پیاده روی سریع راه رفتن تند cardio walking', 'supports_speed' => true, 'met_light' => 3.0, 'met_moderate' => 4.3, 'met_vigorous' => 5.0, 'sort_order' => 10],
            ['group' => 'cardio-running', 'slug' => 'jogging', 'title' => 'جاگینگ', 'description' => 'دو آرام برای استقامت و کالری‌سوزی پیوسته.', 'icon_key' => 'Activity', 'badge_text' => 'هوازی محبوب', 'search_terms' => 'جاگینگ دو آرام jogging run', 'supports_speed' => true, 'met_light' => 6.0, 'met_moderate' => 7.0, 'met_vigorous' => 8.3, 'sort_order' => 20],
            ['group' => 'cardio-running', 'slug' => 'running', 'title' => 'دویدن', 'description' => 'دویدن در فضای باز یا روی تردمیل.', 'icon_key' => 'TimerReset', 'badge_text' => 'پرکالری', 'search_terms' => 'دویدن رانینگ treadmill run sprint', 'supports_speed' => true, 'supports_distance' => true, 'met_light' => 7.0, 'met_moderate' => 9.8, 'met_vigorous' => 11.8, 'sort_order' => 30],
            ['group' => 'cardio-running', 'slug' => 'stair-climber', 'title' => 'استپ و پله', 'description' => 'بالا رفتن از پله یا دستگاه استپر.', 'icon_key' => 'StepForward', 'badge_text' => 'پا و قلب', 'search_terms' => 'استپ پله stair climber step', 'met_light' => 5.0, 'met_moderate' => 8.8, 'met_vigorous' => 10.5, 'sort_order' => 40],
            ['group' => 'cardio-running', 'slug' => 'elliptical', 'title' => 'الپتیکال', 'description' => 'هوازی کم‌فشار برای کل بدن.', 'icon_key' => 'Orbit', 'badge_text' => 'مفصل پسند', 'search_terms' => 'elliptical الپتیکال', 'met_light' => 4.8, 'met_moderate' => 5.8, 'met_vigorous' => 7.0, 'sort_order' => 50],

            ['group' => 'walking-daily', 'slug' => 'casual-walking', 'title' => 'پیاده روی معمولی', 'description' => 'قدم‌زدن روزانه با شدت سبک.', 'icon_key' => 'Footprints', 'badge_text' => 'سبک', 'search_terms' => 'پیاده روی معمولی راه رفتن daily walk', 'supports_speed' => true, 'met_light' => 2.5, 'met_moderate' => 3.2, 'met_vigorous' => 4.0, 'sort_order' => 10],
            ['group' => 'walking-daily', 'slug' => 'housework', 'title' => 'کارهای خانه', 'description' => 'خانه‌داری و فعالیت‌های پیوسته روزمره.', 'icon_key' => 'Home', 'badge_text' => 'روزمره', 'search_terms' => 'خانه داری نظافت جارو housework', 'met_light' => 2.5, 'met_moderate' => 3.5, 'met_vigorous' => 4.5, 'sort_order' => 20],
            ['group' => 'walking-daily', 'slug' => 'mobility', 'title' => 'تحرک و گرم کردن', 'description' => 'حرکات نرم برای شروع تمرین یا ریکاوری.', 'icon_key' => 'RefreshCcw', 'badge_text' => 'ریکاوری', 'search_terms' => 'گرم کردن mobility warmup', 'met_light' => 2.3, 'met_moderate' => 3.0, 'met_vigorous' => 3.5, 'sort_order' => 30],
            ['group' => 'walking-daily', 'slug' => 'light-hike', 'title' => 'طبیعت گردی سبک', 'description' => 'راه‌پیمایی سبک در مسیرهای هموار.', 'icon_key' => 'Trees', 'badge_text' => 'آرام', 'search_terms' => 'طبیعت گردی سبک hiking', 'supports_speed' => true, 'supports_distance' => true, 'met_light' => 3.5, 'met_moderate' => 5.0, 'met_vigorous' => 6.0, 'sort_order' => 40],

            ['group' => 'strength-gym', 'slug' => 'bodybuilding', 'title' => 'بدنسازی عمومی', 'description' => 'تمرین مقاومتی کلاسیک با وزنه یا دستگاه.', 'icon_key' => 'Dumbbell', 'badge_text' => 'عضله سازی', 'search_terms' => 'بدنسازی باشگاه وزنه bodybuilding gym', 'met_light' => 3.5, 'met_moderate' => 5.0, 'met_vigorous' => 6.0, 'sort_order' => 10],
            ['group' => 'strength-gym', 'slug' => 'crossfit', 'title' => 'کراس فیت', 'description' => 'تمرین شدید ترکیبی قدرت و هوازی.', 'icon_key' => 'Anvil', 'badge_text' => 'شدید', 'search_terms' => 'crossfit کراسفیت', 'met_light' => 5.5, 'met_moderate' => 8.0, 'met_vigorous' => 10.0, 'sort_order' => 20],
            ['group' => 'strength-gym', 'slug' => 'trx', 'title' => 'TRX', 'description' => 'تمرین تعلیقی برای میان‌تنه و استقامت عضلات.', 'icon_key' => 'Cable', 'badge_text' => 'میان تنه', 'search_terms' => 'trx تعلیقی', 'met_light' => 3.8, 'met_moderate' => 5.0, 'met_vigorous' => 6.0, 'sort_order' => 30],
            ['group' => 'strength-gym', 'slug' => 'pilates', 'title' => 'پیلاتس', 'description' => 'تمرین کنترلی برای فرم بدن و تقویت core.', 'icon_key' => 'Focus', 'badge_text' => 'فرم دهی', 'search_terms' => 'پیلاتس pilates', 'met_light' => 3.0, 'met_moderate' => 4.0, 'met_vigorous' => 5.5, 'sort_order' => 40],
            ['group' => 'strength-gym', 'slug' => 'functional-training', 'title' => 'تمرین فانکشنال', 'description' => 'حرکت‌های چندمفصلی برای آمادگی جسمانی کامل.', 'icon_key' => 'Gauge', 'badge_text' => 'تمام بدن', 'search_terms' => 'فانکشنال functional', 'met_light' => 4.0, 'met_moderate' => 6.0, 'met_vigorous' => 8.0, 'sort_order' => 50],

            ['group' => 'ball-sports', 'slug' => 'football', 'title' => 'فوتبال', 'description' => 'بازی پرتحرک تیمی با دوهای انفجاری.', 'icon_key' => 'Goal', 'badge_text' => 'تیمی', 'search_terms' => 'فوتبال soccer football', 'met_light' => 5.0, 'met_moderate' => 7.0, 'met_vigorous' => 10.0, 'sort_order' => 10],
            ['group' => 'ball-sports', 'slug' => 'futsal', 'title' => 'فوتسال', 'description' => 'نسخه سریع و پرشدت فوتبال در سالن.', 'icon_key' => 'Goal', 'badge_text' => 'سالن', 'search_terms' => 'فوتسال futsal', 'met_light' => 6.0, 'met_moderate' => 8.0, 'met_vigorous' => 10.0, 'sort_order' => 20],
            ['group' => 'ball-sports', 'slug' => 'basketball', 'title' => 'بسکتبال', 'description' => 'تحرک متناوب، پرش و شتاب‌گیری‌های زیاد.', 'icon_key' => 'Badge', 'badge_text' => 'پرتحرک', 'search_terms' => 'بسکتبال basketball', 'met_light' => 5.0, 'met_moderate' => 6.5, 'met_vigorous' => 8.0, 'sort_order' => 30],
            ['group' => 'ball-sports', 'slug' => 'volleyball', 'title' => 'والیبال', 'description' => 'پرش و واکنش سریع در فضای تیمی.', 'icon_key' => 'Volleyball', 'badge_text' => 'واکنشی', 'search_terms' => 'والیبال volleyball', 'met_light' => 3.5, 'met_moderate' => 4.5, 'met_vigorous' => 8.0, 'sort_order' => 40],
            ['group' => 'ball-sports', 'slug' => 'tennis', 'title' => 'تنیس', 'description' => 'تحرک جانبی و استقامت هوازی با شدت قابل تنظیم.', 'icon_key' => 'Racket', 'badge_text' => 'چابکی', 'search_terms' => 'تنیس tennis', 'met_light' => 5.0, 'met_moderate' => 7.3, 'met_vigorous' => 8.5, 'sort_order' => 50],
            ['group' => 'ball-sports', 'slug' => 'table-tennis', 'title' => 'پینگ پنگ', 'description' => 'تمرکز، رفلکس و تحرک سبک تا متوسط.', 'icon_key' => 'CircleDot', 'badge_text' => 'سریع', 'search_terms' => 'پینگ پنگ تنیس روی میز table tennis', 'met_light' => 3.0, 'met_moderate' => 4.0, 'met_vigorous' => 5.0, 'sort_order' => 60],
            ['group' => 'ball-sports', 'slug' => 'handball', 'title' => 'هندبال', 'description' => 'ورزش تیمی پرتحرک با دوهای کوتاه و شتاب‌های متوالی.', 'icon_key' => 'Goal', 'badge_text' => 'تیمی', 'search_terms' => 'هندبال handball', 'met_light' => 6.0, 'met_moderate' => 8.0, 'met_vigorous' => 10.0, 'sort_order' => 70],
            ['group' => 'ball-sports', 'slug' => 'baseball', 'title' => 'بیسبال', 'description' => 'ورزش تیمی با جابه‌جایی، ضربه و دوهای انفجاری.', 'icon_key' => 'Badge', 'badge_text' => 'مهارتی', 'search_terms' => 'بیسبال baseball', 'met_light' => 4.5, 'met_moderate' => 5.8, 'met_vigorous' => 7.0, 'sort_order' => 80],
            ['group' => 'ball-sports', 'slug' => 'cricket', 'title' => 'کریکت', 'description' => 'ورزش تیمی با تحرک متناوب و نیاز به تمرکز بالا.', 'icon_key' => 'CircleDot', 'badge_text' => 'دقتی', 'search_terms' => 'کریکت cricket', 'met_light' => 3.8, 'met_moderate' => 5.0, 'met_vigorous' => 6.5, 'sort_order' => 90],
            ['group' => 'ball-sports', 'slug' => 'rugby', 'title' => 'راگبی', 'description' => 'ورزش برخوردی شدید با مصرف انرژی بسیار بالا.', 'icon_key' => 'Shield', 'badge_text' => 'سنگین', 'search_terms' => 'راگبی rugby', 'met_light' => 6.5, 'met_moderate' => 8.3, 'met_vigorous' => 10.0, 'sort_order' => 100],

            ['group' => 'water-sports', 'slug' => 'swimming-freestyle', 'title' => 'شنا آزاد', 'description' => 'شنا با شدت قابل تنظیم و کالری‌سوزی بالا.', 'icon_key' => 'Waves', 'badge_text' => 'تمام بدن', 'search_terms' => 'شنا آزاد swimming freestyle', 'met_light' => 6.0, 'met_moderate' => 8.3, 'met_vigorous' => 10.0, 'sort_order' => 10],
            ['group' => 'water-sports', 'slug' => 'swimming-breaststroke', 'title' => 'شنا قورباغه', 'description' => 'شنا با فشار یکنواخت و متوسط روی کل بدن.', 'icon_key' => 'Fish', 'badge_text' => 'تکنیکی', 'search_terms' => 'شنا قورباغه breaststroke', 'met_light' => 5.3, 'met_moderate' => 7.0, 'met_vigorous' => 10.3, 'sort_order' => 20],
            ['group' => 'water-sports', 'slug' => 'water-aerobics', 'title' => 'ایروبیک در آب', 'description' => 'تمرین هوازی کم‌فشار در محیط آبی.', 'icon_key' => 'Droplets', 'badge_text' => 'کم فشار', 'search_terms' => 'ایروبیک در آب water aerobics', 'met_light' => 4.0, 'met_moderate' => 5.5, 'met_vigorous' => 7.0, 'sort_order' => 30],
            ['group' => 'water-sports', 'slug' => 'water-polo', 'title' => 'واترپلو', 'description' => 'ورزش تیمی شدید و پرمصرف در آب.', 'icon_key' => 'ShieldEllipsis', 'badge_text' => 'شدید', 'search_terms' => 'واترپلو water polo', 'met_light' => 7.0, 'met_moderate' => 9.0, 'met_vigorous' => 10.0, 'sort_order' => 40],
            ['group' => 'water-sports', 'slug' => 'diving', 'title' => 'شیرجه و غواصی سبک', 'description' => 'فعالیت آبی فنی با مصرف انرژی متوسط.', 'icon_key' => 'Droplets', 'badge_text' => 'فنی', 'search_terms' => 'غواصی diving scuba', 'met_light' => 3.0, 'met_moderate' => 5.0, 'met_vigorous' => 7.0, 'sort_order' => 50],
            ['group' => 'water-sports', 'slug' => 'surfing', 'title' => 'موج سواری', 'description' => 'تعادل، پارو زدن و کار تمام‌بدن روی آب.', 'icon_key' => 'Waves', 'badge_text' => 'تعادلی', 'search_terms' => 'موج سواری surfing', 'met_light' => 3.0, 'met_moderate' => 5.0, 'met_vigorous' => 8.0, 'sort_order' => 60],
            ['group' => 'water-sports', 'slug' => 'kayaking', 'title' => 'کایاک', 'description' => 'قایق‌سواری پارویی با درگیری بالا در بالاتنه و core.', 'icon_key' => 'ShipWheel', 'badge_text' => 'پارویی', 'search_terms' => 'کایاک kayak kayaking canoe', 'met_light' => 3.5, 'met_moderate' => 5.0, 'met_vigorous' => 7.0, 'sort_order' => 70],
            ['group' => 'water-sports', 'slug' => 'stand-up-paddle', 'title' => 'پدل برد', 'description' => 'تمرین تعادلی و استقامتی روی آب.', 'icon_key' => 'Waves', 'badge_text' => 'تعادل', 'search_terms' => 'پدل برد sup paddle board', 'met_light' => 3.3, 'met_moderate' => 4.8, 'met_vigorous' => 6.0, 'sort_order' => 80],

            ['group' => 'combat', 'slug' => 'boxing', 'title' => 'بوکس', 'description' => 'ضربات سریع، جابه‌جایی و چربی‌سوزی بالا.', 'icon_key' => 'HandMetal', 'badge_text' => 'انفجاری', 'search_terms' => 'بوکس boxing', 'met_light' => 6.0, 'met_moderate' => 8.0, 'met_vigorous' => 12.0, 'sort_order' => 10],
            ['group' => 'combat', 'slug' => 'kickboxing', 'title' => 'کیک بوکسینگ', 'description' => 'ورزش رزمی پرتحرک با درگیری کامل بدن.', 'icon_key' => 'FlameKindling', 'badge_text' => 'قدرتی', 'search_terms' => 'کیک بوکس kickboxing', 'met_light' => 7.0, 'met_moderate' => 9.5, 'met_vigorous' => 11.5, 'sort_order' => 20],
            ['group' => 'combat', 'slug' => 'karate', 'title' => 'کاراته', 'description' => 'تمرین تکنیک، ضربه و هماهنگی بدنی.', 'icon_key' => 'Shield', 'badge_text' => 'تکنیکی', 'search_terms' => 'کاراته karate', 'met_light' => 5.0, 'met_moderate' => 7.0, 'met_vigorous' => 10.3, 'sort_order' => 30],
            ['group' => 'combat', 'slug' => 'taekwondo', 'title' => 'تکواندو', 'description' => 'ضربات پا و تمرین انفجاری برای کل بدن.', 'icon_key' => 'BadgeAlert', 'badge_text' => 'پا محور', 'search_terms' => 'تکواندو taekwondo', 'met_light' => 5.5, 'met_moderate' => 7.5, 'met_vigorous' => 10.3, 'sort_order' => 40],
            ['group' => 'combat', 'slug' => 'wrestling', 'title' => 'کشتی', 'description' => 'تمرین قدرتی شدید با درگیری بالا.', 'icon_key' => 'Swords', 'badge_text' => 'خیلی شدید', 'search_terms' => 'کشتی wrestling', 'met_light' => 6.0, 'met_moderate' => 8.0, 'met_vigorous' => 11.0, 'sort_order' => 50],
            ['group' => 'combat', 'slug' => 'judo', 'title' => 'جودو', 'description' => 'تمرین رزمی قدرتی با پرتاب و درگیری تن‌به‌تن.', 'icon_key' => 'Shield', 'badge_text' => 'قدرتی', 'search_terms' => 'جودو judo', 'met_light' => 5.0, 'met_moderate' => 7.0, 'met_vigorous' => 10.0, 'sort_order' => 60],
            ['group' => 'combat', 'slug' => 'jiu-jitsu', 'title' => 'جوجیتسو', 'description' => 'مبارزه زمینی و استقامتی با فشار یکنواخت بالا.', 'icon_key' => 'Shield', 'badge_text' => 'استقامتی', 'search_terms' => 'جوجیتسو jiu jitsu bjj', 'met_light' => 5.5, 'met_moderate' => 7.5, 'met_vigorous' => 10.0, 'sort_order' => 70],
            ['group' => 'combat', 'slug' => 'mma', 'title' => 'MMA', 'description' => 'تمرین ترکیبی شدید با درگیری کامل بدن.', 'icon_key' => 'FlameKindling', 'badge_text' => 'ترکیبی', 'search_terms' => 'mma رزمی ترکیبی', 'met_light' => 7.0, 'met_moderate' => 9.0, 'met_vigorous' => 11.0, 'sort_order' => 80],

            ['group' => 'cycling', 'slug' => 'cycling-outdoor', 'title' => 'دوچرخه سواری', 'description' => 'دوچرخه در فضای باز با امکان محاسبه بر اساس سرعت.', 'icon_key' => 'Bike', 'badge_text' => 'سرعت محور', 'search_terms' => 'دوچرخه سواری cycling biking', 'supports_speed' => true, 'supports_distance' => true, 'met_light' => 4.0, 'met_moderate' => 8.0, 'met_vigorous' => 12.0, 'sort_order' => 10],
            ['group' => 'cycling', 'slug' => 'spinning', 'title' => 'اسپینینگ', 'description' => 'دوچرخه ثابت گروهی با شدت قابل تنظیم.', 'icon_key' => 'GaugeCircle', 'badge_text' => 'باشگاهی', 'search_terms' => 'اسپینینگ spinning cycling indoor', 'supports_speed' => true, 'met_light' => 5.5, 'met_moderate' => 8.5, 'met_vigorous' => 11.0, 'sort_order' => 20],
            ['group' => 'cycling', 'slug' => 'rowing-machine', 'title' => 'روئینگ', 'description' => 'دستگاه قایقی برای قدرت و هوازی همزمان.', 'icon_key' => 'ShipWheel', 'badge_text' => 'قدرت+هوازی', 'search_terms' => 'روئینگ rowing erg', 'met_light' => 4.8, 'met_moderate' => 7.0, 'met_vigorous' => 8.5, 'sort_order' => 30],
            ['group' => 'cycling', 'slug' => 'mountain-biking', 'title' => 'دوچرخه کوهستان', 'description' => 'دوچرخه‌سواری روی مسیرهای ناهموار با فشار بیشتر.', 'icon_key' => 'Bike', 'badge_text' => 'مسیر سخت', 'search_terms' => 'دوچرخه کوهستان mountain biking mtb', 'supports_speed' => true, 'supports_distance' => true, 'met_light' => 5.5, 'met_moderate' => 8.5, 'met_vigorous' => 14.0, 'sort_order' => 40],

            ['group' => 'mind-body', 'slug' => 'yoga', 'title' => 'یوگا', 'description' => 'آرام‌سازی، تعادل و انعطاف بدنی.', 'icon_key' => 'Flower2', 'badge_text' => 'آرام', 'search_terms' => 'یوگا yoga', 'met_light' => 2.3, 'met_moderate' => 3.0, 'met_vigorous' => 4.0, 'sort_order' => 10],
            ['group' => 'mind-body', 'slug' => 'stretching', 'title' => 'حرکات کششی', 'description' => 'کشش برای کاهش گرفتگی و افزایش انعطاف.', 'icon_key' => 'Worm', 'badge_text' => 'ریکاوری', 'search_terms' => 'کشش stretching', 'met_light' => 2.0, 'met_moderate' => 2.8, 'met_vigorous' => 3.5, 'sort_order' => 20],
            ['group' => 'mind-body', 'slug' => 'meditation-breathwork', 'title' => 'تنفس و مدیتیشن فعال', 'description' => 'تمرین‌های ملایم همراه با کنترل تنفس.', 'icon_key' => 'BrainCircuit', 'badge_text' => 'آرامش', 'search_terms' => 'مدیتیشن تنفس breathwork meditation', 'met_light' => 1.8, 'met_moderate' => 2.3, 'met_vigorous' => 2.8, 'sort_order' => 30],
            ['group' => 'mind-body', 'slug' => 'barre', 'title' => 'باره', 'description' => 'تمرین فرم‌دهی با حرکات کنترل‌شده و کششی.', 'icon_key' => 'Sparkles', 'badge_text' => 'فرم دهی', 'search_terms' => 'باره barre', 'met_light' => 3.0, 'met_moderate' => 4.0, 'met_vigorous' => 5.0, 'sort_order' => 40],
            ['group' => 'mind-body', 'slug' => 'tai-chi', 'title' => 'تای چی', 'description' => 'حرکات نرم، تعادلی و کنترل‌شده با تمرکز ذهنی.', 'icon_key' => 'BrainCircuit', 'badge_text' => 'تعادل', 'search_terms' => 'تای چی tai chi', 'met_light' => 2.5, 'met_moderate' => 3.5, 'met_vigorous' => 4.5, 'sort_order' => 50],

            ['group' => 'outdoor', 'slug' => 'hiking', 'title' => 'کوه پیمایی', 'description' => 'بالا و پایین مسیر با مصرف کالری بالا.', 'icon_key' => 'Mountain', 'badge_text' => 'فضای باز', 'search_terms' => 'کوه پیمایی hiking trek', 'supports_speed' => true, 'supports_distance' => true, 'met_light' => 5.0, 'met_moderate' => 6.0, 'met_vigorous' => 7.5, 'sort_order' => 10],
            ['group' => 'outdoor', 'slug' => 'climbing', 'title' => 'سنگ نوردی', 'description' => 'تمرین تمام‌بدن با چالش قدرت و تمرکز.', 'icon_key' => 'MountainSnow', 'badge_text' => 'قدرتی', 'search_terms' => 'سنگ نوردی climbing bouldering', 'met_light' => 5.0, 'met_moderate' => 8.0, 'met_vigorous' => 11.0, 'sort_order' => 20],
            ['group' => 'outdoor', 'slug' => 'jump-rope', 'title' => 'طناب زدن', 'description' => 'هوازی شدید و سریع برای کالری‌سوزی بالا.', 'icon_key' => 'Orbit', 'badge_text' => 'سریع', 'search_terms' => 'طناب زدن jump rope skipping', 'met_light' => 8.0, 'met_moderate' => 10.0, 'met_vigorous' => 12.3, 'sort_order' => 30],
            ['group' => 'outdoor', 'slug' => 'horse-riding', 'title' => 'اسب سواری', 'description' => 'تعادل و درگیری میان‌تنه با فشار سبک تا متوسط.', 'icon_key' => 'Activity', 'badge_text' => 'تعادلی', 'search_terms' => 'اسب سواری horse riding', 'met_light' => 3.5, 'met_moderate' => 5.0, 'met_vigorous' => 7.3, 'sort_order' => 40],
            ['group' => 'outdoor', 'slug' => 'orienteering', 'title' => 'جهت یابی ورزشی', 'description' => 'دو و پیمایش در طبیعت همراه با تمرکز و تصمیم‌گیری.', 'icon_key' => 'Compass', 'badge_text' => 'چالشی', 'search_terms' => 'جهت یابی orienteering', 'supports_speed' => true, 'supports_distance' => true, 'met_light' => 5.0, 'met_moderate' => 8.0, 'met_vigorous' => 9.5, 'sort_order' => 50],

            ['group' => 'dance-fun', 'slug' => 'dance-fitness', 'title' => 'رقص فیتنس', 'description' => 'حرکت موزون با تمرکز روی چربی‌سوزی و شادی.', 'icon_key' => 'Music4', 'badge_text' => 'شاد', 'search_terms' => 'رقص زومبا dance fitness', 'met_light' => 4.5, 'met_moderate' => 6.5, 'met_vigorous' => 8.5, 'sort_order' => 10],
            ['group' => 'dance-fun', 'slug' => 'zumba', 'title' => 'زومبا', 'description' => 'کلاس موزیکال پرتحرک و پرانرژی.', 'icon_key' => 'Disc3', 'badge_text' => 'پرانرژی', 'search_terms' => 'زومبا zumba dance', 'met_light' => 5.5, 'met_moderate' => 7.3, 'met_vigorous' => 9.5, 'sort_order' => 20],
            ['group' => 'dance-fun', 'slug' => 'aerobics', 'title' => 'ایروبیک', 'description' => 'هوازی ریتم‌دار کلاسیک برای کل بدن.', 'icon_key' => 'AudioLines', 'badge_text' => 'کلاسیک', 'search_terms' => 'ایروبیک aerobics', 'met_light' => 5.0, 'met_moderate' => 6.5, 'met_vigorous' => 8.0, 'sort_order' => 30],
            ['group' => 'dance-fun', 'slug' => 'hip-hop-dance', 'title' => 'رقص هیپ هاپ', 'description' => 'ریتم، جهش و تحرک بالاتر نسبت به رقص‌های سبک.', 'icon_key' => 'Music4', 'badge_text' => 'پرریتم', 'search_terms' => 'هیپ هاپ hip hop dance', 'met_light' => 5.0, 'met_moderate' => 7.0, 'met_vigorous' => 8.5, 'sort_order' => 40],

            ['group' => 'racket-precision', 'slug' => 'badminton', 'title' => 'بدمینتون', 'description' => 'ورزش راکتی چابک با جابه‌جایی سریع و کالری‌سوزی خوب.', 'icon_key' => 'Racket', 'badge_text' => 'چابک', 'search_terms' => 'بدمینتون badminton', 'met_light' => 4.5, 'met_moderate' => 5.5, 'met_vigorous' => 7.0, 'sort_order' => 10],
            ['group' => 'racket-precision', 'slug' => 'squash', 'title' => 'اسکواش', 'description' => 'ورزش راکتی بسیار پرتحرک در فضای بسته.', 'icon_key' => 'Racket', 'badge_text' => 'شدید', 'search_terms' => 'اسکواش squash', 'met_light' => 6.0, 'met_moderate' => 8.0, 'met_vigorous' => 12.0, 'sort_order' => 20],
            ['group' => 'racket-precision', 'slug' => 'padel', 'title' => 'پدل', 'description' => 'ورزش راکتی مدرن با تحرک متوسط تا شدید.', 'icon_key' => 'Racket', 'badge_text' => 'مدرن', 'search_terms' => 'پدل padel', 'met_light' => 4.8, 'met_moderate' => 6.5, 'met_vigorous' => 8.0, 'sort_order' => 30],
            ['group' => 'racket-precision', 'slug' => 'billiards', 'title' => 'بیلیارد', 'description' => 'ورزش مهارتی و تمرکزی با تحرک سبک.', 'icon_key' => 'CircleDot', 'badge_text' => 'تمرکزی', 'search_terms' => 'بیلیارد billiards pool snooker', 'met_light' => 2.0, 'met_moderate' => 2.8, 'met_vigorous' => 3.5, 'sort_order' => 40],
            ['group' => 'racket-precision', 'slug' => 'bowling', 'title' => 'بولینگ', 'description' => 'ورزش مهارتی با درگیری سبک و تکرارشونده.', 'icon_key' => 'CircleDot', 'badge_text' => 'مهارتی', 'search_terms' => 'بولینگ bowling', 'met_light' => 2.5, 'met_moderate' => 3.0, 'met_vigorous' => 4.0, 'sort_order' => 50],
            ['group' => 'racket-precision', 'slug' => 'golf', 'title' => 'گلف', 'description' => 'ورزش دقتی همراه با راه‌رفتن و کنترل ضربه.', 'icon_key' => 'CircleDot', 'badge_text' => 'دقتی', 'search_terms' => 'گلف golf', 'met_light' => 2.5, 'met_moderate' => 4.3, 'met_vigorous' => 5.3, 'sort_order' => 60],
            ['group' => 'racket-precision', 'slug' => 'archery', 'title' => 'تیراندازی با کمان', 'description' => 'ورزش تمرکزی برای کنترل بدن و دقت.', 'icon_key' => 'CircleDot', 'badge_text' => 'تمرکز', 'search_terms' => 'تیراندازی با کمان archery', 'met_light' => 2.3, 'met_moderate' => 2.8, 'met_vigorous' => 4.0, 'sort_order' => 70],
            ['group' => 'racket-precision', 'slug' => 'darts', 'title' => 'دارت', 'description' => 'فعالیت دقتی سبک با مصرف انرژی کم.', 'icon_key' => 'CircleDot', 'badge_text' => 'سبک', 'search_terms' => 'دارت darts', 'met_light' => 1.8, 'met_moderate' => 2.0, 'met_vigorous' => 2.5, 'sort_order' => 80],
            ['group' => 'racket-precision', 'slug' => 'shooting', 'title' => 'تیراندازی', 'description' => 'ورزش مهارتی با تحرک کم و تمرکز بالا.', 'icon_key' => 'CircleDot', 'badge_text' => 'مهارت', 'search_terms' => 'تیراندازی shooting target', 'met_light' => 2.0, 'met_moderate' => 2.5, 'met_vigorous' => 3.0, 'sort_order' => 90],

            ['group' => 'winter-ice', 'slug' => 'skiing-downhill', 'title' => 'اسکی', 'description' => 'اسکی روی برف با مصرف انرژی متوسط تا بالا.', 'icon_key' => 'MountainSnow', 'badge_text' => 'زمستانی', 'search_terms' => 'اسکی ski skiing downhill', 'met_light' => 5.3, 'met_moderate' => 6.8, 'met_vigorous' => 8.0, 'sort_order' => 10],
            ['group' => 'winter-ice', 'slug' => 'cross-country-ski', 'title' => 'اسکی صحرانوردی', 'description' => 'اسکی استقامتی با کالری‌سوزی بالا.', 'icon_key' => 'MountainSnow', 'badge_text' => 'استقامتی', 'search_terms' => 'اسکی صحرانوردی cross country ski', 'met_light' => 7.0, 'met_moderate' => 9.0, 'met_vigorous' => 12.5, 'sort_order' => 20],
            ['group' => 'winter-ice', 'slug' => 'snowboarding', 'title' => 'اسنوبرد', 'description' => 'ورزش زمستانی تعادلی و قدرتی روی برف.', 'icon_key' => 'MountainSnow', 'badge_text' => 'تعادل', 'search_terms' => 'اسنوبرد snowboard', 'met_light' => 4.5, 'met_moderate' => 6.0, 'met_vigorous' => 8.0, 'sort_order' => 30],
            ['group' => 'winter-ice', 'slug' => 'ice-skating', 'title' => 'اسکیت روی یخ', 'description' => 'ورزش یخی برای تعادل، پاها و استقامت.', 'icon_key' => 'Orbit', 'badge_text' => 'یخی', 'search_terms' => 'اسکیت روی یخ ice skating', 'met_light' => 5.0, 'met_moderate' => 7.0, 'met_vigorous' => 9.0, 'sort_order' => 40],
            ['group' => 'winter-ice', 'slug' => 'roller-skating', 'title' => 'اسکیت', 'description' => 'اسکیت با شدت قابل تنظیم برای پا و core.', 'icon_key' => 'Orbit', 'badge_text' => 'چرخی', 'search_terms' => 'اسکیت skating roller skate', 'met_light' => 5.0, 'met_moderate' => 7.0, 'met_vigorous' => 9.5, 'sort_order' => 50],
            ['group' => 'winter-ice', 'slug' => 'ice-hockey', 'title' => 'هاکی روی یخ', 'description' => 'ورزش تیمی بسیار پرتحرک و شدید.', 'icon_key' => 'Shield', 'badge_text' => 'خیلی شدید', 'search_terms' => 'هاکی hockey ice hockey', 'met_light' => 6.0, 'met_moderate' => 8.0, 'met_vigorous' => 10.0, 'sort_order' => 60],
            ['group' => 'winter-ice', 'slug' => 'field-hockey', 'title' => 'هاکی', 'description' => 'هاکی روی زمین با دویدن و شتاب‌های متوالی.', 'icon_key' => 'Shield', 'badge_text' => 'تیمی', 'search_terms' => 'هاکی field hockey', 'met_light' => 5.5, 'met_moderate' => 7.8, 'met_vigorous' => 9.5, 'sort_order' => 70],

            ['group' => 'adventure-motor', 'slug' => 'skateboarding', 'title' => 'اسکیت بورد', 'description' => 'مهارت، تعادل و کار بدنی سبک تا متوسط.', 'icon_key' => 'Orbit', 'badge_text' => 'تعادل', 'search_terms' => 'اسکیت بورد skateboarding', 'met_light' => 4.0, 'met_moderate' => 5.0, 'met_vigorous' => 6.5, 'sort_order' => 10],
            ['group' => 'adventure-motor', 'slug' => 'parkour', 'title' => 'پارکور', 'description' => 'حرکات انفجاری، پرش و جابه‌جایی شدید.', 'icon_key' => 'Activity', 'badge_text' => 'چالشی', 'search_terms' => 'پارکور parkour freerun', 'met_light' => 6.0, 'met_moderate' => 8.0, 'met_vigorous' => 10.5, 'sort_order' => 20],
            ['group' => 'adventure-motor', 'slug' => 'motocross', 'title' => 'موتوکراس', 'description' => 'ورزش موتورسواری چالشی با فشار بدنی متوسط.', 'icon_key' => 'Gauge', 'badge_text' => 'پیستی', 'search_terms' => 'موتوکراس motocross', 'met_light' => 3.5, 'met_moderate' => 5.0, 'met_vigorous' => 7.0, 'sort_order' => 30],
            ['group' => 'adventure-motor', 'slug' => 'atv-riding', 'title' => 'چهارچرخ و ATV', 'description' => 'فعالیت موتورمحور با کنترل و تنش بدنی متوسط.', 'icon_key' => 'Gauge', 'badge_text' => 'ماجراجویی', 'search_terms' => 'atv چهارچرخ offroad', 'met_light' => 3.0, 'met_moderate' => 4.0, 'met_vigorous' => 5.5, 'sort_order' => 40],
            ['group' => 'adventure-motor', 'slug' => 'gymnastics', 'title' => 'ژیمناستیک', 'description' => 'قدرت، انعطاف و کنترل تمام بدن.', 'icon_key' => 'Sparkles', 'badge_text' => 'کنترلی', 'search_terms' => 'ژیمناستیک gymnastics', 'met_light' => 3.8, 'met_moderate' => 5.5, 'met_vigorous' => 8.0, 'sort_order' => 50],
        ];

        foreach ($exercises as $exercise) {
            $group = $groups->get($exercise['group']);
            if (! $group) {
                continue;
            }

            NutritionExercise::query()->updateOrCreate(
                ['slug' => $exercise['slug']],
                [
                    'nutrition_exercise_group_id' => $group->id,
                    'title' => $exercise['title'],
                    'description' => $exercise['description'],
                    'icon_key' => $exercise['icon_key'],
                    'badge_text' => $exercise['badge_text'] ?? null,
                    'search_terms' => $exercise['search_terms'] ?? null,
                    'supports_intensity' => $exercise['supports_intensity'] ?? true,
                    'supports_distance' => $exercise['supports_distance'] ?? false,
                    'supports_speed' => $exercise['supports_speed'] ?? false,
                    'default_intensity' => $exercise['default_intensity'] ?? 'moderate',
                    'met_light' => $exercise['met_light'] ?? null,
                    'met_moderate' => $exercise['met_moderate'] ?? null,
                    'met_vigorous' => $exercise['met_vigorous'] ?? null,
                    'sort_order' => $exercise['sort_order'] ?? 0,
                    'is_active' => true,
                ],
            );
        }
    }
}
