<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\ReferralLead;
use App\Domain\Tenant\Models\SubscriptionPackage;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantUser;
use App\Support\InputNormalizer;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReferralService
{
    public function createLead(Tenant $tenant, TenantUser $actor, string $mobile): ReferralLead
    {
        $normalized = InputNormalizer::mobile($mobile);

        if (! is_string($normalized) || preg_match('/^09\d{9}$/', $normalized) !== 1) {
            throw ValidationException::withMessages([
                'mobile' => 'شماره موبایل باید ۱۱ رقم، فقط عدد و با ۰۹ شروع شود.',
            ]);
        }

        if ($normalized === InputNormalizer::mobile((string) $actor->mobile)) {
            throw ValidationException::withMessages([
                'mobile' => 'نمی‌توانید شماره خودتان را به عنوان معرفی ثبت کنید.',
            ]);
        }

        if (ReferralLead::query()->where('referred_mobile', $normalized)->exists()) {
            throw ValidationException::withMessages([
                'mobile' => 'این شماره قبلاً در سیستم معرفی ثبت شده است.',
            ]);
        }

        if (Tenant::query()->where('owner_user_id', '!=', null)->whereHas('owner', fn ($query) => $query->where('mobile', $normalized))->exists()) {
            throw ValidationException::withMessages([
                'mobile' => 'برای این شماره قبلاً سامانه نوبت‌دهی ساخته شده است.',
            ]);
        }

        return ReferralLead::query()->create([
            'referrer_tenant_id' => (string) $tenant->id,
            'referrer_tenant_user_id' => $actor->id,
            'referrer_name' => $actor->name,
            'referrer_mobile' => $actor->mobile,
            'referred_mobile' => $normalized,
            'status' => 'pending',
        ]);
    }

    public function applyRewardForPurchasedTenant(Tenant $purchasedTenant): ?ReferralLead
    {
        $purchasedTenant->loadMissing(['owner', 'subscriptionPackage']);

        $ownerMobile = InputNormalizer::mobile((string) $purchasedTenant->owner?->mobile);

        if (! is_string($ownerMobile) || blank($ownerMobile) || ! $purchasedTenant->subscription_package_id) {
            return null;
        }

        return DB::connection('central')->transaction(function () use ($ownerMobile, $purchasedTenant) {
            /** @var ReferralLead|null $lead */
            $lead = ReferralLead::query()
                ->where('referred_mobile', $ownerMobile)
                ->where('status', 'pending')
                ->lockForUpdate()
                ->first();

            if (! $lead || $lead->referrer_tenant_id === (string) $purchasedTenant->id) {
                return null;
            }

            $referrerTenant = Tenant::query()->lockForUpdate()->find($lead->referrer_tenant_id);
            $package = SubscriptionPackage::query()->find($purchasedTenant->subscription_package_id);

            if (! $referrerTenant || ! $package) {
                return null;
            }

            $rewardDays = max(1, (int) floor(((int) $package->duration_days) / 2));
            $previousSupportEndsAt = $referrerTenant->support_ends_at instanceof Carbon && $referrerTenant->support_ends_at->isFuture()
                ? $referrerTenant->support_ends_at->copy()
                : now();
            $newSupportEndsAt = $previousSupportEndsAt->copy()->addDays($rewardDays)->toDateString();

            $referrerTenant->update([
                'support_ends_at' => $newSupportEndsAt,
                'data' => array_merge($referrerTenant->data ?? [], [
                    'support_ends_at' => $newSupportEndsAt,
                ]),
            ]);

            $lead->update([
                'status' => 'rewarded',
                'converted_tenant_id' => (string) $purchasedTenant->id,
                'subscription_package_id' => $package->id,
                'purchased_duration_days' => (int) $package->duration_days,
                'reward_duration_days' => $rewardDays,
                'reward_previous_support_ends_at' => $previousSupportEndsAt->toDateString(),
                'reward_new_support_ends_at' => $newSupportEndsAt,
                'converted_at' => now(),
                'rewarded_at' => now(),
            ]);

            return $lead->fresh(['package', 'convertedTenant']);
        });
    }
}
