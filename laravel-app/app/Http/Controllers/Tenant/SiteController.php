<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Booking\Models\Barber;
use App\Domain\Booking\Models\Service;
use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\TenantFeatureModule;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\ArticleSettingsController;
use App\Http\Controllers\Tenant\NutritionLandingSettingsController;
use App\Http\Controllers\Tenant\OnlineChatSettingsController;
use App\Services\CustomerClubService;
use App\Support\AudienceSpecializedCourseSettings;
use App\Support\TenantIrDomain;
use App\Support\TenantLocale;
use App\Support\TenantSupport;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

class SiteController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $tenant = tenant()->loadMissing(['audienceType', 'subscriptionPackage']);
        $barbersCount = Barber::query()->count();
        $servicesCount = Service::query()->count();
        $support = TenantSupport::summary($tenant);
        $domainRenewal = TenantIrDomain::summary($tenant);
        $audience = $tenant->audienceType;
        $generalSettings = GeneralSetting::query()->first();
        $rules = $generalSettings?->booking_rules ?? [];
        $localeMeta = TenantLocale::meta($generalSettings, $request);
        $pwaMeta = $this->buildPwaMeta($request, $tenant->name, $rules, $generalSettings?->updated_at?->timestamp);
        $isNutritionAudience = in_array($audience?->slug, ['nutritionists', 'nutrition-doctors'], true);
        $appointmentBookingDisabled = $isNutritionAudience && (bool) ($rules['appointment_booking_disabled'] ?? false);
        $activeFeatureModules = TenantFeatureModule::query()
            ->with('featureModule')
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->where(function ($query): void {
                $query->whereNull('expires_at')
                    ->orWhereDate('expires_at', '>=', now()->toDateString());
            })
            ->get()
            ->filter(fn (TenantFeatureModule $item) => $item->featureModule !== null)
            ->map(fn (TenantFeatureModule $item): array => [
                'id' => (string) $item->featureModule->id,
                'slug' => $item->featureModule->slug,
                'name' => $item->featureModule->name,
                'expiresAt' => $item->expires_at?->toDateString(),
            ])
            ->values();
        $customerClubStatus = app(CustomerClubService::class)->publicStatusForTenant($tenant);
        $pageMeta = $this->buildPageMeta($request, $tenant->name, $rules);

        return response()
            ->view('tenant.booking-spa', [
                'tenant' => $tenant,
                'pageMeta' => $pageMeta,
                'pwaMeta' => $pwaMeta,
                'localeMeta' => $localeMeta,
                'bootstrapMeta' => [
                    'tenant_id' => tenant('id'),
                    ...$localeMeta,
                    'tenant_domains' => $tenant->domains->pluck('domain')->values(),
                    'setupCompleted' => $barbersCount > 0 && $servicesCount > 0,
                    'barbersCount' => $barbersCount,
                    'servicesCount' => $servicesCount,
                    'supportEndsAt' => $support['supportEndsAt'],
                    'supportExpired' => $support['supportExpired'],
                    'supportDaysRemaining' => $support['supportDaysRemaining'],
                    'irDomain' => $domainRenewal,
                    'domainRenewal' => $domainRenewal,
                    'panelAccessLocked' => $tenant->isPanelAccessLocked(),
                    'panelAccessMessage' => $tenant->isPanelAccessLocked() ? $tenant->panelAccessMessage() : null,
                    'galleryEnabled' => (bool) (($generalSettings?->booking_rules ?? [])['gallery_enabled'] ?? false),
                    'contactEnabled' => (bool) ((($generalSettings?->booking_rules ?? [])['contact_page'] ?? [])['enabled'] ?? false),
                    'storeEnabled' => (bool) ((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['enabled'] ?? true),
                    'appointmentBookingDisabled' => $appointmentBookingDisabled,
                    'articlesSettings' => ArticleSettingsController::settingsFromRules($rules),
                    'articleCategories' => ArticleSettingsController::categoryTree(),
                    'articleTags' => ArticleSettingsController::tagItems(),
                    'storeHomeSettings' => [
                        'showCategories' => (bool) ((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['home'] ?? [])['show_categories'] ?? true)),
                        'showBestsellers' => (bool) ((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['home'] ?? [])['show_bestsellers'] ?? true)),
                        'showGraphicBanner' => (bool) ((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['home'] ?? [])['show_graphic_banner'] ?? true)),
                        'showPopularProducts' => (bool) ((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['home'] ?? [])['show_popular_products'] ?? true)),
                        'showLatestProducts' => (bool) ((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['home'] ?? [])['show_latest_products'] ?? true)),
                        'showFaq' => (bool) ((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['home'] ?? [])['show_faq'] ?? true)),
                        'showBannerOnMainSite' => (bool) ((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['home'] ?? [])['show_banner_on_main_site'] ?? false)),
                        'preferStoreAsDefaultLanding' => (bool) ((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['home'] ?? [])['prefer_store_as_default_landing'] ?? false)),
                        'showBookingEntryOnStore' => (bool) ((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['home'] ?? [])['show_booking_entry_on_store'] ?? false)),
                        'mainSiteBannerImageUrl' => $this->tenantMediaUrl((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['home'] ?? [])['main_site_banner_image_path'] ?? null)),
                        'mainSiteBannerTitle' => trim((string) ((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['home'] ?? [])['main_site_banner_title'] ?? ''))) ?: null,
                        'mainSiteBannerDescription' => trim((string) ((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['home'] ?? [])['main_site_banner_description'] ?? ''))) ?: null,
                        'graphicBannerImageUrl' => $this->tenantMediaUrl((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['home'] ?? [])['graphic_banner_image_path'] ?? null)),
                        'graphicBannerBadge' => trim((string) ((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['home'] ?? [])['graphic_banner_badge'] ?? ''))) ?: null,
                        'graphicBannerTitle' => trim((string) ((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['home'] ?? [])['graphic_banner_title'] ?? ''))) ?: null,
                        'graphicBannerDescription' => trim((string) ((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['home'] ?? [])['graphic_banner_description'] ?? ''))) ?: null,
                        'graphicBannerButtonLabel' => trim((string) ((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['home'] ?? [])['graphic_banner_button_label'] ?? ''))) ?: null,
                        'graphicBannerLink' => trim((string) ((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['home'] ?? [])['graphic_banner_link'] ?? ''))) ?: null,
                    ],
                    'storeFaqItems' => collect((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['faq'] ?? [])['items'] ?? []))
                        ->map(fn ($item, $index) => [
                            'id' => (string) ($item['id'] ?? ('faq-' . ($index + 1))),
                            'question' => trim((string) ($item['question'] ?? '')),
                            'answer' => trim((string) ($item['answer'] ?? '')),
                        ])
                        ->filter(fn (array $item) => $item['question'] !== '' && $item['answer'] !== '')
                        ->values()
                        ->all(),
                    'storeShippingSettings' => [
                        'postalEnabled' => (bool) ((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['shipping'] ?? [])['postal_enabled'] ?? true)),
                        'postalBaseAmount' => (int) ((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['shipping'] ?? [])['postal_base_amount'] ?? 0)),
                        'postalCityOverrides' => collect((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['shipping'] ?? [])['postal_city_overrides'] ?? []))
                            ->map(fn ($item, $index) => [
                                'id' => (string) ($item['id'] ?? ('postal-city-' . ($index + 1))),
                                'provinceId' => (int) ($item['province_id'] ?? 0),
                                'provinceName' => trim((string) ($item['province_name'] ?? '')),
                                'cityId' => (int) ($item['city_id'] ?? 0),
                                'cityName' => trim((string) ($item['city_name'] ?? '')),
                                'amount' => (int) ($item['amount'] ?? 0),
                            ])->filter(fn (array $item) => $item['provinceId'] > 0 && $item['cityId'] > 0)->values()->all(),
                        'expressEnabled' => (bool) ((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['shipping'] ?? [])['express_enabled'] ?? false)),
                        'expressAmount' => (int) ((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['shipping'] ?? [])['express_amount'] ?? 0)),
                        'expressCities' => collect((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['shipping'] ?? [])['express_cities'] ?? []))
                            ->map(fn ($item, $index) => [
                                'id' => (string) ($item['id'] ?? ('express-city-' . ($index + 1))),
                                'provinceId' => (int) ($item['province_id'] ?? 0),
                                'provinceName' => trim((string) ($item['province_name'] ?? '')),
                                'cityId' => (int) ($item['city_id'] ?? 0),
                                'cityName' => trim((string) ($item['city_name'] ?? '')),
                            ])->filter(fn (array $item) => $item['provinceId'] > 0 && $item['cityId'] > 0)->values()->all(),
                        'pickupEnabled' => (bool) ((((($generalSettings?->booking_rules ?? [])['store_page'] ?? [])['shipping'] ?? [])['pickup_enabled'] ?? false)),
                    ],
                    'audience' => $audience ? [
                        'id' => (string) $audience->id,
                        'name' => $audience->name,
                        'slug' => $audience->slug,
                        'singularLabel' => $audience->singular_label,
                        'pluralLabel' => $audience->plural_label,
                        'businessLabel' => $audience->business_label,
                        'enabledFeatures' => $audience->enabled_features ?? [],
                        'nutritionFeatures' => $audience->nutrition_features ?? [],
                        'futureFeatures' => $audience->future_features ?? [],
                        'specializedCourseSettings' => AudienceSpecializedCourseSettings::normalize(
                            $audience->specialized_course_settings,
                            $audience->slug,
                        ),
                    ] : null,
                    'subscriptionPackage' => $tenant->subscriptionPackage ? [
                        'id' => (string) $tenant->subscriptionPackage->id,
                        'name' => $tenant->subscriptionPackage->name,
                        'durationDays' => (int) $tenant->subscriptionPackage->duration_days,
                    ] : null,
                    'activeFeatureModules' => $activeFeatureModules,
                    'customerClubSettings' => $customerClubStatus,
                    'onlineChatSettings' => OnlineChatSettingsController::dataFromRules($rules, $tenant),
                    'nutritionLanding' => $isNutritionAudience
                        ? NutritionLandingSettingsController::dataFromRules($rules)
                        : null,
                ],
            ])
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            ->header('Pragma', 'no-cache')
            ->header('Expires', '0');
    }

    public function manifest(Request $request): JsonResponse
    {
        $tenant = tenant()->loadMissing('audienceType');
        $generalSettings = GeneralSetting::query()->first();
        $rules = $generalSettings?->booking_rules ?? [];
        $localeMeta = TenantLocale::meta($generalSettings, $request);
        $pwaMeta = $this->buildPwaMeta($request, $tenant->name, $rules, $generalSettings?->updated_at?->timestamp);

        return response()
            ->json([
                'id' => '/',
                'name' => $pwaMeta['appName'],
                'short_name' => $pwaMeta['shortName'],
                'description' => $localeMeta['locale'] === 'en'
                    ? 'Online booking and service management'
                    : 'نوبت‌دهی آنلاین و مدیریت خدمات',
                'dir' => $localeMeta['dir'],
                'lang' => $localeMeta['htmlLang'],
                'start_url' => '/?source=pwa',
                'scope' => '/',
                'display' => 'standalone',
                'display_override' => ['standalone', 'minimal-ui'],
                'orientation' => 'portrait',
                'background_color' => $pwaMeta['backgroundColor'],
                'theme_color' => $pwaMeta['themeColor'],
                'icons' => [
                    [
                        'src' => $pwaMeta['icon192Url'],
                        'sizes' => '192x192',
                        'type' => $pwaMeta['iconType'],
                        'purpose' => 'any maskable',
                    ],
                    [
                        'src' => $pwaMeta['icon512Url'],
                        'sizes' => '512x512',
                        'type' => $pwaMeta['iconType'],
                        'purpose' => 'any maskable',
                    ],
                    [
                        'src' => $pwaMeta['appleTouchIconUrl'],
                        'sizes' => '180x180',
                        'type' => $pwaMeta['iconType'],
                        'purpose' => 'any',
                    ],
                ],
            ], 200, [
                'Content-Type' => 'application/manifest+json; charset=UTF-8',
                'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma' => 'no-cache',
                'Expires' => '0',
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public function pwaIcon(Request $request, int $size)
    {
        abort_unless(in_array($size, [180, 192, 512], true), 404);

        $generalSettings = GeneralSetting::query()->first();
        $rules = $generalSettings?->booking_rules ?? [];
        $appearance = is_array($rules['appearance'] ?? null) ? $rules['appearance'] : [];
        $customIconPath = trim((string) ($appearance['logo_path'] ?? '')) ?: trim((string) ($appearance['favicon_path'] ?? ''));

        if ($customIconPath !== '') {
            $rendered = $this->renderTenantPngIcon($customIconPath, $size);

            if ($rendered !== null) {
                return response($rendered, 200, [
                    'Content-Type' => 'image/png',
                    'Cache-Control' => 'public, max-age=31536000, immutable',
                ]);
            }
        }

        $fallback = public_path('booking-app/' . match ($size) {
            180 => 'apple-touch-icon.png',
            512 => 'icon-512.png',
            default => 'icon-192.png',
        });

        abort_unless(is_file($fallback), 404);

        return response()->file($fallback, [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }

    private function buildPageMeta(Request $request, string $tenantName, array $rules): array
    {
        $appearance = $rules['appearance'] ?? [];
        $about = $rules['about_page'] ?? [];
        $aboutSeo = $about['seo'] ?? [];
        $storeName = trim((string) ($appearance['store_name'] ?? '')) ?: $tenantName;
        $path = '/' . ltrim($request->path(), '/');
        if ($path === '//' || $path === '/index.php') {
            $path = '/';
        }

        $canonical = $this->publicOrigin($request) . ($path === '/' ? '/' : $path);
        $defaultImage = global_asset('booking-app/opengraph.jpg');

        $meta = [
            'siteName' => $storeName,
            'title' => $storeName . ' | سیستم نوبت‌دهی',
            'description' => 'نوبت‌دهی آنلاین و آشنایی با خدمات این مجموعه.',
            'keywords' => '',
            'robots' => 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
            'canonical' => $canonical,
            'image' => $defaultImage,
            'type' => 'website',
            'jsonLd' => null,
        ];

        if ($path === '/about') {
            $aboutTitle = trim((string) ($about['title'] ?? ''));
            $aboutBody = trim((string) ($about['body'] ?? ''));
            $seoEnabled = (bool) ($aboutSeo['enabled'] ?? false);
            $indexable = (bool) ($about['enabled'] ?? false)
                && $seoEnabled
                && (bool) ($aboutSeo['indexable'] ?? true);
            $description = trim((string) ($aboutSeo['description'] ?? '')) ?: $this->excerpt($aboutBody, 160);

            $meta['title'] = trim((string) ($aboutSeo['title'] ?? '')) ?: ($aboutTitle !== '' ? $aboutTitle . ' | ' . $storeName : 'درباره ما | ' . $storeName);
            $meta['description'] = $description !== '' ? $description : ('معرفی ' . $storeName);
            $meta['keywords'] = trim((string) ($aboutSeo['keywords'] ?? ''));
            $meta['robots'] = $indexable
                ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
                : 'noindex,nofollow';
            $meta['image'] = ! empty($about['image_path'])
                ? asset('/storage/' . ltrim((string) $about['image_path'], '/'))
                : $defaultImage;
            $meta['jsonLd'] = $seoEnabled ? [
                '@context' => 'https://schema.org',
                '@type' => 'Organization',
                'name' => $storeName,
                'url' => $canonical,
                'description' => $meta['description'],
                'image' => $meta['image'],
            ] : null;
        }

        if ($path === '/contact') {
            $contact = $rules['contact_page'] ?? [];
            $location = $contact['location'] ?? [];
            $phones = collect($contact['phones'] ?? [])->pluck('number')->filter()->join(' - ');

            $meta['title'] = 'ارتباط با ما | ' . $storeName;
            $meta['description'] = trim((string) ($location['address'] ?? '')) ?: ($phones !== '' ? 'راه‌های ارتباط با ' . $storeName . ' شامل شماره تماس و آدرس.' : 'اطلاعات تماس ' . $storeName);
            $meta['robots'] = (bool) ($contact['enabled'] ?? false)
                ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
                : 'noindex,nofollow';
            $meta['jsonLd'] = (bool) ($contact['enabled'] ?? false) ? [
                '@context' => 'https://schema.org',
                '@type' => 'LocalBusiness',
                'name' => $storeName,
                'url' => $canonical,
                'description' => $meta['description'],
                'telephone' => collect($contact['phones'] ?? [])->pluck('number')->filter()->values()->all(),
                'address' => [
                    '@type' => 'PostalAddress',
                    'addressLocality' => (string) ($location['city_name'] ?? ''),
                    'addressRegion' => (string) ($location['province_name'] ?? ''),
                    'streetAddress' => (string) ($location['address'] ?? ''),
                    'addressCountry' => 'IR',
                ],
                'geo' => (! empty($location['latitude']) && ! empty($location['longitude'])) ? [
                    '@type' => 'GeoCoordinates',
                    'latitude' => (float) $location['latitude'],
                    'longitude' => (float) $location['longitude'],
                ] : null,
            ] : null;
        }

        if ($path === '/store') {
            $meta['title'] = 'فروشگاه | ' . $storeName;
            $meta['description'] = 'فروشگاه آنلاین ' . $storeName . ' برای مشاهده محصولات منتخب، پرفروش‌ها و محبوب‌ترین‌ها.';
        }

        if ($path === '/store/bestsellers') {
            $meta['title'] = 'پرفروش‌ترین محصولات | ' . $storeName;
            $meta['description'] = 'لیست پرفروش‌ترین محصولات فروشگاه ' . $storeName . ' با صفحه‌بندی مجزا و مسیر اختصاصی.';
        }

        if ($path === '/store/popular') {
            $meta['title'] = 'محبوب‌ترین محصولات | ' . $storeName;
            $meta['description'] = 'لیست محبوب‌ترین محصولات فروشگاه ' . $storeName . ' با مسیر اختصاصی برای نمایش و ایندکس بهتر.';
        }

        if ($path === '/store/search') {
            $meta['title'] = 'جست‌وجوی محصولات | ' . $storeName;
            $meta['description'] = 'نتایج جست‌وجوی محصولات فروشگاه ' . $storeName . '.';
            $meta['robots'] = 'noindex,nofollow';
        }

        if ($path === '/store/checkout') {
            $meta['title'] = 'سبد خرید و تکمیل سفارش | ' . $storeName;
            $meta['description'] = 'مرور سبد خرید و تکمیل اطلاعات سفارش در فروشگاه ' . $storeName . '.';
            $meta['robots'] = 'noindex,nofollow';
        }

        if ($path === '/store/checkout/payment') {
            $meta['title'] = 'انتخاب روش پرداخت | ' . $storeName;
            $meta['description'] = 'انتخاب روش پرداخت سفارش در فروشگاه ' . $storeName . '.';
            $meta['robots'] = 'noindex,nofollow';
        }

        if ($path === '/store/checkout/result') {
            $meta['title'] = 'نتیجه سفارش | ' . $storeName;
            $meta['description'] = 'نتیجه ثبت سفارش فروشگاه ' . $storeName . '.';
            $meta['robots'] = 'noindex,nofollow';
        }

        if (str_starts_with($path, '/store/product/')) {
            $meta['title'] = 'مشاهده محصول | ' . $storeName;
            $meta['description'] = 'صفحه معرفی محصول در فروشگاه ' . $storeName . '.';
            $meta['type'] = 'product';
        }

        return $meta;
    }

    private function buildPwaMeta(Request $request, string $tenantName, array $rules, ?int $settingsTimestamp = null): array
    {
        $appearance = is_array($rules['appearance'] ?? null) ? $rules['appearance'] : [];
        $storeName = trim((string) ($appearance['store_name'] ?? '')) ?: $tenantName;
        $shortName = Str::limit($storeName, 24, '');
        $version = substr(sha1(implode('|', [
            tenant('id') ?: '',
            $tenantName,
            $settingsTimestamp ?: 0,
            $appearance['logo_path'] ?? '',
            $appearance['favicon_path'] ?? '',
        ])), 0, 12);

        $fallbackIcon192 = $this->withVersion(global_asset('booking-app/icon-192.png'), (string) @filemtime(public_path('booking-app/icon-192.png')) ?: $version);
        $fallbackIcon512 = $this->withVersion(global_asset('booking-app/icon-512.png'), (string) @filemtime(public_path('booking-app/icon-512.png')) ?: $version);
        $fallbackApple = $this->withVersion(global_asset('booking-app/apple-touch-icon.png'), (string) @filemtime(public_path('booking-app/apple-touch-icon.png')) ?: $version);
        $fallbackFavicon = $this->withVersion(global_asset('booking-app/favicon.png'), (string) @filemtime(public_path('booking-app/favicon.png')) ?: $version);
        $pwaIconPath = trim((string) ($appearance['logo_path'] ?? '')) ?: trim((string) ($appearance['favicon_path'] ?? ''));
        $faviconPath = trim((string) ($appearance['favicon_path'] ?? '')) ?: trim((string) ($appearance['logo_path'] ?? ''));
        $customPwaIconUrl = $pwaIconPath !== ''
            ? $this->publicOrigin($request) . '/pwa/icon-%s.png'
            : null;
        $customFaviconUrl = $faviconPath !== '' ? $this->withVersion($this->tenantMediaUrl($faviconPath), $version) : null;
        $faviconType = $faviconPath !== '' ? $this->iconMimeType($faviconPath) : 'image/png';

        $themeMode = (string) ($appearance['theme_mode'] ?? 'dark');
        $backgroundColor = $themeMode === 'light' ? '#f8fafc' : '#0f172a';

        return [
            'appName' => $storeName,
            'shortName' => $shortName !== '' ? $shortName : 'نوبت‌دهی',
            'manifestUrl' => $this->withVersion($this->publicOrigin($request) . '/site.webmanifest', $version),
            'themeColor' => $backgroundColor,
            'backgroundColor' => $backgroundColor,
            'iconType' => 'image/png',
            'faviconType' => $customFaviconUrl ? $faviconType : 'image/png',
            'icon192Url' => $customPwaIconUrl ? $this->withVersion(sprintf($customPwaIconUrl, 192), $version) : $fallbackIcon192,
            'icon512Url' => $customPwaIconUrl ? $this->withVersion(sprintf($customPwaIconUrl, 512), $version) : $fallbackIcon512,
            'appleTouchIconUrl' => $customPwaIconUrl ? $this->withVersion(sprintf($customPwaIconUrl, 180), $version) : $fallbackApple,
            'faviconUrl' => $customFaviconUrl ?: $fallbackFavicon,
            'alternateIconType' => $customFaviconUrl ? $faviconType : 'image/x-icon',
            'alternateIconUrl' => $customFaviconUrl ?: $this->withVersion(global_asset('booking-app/favicon.ico'), (string) @filemtime(public_path('booking-app/favicon.ico')) ?: $version),
        ];
    }

    private function withVersion(?string $url, string $version): string
    {
        $url = trim((string) $url);

        if ($url === '') {
            return '';
        }

        return $url . (str_contains($url, '?') ? '&' : '?') . 'v=' . rawurlencode($version);
    }

    private function iconMimeType(string $path): string
    {
        return match (Str::lower(pathinfo($path, PATHINFO_EXTENSION))) {
            'svg' => 'image/svg+xml',
            'jpg', 'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
            'ico' => 'image/x-icon',
            default => 'image/png',
        };
    }

    private function publicOrigin(Request $request): string
    {
        $forwardedProto = trim((string) $request->headers->get('x-forwarded-proto', ''));
        $scheme = $forwardedProto !== ''
            ? Str::lower(trim(explode(',', $forwardedProto)[0]))
            : ($request->isSecure() ? 'https' : $request->getScheme());

        if (! in_array($scheme, ['http', 'https'], true)) {
            $scheme = 'https';
        }

        $forwardedHost = trim((string) $request->headers->get('x-forwarded-host', ''));
        $host = $forwardedHost !== ''
            ? trim(explode(',', $forwardedHost)[0])
            : $request->getHttpHost();

        if ($host === '' || str_starts_with($host, '127.0.0.1')) {
            $host = $request->getHttpHost();
        }

        return $scheme . '://' . $host;
    }

    private function renderTenantPngIcon(string $path, int $size): ?string
    {
        if (! function_exists('imagecreatetruecolor')) {
            return null;
        }

        $fullPath = storage_path('app/public/' . ltrim($path, '/'));

        if (! is_file($fullPath)) {
            return null;
        }

        $imageInfo = @getimagesize($fullPath);

        if (! is_array($imageInfo)) {
            return null;
        }

        [$sourceWidth, $sourceHeight] = $imageInfo;

        if ($sourceWidth <= 0 || $sourceHeight <= 0) {
            return null;
        }

        $source = match ($imageInfo[2] ?? null) {
            IMAGETYPE_PNG => @imagecreatefrompng($fullPath),
            IMAGETYPE_JPEG => @imagecreatefromjpeg($fullPath),
            IMAGETYPE_WEBP => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($fullPath) : false,
            IMAGETYPE_GIF => @imagecreatefromgif($fullPath),
            default => false,
        };

        if (! $source) {
            return null;
        }

        $canvas = imagecreatetruecolor($size, $size);

        if (! $canvas) {
            imagedestroy($source);

            return null;
        }

        imagealphablending($canvas, false);
        imagesavealpha($canvas, true);
        $transparent = imagecolorallocatealpha($canvas, 255, 255, 255, 127);
        imagefilledrectangle($canvas, 0, 0, $size, $size, $transparent);

        $padding = max(0, (int) round($size * 0.08));
        $availableSize = $size - ($padding * 2);
        $scale = min($availableSize / $sourceWidth, $availableSize / $sourceHeight);
        $targetWidth = max(1, (int) round($sourceWidth * $scale));
        $targetHeight = max(1, (int) round($sourceHeight * $scale));
        $targetX = (int) floor(($size - $targetWidth) / 2);
        $targetY = (int) floor(($size - $targetHeight) / 2);

        imagecopyresampled(
            $canvas,
            $source,
            $targetX,
            $targetY,
            0,
            0,
            $targetWidth,
            $targetHeight,
            $sourceWidth,
            $sourceHeight,
        );

        ob_start();
        imagepng($canvas);
        $png = ob_get_clean();

        imagedestroy($source);
        imagedestroy($canvas);

        return is_string($png) && $png !== '' ? $png : null;
    }

    private function excerpt(string $text, int $limit): string
    {
        $normalized = trim(preg_replace('/\s+/u', ' ', strip_tags($text)) ?? '');

        if ($normalized === '') {
            return '';
        }

        return mb_strimwidth($normalized, 0, $limit, '...');
    }
}
