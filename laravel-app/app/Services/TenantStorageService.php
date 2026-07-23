<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantSetting;
use App\Domain\Tenant\Models\TenantStorageAddon;
use App\Models\SystemSetting;
use App\Support\TenantStorageSettings;
use Carbon\CarbonInterface;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

class TenantStorageService
{
    private const BILLING_DAYS_PER_MONTH = 30;

    public function settings(): array
    {
        $raw = SystemSetting::getValue('tenant_storage', []);

        return [
            'default_quota_gb' => TenantStorageSettings::normalizeQuotaGb($raw['default_quota_gb'] ?? TenantStorageSettings::DEFAULT_QUOTA_GB),
            'extra_price_per_gb_month' => max(0, (int) ($raw['extra_price_per_gb_month'] ?? 0)),
        ];
    }

    public function usage(?Tenant $tenant = null): array
    {
        $tenant ??= tenant();

        if (! $tenant) {
            return $this->emptyUsage();
        }

        return $tenant->run(function () use ($tenant): array {
            if (! Schema::hasTable('tenant_settings')) {
                return $this->emptyUsage();
            }

            $usedBytes = max(0, (int) TenantSetting::getValue(TenantStorageSettings::KEY_USED_BYTES, 0));
            $baseQuotaBytes = max(0, (int) TenantSetting::getValue(TenantStorageSettings::KEY_BASE_QUOTA_BYTES, TenantStorageSettings::gbToBytes(TenantStorageSettings::DEFAULT_QUOTA_GB)));
            $extraQuotaBytes = max(0, (int) TenantSetting::getValue(TenantStorageSettings::KEY_EXTRA_QUOTA_BYTES, 0));
            $totalQuotaBytes = $baseQuotaBytes + $extraQuotaBytes;

            return [
                'usedBytes' => $usedBytes,
                'baseQuotaBytes' => $baseQuotaBytes,
                'extraQuotaBytes' => $extraQuotaBytes,
                'totalQuotaBytes' => $totalQuotaBytes,
                'baseQuotaGb' => (int) round($baseQuotaBytes / TenantStorageSettings::BYTES_PER_GB),
                'extraQuotaGb' => (int) round($extraQuotaBytes / TenantStorageSettings::BYTES_PER_GB),
                'totalQuotaGb' => (int) round($totalQuotaBytes / TenantStorageSettings::BYTES_PER_GB),
                'remainingBytes' => max(0, $totalQuotaBytes - $usedBytes),
                'isFull' => $totalQuotaBytes > 0 && $usedBytes >= $totalQuotaBytes,
                'tenantId' => (string) $tenant->id,
            ];
        });
    }

    public function recordUpload(UploadedFile $file): void
    {
        $this->increaseUsedBytes((int) ($file->getSize() ?: 0));
    }

    public function recordStoredPath(string $disk, ?string $path, ?int $knownSize = null): void
    {
        if (! $path) {
            return;
        }

        $size = $knownSize;
        if ($size === null) {
            try {
                $size = Storage::disk($disk)->exists($path) ? Storage::disk($disk)->size($path) : 0;
            } catch (\Throwable) {
                $size = 0;
            }
        }

        $this->increaseUsedBytes((int) $size);
    }

    public function deleteStoredPath(string $disk, ?string $path): bool
    {
        if (! $path) {
            return false;
        }

        $size = 0;
        try {
            if (Storage::disk($disk)->exists($path)) {
                $size = (int) Storage::disk($disk)->size($path);
                $deleted = Storage::disk($disk)->delete($path);
                if ($deleted) {
                    $this->decreaseUsedBytes($size);
                }

                return (bool) $deleted;
            }
        } catch (\Throwable) {
            return false;
        }

        return false;
    }

    public function increaseUsedBytes(int $bytes): void
    {
        if ($bytes <= 0 || ! Schema::hasTable('tenant_settings')) {
            return;
        }

        DB::transaction(function () use ($bytes): void {
            $setting = TenantSetting::query()
                ->where('key', TenantStorageSettings::KEY_USED_BYTES)
                ->lockForUpdate()
                ->first();

            if (! $setting) {
                TenantSetting::putValue(TenantStorageSettings::KEY_USED_BYTES, $bytes, 'integer', 'storage');

                return;
            }

            $setting->update([
                'value' => max(0, (int) $setting->value + $bytes),
            ]);
        });
    }

    public function decreaseUsedBytes(int $bytes): void
    {
        if ($bytes <= 0 || ! Schema::hasTable('tenant_settings')) {
            return;
        }

        DB::transaction(function () use ($bytes): void {
            $setting = TenantSetting::query()
                ->where('key', TenantStorageSettings::KEY_USED_BYTES)
                ->lockForUpdate()
                ->first();

            if (! $setting) {
                TenantSetting::putValue(TenantStorageSettings::KEY_USED_BYTES, 0, 'integer', 'storage');

                return;
            }

            $setting->update([
                'value' => max(0, (int) $setting->value - $bytes),
            ]);
        });
    }

    public function recalculateCurrentTenant(): int
    {
        $bytes = $this->directorySize(storage_path());

        TenantSetting::putValue(TenantStorageSettings::KEY_USED_BYTES, $bytes, 'integer', 'storage');
        TenantSetting::query()->firstOrCreate(
            ['key' => TenantStorageSettings::KEY_EXTRA_QUOTA_BYTES],
            ['value' => 0, 'type' => 'integer', 'group' => 'storage'],
        );

        return $bytes;
    }

