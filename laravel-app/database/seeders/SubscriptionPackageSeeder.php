<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domain\Tenant\Models\SubscriptionPackage;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class SubscriptionPackageSeeder extends Seeder
{
    public function run(): void
    {
        $baseDurations = [
            ['name' => 'بسته ۱ روزه', 'duration_days' => 1, 'sort_order' => 10],
            ['name' => 'بسته ۱۵ روزه', 'duration_days' => 15, 'sort_order' => 20],
            ['name' => 'بسته ۱ ماهه', 'duration_days' => 30, 'sort_order' => 30],
            ['name' => 'بسته ۲ ماهه', 'duration_days' => 60, 'sort_order' => 40],
            ['name' => 'بسته ۳ ماهه', 'duration_days' => 90, 'sort_order' => 50],
            ['name' => 'بسته ۴ ماهه', 'duration_days' => 120, 'sort_order' => 60],
            ['name' => 'بسته ۵ ماهه', 'duration_days' => 150, 'sort_order' => 70],
            ['name' => 'بسته ۶ ماهه', 'duration_days' => 180, 'sort_order' => 80],
            ['name' => 'بسته ۱ ساله', 'duration_days' => 365, 'sort_order' => 90],
            ['name' => 'بسته ۲ ساله', 'duration_days' => 730, 'sort_order' => 100],
        ];
        $userLimits = [1, 2, 3, 5, 10, null];

        SubscriptionPackage::query()->update(['is_active' => false]);

        foreach ($baseDurations as $base) {
            foreach ($userLimits as $index => $userLimit) {
                $limitTitle = $userLimit === null ? 'نامحدود' : "{$userLimit} کاربر";
                $name = "{$base['name']} - {$limitTitle}";
                $slugBase = "{$base['duration_days']}-days-".($userLimit === null ? 'unlimited' : "{$userLimit}-users");

                SubscriptionPackage::query()->updateOrCreate(
                    ['slug' => Str::slug($slugBase)],
                    [
                        'name' => $name,
                        'duration_days' => $base['duration_days'],
                        'user_limit' => $userLimit,
                        'sms_credit_gift_amount' => 15000,
                        'sort_order' => ($base['sort_order'] * 10) + $index,
                        'is_active' => true,
                    ],
                );
            }
        }
    }
}
