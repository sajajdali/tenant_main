<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Booking\Models\Service;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantFeatureModule;
use App\Domain\Tenant\Models\TenantUser;

class VipFeatureService
{
    public const MODULE_SLUG = 'vip-customers';

    public function isActiveForTenant(Tenant $tenant): bool
    {
        return TenantFeatureModule::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->where(function ($query): void {
                $query->whereNull('expires_at')
                    ->orWhereDate('expires_at', '>=', now()->toDateString());
            })
            ->whereHas('featureModule', fn ($query) => $query->where('slug', self::MODULE_SLUG))
            ->exists();
    }

    public function syncCurrentTenantState(?Tenant $tenant = null): bool
    {
        $resolvedTenant = $tenant ?? tenant();

        if (! $resolvedTenant instanceof Tenant) {
            return false;
        }

        $isActive = $this->isActiveForTenant($resolvedTenant);

        if (! $isActive) {
            $this->clearVipStateInCurrentTenant();
        }

        return $isActive;
    }

    public function syncTenantState(Tenant $tenant): bool
    {
        $isActive = $this->isActiveForTenant($tenant);

        if (! $isActive) {
            $tenant->run(fn () => $this->clearVipStateInCurrentTenant());
        }

        return $isActive;
    }

    private function clearVipStateInCurrentTenant(): void
    {
        TenantUser::query()
            ->where('is_vip', true)
            ->update(['is_vip' => false]);

        Service::query()->get()->each(function (Service $service): void {
            $settings = $service->settings ?? [];

            if (($settings['vip_breaks'] ?? []) === []) {
                return;
            }

            $settings['vip_breaks'] = [];
            $service->update([
                'settings' => $settings,
            ]);
        });
    }
}
