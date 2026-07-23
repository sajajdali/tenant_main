<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Store\Models\StoreCategory;
use App\Domain\Store\Models\StoreProduct;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class StoreCategoryController extends Controller
{
    public function publicIndex(): JsonResponse
    {
        $items = StoreCategory::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $items->map(fn (StoreCategory $category) => $this->transformCategory($category))->values()->all(),
            ],
        ]);
    }

    public function index(): JsonResponse
    {
        $items = StoreCategory::query()
            ->orderBy('sort_order')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $items->map(fn (StoreCategory $category) => $this->transformCategory($category))->values()->all(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:store_categories,slug'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'show_on_home' => ['nullable', 'boolean'],
            'image' => ['nullable', 'file', 'mimes:jpg,jpeg,png,gif,webp,avif', 'max:8192'],
        ]);

        $category = new StoreCategory();
        $category->name = trim((string) $validated['name']);
        $category->slug = $this->uniqueSlug((string) ($validated['slug'] ?? $validated['name']));
        $category->sort_order = (int) ($validated['sort_order'] ?? 0);
        $category->is_active = (bool) ($validated['is_active'] ?? true);
        if ($this->hasShowOnHomeColumn()) {
            $category->show_on_home = (bool) ($validated['show_on_home'] ?? true);
        }

        if (isset($validated['image']) && $validated['image'] instanceof UploadedFile) {
            $category->image_path = $validated['image']->store('store/categories', 'media_public');
            $this->recordTenantMediaFile($category->image_path, (int) $validated['image']->getSize());
        }

        $category->save();

        return response()->json([
            'success' => true,
            'message' => __('store.category.created'),
            'data' => $this->transformCategory($category->fresh()),
        ]);
    }

    public function update(Request $request, StoreCategory $storeCategory): JsonResponse
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'unique:store_categories,slug,' . $storeCategory->id],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['required', 'boolean'],
            'show_on_home' => ['nullable', 'boolean'],
            'remove_image' => ['nullable', 'boolean'],
            'image' => ['nullable', 'file', 'mimes:jpg,jpeg,png,gif,webp,avif', 'max:8192'],
        ]);

        $storeCategory->name = trim((string) $validated['name']);
        $storeCategory->slug = $this->uniqueSlug((string) $validated['slug'], (int) $storeCategory->id);
        $storeCategory->sort_order = (int) ($validated['sort_order'] ?? 0);
        $storeCategory->is_active = (bool) $validated['is_active'];
        if ($this->hasShowOnHomeColumn()) {
            $storeCategory->show_on_home = (bool) ($validated['show_on_home'] ?? false);
        }

        if ((bool) ($validated['remove_image'] ?? false)) {
            $this->deletePhysicalFile($storeCategory->image_path);
            $storeCategory->image_path = null;
        }

        if (isset($validated['image']) && $validated['image'] instanceof UploadedFile) {
            $this->deletePhysicalFile($storeCategory->image_path);
            $storeCategory->image_path = $validated['image']->store('store/categories', 'media_public');
            $this->recordTenantMediaFile($storeCategory->image_path, (int) $validated['image']->getSize());
        }

        $storeCategory->save();

        return response()->json([
            'success' => true,
            'message' => __('store.category.updated'),
            'data' => $this->transformCategory($storeCategory->fresh()),
        ]);
    }

    public function destroy(Request $request, StoreCategory $storeCategory): JsonResponse
    {
        $this->ensureAdmin($request);

        StoreProduct::query()
            ->where('store_category_id', $storeCategory->getKey())
            ->update(['store_category_id' => null]);

        $this->deletePhysicalFile($storeCategory->image_path);
        $storeCategory->delete();

        return response()->json([
            'success' => true,
            'message' => __('store.category.deleted'),
        ]);
    }

    private function transformCategory(StoreCategory $category): array
    {
        return [
            'id' => (string) $category->id,
            'name' => $category->name,
            'slug' => $category->slug,
            'sortOrder' => (int) $category->sort_order,
            'isActive' => (bool) $category->is_active,
            'showOnHome' => $this->hasShowOnHomeColumn() ? (bool) ($category->show_on_home ?? false) : true,
            'imageUrl' => $this->tenantMediaUrl($category->image_path),
            'createdAt' => $category->created_at?->toISOString(),
        ];
    }

    private function hasShowOnHomeColumn(): bool
    {
        return Schema::hasColumn('store_categories', 'show_on_home');
    }

    private function uniqueSlug(string $value, ?int $ignoreId = null): string
    {
        $base = Str::slug(trim($value) !== '' ? $value : 'category');
        $slug = $base !== '' ? $base : 'category';
        $counter = 1;

        while (
            StoreCategory::query()
                ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
                ->where('slug', $slug)
                ->exists()
        ) {
            $slug = $base . '-' . $counter;
            $counter++;
        }

        return $slug;
    }

    private function deletePhysicalFile(?string $path): void
    {
        $this->deleteTenantMediaFile($path);
    }

    private function ensureAdmin(Request $request): void
    {
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));
    }
}
