<?php

declare(strict_types=1);

namespace App\Support;

use App\Domain\Landing\Models\DomainTldPrice;
use App\Domain\Tenant\Models\Tenant;
use Illuminate\Support\Carbon;

class TenantManagedDomain
{
    private const RENEWAL_WINDOW_DAYS = 90;

    public static function summary(?Tenant $tenant = null): array
    {
        /** @var Tenant|null $tenant */
        $tenant ??= tenant();

        $mode = self::managementMode($tenant);
        $tld = trim((string) ($tenant?->managed_domain_tld ?: ($tenant?->ir_domain_registered ? '.ir' : '')));
        $registered = (bool) ($tenant?->managed_domain_registered ?? $tenant?->ir_domain_registered ?? false);
        $renewsAt = $tenant?->managed_domain_renews_at
            ? Carbon::parse($tenant->managed_domain_renews_at)->endOfDay()
            : ($tenant?->ir_domain_renews_at ? Carbon::parse($tenant->ir_domain_renews_at)->endOfDay() : null);
        $amount = $tenant?->managed_domain_amount ?? $tenant?->ir_domain_amount;
        $label = trim((string) (DomainTldPrice::query()->where('tld', $tld)->value('meta_json->label') ?? ''));
        $label = $label !== '' ? $label : ($tld !== '' ? "دامنه {$tld}" : 'دامنه');

        if ($mode === 'self_managed') {
            return [
                'enabled' => false,
                'selfManaged' => true,
                'managementMode' => $mode,
                'tld' => $tld !== '' ? $tld : null,
                'label' => $label,
                'registeredAt' => null,
                'lastPaidAt' => null,
                'renewsAt' => null,
                'expired' => false,
                'daysRemaining' => null,
                'isDueSoon' => false,
                'amount' => null,
                'statusKey' => 'self_managed',
                'statusLabel' => 'دامنه شخصی کاربر',
                'renewalAvailable' => false,
                'renewalWindowOpen' => false,
                'renewalBlockedReason' => 'این سامانه از دامنه شخصی استفاده می‌کند و امکان تمدید از این بخش را ندارد.',
            ];
        }

        if (! $registered || ! $renewsAt) {
            return [
                'enabled' => false,
                'selfManaged' => false,
                'managementMode' => $mode,
                'tld' => $tld !== '' ? $tld : '.ir',
                'label' => $tld !== '' ? $label : 'دامنه .ir',
                'registeredAt' => $tenant?->managed_domain_registered_at?->toDateString() ?? $tenant?->ir_domain_registered_at?->toDateString(),
                'lastPaidAt' => $tenant?->managed_domain_last_paid_at?->toDateString() ?? $tenant?->ir_domain_last_paid_at?->toDateString(),
                'renewsAt' => null,
                'expired' => false,
                'daysRemaining' => null,
                'isDueSoon' => false,
                'amount' => $amount,
                'statusKey' => 'not_registered',
                'statusLabel' => 'ثبت نشده',
                'renewalAvailable' => false,
                'renewalWindowOpen' => false,
                'renewalBlockedReason' => 'برای این سامانه هنوز دامنه قابل تمدید ثبت نشده است.',
            ];
        }

        $now = now();
        $expired = $now->greaterThan($renewsAt);
        $daysRemaining = $expired
            ? 0
            : $now->startOfDay()->diffInDays($renewsAt->copy()->startOfDay()) + 1;
        $isDueSoon = ! $expired && $daysRemaining <= 30;
        $renewalWindowOpen = $expired || $daysRemaining <= self::RENEWAL_WINDOW_DAYS;
        $renewalBlockedReason = $renewalWindowOpen ? null : 'هنوز زمان تمدید دامنه فرا نرسیده است.';

        return [
            'enabled' => true,
            'selfManaged' => false,
            'managementMode' => $mode,
            'tld' => $tld !== '' ? $tld : '.ir',
            'label' => $label,
            'registeredAt' => $tenant?->managed_domain_registered_at?->toDateString() ?? $tenant?->ir_domain_registered_at?->toDateString(),
            'lastPaidAt' => $tenant?->managed_domain_last_paid_at?->toDateString() ?? $tenant?->ir_domain_last_paid_at?->toDateString(),
            'renewsAt' => $renewsAt->toDateString(),
            'expired' => $expired,
            'daysRemaining' => $daysRemaining,
            'isDueSoon' => $isDueSoon,
            'amount' => $amount,
            'statusKey' => $expired ? 'expired' : ($isDueSoon ? 'due_soon' : 'active'),
            'statusLabel' => $expired ? 'منقضی شده' : ($isDueSoon ? 'در آستانه سررسید' : 'فعال'),
            'renewalAvailable' => $renewalWindowOpen,
            'renewalWindowOpen' => $renewalWindowOpen,
            'renewalBlockedReason' => $renewalBlockedReason,
        ];
    }

    public static function managementMode(?Tenant $tenant = null): string
    {
        /** @var Tenant|null $tenant */
        $tenant ??= tenant();

        $mode = trim((string) ($tenant?->domain_management_mode ?? ''));
        if (in_array($mode, ['platform_managed', 'self_managed'], true)) {
            return $mode;
        }

        $usesOwnDomain = (bool) data_get($tenant?->landingOrders()->latest('id')->first()?->meta_json ?? [], 'usesOwnDomain', false);

        return $usesOwnDomain ? 'self_managed' : 'platform_managed';
    }
}
