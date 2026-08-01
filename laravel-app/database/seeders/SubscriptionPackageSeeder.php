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
            ['name' => 'بسته ۱ ماهه', 'duration_days' => 30, 'sort_order' => 30],
            ['name' => 'بسته ۳ ماهه', 'duration_days' => 90, 'sort_order' => 50],
            ['name' => 'بسته ۶ ماهه', 'duration_days' => 180, 'sort_order' => 80],
            ['name' => 'بسته ۱ ساله', 'duration_days' => 365, 'sort_order' => 90],
        ];
        $userLimits = [1, 2, 3, 5, 10, null];
        $monthlyPayableAmounts = [
            1 => 1100000,
            2 => 1700000,
            3 => 2300000,
            5 => 3800000,
            10 => 6900000,
            'unlimited' => 9900000,
        ];
        $durationMultipliers = [
            30 => 1.0,
            90 => 2.7,
            180 => 4.92,
            365 => 8.4,
        ];

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
                        'price_amount' => $this->priceAmount($monthlyPayableAmounts, $durationMultipliers, $userLimit, $base['duration_days']),
                        'discounted_price_amount' => $this->discountedPriceAmount($monthlyPayableAmounts, $durationMultipliers, $userLimit, $base['duration_days']),
                        'sms_credit_gift_amount' => 15000,
                        'sort_order' => ($base['sort_order'] * 10) + $index,
                        'is_active' => true,
                    ],
                );
            }
        }
    }

    private function discountedPriceAmount(array $monthlyPayableAmounts, array $durationMultipliers, ?int $userLimit, int $durationDays): ?int
    {
        $limitKey = $userLimit ?? 'unlimited';
        if (! isset($monthlyPayableAmounts[$limitKey], $durationMultipliers[$durationDays])) {
            return null;
        }

        return (int) round(($monthlyPayableAmounts[$limitKey] * $durationMultipliers[$durationDays]) / 10000) * 10000;
    }

    private function priceAmount(array $monthlyPayableAmounts, array $durationMultipliers, ?int $userLimit, int $durationDays): int
    {
        $discounted = $this->discountedPriceAmount($monthlyPayableAmounts, $durationMultipliers, $userLimit, $durationDays);

        return $discounted ? (int) round(($discounted * 1.3) / 10000) * 10000 : 0;
    }
}
