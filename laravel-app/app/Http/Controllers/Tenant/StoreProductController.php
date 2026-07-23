<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Store\Models\StoreCategory;
use App\Domain\Store\Models\StoreProduct;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class StoreProductController extends Controller
{
    public function publicIndex(): JsonResponse
    {
        $items = StoreProduct::query()
            ->with('category')
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $items->map(fn (StoreProduct $product) => $this->transformProduct($product))->values()->all(),
            ],
        ]);
    }

    public function publicShow(StoreProduct $storeProduct): JsonResponse
    {
        abort_unless($storeProduct->is_active, 404);

        return response()->json([
            'success' => true,
            'data' => $this->transformProduct($storeProduct->loadMissing('category')),
        ]);
    }

    public function index(): JsonResponse
    {
        $items = StoreProduct::query()
            ->with('category')
            ->orderBy('sort_order')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $items->map(fn (StoreProduct $product) => $this->transformProduct($product))->values()->all(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $validated = $this->validateRequest($request);

        $product = new StoreProduct();
        $this->fillProduct($product, $validated, $request, false);
        $product->save();

        return response()->json([
            'success' => true,
            'message' => __('store.product.created'),
            'data' => $this->transformProduct($product->fresh('category')),
        ]);
    }

    public function update(Request $request, StoreProduct $storeProduct): JsonResponse
    {
        $this->ensureAdmin($request);

        $validated = $this->validateRequest($request, $storeProduct->id);

        $this->fillProduct($storeProduct, $validated, $request, true);
        $storeProduct->save();

        return response()->json([
            'success' => true,
            'message' => __('store.product.updated'),
            'data' => $this->transformProduct($storeProduct->fresh('category')),
        ]);
    }

    public function destroy(Request $request, StoreProduct $storeProduct): JsonResponse
    {
        $this->ensureAdmin($request);

        $this->deletePhysicalFile($storeProduct->image_path);
        collect(($storeProduct->metadata ?? [])['gallery'] ?? [])->each(fn ($path) => $this->deletePhysicalFile(is_string($path) ? $path : null));
        $storeProduct->delete();

        return response()->json([
            'success' => true,
            'message' => __('store.product.deleted'),
        ]);
    }

    private function validateRequest(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'store_category_id' => ['nullable', 'integer', 'exists:store_categories,id'],
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:store_products,slug' . ($ignoreId ? ',' . $ignoreId : '')],
            'subtitle' => ['nullable', 'string', 'max:500'],
            'description' => ['nullable', 'string', 'max:20000'],
            'price_amount' => ['required', 'integer', 'min:0'],
            'discounted_price_amount' => ['nullable', 'integer', 'min:0'],
            'stock_quantity' => ['nullable', 'integer', 'min:0'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['required', 'boolean'],
            'is_featured' => ['required', 'boolean'],
            'is_bestseller' => ['required', 'boolean'],
            'is_popular' => ['required', 'boolean'],
            'reviews_enabled' => ['required', 'boolean'],
            'image' => ['nullable', 'file', 'mimes:jpg,jpeg,png,gif,webp,avif', 'max:8192'],
            'gallery_images' => ['nullable', 'array'],
            'gallery_images.*' => ['file', 'mimes:jpg,jpeg,png,gif,webp,avif', 'max:8192'],
            'retained_gallery_ids' => ['nullable', 'array'],
            'retained_gallery_ids.*' => ['string', 'max:1000'],
            'remove_image' => ['nullable', 'boolean'],
            'remove_gallery' => ['nullable', 'boolean'],
        ]);
    }

    private function fillProduct(StoreProduct $product, array $validated, Request $request, bool $isUpdate): void
    {
        $discountedPrice = isset($validated['discounted_price_amount']) && $validated['discounted_price_amount'] !== null
            ? (int) $validated['discounted_price_amount']
            : null;
        $basePrice = (int) $validated['price_amount'];

        if ($discountedPrice !== null && $discountedPrice > $basePrice) {
            abort(422, __('store.product.discount_greater_than_price'));
        }

        $existingMetadata = is_array($product->metadata) ? $product->metadata : [];
        $existingGallery = collect($existingMetadata['gallery'] ?? [])->filter(fn ($path) => is_string($path) && $path !== '');

        if ($isUpdate && isset($validated['retained_gallery_ids']) && is_array($validated['retained_gallery_ids'])) {
            $retainedGalleryIds = collect($validated['retained_gallery_ids'])
                ->filter(fn ($item) => is_string($item) && trim($item) !== '')
                ->map(fn (string $item) => trim($item))
                ->values();

            $existingGallery
                ->filter(fn (string $path) => ! $retainedGalleryIds->contains($path))
                ->each(fn (string $path) => $this->deletePhysicalFile($path));

            $existingGallery = $existingGallery
                ->filter(fn (string $path) => $retainedGalleryIds->contains($path))
                ->values();
        }

        if ((bool) ($validated['remove_gallery'] ?? false)) {
            $existingGallery->each(fn ($path) => $this->deletePhysicalFile($path));
            $existingGallery = collect();
        }

        /** @var array<int, UploadedFile> $newGalleryFiles */
        $newGalleryFiles = $request->file('gallery_images', []);
        if ($newGalleryFiles !== []) {
            $storedPaths = collect($newGalleryFiles)
                ->filter(fn ($file) => $file instanceof UploadedFile)
                ->map(function (UploadedFile $file): string {
                    $path = $file->store('store/products/gallery', 'media_public');
                    $this->recordTenantMediaFile($path, (int) $file->getSize());

                    return $path;
                });

            $existingGallery = $existingGallery->merge($storedPaths)->values();
        }

        if ((bool) ($validated['remove_image'] ?? false)) {
            $this->deletePhysicalFile($product->image_path);
            $product->image_path = null;
        }

        /** @var UploadedFile|null $image */
        $image = $request->file('image');
        if ($image instanceof UploadedFile) {
            $this->deletePhysicalFile($product->image_path);
            $product->image_path = $image->store('store/products', 'media_public');
            $this->recordTenantMediaFile($product->image_path, (int) $image->getSize());
        }

        $product->store_category_id = isset($validated['store_category_id']) ? (int) $validated['store_category_id'] : null;
        $product->title = trim((string) $validated['title']);
        $product->slug = $this->uniqueSlug((string) ($validated['slug'] ?? $validated['title']), $isUpdate ? (int) $product->id : null);
        $product->subtitle = trim((string) ($validated['subtitle'] ?? '')) ?: null;
        $product->description = trim((string) ($validated['description'] ?? '')) ?: null;
        $product->price_amount = $basePrice;
        $product->discounted_price_amount = $discountedPrice;
        $product->stock_quantity = (int) ($validated['stock_quantity'] ?? 0);
        $product->sort_order = (int) ($validated['sort_order'] ?? 0);
        $product->is_active = (bool) $validated['is_active'];
        $product->is_featured = (bool) $validated['is_featured'];
        $product->is_bestseller = (bool) $validated['is_bestseller'];
        $product->is_popular = (bool) $validated['is_popular'];
        $product->metadata = [
            ...$existingMetadata,
            'reviews_enabled' => (bool) $validated['reviews_enabled'],
            'gallery' => $existingGallery->values()->all(),
        ];
    }

    private function transformProduct(StoreProduct $product): array
    {
        $metadata = is_array($product->metadata) ? $product->metadata : [];

        return [
            'id' => (string) $product->id,
            'categoryId' => $product->store_category_id ? (string) $product->store_category_id : null,
            'categoryName' => $product->category?->name,
            'title' => $product->title,
            'slug' => $product->slug,
            'subtitle' => $product->subtitle,
            'description' => $product->description,
            'priceAmount' => (int) $product->price_amount,
            'discountedPriceAmount' => $product->discounted_price_amount !== null ? (int) $product->discounted_price_amount : null,
            'stockQuantity' => (int) $product->stock_quantity,
            'sortOrder' => (int) $product->sort_order,
            'isActive' => (bool) $product->is_active,
            'isFeatured' => (bool) $product->is_featured,
            'isBestseller' => (bool) $product->is_bestseller,
            'isPopular' => (bool) $product->is_popular,
            'reviewsEnabled' => (bool) ($metadata['reviews_enabled'] ?? true),
            'imageUrl' => $this->tenantMediaUrl($product->image_path),
            'galleryImages' => collect($metadata['gallery'] ?? [])
                ->filter(fn ($path) => is_string($path) && $path !== '')
                ->map(fn (string $path) => [
                    'id' => $path,
                    'url' => $this->tenantMediaUrl($path),
                ])
                ->values()
                ->all(),
            'galleryImageUrls' => collect($metadata['gallery'] ?? [])
                ->filter(fn ($path) => is_string($path) && $path !== '')
                ->map(fn (string $path) => $this->tenantMediaUrl($path))
                ->values()
                ->all(),
            'createdAt' => $product->created_at?->toISOString(),
        ];
    }

    private function uniqueSlug(string $value, ?int $ignoreId = null): string
    {
        $base = Str::slug(trim($value) !== '' ? $value : 'product');
        $slug = $base !== '' ? $base : 'product';
        $counter = 1;

        while (
            StoreProduct::query()
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
