<?php

namespace App\Http\Controllers;

use App\Services\TenantStorageService;
use Illuminate\Support\Facades\Storage;

abstract class Controller
{
    protected function tenantMediaUrl(?string $path, string $disk = 'media_public'): ?string
    {
        $relativePath = ltrim((string) $path, '/');

        if ($relativePath === '') {
            return null;
        }

        return tenant() ? tenant_asset($relativePath) : Storage::disk($disk)->url($relativePath);
    }

    protected function deleteTenantMediaFile(?string $path, string $disk = 'media_public'): void
    {
        $relativePath = ltrim((string) $path, '/');

        if ($relativePath === '') {
            return;
        }

        app(TenantStorageService::class)->deleteStoredPath($disk, $relativePath);
    }

    protected function recordTenantMediaFile(?string $path, ?int $knownSize = null, string $disk = 'media_public'): void
    {
        $relativePath = ltrim((string) $path, '/');

        if ($relativePath === '') {
            return;
        }

        app(TenantStorageService::class)->recordStoredPath($disk, $relativePath, $knownSize);
    }
}
