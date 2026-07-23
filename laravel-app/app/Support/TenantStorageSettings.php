<?php

declare(strict_types=1);

namespace App\Support;

final class TenantStorageSettings
{
    public const DEFAULT_QUOTA_GB = 1;
    public const BYTES_PER_GB = 1073741824;

    public const KEY_USED_BYTES = 'storage_used_bytes';
    public const KEY_BASE_QUOTA_BYTES = 'storage_base_quota_bytes';
    public const KEY_EXTRA_QUOTA_BYTES = 'storage_extra_quota_bytes';

    /**
     * @return array<int, int>
     */
    public static function quotaGbOptions(): array
    {
        return [
            ...range(1, 50),
            75,
            100,
            200,
        ];
    }

    public static function normalizeQuotaGb(mixed $value): int
    {
        $quotaGb = (int) $value;

        return in_array($quotaGb, self::quotaGbOptions(), true)
            ? $quotaGb
            : self::DEFAULT_QUOTA_GB;
    }

    public static function gbToBytes(int $gb): int
    {
        return $gb * self::BYTES_PER_GB;
    }
}
