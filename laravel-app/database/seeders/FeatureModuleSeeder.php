<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domain\Tenant\Models\AudienceType;
use App\Domain\Tenant\Models\FeatureModule;
use Illuminate\Database\Seeder;

class FeatureModuleSeeder extends Seeder
{
    public function run(): void
    {
        $audiences = AudienceType::query()->get()->keyBy('slug');
        $definitions = [
            'online-store' => [
                'name' => 'فروشگاه آنلاین',
                'description' => 'محصولات مجموعه را آنلاین بفروشید، سفارش بگیرید و مدیریت فروش را کنار سامانه اصلی داشته باشید.',
                'monthly_price_amount' => 100000,
                'sort_order' => 10,
                'metadata' => [
                    'cta_note' => 'این ماژول نیاز به فعال‌سازی و پرداخت هزینه جداگانه دارد.',
                ],
                'prices' => [
                    'barbers' => 100000,
                    'doctors' => 200000,
                    'lawyers' => 140000,
                    'consultants' => 140000,
                    'experts' => 140000,
                ],
            ],
            'vip-customers' => [
                'name' => 'مشتریان VIP',
                'description' => 'می‌توانید مشتری vip داشته باشید و ساعت‌های خاص برای آنها تعریف کنید.',
                'monthly_price_amount' => 80000,
                'sort_order' => 20,
                'metadata' => [
                    'cta_note' => 'بعد از فعال‌سازی این ماژول، می‌توانید مشتری‌های VIP و ساعت‌های اختصاصی برای آن‌ها تعریف کنید.',
                ],
                'prices' => [
                    'barbers' => 80000,
                    'doctors' => 120000,
                    'lawyers' => 90000,
                    'consultants' => 90000,
                    'experts' => 90000,
                ],
            ],
            'customer-club' => [
                'name' => 'باشگاه مشتریان',
                'description' => 'امتیاز، کیف پول، سطح‌بندی و جوایز را برای افزایش مراجعات دوباره مشتری‌ها فعال کنید.',
                'monthly_price_amount' => 140000,
                'sort_order' => 30,
                'metadata' => [
                    'cta_note' => 'بعد از فعال‌سازی این ماژول، می‌توانید باشگاه مشتریان، کیف پول، سطح‌ها و جوایز را کامل مدیریت کنید.',
                ],
                'prices' => [
                    'barbers' => 140000,
                    'doctors' => 220000,
                    'lawyers' => 160000,
                    'consultants' => 160000,
                    'experts' => 160000,
                ],
            ],
            'customer-feedback' => [
                'name' => 'نظرسنجی و رضایت مشتری',
                'description' => 'بعد از نوبت برای مشتری‌ها نظرسنجی بفرستید و رضایت خدمات را دقیق‌تر مدیریت کنید.',
                'monthly_price_amount' => 50000,
                'sort_order' => 40,
                'metadata' => [
                    'cta_note' => 'بعد از فعال‌سازی این ماژول، می‌توانید تنظیمات نظرسنجی، سوال‌ها و پیامک رضایت مشتری را کامل مدیریت کنید.',
                ],
                'prices' => [
                    'barbers' => 50000,
                    'doctors' => 50000,
                    'lawyers' => 50000,
                    'consultants' => 50000,
                    'experts' => 50000,
                ],
            ],
            'online-chat' => [
                'name' => 'چت آنلاین',
                'description' => 'با مشتریان خود آنلاین چت کنید و پیغام بفرستید.',
                'monthly_price_amount' => 50000,
                'sort_order' => 50,
                'metadata' => [
                    'cta_note' => 'بعد از فعال‌سازی این ماژول، می‌توانید چت آنلاین با مشتریان را برای سامانه خود فعال کنید.',
                ],
                'prices' => [
                    'barbers' => 50000,
                    'doctors' => 50000,
                    'lawyers' => 50000,
                    'consultants' => 50000,
                    'experts' => 50000,
                    'nutritionists' => 50000,
                    'nutrition-doctors' => 50000,
                ],
            ],
            'cooking-recipes' => [
                'name' => 'دستور آشپزی',
                'description' => 'دستورهای آشپزی اختصاصی را برای کاربران همین سامانه منتشر و مدیریت کنید.',
                'monthly_price_amount' => 0,
                'sort_order' => 60,
                'metadata' => [
                    'cta_note' => 'این ماژول نمونه برای تست نصب migration و seeder اختصاصی tenant است.',
                    'meta_key' => 'cookingRecipes',
                    'route_prefix' => 'cooking-recipes',
                ],
                'prices' => [
                    'barbers' => 0,
                    'doctors' => 0,
                    'lawyers' => 0,
                    'consultants' => 0,
                    'experts' => 0,
                    'nutritionists' => 0,
                    'nutrition-doctors' => 0,
                ],
            ],
        ];

        foreach ($definitions as $slug => $definition) {
            $module = FeatureModule::query()->updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $definition['name'],
                    'description' => $definition['description'],
                    'monthly_price_amount' => $definition['monthly_price_amount'],
                    'sort_order' => $definition['sort_order'],
                    'is_active' => true,
                    'metadata' => $definition['metadata'],
                ],
            );

            $module->audiencePrices()->delete();

            foreach ($definition['prices'] as $audienceSlug => $amount) {
                $audience = $audiences->get($audienceSlug);

                if (! $audience) {
                    continue;
                }

                $module->audiencePrices()->create([
                    'audience_type_id' => $audience->id,
                    'monthly_price_amount' => $amount,
                ]);
            }
        }
    }
}
