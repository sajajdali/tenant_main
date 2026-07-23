<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\TenantFeatureModule;
use App\Http\Controllers\Controller;
use App\Support\StoreSmsTemplateRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

class StoreSettingsController extends Controller
{
    public function showFaq(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->faqPayload(),
        ]);
    }

    public function showShipping(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->shippingPayload(),
        ]);
    }

    public function updateFaq(Request $request): JsonResponse
    {
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));

        $validated = $request->validate([
            'items' => ['required', 'array'],
            'items.*.id' => ['required', 'string', 'max:80'],
            'items.*.question' => ['required', 'string', 'max:500'],
            'items.*.answer' => ['required', 'string', 'max:5000'],
        ]);

        $general = GeneralSetting::query()->firstOrCreate([], [
            'timezone' => 'Asia/Tehran',
            'currency' => 'IRR',
            'booking_rules' => [],
        ]);

        $rules = $general->booking_rules ?? [];
        $storePage = $rules['store_page'] ?? [];
        $faq = $storePage['faq'] ?? [];

        $faq['items'] = collect($validated['items'])
            ->map(fn (array $item) => [
                'id' => (string) $item['id'],
                'question' => trim((string) $item['question']),
                'answer' => trim((string) $item['answer']),
            ])
            ->values()
            ->all();

        $storePage['faq'] = $faq;
        $rules['store_page'] = $storePage;

        $general->update([
            'booking_rules' => $rules,
        ]);

        return response()->json([
            'success' => true,
            'message' => __('store.settings.faq_saved'),
            'data' => $this->faqPayload(),
        ]);
    }

    public function updateShipping(Request $request): JsonResponse
    {
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));

        $validated = $request->validate([
            'postalEnabled' => ['required', 'boolean'],
            'postalBaseAmount' => ['required', 'integer', 'min:0'],
            'postalCityOverrides' => ['nullable', 'array'],
            'postalCityOverrides.*.id' => ['required', 'string', 'max:80'],
            'postalCityOverrides.*.provinceId' => ['required', 'integer'],
            'postalCityOverrides.*.provinceName' => ['required', 'string', 'max:255'],
            'postalCityOverrides.*.cityId' => ['required', 'integer'],
            'postalCityOverrides.*.cityName' => ['required', 'string', 'max:255'],
            'postalCityOverrides.*.amount' => ['required', 'integer', 'min:0'],
            'expressEnabled' => ['required', 'boolean'],
            'expressAmount' => ['required', 'integer', 'min:0'],
            'expressCities' => ['nullable', 'array'],
            'expressCities.*.id' => ['required', 'string', 'max:80'],
            'expressCities.*.provinceId' => ['required', 'integer'],
            'expressCities.*.provinceName' => ['required', 'string', 'max:255'],
            'expressCities.*.cityId' => ['required', 'integer'],
            'expressCities.*.cityName' => ['required', 'string', 'max:255'],
            'pickupEnabled' => ['required', 'boolean'],
        ]);

        $general = GeneralSetting::query()->firstOrCreate([], [
            'timezone' => 'Asia/Tehran',
            'currency' => 'IRR',
            'booking_rules' => [],
        ]);

        $rules = $general->booking_rules ?? [];
        $storePage = $rules['store_page'] ?? [];

        $storePage['shipping'] = [
            'postal_enabled' => (bool) $validated['postalEnabled'],
            'postal_base_amount' => (int) $validated['postalBaseAmount'],
            'postal_city_overrides' => collect($validated['postalCityOverrides'] ?? [])
                ->map(fn (array $item) => [
                    'id' => (string) $item['id'],
                    'province_id' => (int) $item['provinceId'],
                    'province_name' => trim((string) $item['provinceName']),
                    'city_id' => (int) $item['cityId'],
                    'city_name' => trim((string) $item['cityName']),
                    'amount' => (int) $item['amount'],
                ])
                ->values()
                ->all(),
            'express_enabled' => (bool) $validated['expressEnabled'],
            'express_amount' => (int) $validated['expressAmount'],
            'express_cities' => collect($validated['expressCities'] ?? [])
                ->map(fn (array $item) => [
                    'id' => (string) $item['id'],
                    'province_id' => (int) $item['provinceId'],
                    'province_name' => trim((string) $item['provinceName']),
                    'city_id' => (int) $item['cityId'],
                    'city_name' => trim((string) $item['cityName']),
                ])
                ->values()
                ->all(),
            'pickup_enabled' => (bool) $validated['pickupEnabled'],
        ];

        $rules['store_page'] = $storePage;

        $general->update([
            'booking_rules' => $rules,
        ]);

        return response()->json([
            'success' => true,
            'message' => __('store.settings.shipping_saved'),
            'data' => $this->shippingPayload(),
        ]);
    }

    public function showHome(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->homePayload(),
        ]);
    }

    public function updateHome(Request $request): JsonResponse
    {
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));

        $validated = $request->validate([
            'showCategories' => ['required', 'boolean'],
            'showBestsellers' => ['required', 'boolean'],
            'showGraphicBanner' => ['required', 'boolean'],
            'showPopularProducts' => ['required', 'boolean'],
            'showLatestProducts' => ['required', 'boolean'],
            'showFaq' => ['required', 'boolean'],
            'showBannerOnMainSite' => ['required', 'boolean'],
            'preferStoreAsDefaultLanding' => ['required', 'boolean'],
            'showBookingEntryOnStore' => ['required', 'boolean'],
        ]);

        $general = GeneralSetting::query()->firstOrCreate([], [
            'timezone' => 'Asia/Tehran',
            'currency' => 'IRR',
            'booking_rules' => [],
        ]);

        $rules = $general->booking_rules ?? [];
        $storePage = $rules['store_page'] ?? [];
        $home = $storePage['home'] ?? [];

        $home['show_categories'] = (bool) $validated['showCategories'];
        $home['show_bestsellers'] = (bool) $validated['showBestsellers'];
        $home['show_graphic_banner'] = (bool) $validated['showGraphicBanner'];
        $home['show_popular_products'] = (bool) $validated['showPopularProducts'];
        $home['show_latest_products'] = (bool) $validated['showLatestProducts'];
        $home['show_faq'] = (bool) $validated['showFaq'];
        $home['show_banner_on_main_site'] = (bool) $validated['showBannerOnMainSite'];
        $home['prefer_store_as_default_landing'] = (bool) $validated['preferStoreAsDefaultLanding'];
        $home['show_booking_entry_on_store'] = (bool) $validated['showBookingEntryOnStore'];

        $storePage['home'] = $home;
        $rules['store_page'] = $storePage;

        $general->update([
            'booking_rules' => $rules,
        ]);

        return response()->json([
            'success' => true,
            'message' => __('store.settings.home_saved'),
            'data' => $this->homePayload(),
        ]);
    }

    public function updateHomeBanner(Request $request): JsonResponse
    {
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));

        $validated = $request->validate([
            'showBannerOnMainSite' => ['nullable', 'boolean'],
            'removeImage' => ['nullable', 'boolean'],
            'mainSiteBannerTitle' => ['nullable', 'string', 'max:150'],
            'mainSiteBannerDescription' => ['nullable', 'string', 'max:1000'],
            'image' => ['nullable', 'file', 'mimes:jpg,jpeg,png,gif,webp,avif', 'max:8192'],
            'removeGraphicBannerImage' => ['nullable', 'boolean'],
            'graphicBannerBadge' => ['nullable', 'string', 'max:80'],
            'graphicBannerTitle' => ['nullable', 'string', 'max:200'],
            'graphicBannerDescription' => ['nullable', 'string', 'max:2000'],
            'graphicBannerButtonLabel' => ['nullable', 'string', 'max:80'],
            'graphicBannerLink' => ['nullable', 'string', 'max:2000'],
            'graphicBannerImage' => ['nullable', 'file', 'mimes:jpg,jpeg,png,gif,webp,avif', 'max:8192'],
        ]);

        $general = GeneralSetting::query()->firstOrCreate([], [
            'timezone' => 'Asia/Tehran',
            'currency' => 'IRR',
            'booking_rules' => [],
        ]);

        $rules = $general->booking_rules ?? [];
        $storePage = $rules['store_page'] ?? [];
        $home = $storePage['home'] ?? [];

        if ($request->has('showBannerOnMainSite')) {
            $home['show_banner_on_main_site'] = (bool) ($validated['showBannerOnMainSite'] ?? false);
        }

        if ($request->has('mainSiteBannerTitle')) {
            $home['main_site_banner_title'] = trim((string) ($validated['mainSiteBannerTitle'] ?? '')) ?: null;
        }

        if ($request->has('mainSiteBannerDescription')) {
            $home['main_site_banner_description'] = trim((string) ($validated['mainSiteBannerDescription'] ?? '')) ?: null;
        }

        if ((bool) ($validated['removeImage'] ?? false)) {
            $this->deletePhysicalFile(isset($home['main_site_banner_image_path']) ? (string) $home['main_site_banner_image_path'] : null);
            $home['main_site_banner_image_path'] = null;
        }

        /** @var UploadedFile|null $image */
        $image = $request->file('image');
        if ($image instanceof UploadedFile) {
            $this->deletePhysicalFile(isset($home['main_site_banner_image_path']) ? (string) $home['main_site_banner_image_path'] : null);
            $home['main_site_banner_image_path'] = $image->store('store/home-banners', 'media_public');
            $this->recordTenantMediaFile($home['main_site_banner_image_path'], (int) $image->getSize());
        }

        if ($request->has('graphicBannerBadge')) {
            $home['graphic_banner_badge'] = trim((string) ($validated['graphicBannerBadge'] ?? '')) ?: null;
        }

        if ($request->has('graphicBannerTitle')) {
            $home['graphic_banner_title'] = trim((string) ($validated['graphicBannerTitle'] ?? '')) ?: null;
        }

        if ($request->has('graphicBannerDescription')) {
            $home['graphic_banner_description'] = trim((string) ($validated['graphicBannerDescription'] ?? '')) ?: null;
        }

        if ($request->has('graphicBannerButtonLabel')) {
            $home['graphic_banner_button_label'] = trim((string) ($validated['graphicBannerButtonLabel'] ?? '')) ?: null;
        }

        if ($request->has('graphicBannerLink')) {
            $home['graphic_banner_link'] = trim((string) ($validated['graphicBannerLink'] ?? '')) ?: null;
        }

        if ((bool) ($validated['removeGraphicBannerImage'] ?? false)) {
            $this->deletePhysicalFile(isset($home['graphic_banner_image_path']) ? (string) $home['graphic_banner_image_path'] : null);
            $home['graphic_banner_image_path'] = null;
        }

        /** @var UploadedFile|null $graphicBannerImage */
        $graphicBannerImage = $request->file('graphicBannerImage');
        if ($graphicBannerImage instanceof UploadedFile) {
            $this->deletePhysicalFile(isset($home['graphic_banner_image_path']) ? (string) $home['graphic_banner_image_path'] : null);
            $home['graphic_banner_image_path'] = $graphicBannerImage->store('store/graphic-banners', 'media_public');
            $this->recordTenantMediaFile($home['graphic_banner_image_path'], (int) $graphicBannerImage->getSize());
        }

        $storePage['home'] = $home;
        $rules['store_page'] = $storePage;

        $general->update([
            'booking_rules' => $rules,
        ]);

        return response()->json([
            'success' => true,
            'message' => __('store.settings.home_banner_saved'),
            'data' => $this->homePayload(),
        ]);
    }

    public function showGeneral(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->generalPayload(),
        ]);
    }

    public function updateGeneral(Request $request): JsonResponse
    {
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));

        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'smsEnabled' => ['required', 'boolean'],
            'smsTemplatesV2' => ['nullable', 'array'],
            'smsTemplatesV2.afterOrder.enabled' => ['required_with:smsTemplatesV2', 'boolean'],
            'smsTemplatesV2.afterOrder.body' => ['nullable', 'string', 'max:2000'],
            'smsTemplatesV2.afterApproval.enabled' => ['required_with:smsTemplatesV2', 'boolean'],
            'smsTemplatesV2.afterApproval.body' => ['nullable', 'string', 'max:2000'],
            'smsTemplatesV2.afterShippingCode.enabled' => ['required_with:smsTemplatesV2', 'boolean'],
            'smsTemplatesV2.afterShippingCode.body' => ['nullable', 'string', 'max:2000'],
            'smsTemplatesV2.afterRejection.enabled' => ['required_with:smsTemplatesV2', 'boolean'],
            'smsTemplatesV2.afterRejection.body' => ['nullable', 'string', 'max:2000'],
            'smsTemplateAfterOrder' => ['nullable', 'string', 'max:2000'],
            'smsTemplateAfterApproval' => ['nullable', 'string', 'max:2000'],
            'smsTemplateAfterShippingCode' => ['nullable', 'string', 'max:2000'],
            'smsTemplateAfterRejection' => ['nullable', 'string', 'max:2000'],
        ]);

        $storeModuleActive = TenantFeatureModule::query()
            ->whereHas('featureModule', fn ($query) => $query->where('slug', 'online-store'))
            ->where(function ($query): void {
                $query
                    ->whereNull('expires_at')
                    ->orWhere('expires_at', '>=', now()->toDateString());
            })
            ->exists();

        if (! $storeModuleActive && (bool) $validated['smsEnabled']) {
            return response()->json([
                'success' => false,
                'message' => __('store.settings.module_required_for_sms'),
                'data' => $this->generalPayload(),
            ], 422);
        }

        $general = GeneralSetting::query()->firstOrCreate([], [
            'timezone' => 'Asia/Tehran',
            'currency' => 'IRR',
            'booking_rules' => [],
        ]);

        $rules = $general->booking_rules ?? [];
        $storePage = $rules['store_page'] ?? [];
        $storePage['enabled'] = (bool) $validated['enabled'];
        $existingStoreSms = is_array($storePage['sms'] ?? null) ? $storePage['sms'] : [];
        $incomingTemplates = is_array($validated['smsTemplatesV2'] ?? null)
            ? $validated['smsTemplatesV2']
            : $this->legacyTemplatesPayload($validated);
        $templates = StoreSmsTemplateRegistry::buildForPersistence(
            $incomingTemplates,
            is_array($existingStoreSms['templates_v2'] ?? null) ? $existingStoreSms['templates_v2'] : [],
        );
        $storePage['sms'] = [
            'enabled' => (bool) $validated['smsEnabled'],
            'template_after_order' => trim((string) ($templates['afterOrder']['body'] ?? '')) ?: null,
            'template_after_approval' => trim((string) ($templates['afterApproval']['body'] ?? '')) ?: null,
            'template_after_shipping_code' => trim((string) ($templates['afterShippingCode']['body'] ?? '')) ?: null,
            'template_after_rejection' => trim((string) ($templates['afterRejection']['body'] ?? '')) ?: null,
            'templates_v2' => $templates,
        ];
        $rules['store_page'] = $storePage;

        $general->update([
            'booking_rules' => $rules,
        ]);

        return response()->json([
            'success' => true,
            'message' => __('store.settings.general_saved'),
            'data' => $this->generalPayload(),
        ]);
    }

    private function generalPayload(): array
    {
        $general = GeneralSetting::query()->first();
        $rules = $general?->booking_rules ?? [];
        $storePage = $rules['store_page'] ?? [];
        $sms = $storePage['sms'] ?? [];
        $templates = StoreSmsTemplateRegistry::normalizeCollection(
            is_array($sms['templates_v2'] ?? null) ? $sms['templates_v2'] : $this->legacyTemplatesPayload($sms),
        );
        $storeModuleActive = TenantFeatureModule::query()
            ->whereHas('featureModule', fn ($query) => $query->where('slug', 'online-store'))
            ->where('status', 'active')
            ->where(function ($query): void {
                $query
                    ->whereNull('expires_at')
                    ->orWhere('expires_at', '>=', now()->toDateString());
            })
            ->exists();

        return [
            'enabled' => (bool) ($storePage['enabled'] ?? true),
            'storeModuleActive' => $storeModuleActive,
            'smsEnabled' => (bool) ($sms['enabled'] ?? false),
            'smsTemplateAfterOrder' => trim((string) ($templates['afterOrder']['body'] ?? '')),
            'smsTemplateAfterApproval' => trim((string) ($templates['afterApproval']['body'] ?? '')),
            'smsTemplateAfterShippingCode' => trim((string) ($templates['afterShippingCode']['body'] ?? '')),
            'smsTemplateAfterRejection' => trim((string) ($templates['afterRejection']['body'] ?? '')),
            'smsTemplatesV2' => $templates,
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, array{enabled: bool, body: string}>
     */
    private function legacyTemplatesPayload(array $payload): array
    {
        return [
            'afterOrder' => [
                'enabled' => true,
                'body' => trim((string) ($payload['smsTemplateAfterOrder'] ?? $payload['template_after_order'] ?? '')),
            ],
            'afterApproval' => [
                'enabled' => true,
                'body' => trim((string) ($payload['smsTemplateAfterApproval'] ?? $payload['template_after_approval'] ?? '')),
            ],
            'afterShippingCode' => [
                'enabled' => true,
                'body' => trim((string) ($payload['smsTemplateAfterShippingCode'] ?? $payload['template_after_shipping_code'] ?? '')),
            ],
            'afterRejection' => [
                'enabled' => false,
                'body' => trim((string) ($payload['smsTemplateAfterRejection'] ?? $payload['template_after_rejection'] ?? '')),
            ],
        ];
    }

    private function homePayload(): array
    {
        $general = GeneralSetting::query()->first();
        $rules = $general?->booking_rules ?? [];
        $storePage = $rules['store_page'] ?? [];
        $home = $storePage['home'] ?? [];

        return [
            'showCategories' => (bool) ($home['show_categories'] ?? true),
            'showBestsellers' => (bool) ($home['show_bestsellers'] ?? true),
            'showGraphicBanner' => (bool) ($home['show_graphic_banner'] ?? true),
            'showPopularProducts' => (bool) ($home['show_popular_products'] ?? true),
            'showLatestProducts' => (bool) ($home['show_latest_products'] ?? true),
            'showFaq' => (bool) ($home['show_faq'] ?? true),
            'showBannerOnMainSite' => (bool) ($home['show_banner_on_main_site'] ?? false),
            'preferStoreAsDefaultLanding' => (bool) ($home['prefer_store_as_default_landing'] ?? false),
            'showBookingEntryOnStore' => (bool) ($home['show_booking_entry_on_store'] ?? false),
            'mainSiteBannerImageUrl' => $this->tenantMediaUrl($home['main_site_banner_image_path'] ?? null),
            'mainSiteBannerTitle' => isset($home['main_site_banner_title']) ? trim((string) $home['main_site_banner_title']) : null,
            'mainSiteBannerDescription' => isset($home['main_site_banner_description']) ? trim((string) $home['main_site_banner_description']) : null,
            'graphicBannerImageUrl' => $this->tenantMediaUrl($home['graphic_banner_image_path'] ?? null),
            'graphicBannerBadge' => isset($home['graphic_banner_badge']) ? trim((string) $home['graphic_banner_badge']) : null,
            'graphicBannerTitle' => isset($home['graphic_banner_title']) ? trim((string) $home['graphic_banner_title']) : null,
            'graphicBannerDescription' => isset($home['graphic_banner_description']) ? trim((string) $home['graphic_banner_description']) : null,
            'graphicBannerButtonLabel' => isset($home['graphic_banner_button_label']) ? trim((string) $home['graphic_banner_button_label']) : null,
            'graphicBannerLink' => isset($home['graphic_banner_link']) ? trim((string) $home['graphic_banner_link']) : null,
        ];
    }

    private function deletePhysicalFile(?string $path): void
    {
        $this->deleteTenantMediaFile($path);
    }

    private function faqPayload(): array
    {
        $general = GeneralSetting::query()->first();
        $rules = $general?->booking_rules ?? [];
        $storePage = $rules['store_page'] ?? [];
        $faq = $storePage['faq'] ?? [];

        return [
            'items' => collect($faq['items'] ?? [])
                ->map(fn ($item, $index) => [
                    'id' => (string) ($item['id'] ?? ('faq-' . ($index + 1))),
                    'question' => trim((string) ($item['question'] ?? '')),
                    'answer' => trim((string) ($item['answer'] ?? '')),
                ])
                ->filter(fn (array $item) => $item['question'] !== '' && $item['answer'] !== '')
                ->values()
                ->all(),
        ];
    }

    private function shippingPayload(): array
    {
        $general = GeneralSetting::query()->first();
        $rules = $general?->booking_rules ?? [];
        $storePage = $rules['store_page'] ?? [];
        $shipping = $storePage['shipping'] ?? [];

        return [
            'postalEnabled' => (bool) ($shipping['postal_enabled'] ?? true),
            'postalBaseAmount' => (int) ($shipping['postal_base_amount'] ?? 0),
            'postalCityOverrides' => collect($shipping['postal_city_overrides'] ?? [])
                ->map(fn ($item, $index) => [
                    'id' => (string) ($item['id'] ?? ('postal-city-' . ($index + 1))),
                    'provinceId' => (int) ($item['province_id'] ?? 0),
                    'provinceName' => trim((string) ($item['province_name'] ?? '')),
                    'cityId' => (int) ($item['city_id'] ?? 0),
                    'cityName' => trim((string) ($item['city_name'] ?? '')),
                    'amount' => (int) ($item['amount'] ?? 0),
                ])
                ->filter(fn (array $item) => $item['provinceId'] > 0 && $item['cityId'] > 0)
                ->values()
                ->all(),
            'expressEnabled' => (bool) ($shipping['express_enabled'] ?? false),
            'expressAmount' => (int) ($shipping['express_amount'] ?? 0),
            'expressCities' => collect($shipping['express_cities'] ?? [])
                ->map(fn ($item, $index) => [
                    'id' => (string) ($item['id'] ?? ('express-city-' . ($index + 1))),
                    'provinceId' => (int) ($item['province_id'] ?? 0),
                    'provinceName' => trim((string) ($item['province_name'] ?? '')),
                    'cityId' => (int) ($item['city_id'] ?? 0),
                    'cityName' => trim((string) ($item['city_name'] ?? '')),
                ])
                ->filter(fn (array $item) => $item['provinceId'] > 0 && $item['cityId'] > 0)
                ->values()
                ->all(),
            'pickupEnabled' => (bool) ($shipping['pickup_enabled'] ?? false),
        ];
    }
}
