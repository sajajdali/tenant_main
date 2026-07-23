<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\GeneralSetting;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class NutritionLandingSettingsController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        abort_unless($this->isNutritionAudience(), 404);
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));

        return response()->json([
            'success' => true,
            'data' => $this->payload(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        abort_unless($this->isNutritionAudience(), 404);
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));

        $variantKeys = implode(',', ['classic', 'diet', 'all_features', 'diet_priority']);

        $validated = $request->validate([
            'preferAsDefault' => ['required', 'boolean'],
            'activeVariant' => ['required', 'in:' . $variantKeys],
            'variants' => ['required', 'array'],
            'bookingBanner' => ['nullable', 'array'],
            'bookingBanner.enabled' => ['nullable', 'boolean'],
            'bookingBanner.content' => ['nullable', 'array'],
            'variants.classic' => ['nullable', 'array'],
            'variants.diet' => ['nullable', 'array'],
            'variants.all_features' => ['nullable', 'array'],
            'variants.diet_priority' => ['nullable', 'array'],
            'variants.classic.content' => ['nullable', 'array'],
            'variants.diet.content' => ['nullable', 'array'],
            'variants.all_features.content' => ['nullable', 'array'],
            'variants.diet_priority.content' => ['nullable', 'array'],
        ]);

        $general = GeneralSetting::query()->firstOrCreate([], [
            'timezone' => 'Asia/Tehran',
            'currency' => 'IRR',
            'booking_rules' => [],
        ]);

        $rules = $general->booking_rules ?? [];
        $nutritionLanding = $rules['nutrition_landing'] ?? [];
        $storedVariants = is_array($nutritionLanding['variants'] ?? null) ? $nutritionLanding['variants'] : [];
        $incomingVariants = is_array($validated['variants'] ?? null) ? $validated['variants'] : [];
        $storedBookingBanner = is_array($nutritionLanding['booking_banner'] ?? null) ? $nutritionLanding['booking_banner'] : [];
        $incomingBookingBanner = is_array($validated['bookingBanner'] ?? null) ? $validated['bookingBanner'] : [];

        $nextVariants = [];
        foreach (['classic', 'diet', 'all_features', 'diet_priority'] as $variant) {
            $existingVariant = is_array($storedVariants[$variant] ?? null) ? $storedVariants[$variant] : [];
            $existingContent = is_array($existingVariant['content'] ?? null) ? $existingVariant['content'] : [];
            $incomingVariant = is_array($incomingVariants[$variant] ?? null) ? $incomingVariants[$variant] : [];
            $incomingContent = is_array($incomingVariant['content'] ?? null) ? $incomingVariant['content'] : [];

            $nextVariants[$variant] = [
                'content' => collect($incomingContent)
                    ->mapWithKeys(fn ($value, $key) => [(string) $key => trim((string) $value)])
                    ->all(),
                'image_path' => isset($existingVariant['image_path']) ? (string) $existingVariant['image_path'] : null,
            ];
        }

        $nextBookingBanner = [
            'enabled' => (bool) ($incomingBookingBanner['enabled'] ?? ($storedBookingBanner['enabled'] ?? false)),
            'content' => collect(is_array($incomingBookingBanner['content'] ?? null) ? $incomingBookingBanner['content'] : [])
                ->mapWithKeys(fn ($value, $key) => [(string) $key => trim((string) $value)])
                ->all(),
            'image_path' => isset($storedBookingBanner['image_path']) ? (string) $storedBookingBanner['image_path'] : null,
        ];

        $rules['nutrition_landing'] = [
            'prefer_as_default' => (bool) $validated['preferAsDefault'],
            'active_variant' => (string) $validated['activeVariant'],
            'variants' => $nextVariants,
            'booking_banner' => $nextBookingBanner,
        ];

        $general->update([
            'booking_rules' => $rules,
        ]);

        return response()->json([
            'success' => true,
            'message' => __('tenant.settings.nutrition_landing_saved'),
            'data' => $this->payload(),
        ]);
    }

    public function updateImage(Request $request, string $variant): JsonResponse
    {
        abort_unless($this->isNutritionAudience(), 404);
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));
        abort_unless(in_array($variant, ['classic', 'diet', 'all_features', 'diet_priority'], true), 404);

        $validated = $request->validate([
            'removeImage' => ['nullable', 'boolean'],
            'image' => ['nullable', 'file', 'mimes:jpg,jpeg,png,gif,webp,avif', 'max:8192'],
        ]);

        $general = GeneralSetting::query()->firstOrCreate([], [
            'timezone' => 'Asia/Tehran',
            'currency' => 'IRR',
            'booking_rules' => [],
        ]);

        $rules = $general->booking_rules ?? [];
        $nutritionLanding = $rules['nutrition_landing'] ?? [];
        $variants = is_array($nutritionLanding['variants'] ?? null) ? $nutritionLanding['variants'] : [];
        $current = is_array($variants[$variant] ?? null) ? $variants[$variant] : [];

        if ((bool) ($validated['removeImage'] ?? false)) {
            $this->deletePhysicalFile(isset($current['image_path']) ? (string) $current['image_path'] : null);
            $current['image_path'] = null;
        }

        /** @var UploadedFile|null $image */
        $image = $request->file('image');
        if ($image instanceof UploadedFile) {
            $this->deletePhysicalFile(isset($current['image_path']) ? (string) $current['image_path'] : null);
            $current['image_path'] = $image->store('nutrition/landings', 'media_public');
            $this->recordTenantMediaFile($current['image_path'], (int) $image->getSize());
        }

        $variants[$variant] = [
            'content' => is_array($current['content'] ?? null) ? $current['content'] : [],
            'image_path' => isset($current['image_path']) ? (string) $current['image_path'] : null,
        ];

        $nutritionLanding['variants'] = $variants;
        $rules['nutrition_landing'] = $nutritionLanding;

        $general->update([
            'booking_rules' => $rules,
        ]);

        return response()->json([
            'success' => true,
            'message' => __('tenant.settings.nutrition_landing_image_updated'),
            'data' => $this->payload(),
        ]);
    }

    public function updateBookingBannerImage(Request $request): JsonResponse
    {
        abort_unless($this->isNutritionAudience(), 404);
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));

        $validated = $request->validate([
            'removeImage' => ['nullable', 'boolean'],
            'image' => ['nullable', 'file', 'mimes:jpg,jpeg,png,gif,webp,avif', 'max:8192'],
        ]);

        $general = GeneralSetting::query()->firstOrCreate([], [
            'timezone' => 'Asia/Tehran',
            'currency' => 'IRR',
            'booking_rules' => [],
        ]);

        $rules = $general->booking_rules ?? [];
        $nutritionLanding = is_array($rules['nutrition_landing'] ?? null) ? $rules['nutrition_landing'] : [];
        $bookingBanner = is_array($nutritionLanding['booking_banner'] ?? null) ? $nutritionLanding['booking_banner'] : [];

        if ((bool) ($validated['removeImage'] ?? false)) {
            $this->deletePhysicalFile(isset($bookingBanner['image_path']) ? (string) $bookingBanner['image_path'] : null);
            $bookingBanner['image_path'] = null;
        }

        /** @var UploadedFile|null $image */
        $image = $request->file('image');
        if ($image instanceof UploadedFile) {
            $this->deletePhysicalFile(isset($bookingBanner['image_path']) ? (string) $bookingBanner['image_path'] : null);
            $bookingBanner['image_path'] = $image->store('nutrition/landings', 'media_public');
            $this->recordTenantMediaFile($bookingBanner['image_path'], (int) $image->getSize());
        }

        $bookingBanner['enabled'] = (bool) ($bookingBanner['enabled'] ?? false);
        $bookingBanner['content'] = is_array($bookingBanner['content'] ?? null) ? $bookingBanner['content'] : [];

        $nutritionLanding['booking_banner'] = $bookingBanner;
        $rules['nutrition_landing'] = $nutritionLanding;

        $general->update([
            'booking_rules' => $rules,
        ]);

        return response()->json([
            'success' => true,
            'message' => __('tenant.settings.nutrition_booking_banner_image_updated'),
            'data' => $this->payload(),
        ]);
    }

    public static function dataFromRules(array $rules): array
    {
        $nutritionLanding = is_array($rules['nutrition_landing'] ?? null) ? $rules['nutrition_landing'] : [];
        $variants = is_array($nutritionLanding['variants'] ?? null) ? $nutritionLanding['variants'] : [];
        $bookingBanner = is_array($nutritionLanding['booking_banner'] ?? null) ? $nutritionLanding['booking_banner'] : [];

        $mapVariant = function (string $variant) use ($variants): array {
            $current = is_array($variants[$variant] ?? null) ? $variants[$variant] : [];
            $imagePath = ltrim((string) ($current['image_path'] ?? ''), '/');

            return [
                'content' => is_array($current['content'] ?? null) ? $current['content'] : [],
                'imageUrl' => $imagePath !== ''
                    ? (tenant() ? tenant_asset($imagePath) : Storage::disk('media_public')->url($imagePath))
                    : null,
            ];
        };

        $bookingBannerImagePath = ltrim((string) ($bookingBanner['image_path'] ?? ''), '/');

        return [
            'available' => true,
            'preferAsDefault' => (bool) ($nutritionLanding['prefer_as_default'] ?? false),
            'activeVariant' => (string) ($nutritionLanding['active_variant'] ?? 'classic'),
            'variants' => [
                'classic' => $mapVariant('classic'),
                'diet' => $mapVariant('diet'),
                'all_features' => $mapVariant('all_features'),
                'diet_priority' => $mapVariant('diet_priority'),
            ],
            'bookingBanner' => [
                'enabled' => (bool) ($bookingBanner['enabled'] ?? false),
                'content' => is_array($bookingBanner['content'] ?? null) ? $bookingBanner['content'] : [],
                'imageUrl' => $bookingBannerImagePath !== ''
                    ? (tenant() ? tenant_asset($bookingBannerImagePath) : Storage::disk('media_public')->url($bookingBannerImagePath))
                    : null,
            ],
        ];
    }

    private function payload(): array
    {
        $general = GeneralSetting::query()->first();
        $rules = $general?->booking_rules ?? [];

        return self::dataFromRules($rules);
    }

    private function isNutritionAudience(): bool
    {
        $tenant = tenant()->loadMissing('audienceType:id,slug');
        $slug = $tenant?->audienceType?->slug;

        return in_array($slug, ['nutritionists', 'nutrition-doctors'], true);
    }

    private function deletePhysicalFile(?string $path): void
    {
        $this->deleteTenantMediaFile($path);
    }
}
