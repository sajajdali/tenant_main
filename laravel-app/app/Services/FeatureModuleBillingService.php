<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\FeatureModule;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantFeatureModule;
use App\Support\TenantSupport;
use Illuminate\Support\Carbon;
use RuntimeException;

class FeatureModuleBillingService
{
    public function listForTenant(Tenant $tenant): array
    {
        $activeModules = TenantFeatureModule::query()
            ->with('featureModule')
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->get()
            ->keyBy('feature_module_id');

        return FeatureModule::query()
            ->with('audiencePrices')
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn (FeatureModule $module): array => $this->serializeModule($tenant, $module, $activeModules->get($module->id)))
            ->values()
            ->all();
    }

    public function renewableModules(Tenant $tenant, int $durationDays, ?array $selectedFeatureModuleIds = null): array
    {
        $selectedLookup = $selectedFeatureModuleIds !== null ? array_map('intval', $selectedFeatureModuleIds) : null;
        $tenantModules = TenantFeatureModule::query()
            ->with('featureModule')
            ->where('tenant_id', $tenant->id)
            ->get()
            ->keyBy('feature_module_id');

        return FeatureModule::query()
            ->with('audiencePrices')
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(function (FeatureModule $module) use ($tenant, $durationDays, $selectedLookup, $tenantModules): array {
                /** @var TenantFeatureModule|null $tenantModule */
                $tenantModule = $tenantModules->get($module->id);
                $pricing = $module->pricingFor($tenant->audience_type_id);
                $isActive = $tenantModule?->status === 'active'
                    && ($tenantModule->expires_at === null || $tenantModule->expires_at->greaterThanOrEqualTo(now()->startOfDay()));
                $amount = $this->proratedAmount((int) $pricing['monthlyPriceAmount'], $durationDays);
                $selected = $selectedLookup === null
                    ? $isActive
                    : in_array((int) $module->id, $selectedLookup, true);

                return [
                    'id' => $tenantModule?->id ? (string) $tenantModule->id : 'module-'.$module->id,
                    'moduleId' => (string) $module->id,
                    'slug' => $module->slug,
                    'name' => $module->name,
                    'description' => $module->description,
                    'monthlyPriceAmount' => (int) $pricing['monthlyPriceAmount'],
                    'renewalAmount' => $amount,
                    'billingMode' => $isActive ? 'renewal' : 'activation',
                    'isActive' => $isActive,
                    'currentEndsAt' => $tenantModule?->expires_at?->toDateString(),
                    'selected' => $selected,
                ];
            })
            ->values()
            ->all();
    }

    public function previewActivation(Tenant $tenant, FeatureModule $module): array
    {
        $supportSummary = TenantSupport::summary($tenant);
        $supportEndsAt = ! empty($supportSummary['supportEndsAt'])
            ? Carbon::parse((string) $supportSummary['supportEndsAt'])->endOfDay()
            : null;

        if (! $supportEndsAt || now()->greaterThan($supportEndsAt)) {
            throw new RuntimeException('برای فعال‌سازی این ماژول، ابتدا باید پشتیبانی سامانه فعال باشد.');
        }

        $existing = TenantFeatureModule::query()
            ->where('tenant_id', $tenant->id)
            ->where('feature_module_id', $module->id)
            ->first();

        if ($existing?->status === 'active' && ($existing->expires_at === null || $existing->expires_at?->greaterThanOrEqualTo($supportEndsAt))) {
            throw new RuntimeException('این ماژول تا پایان دوره فعلی شما فعال است و نیازی به خرید دوباره ندارد.');
        }

        $pricing = $module->pricingFor($tenant->audience_type_id);
        $remainingDays = $this->normalizeDays(
            now()->startOfDay()->diffInDays($supportEndsAt->copy()->startOfDay(), false) + 1,
        );
        $amount = $this->proratedAmount((int) $pricing['monthlyPriceAmount'], $remainingDays);

        return [
            'module' => [
                'id' => (string) $module->id,
                'slug' => $module->slug,
                'name' => $module->name,
                'description' => $module->description,
                'monthlyPriceAmount' => (int) $pricing['monthlyPriceAmount'],
            ],
            'currentSupportEndsAt' => $supportEndsAt->toDateString(),
            'remainingDays' => $remainingDays,
            'amount' => $amount,
            'discountAmount' => 0,
            'payableAmount' => $amount,
            'message' => 'این ماژول تا پایان پشتیبانی فعلی سامانه برای شما فعال می‌شود.',
        ];
    }

    public function proratedAmount(int $monthlyPriceAmount, int $days): int
    {
        return (int) round(($monthlyPriceAmount * $this->normalizeDays($days)) / 30);
    }

    private function normalizeDays(int|float $days): int
    {
        return max(1, (int) ceil($days));
    }

    private function serializeModule(Tenant $tenant, FeatureModule $module, ?TenantFeatureModule $tenantModule): array
    {
        $pricing = $module->pricingFor($tenant->audience_type_id);
        $isActive = $tenantModule?->status === 'active'
            && ($tenantModule->expires_at === null || $tenantModule->expires_at->greaterThanOrEqualTo(now()->startOfDay()));

        return [
            'id' => (string) $module->id,
            'slug' => $module->slug,
            'name' => $module->name,
            'description' => $module->description,
            'monthlyPriceAmount' => (int) $pricing['monthlyPriceAmount'],
            'isActive' => $isActive,
            'expiresAt' => $tenantModule?->expires_at?->toDateString(),
            'status' => $isActive ? 'active' : 'locked',
            'ctaNote' => (string) ($module->metadata['cta_note'] ?? 'این ماژول نیاز به فعال‌سازی و پرداخت هزینه جداگانه دارد.'),
        ];
    }
}
