<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Booking\Models\Barber;
use App\Domain\Tenant\Models\SubscriptionPackage;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantFeatureModule;
use App\Models\AdminActionLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminSupportAdjustmentService
{
    public function reduceSupportPackage(Tenant $tenant, SubscriptionPackage $package, string $newSupportEndsAt, string $reason, User $actor): void
    {
        $tenant->loadMissing(['subscriptionPackage', 'audienceType']);

        $currentSupportEndsAt = $tenant->support_ends_at?->toDateString();
        if (! $currentSupportEndsAt) {
            throw ValidationException::withMessages([
                'new_support_ends_at' => 'برای این سامانه تاریخ پشتیبانی فعلی ثبت نشده است.',
            ]);
        }

        if ($newSupportEndsAt > $currentSupportEndsAt) {
            throw ValidationException::withMessages([
                'new_support_ends_at' => 'در کاهش پشتیبانی، تاریخ جدید نباید از تاریخ فعلی بیشتر باشد.',
            ]);
        }

        $professionalCount = $this->professionalCount($tenant);
        if ($package->user_limit !== null && $professionalCount > (int) $package->user_limit) {
            $pluralLabel = trim((string) ($tenant->audienceType?->plural_label ?? 'کاربران'));

            throw ValidationException::withMessages([
                'subscription_package_id' => "اکنون {$professionalCount} {$pluralLabel} فعال دارید و این بسته برای وضعیت فعلی سامانه مناسب نیست.",
            ]);
        }

        DB::connection('central')->transaction(function () use ($tenant, $package, $newSupportEndsAt, $reason, $actor, $currentSupportEndsAt): void {
            $lockedTenant = Tenant::query()
                ->with(['subscriptionPackage', 'audienceType'])
                ->lockForUpdate()
                ->findOrFail($tenant->id);

            $previousPackage = $lockedTenant->subscriptionPackage;

            $lockedTenant->update([
                'subscription_package_id' => $package->id,
                'support_ends_at' => $newSupportEndsAt,
                'data' => array_merge($lockedTenant->data ?? [], [
                    'support_ends_at' => $newSupportEndsAt,
                ]),
            ]);

            TenantFeatureModule::query()
                ->where('tenant_id', $lockedTenant->id)
                ->whereNotNull('expires_at')
                ->whereDate('expires_at', '>', $newSupportEndsAt)
                ->get()
                ->each(function (TenantFeatureModule $module) use ($newSupportEndsAt): void {
                    $module->update([
                        'expires_at' => $newSupportEndsAt,
                        'status' => $newSupportEndsAt < now()->toDateString() ? 'inactive' : $module->status,
                        'metadata' => array_merge($module->metadata ?? [], [
                            'support_adjusted_at' => now()->toIso8601String(),
                        ]),
                    ]);
                });

            if (AdminActionLog::tableExists()) {
                AdminActionLog::query()->create([
                    'action_type' => 'tenant_support_reduced',
                    'actor_user_id' => $actor->id,
                    'tenant_id' => $lockedTenant->id,
                    'title' => 'کاهش بسته یا تاریخ پشتیبانی '.$lockedTenant->name,
                    'reason' => $reason,
                    'meta_json' => [
                        'tenant_name' => $lockedTenant->name,
                        'previous_package_id' => $previousPackage?->id,
                        'previous_package_name' => $previousPackage?->name,
                        'new_package_id' => $package->id,
                        'new_package_name' => $package->name,
                        'previous_support_ends_at' => $currentSupportEndsAt,
                        'new_support_ends_at' => $newSupportEndsAt,
                    ],
                    'occurred_at' => now(),
                ]);
            }
        });
    }

    private function professionalCount(Tenant $tenant): int
    {
        return (int) $tenant->run(function (): int {
            return DB::table((new Barber())->getTable())->count();
        });
    }
}
