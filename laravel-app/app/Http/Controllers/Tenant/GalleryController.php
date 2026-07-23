<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Booking\Models\Barber;
use App\Domain\Tenant\Models\GalleryImage;
use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;

class GalleryController extends Controller
{
    public function index(): JsonResponse
    {
        $gallery = $this->gallerySettings();

        $items = GalleryImage::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'enabled' => (bool) ($gallery['enabled'] ?? false),
                'items' => $items->map(fn (GalleryImage $image) => $this->transformImage($image))->values()->all(),
            ],
        ]);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        $actor = $this->authorizeManager($request);
        $gallery = $this->gallerySettings();

        $items = GalleryImage::query()
            ->orderBy('sort_order')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'enabled' => (bool) ($gallery['enabled'] ?? false),
                'items' => $items->map(fn (GalleryImage $image) => $this->transformImage($image))->values()->all(),
                'actorRole' => $actor->role,
            ],
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $this->authorizeManager($request);

        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
        ]);

        $general = GeneralSetting::query()->firstOrCreate([], [
            'timezone' => 'Asia/Tehran',
            'currency' => 'IRR',
            'booking_rules' => [],
        ]);

        $rules = $general->booking_rules ?? [];
        $rules['gallery_enabled'] = (bool) $validated['enabled'];

        $general->update([
            'booking_rules' => $rules,
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'enabled' => (bool) $validated['enabled'],
            ],
            'message' => __('tenant.gallery.settings_saved'),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $actor = $this->authorizeManager($request);

        $validated = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'image' => ['required', 'file', 'mimes:jpg,jpeg,png,gif,webp,avif', 'max:8192'],
        ]);

        /** @var UploadedFile $image */
        $image = $validated['image'];
        $path = $image->store('gallery', 'media_public');
        $this->recordTenantMediaFile($path, (int) $image->getSize());

        $galleryImage = GalleryImage::query()->create([
            'title' => $validated['title'] ?? null,
            'description' => $validated['description'] ?? null,
            'disk' => 'media_public',
            'path' => $path,
            'mime_type' => $image->getClientMimeType(),
            'size' => $image->getSize() ?: 0,
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
            'is_active' => (bool) ($validated['is_active'] ?? true),
            'uploaded_by_user_id' => $actor->id,
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->transformImage($galleryImage),
            'message' => __('tenant.gallery.image_added'),
        ]);
    }

    public function update(Request $request, GalleryImage $galleryImage): JsonResponse
    {
        $this->authorizeManager($request);

        $validated = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'is_active' => ['required', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $galleryImage->update([
            'title' => $validated['title'] ?? null,
            'description' => $validated['description'] ?? null,
            'is_active' => (bool) $validated['is_active'],
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->transformImage($galleryImage->fresh()),
            'message' => __('tenant.gallery.image_updated'),
        ]);
    }

    public function destroy(Request $request, GalleryImage $galleryImage): JsonResponse
    {
        $this->authorizeManager($request);

        $this->deletePhysicalFile($galleryImage);
        $galleryImage->delete();

        return response()->json([
            'success' => true,
            'message' => __('tenant.gallery.image_deleted'),
        ]);
    }

    private function authorizeManager(Request $request): TenantUser
    {
        /** @var TenantUser|null $actor */
        $actor = $request->user('tenant_web');

        abort_unless($actor && in_array($actor->role, ['admin', 'barber'], true), 403, __('authorization.admin_or_barber_allowed'));

        if ($actor->role === 'barber') {
            $barber = Barber::query()->where('user_id', $actor->id)->first();
            abort_if(! $barber || ! $barber->can_access_panel, 403, __('tenant.gallery.barber_panel_blocked'));
        }

        return $actor;
    }

    private function gallerySettings(): array
    {
        $general = GeneralSetting::query()->first();
        $rules = $general?->booking_rules ?? [];

        return [
            'enabled' => (bool) ($rules['gallery_enabled'] ?? false),
        ];
    }

    private function transformImage(GalleryImage $image): array
    {
        return [
            'id' => (string) $image->id,
            'title' => $image->title,
            'description' => $image->description,
            'imageUrl' => $this->tenantMediaUrl($image->path, $image->disk ?: 'media_public'),
            'isActive' => (bool) $image->is_active,
            'sortOrder' => (int) $image->sort_order,
            'createdAt' => $image->created_at?->toISOString(),
        ];
    }

    private function deletePhysicalFile(GalleryImage $image): void
    {
        $this->deleteTenantMediaFile($image->path);
    }
}
