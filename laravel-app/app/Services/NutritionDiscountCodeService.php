<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\NutritionDiscountCode;
use App\Domain\Tenant\Models\NutritionPackage;
use App\Domain\Tenant\Models\NutritionPackageOrder;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class NutritionDiscountCodeService
{
    public function resolve(?string $rawCode, NutritionPackage $package): array
    {
        $baseAmount = (int) ($package->discounted_price_amount ?? $package->price_amount);
        $normalized = Str::upper(trim((string) $rawCode));

        if ($normalized === '') {
            return [
                'discountCode' => null,
                'code' => null,
                'discountAmount' => 0,
                'baseAmount' => $baseAmount,
                'payableAmount' => $baseAmount,
            ];
        }

        /** @var NutritionDiscountCode|null $code */
        $code = NutritionDiscountCode::query()->whereRaw('UPPER(code) = ?', [$normalized])->first();

        if (! $code) {
            throw ValidationException::withMessages([
                'discount_code' => 'کد تخفیف واردشده معتبر نیست.',
            ]);
        }

        if (! $code->is_active) {
            throw ValidationException::withMessages([
                'discount_code' => 'این کد تخفیف غیرفعال است.',
            ]);
        }

        if ($code->max_uses !== null) {
            $usedCount = NutritionPackageOrder::query()
                ->where('nutrition_discount_code_id', $code->id)
                ->where('status', 'paid')
                ->count();

            if ($usedCount >= (int) $code->max_uses) {
                throw ValidationException::withMessages([
                    'discount_code' => 'ظرفیت استفاده از این کد تخفیف تکمیل شده است.',
                ]);
            }
        }

        $discountAmount = $code->discount_type === 'percent'
            ? (int) floor(($baseAmount * (int) $code->discount_value) / 100)
            : (int) $code->discount_value;

        $discountAmount = max(0, min($baseAmount, $discountAmount));

        return [
            'discountCode' => $code,
            'code' => [
                'id' => (string) $code->id,
                'code' => $code->code,
                'title' => $code->title,
                'discountType' => $code->discount_type,
                'discountValue' => (int) $code->discount_value,
                'discountAmount' => $discountAmount,
            ],
            'discountAmount' => $discountAmount,
            'baseAmount' => $baseAmount,
            'payableAmount' => max(0, $baseAmount - $discountAmount),
        ];
    }
}
