<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\GeneralSetting;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

class AboutSettingsController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->payload(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $this->ensurePrimaryAdmin($request);

        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'title' => ['nullable', 'string', 'max:255'],
            'body' => ['nullable', 'string'],
            'seoEnabled' => ['nullable', 'boolean'],
            'seoTitle' => ['nullable', 'string', 'max:255'],
            'seoDescription' => ['nullable', 'string', 'max:320'],
            'seoKeywords' => ['nullable', 'string', 'max:500'],
            'seoIndexable' => ['nullable', 'boolean'],
            'removeImage' => ['nullable', 'boolean'],
            'image' => ['nullable', 'file', 'image', 'max:4096'],
        ]);

        $general = GeneralSetting::query()->firstOrCreate([], [
            'timezone' => 'Asia/Tehran',
            'currency' => 'IRR',
            'booking_rules' => [],
        ]);

        $rules = $general->booking_rules ?? [];
        $about = $rules['about_page'] ?? [];

        if (! empty($validated['removeImage'])) {
            $this->deletePhysicalFile($about['image_path'] ?? null);
            unset($about['image_path']);
        }

        if ($request->hasFile('image')) {
            $this->deletePhysicalFile($about['image_path'] ?? null);
            /** @var UploadedFile $image */
            $image = $request->file('image');
            $about['image_path'] = $image->store('about', 'media_public');
            $this->recordTenantMediaFile($about['image_path'], (int) $image->getSize());
        }

        $about['enabled'] = (bool) $validated['enabled'];
        $about['title'] = (string) ($validated['title'] ?? '');
        $about['body'] = (string) ($validated['body'] ?? '');
        $about['seo'] = [
            'enabled' => (bool) ($validated['seoEnabled'] ?? false),
            'title' => (string) ($validated['seoTitle'] ?? ''),
            'description' => (string) ($validated['seoDescription'] ?? ''),
            'keywords' => (string) ($validated['seoKeywords'] ?? ''),
            'indexable' => array_key_exists('seoIndexable', $validated) ? (bool) $validated['seoIndexable'] : true,
        ];

        $rules['about_page'] = $about;

        $general->update([
            'booking_rules' => $rules,
        ]);

        return response()->json([
            'success' => true,
            'message' => __('tenant.about.settings_saved'),
            'data' => $this->payload(),
        ]);
    }

    private function payload(): array
    {
        $general = GeneralSetting::query()->first();
        $rules = $general?->booking_rules ?? [];
        $about = $rules['about_page'] ?? [];
        $seo = $about['seo'] ?? [];

        return [
            'enabled' => (bool) ($about['enabled'] ?? false),
            'title' => (string) ($about['title'] ?? ''),
            'body' => (string) ($about['body'] ?? ''),
            'imageUrl' => $this->tenantMediaUrl($about['image_path'] ?? null),
            'seoEnabled' => (bool) ($seo['enabled'] ?? false),
            'seoTitle' => (string) ($seo['title'] ?? ''),
            'seoDescription' => (string) ($seo['description'] ?? ''),
            'seoKeywords' => (string) ($seo['keywords'] ?? ''),
            'seoIndexable' => array_key_exists('indexable', $seo) ? (bool) $seo['indexable'] : true,
        ];
    }

    private function ensurePrimaryAdmin(Request $request): void
    {
        $actor = $request->user('tenant_web');
        $tenant = tenant();

        abort_unless($actor?->role === 'admin', 403, __('authorization.primary_admin_section'));
        abort_unless(
            $actor?->central_user_id !== null
            && $tenant?->owner_user_id !== null
            && (int) $actor->central_user_id === (int) $tenant->owner_user_id,
            403,
            __('authorization.primary_admin_section'),
        );
    }

    private function deletePhysicalFile(?string $path): void
    {
        $this->deleteTenantMediaFile($path);
    }
}
