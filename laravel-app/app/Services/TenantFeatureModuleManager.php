<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\FeatureModule;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantFeatureModule;
use App\Models\AdminActionLog;
use App\Support\TenantFeatureModuleRegistry;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class TenantFeatureModuleManager
{
    public function activate(Tenant $tenant, string|FeatureModule $module, array $context = []): TenantFeatureModule
    {
        $featureModule = $this->resolveFeatureModule($module);
        $definition = TenantFeatureModuleRegistry::get($featureModule->slug);

        if (! $definition) {
            throw new RuntimeException("ماژول {$featureModule->slug} در registry تعریف نشده است.");
        }

        $tenantModule = DB::connection('central')->transaction(function () use ($tenant, $featureModule): TenantFeatureModule {
            $tenantModule = TenantFeatureModule::query()
                ->where('tenant_id', $tenant->id)
                ->where('feature_module_id', $featureModule->id)
                ->lockForUpdate()
                ->first();

            if (! $tenantModule) {
                $tenantModule = TenantFeatureModule::query()->create([
                    'tenant_id' => $tenant->id,
                    'feature_module_id' => $featureModule->id,
                    'status' => 'inactive',
                    'metadata' => [],
                ]);
            }

            return $tenantModule->fresh('featureModule');
        });

        $this->installIfNeeded($tenant, $tenantModule, $definition);

        return DB::connection('central')->transaction(function () use ($tenant, $tenantModule, $context): TenantFeatureModule {
            $lockedModule = TenantFeatureModule::query()
                ->with('featureModule')
                ->lockForUpdate()
                ->findOrFail($tenantModule->id);
            $metadata = $lockedModule->metadata ?? [];
            $metadata['last_activated_at'] = now()->toIso8601String();
            $metadata['last_activated_by_user_id'] = $context['actor_user_id'] ?? null;
            $metadata['last_activation_source'] = $context['source'] ?? 'central_admin';

            $lockedModule->update([
                'status' => 'active',
                'activated_at' => $lockedModule->activated_at ?? now()->toDateString(),
                'expires_at' => $context['expires_at'] ?? $lockedModule->expires_at,
                'metadata' => $metadata,
            ]);

            $this->logAction('tenant_feature_module_activated', $tenant, $lockedModule->fresh('featureModule'), $context);

            return $lockedModule->fresh('featureModule');
        });
    }

    public function deactivate(Tenant $tenant, string|FeatureModule|TenantFeatureModule $module, array $context = []): TenantFeatureModule
    {
        $tenantModule = $module instanceof TenantFeatureModule
            ? $module
            : $this->tenantModule($tenant, $this->resolveFeatureModule($module));

        if (! $tenantModule) {
            throw new RuntimeException('این ماژول برای tenant انتخاب‌شده ثبت نشده است.');
        }

        return DB::connection('central')->transaction(function () use ($tenant, $tenantModule, $context): TenantFeatureModule {
            $lockedModule = TenantFeatureModule::query()
                ->with('featureModule')
                ->lockForUpdate()
                ->findOrFail($tenantModule->id);

            abort_unless((string) $lockedModule->tenant_id === (string) $tenant->id, 404);

            $metadata = $lockedModule->metadata ?? [];
            $metadata['last_deactivated_at'] = now()->toIso8601String();
            $metadata['last_deactivated_by_user_id'] = $context['actor_user_id'] ?? null;
            $metadata['last_deactivation_reason'] = $context['reason'] ?? null;

            $lockedModule->update([
                'status' => 'inactive',
                'metadata' => $metadata,
            ]);

            $this->logAction('tenant_feature_module_deactivated', $tenant, $lockedModule->fresh('featureModule'), $context);

            return $lockedModule->fresh('featureModule');
        });
    }

    public function installIfNeeded(Tenant $tenant, TenantFeatureModule $tenantModule, array $definition): TenantFeatureModule
    {
        $metadata = $tenantModule->metadata ?? [];

        if (($metadata['installed'] ?? false) === true) {
            return $tenantModule;
        }

        try {
            $migrationPath = $definition['migration_path'] ?? null;

            if (is_string($migrationPath) && $migrationPath !== '' && File::isDirectory($migrationPath)) {
                $tenant->run(function () use ($migrationPath): void {
                    Artisan::call('migrate', [
                        '--database' => 'tenant',
                        '--path' => $migrationPath,
                        '--realpath' => true,
                        '--force' => true,
                    ]);
                });

                $metadata['module_migrations'] = [
                    'path' => $migrationPath,
                    'ran_at' => now()->toIso8601String(),
                ];
            }

            $seeder = $definition['seeder'] ?? null;

            if (is_string($seeder) && $seeder !== '') {
                $tenant->run(function () use ($seeder): void {
                    Artisan::call('db:seed', [
                        '--class' => $seeder,
                        '--database' => 'tenant',
                        '--force' => true,
                    ]);
                });

                $metadata['module_seeder'] = [
                    'class' => $seeder,
                    'ran_at' => now()->toIso8601String(),
                ];
            }

            $metadata['installed'] = true;
            $metadata['installed_at'] = now()->toIso8601String();
            unset($metadata['last_install_error']);
        } catch (Throwable $exception) {
            $metadata['installed'] = false;
            $metadata['last_install_error'] = [
                'message' => $exception->getMessage(),
                'class' => $exception::class,
                'failed_at' => now()->toIso8601String(),
            ];

            $tenantModule->update(['metadata' => $metadata]);

            throw $exception;
        }

        $tenantModule->update(['metadata' => $metadata]);

        return $tenantModule->fresh();
    }

    public function isActive(Tenant $tenant, string $slug): bool
    {
        return TenantFeatureModule::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->where(function ($query): void {
                $query->whereNull('expires_at')
                    ->orWhereDate('expires_at', '>=', now()->toDateString());
            })
            ->whereHas('featureModule', fn ($query) => $query->where('slug', $slug))
            ->exists();
    }

    public function activeForMeta(Tenant $tenant): array
    {
        return TenantFeatureModule::query()
            ->with('featureModule')
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->where(function ($query): void {
                $query->whereNull('expires_at')
                    ->orWhereDate('expires_at', '>=', now()->toDateString());
            })
            ->get()
            ->filter(fn (TenantFeatureModule $item) => $item->featureModule !== null)
            ->map(function (TenantFeatureModule $item): array {
                $definition = TenantFeatureModuleRegistry::get((string) $item->featureModule->slug);

                return [
                    'id' => (string) $item->featureModule->id,
                    'slug' => $item->featureModule->slug,
                    'name' => $item->featureModule->name,
                    'label' => $definition['label'] ?? $item->featureModule->name,
                    'metaKey' => $definition['meta_key'] ?? Str::camel((string) $item->featureModule->slug),
                    'routePrefix' => $definition['route_prefix'] ?? $item->featureModule->slug,
                    'expiresAt' => $item->expires_at?->toDateString(),
                ];
            })
            ->values()
            ->all();
    }

    private function resolveFeatureModule(string|FeatureModule $module): FeatureModule
    {
        if ($module instanceof FeatureModule) {
            return $module;
        }

        return FeatureModule::query()->where('slug', $module)->firstOrFail();
    }

    private function tenantModule(Tenant $tenant, FeatureModule $module): ?TenantFeatureModule
    {
        return TenantFeatureModule::query()
            ->where('tenant_id', $tenant->id)
            ->where('feature_module_id', $module->id)
            ->first();
    }

    private function logAction(string $actionType, Tenant $tenant, TenantFeatureModule $tenantModule, array $context): void
    {
        if (! AdminActionLog::tableExists()) {
            return;
        }

        $module = $tenantModule->featureModule;
        $isActivation = $actionType === 'tenant_feature_module_activated';

        AdminActionLog::query()->create([
            'action_type' => $actionType,
            'actor_user_id' => $context['actor_user_id'] ?? null,
            'tenant_id' => $tenant->id,
            'title' => ($isActivation ? 'فعال‌سازی ماژول ' : 'غیرفعال‌سازی ماژول ').($module?->name ?? 'نامشخص').' برای '.$tenant->name,
            'reason' => (string) ($context['reason'] ?? ($isActivation ? 'فعال‌سازی ماژول اختصاصی tenant' : 'غیرفعال‌سازی ماژول اختصاصی tenant')),
            'meta_json' => [
                'tenant_name' => $tenant->name,
                'tenant_feature_module_id' => (string) $tenantModule->id,
                'feature_module_id' => $module?->id ? (string) $module->id : null,
                'feature_module_slug' => $module?->slug,
                'feature_module_name' => $module?->name,
                'source' => $context['source'] ?? 'central_admin',
                'installed' => (bool) (($tenantModule->metadata ?? [])['installed'] ?? false),
            ],
            'occurred_at' => now(),
        ]);
    }
}