    public function previewExtraStoragePurchase(Tenant $tenant, int $gb): array
    {
        $gb = max(1, min(200, $gb));
        $settings = $this->settings();
        $pricePerGbMonth = (int) $settings['extra_price_per_gb_month'];
        $remainingDays = $this->remainingSupportDays($tenant);
        $amount = $this->proratedStorageAmount($gb, $pricePerGbMonth, $remainingDays);

        return [
            'gb' => $gb,
            'remainingDays' => $remainingDays,
            'billingDaysPerMonth' => self::BILLING_DAYS_PER_MONTH,
            'pricePerGbMonth' => $pricePerGbMonth,
            'amount' => $amount,
            'payableAmount' => $amount,
            'startsAt' => now()->toDateString(),
            'endsAt' => $tenant->support_ends_at?->toDateString(),
            'currentUsage' => $this->usage($tenant),
        ];
    }

    public function activeExtraStorageRenewalLine(Tenant $tenant, int $durationDays): ?array
    {
        $extraGb = $this->usage($tenant)['extraQuotaGb'] ?? 0;
        if ($extraGb <= 0) {
            return null;
        }

        $pricePerGbMonth = (int) $this->settings()['extra_price_per_gb_month'];
        $durationDays = max(1, $durationDays);
        $amount = $this->proratedStorageAmount($extraGb, $pricePerGbMonth, $durationDays);

        return [
            'gb' => $extraGb,
            'pricePerGbMonth' => $pricePerGbMonth,
            'durationDays' => $durationDays,
            'billingDaysPerMonth' => self::BILLING_DAYS_PER_MONTH,
            'amount' => $amount,
            'payableAmount' => $amount,
        ];
    }

    public function activateAddonFromPayment(Tenant $tenant, int $gb, int $pricePerGbMonth, int $amount, int $paymentId): TenantStorageAddon
    {
        $addon = TenantStorageAddon::query()->create([
            'tenant_id' => (string) $tenant->id,
            'gb' => $gb,
            'price_per_gb_month' => $pricePerGbMonth,
            'amount' => $amount,
            'payable_amount' => $amount,
            'starts_at' => now()->toDateString(),
            'ends_at' => $tenant->support_ends_at?->toDateString(),
            'status' => 'active',
            'tenant_subscription_payment_id' => $paymentId,
        ]);

        $this->setExtraQuotaGb($tenant, ((int) ($this->usage($tenant)['extraQuotaGb'] ?? 0)) + $gb);

        return $addon;
    }

    public function renewActiveAddons(Tenant $tenant, int $paymentId, ?CarbonInterface $endsAt = null): void
    {
        TenantStorageAddon::query()
            ->where('tenant_id', (string) $tenant->id)
            ->where('status', 'active')
            ->get()
            ->each(function (TenantStorageAddon $addon) use ($paymentId, $endsAt): void {
                $addon->update([
                    'ends_at' => $endsAt?->toDateString(),
                    'metadata' => array_merge($addon->metadata ?? [], [
                        'last_renewal_payment_id' => $paymentId,
                    ]),
                ]);
            });
    }

    public function setExtraQuotaGb(Tenant $tenant, int $gb): void
    {
        $tenant->run(function () use ($gb): void {
            TenantSetting::putValue(
                TenantStorageSettings::KEY_EXTRA_QUOTA_BYTES,
                TenantStorageSettings::gbToBytes(max(0, $gb)),
                'integer',
                'storage',
            );
        });
    }

    private function remainingSupportDays(Tenant $tenant): int
    {
        $supportEndsAt = $tenant->support_ends_at?->copy()->endOfDay();

        if (! $supportEndsAt || now()->greaterThan($supportEndsAt)) {
            return 30;
        }

        $days = now()->startOfDay()->diffInDays($supportEndsAt->copy()->startOfDay(), false);

        return max(1, (int) ceil($days));
    }

    private function proratedStorageAmount(int $gb, int $pricePerGbMonth, int $days): int
    {
        if ($gb <= 0 || $pricePerGbMonth <= 0 || $days <= 0) {
            return 0;
        }

        return (int) ceil(($gb * $pricePerGbMonth * $days) / self::BILLING_DAYS_PER_MONTH);
    }

    private function directorySize(string $path): int
    {
        if (! is_dir($path)) {
            return 0;
        }

        $bytes = 0;
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($path, RecursiveDirectoryIterator::SKIP_DOTS),
        );

        /** @var SplFileInfo $file */
        foreach ($iterator as $file) {
            if ($file->isFile()) {
                $bytes += $file->getSize();
            }
        }

        return $bytes;
    }

    private function emptyUsage(): array
    {
        return [
            'usedBytes' => 0,
            'baseQuotaBytes' => 0,
            'extraQuotaBytes' => 0,
            'totalQuotaBytes' => 0,
            'baseQuotaGb' => 0,
            'extraQuotaGb' => 0,
            'totalQuotaGb' => 0,
            'remainingBytes' => 0,
            'isFull' => false,
            'tenantId' => null,
        ];
    }
}
