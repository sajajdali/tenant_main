<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Landing\Models\LandingCustomer;
use App\Domain\Landing\Models\LandingOrder;
use App\Domain\Landing\Models\LandingOrderPayment;
use App\Domain\Landing\Models\LandingSite;
use App\Domain\Tenant\Models\AudienceType;
use App\Domain\Tenant\Models\DiscountCode;
use App\Domain\Tenant\Models\DiscountCodeRedemption;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantSubscriptionPayment;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DiscountCodeService
{
    public function __construct(
        private readonly SalesTrackingService $salesTracking,
    ) {
    }

    public function resolveForLanding(
        ?string $rawCode,
        AudienceType $audienceType,
        int $baseAmount,
    ): array {
        return $this->resolveDiscount(
            rawCode: $rawCode,
            audienceType: $audienceType,
            baseAmount: $baseAmount,
            target: 'initial_purchase',
        );
    }

    public function resolveForRenewal(
        ?string $rawCode,
        AudienceType $audienceType,
        int $baseAmount,
    ): array {
        return $this->resolveDiscount(
            rawCode: $rawCode,
            audienceType: $audienceType,
            baseAmount: $baseAmount,
            target: 'renewal',
        );
    }

    public function recordLandingRedemption(
        DiscountCode $code,
        LandingSite $landingSite,
        LandingCustomer $customer,
        LandingOrder $order,
        LandingOrderPayment $payment,
        array $discount,
    ): void {
        $redemption = DiscountCodeRedemption::query()->create([
            'discount_code_id' => $code->id,
            'audience_type_id' => $order->audience_type_id,
            'sales_user_id' => $code->sales_user_id,
            'context_type' => 'landing_order',
            'landing_site_id' => $landingSite->id,
            'landing_customer_id' => $customer->id,
            'landing_order_id' => $order->id,
            'landing_order_payment_id' => $payment->id,
            'customer_mobile' => $customer->mobile,
            'base_amount' => (int) ($discount['baseAmount'] ?? 0),
            'discount_amount' => (int) ($discount['discountAmount'] ?? 0),
            'payable_amount' => (int) ($discount['payableAmount'] ?? 0),
            'meta_json' => [
                'code' => $code->code,
                'target' => 'initial_purchase',
                'salesUserId' => $code->sales_user_id,
                'salesUserRole' => $code->salesUser?->role,
                'connectedTeacherUserId' => $code->connectedTeacherId(),
                'restrictToTeacherCourses' => $code->restrictToTeacherCourses(),
            ],
            'redeemed_at' => now(),
        ]);

        $this->salesTracking->trackLandingSale($code, $redemption, $customer, $order, $payment);
    }

    public function recordRenewalRedemption(
        DiscountCode $code,
        Tenant $tenant,
        TenantSubscriptionPayment $payment,
        array $discount,
    ): void {
        $redemption = DiscountCodeRedemption::query()->create([
            'discount_code_id' => $code->id,
            'audience_type_id' => $tenant->audience_type_id,
            'sales_user_id' => $code->sales_user_id,
            'context_type' => 'support_renewal',
            'tenant_id' => (string) $tenant->id,
            'tenant_subscription_payment_id' => $payment->id,
            'customer_mobile' => $payment->initiated_by_mobile,
            'base_amount' => (int) ($discount['baseAmount'] ?? 0),
            'discount_amount' => (int) ($discount['discountAmount'] ?? 0),
            'payable_amount' => (int) ($discount['payableAmount'] ?? 0),
            'meta_json' => [
                'code' => $code->code,
                'target' => 'renewal',
                'salesUserId' => $code->sales_user_id,
                'salesUserRole' => $code->salesUser?->role,
                'connectedTeacherUserId' => $code->connectedTeacherId(),
                'restrictToTeacherCourses' => $code->restrictToTeacherCourses(),
            ],
            'redeemed_at' => now(),
        ]);

        $this->salesTracking->trackRenewalSale($code, $redemption, $tenant, $payment);
    }

    private function resolveDiscount(
        ?string $rawCode,
        AudienceType $audienceType,
        int $baseAmount,
        string $target,
    ): array {
        $normalized = Str::upper(trim((string) $rawCode));

        if ($normalized === '') {
            return [
                'discountCode' => null,
                'code' => null,
                'discountAmount' => 0,
                'baseAmount' => max(0, $baseAmount),
                'payableAmount' => max(0, $baseAmount),
            ];
        }

        /** @var DiscountCode|null $code */
        $code = DiscountCode::query()
            ->with(['audienceType', 'salesUser'])
            ->whereRaw('UPPER(code) = ?', [$normalized])
            ->first();

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

        if ($code->audience_type_id !== null && (int) $code->audience_type_id !== (int) $audienceType->id) {
            throw ValidationException::withMessages([
                'discount_code' => 'این کد تخفیف برای این طیف کاری قابل استفاده نیست.',
            ]);
        }

        if (! in_array($code->applies_to, ['both', $target], true)) {
            throw ValidationException::withMessages([
                'discount_code' => $target === 'renewal'
                    ? 'این کد فقط برای خرید اولیه قابل استفاده است.'
                    : 'این کد فقط برای تمدید قابل استفاده است.',
            ]);
        }

        if ($code->starts_at && now()->lt($code->starts_at)) {
            throw ValidationException::withMessages([
                'discount_code' => 'زمان شروع استفاده از این کد هنوز نرسیده است.',
            ]);
        }

        if ($code->ends_at && now()->gt($code->ends_at)) {
            throw ValidationException::withMessages([
                'discount_code' => 'مهلت استفاده از این کد تخفیف به پایان رسیده است.',
            ]);
        }

        $baseAmount = max(0, $baseAmount);

        if ($code->minimum_amount !== null && $baseAmount < (int) $code->minimum_amount) {
            throw ValidationException::withMessages([
                'discount_code' => 'مبلغ این سفارش به حداقل لازم برای استفاده از کد تخفیف نرسیده است.',
            ]);
        }

        if ($code->maximum_amount !== null && $baseAmount > (int) $code->maximum_amount) {
            throw ValidationException::withMessages([
                'discount_code' => 'این کد تخفیف برای این مبلغ قابل استفاده نیست.',
            ]);
        }

        if ($code->max_uses !== null) {
            $usedCount = DiscountCodeRedemption::query()
                ->where('discount_code_id', $code->id)
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

        if ($code->maximum_discount_amount !== null) {
            $discountAmount = min($discountAmount, (int) $code->maximum_discount_amount);
        }

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
                'salesUserId' => $code->sales_user_id !== null ? (string) $code->sales_user_id : null,
                'salesUserName' => $code->salesUser?->name,
                'salesUserRole' => $code->salesUser?->role,
                'connectedTeacherUserId' => $code->connectedTeacherId(),
                'restrictToTeacherCourses' => $code->restrictToTeacherCourses(),
            ],
            'discountAmount' => $discountAmount,
            'baseAmount' => $baseAmount,
            'payableAmount' => max(0, $baseAmount - $discountAmount),
        ];
    }
}
