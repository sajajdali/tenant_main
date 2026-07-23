<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Services\TenantStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class TenantFileManagerController extends Controller
{
    public function index(Request $request, TenantStorageService $storage): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'type' => ['nullable', 'in:all,image,audio,video,document,other'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:60'],
        ]);

        $query = Str::of((string) ($validated['q'] ?? ''))->trim()->lower()->toString();
        $type = (string) ($validated['type'] ?? 'all');
        $page = max(1, (int) ($validated['page'] ?? 1));
        $perPage = max(1, min(60, (int) ($validated['per_page'] ?? 24)));
        $disk = Storage::disk('media_public');

        $files = collect($disk->allFiles())
            ->filter(fn (string $path): bool => $query === '' || str_contains(Str::lower($path), $query))
            ->map(function (string $path) use ($disk): array {
                $size = 0;
                $modifiedAt = null;
                $mimeType = null;

                try {
                    $size = (int) $disk->size($path);
                    $modifiedAt = date('c', (int) $disk->lastModified($path));
                    $mimeType = $disk->mimeType($path) ?: null;
                } catch (\Throwable) {
                    //
                }

                $category = $this->fileCategory($path, $mimeType);

                return [
                    'id' => $this->encodePath($path),
                    'path' => $path,
                    'name' => basename($path),
                    'directory' => trim(dirname($path), '.'),
                    'extension' => Str::lower(pathinfo($path, PATHINFO_EXTENSION)),
                    'mimeType' => $mimeType,
                    'category' => $category,
                    'sizeBytes' => $size,
                    'modifiedAt' => $modifiedAt,
                    'url' => $this->tenantMediaUrl($path),
                ];
            })
            ->filter(fn (array $file): bool => $type === 'all' || $file['category'] === $type)
            ->sortByDesc('modifiedAt')
            ->values();

        $total = $files->count();
        $items = $files->slice(($page - 1) * $perPage, $perPage)->values();

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $items,
                'usage' => $storage->usage(),
                'pagination' => [
                    'page' => $page,
                    'perPage' => $perPage,
                    'total' => $total,
                    'lastPage' => (int) max(1, ceil($total / $perPage)),
                ],
            ],
        ]);
    }

    public function destroy(string $encodedPath, TenantStorageService $storage): JsonResponse
    {
        $path = $this->decodePath($encodedPath);

        if (! is_string($path) || $path === '' || str_contains($path, '..') || str_starts_with($path, '/')) {
            return response()->json([
                'success' => false,
                'message' => __('tenant.file_manager.invalid_path'),
            ], 422);
        }

        $deleted = $storage->deleteStoredPath('media_public', $path);

        return response()->json([
            'success' => $deleted,
            'message' => $deleted
                ? __('tenant.file_manager.deleted')
                : __('tenant.file_manager.not_found_or_not_deletable'),
            'data' => [
                'usage' => $storage->usage(),
            ],
        ], $deleted ? 200 : 404);
    }

    private function fileCategory(string $path, ?string $mimeType): string
    {
        $mimeType = Str::lower((string) $mimeType);
        $extension = Str::lower(pathinfo($path, PATHINFO_EXTENSION));

        if (str_starts_with($mimeType, 'image/') || in_array($extension, ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif'], true)) {
            return 'image';
        }

        if (str_starts_with($mimeType, 'audio/') || in_array($extension, ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'webm'], true)) {
            return 'audio';
        }

        if (str_starts_with($mimeType, 'video/') || in_array($extension, ['mp4', 'mov', 'avi', 'mkv', 'webm'], true)) {
            return 'video';
        }

        if (in_array($extension, ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'zip', 'rar'], true)) {
            return 'document';
        }

        return 'other';
    }

    private function encodePath(string $path): string
    {
        return rtrim(strtr(base64_encode($path), '+/', '-_'), '=');
    }

    private function decodePath(string $encodedPath): string|false
    {
        $encodedPath = strtr($encodedPath, '-_', '+/');
        $padding = strlen($encodedPath) % 4;

        if ($padding > 0) {
            $encodedPath .= str_repeat('=', 4 - $padding);
        }

        return base64_decode($encodedPath, true);
    }
}
