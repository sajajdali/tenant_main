<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Tenant\Models\Tenant;
use App\Services\TenantStorageService;
use Illuminate\Console\Command;

class SyncTenantStorageUsage extends Command
{
    protected $signature = 'tenants:sync-storage-usage {--tenant=* : Tenant ids to sync}';

    protected $description = 'Recalculate tenant storage usage from files on disk.';

    public function handle(TenantStorageService $storage): int
    {
        $tenantIds = array_filter((array) $this->option('tenant'));
        $query = Tenant::query()->orderBy('id');

        if ($tenantIds !== []) {
            $query->whereIn('id', $tenantIds);
        }

        $query->each(function (Tenant $tenant) use ($storage): void {
            $bytes = $tenant->run(fn (): int => $storage->recalculateCurrentTenant());
            $this->info("{$tenant->id}: {$bytes} bytes");
        });

        return self::SUCCESS;
    }
}
