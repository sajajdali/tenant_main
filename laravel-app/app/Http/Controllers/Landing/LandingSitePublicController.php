<?php

declare(strict_types=1);

namespace App\Http\Controllers\Landing;

use App\Domain\Landing\Models\LandingSiteDomain;
use App\Domain\Tenant\Models\SubscriptionPackage;
use App\Http\Controllers\Controller;
use App\Support\LandingSectionRegistry;
use App\Support\TenantLocale;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;

class LandingSitePublicController extends Controller
{
    public function manifest(Request $request): JsonResponse
    {
        $domain = $this->resolveActiveDomain($request);
        abort_unless($domain !== null && $domain->landingSite !== null, 404);

        $landingSite = $domain->landingSite;
        $settings = $this->siteSettings($landingSite);
        $name = $settings['siteTitle'] ?: $landingSite->name;
        $iconUrl = $settings['faviconUrl'] ?: global_asset('favicon.png');
        $iconType = $this->iconMimeType($iconUrl);

        return response()
            ->json([
                'name' => $name,
                'short_name' => $name,
                'description' => 'لندینگ اختصاصی '.$name,
                'dir' => 'rtl',
                'lang' => 'fa-IR',
                'start_url' => '/',
                'scope' => '/',
                'display' => 'standalone',
                'display_override' => ['standalone', 'minimal-ui'],
                'orientation' => 'portrait',
                'background_color' => $landingSite->theme_mode === 'light' ? '#f8fafc' : '#0f172a',
                'theme_color' => $landingSite->theme_mode === 'light' ? '#f8fafc' : '#0f172a',
                'icons' => [
                    [
                        'src' => $iconUrl,
                        'sizes' => '192x192',
                        'type' => $iconType,
                        'purpose' => 'any maskable',
                    ],
                    [
                        'src' => $iconUrl,
                        'sizes' => '512x512',
                        'type' => $iconType,
                        'purpose' => 'any maskable',
                    ],
                    [
                        'src' => $iconUrl,
                        'sizes' => '180x180',
                        'type' => $iconType,
                        'purpose' => 'any',
                    ],
                ],
            ])
            ->header('Content-Type', 'application/manifest+json')
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }

    public function __invoke(Request $request): Response|RedirectResponse
    {
        app()->setLocale('fa');
        $request->query->set('locale', 'fa');

        $domain = $this->resolveActiveDomain($request);

        abort_unless($domain !== null && $domain->landingSite !== null, 404);

        $landingSite = $domain->landingSite;
        $this->seedDefaultSectionsIfMissing($landingSite);
        $landingSite->load(['pages.sections', 'domains', 'features']);
        $path = '/'.ltrim($request->path(), '/');
        if ($path === '//' || $path === '/index.php') {
            $path = '/';
        }

        $pageMeta = $this->buildPageMeta($request, $landingSite);
        $localeMeta = TenantLocale::meta(null, $request);

        return response()
            ->view('landing.site-spa', [
                'landingSite' => $landingSite,
                'pageMeta' => $pageMeta,
                'localeMeta' => $localeMeta,
                'bootstrapMeta' => [
                    ...$localeMeta,
                    'landingSiteId' => $landingSite->id,
                    'name' => $this->siteSettings($landingSite)['siteTitle'] ?: $landingSite->name,
                    'slug' => $landingSite->slug,
                    'themeMode' => $landingSite->theme_mode ?: 'dark',
                    'audienceName' => $landingSite->audienceType?->name,
                    'audience' => $landingSite->audienceType ? [
                        'id' => (string) $landingSite->audienceType->id,
                        'name' => $landingSite->audienceType->name,
                        'slug' => $landingSite->audienceType->slug,
                        'singularLabel' => $landingSite->audienceType->singular_label,
                        'pluralLabel' => $landingSite->audienceType->plural_label,
                        'businessLabel' => $landingSite->audienceType->business_label,
                        'enabledFeatures' => $landingSite->audienceType->enabled_features ?? [],
                        'nutritionFeatures' => $landingSite->audienceType->nutrition_features ?? [],
                        'futureFeatures' => $landingSite->audienceType->future_features ?? [],
                    ] : null,
                    'domains' => $landingSite->domains()->pluck('domain')->values()->all(),
                    'primaryDomain' => $domain->domain,
                    'isLandingDomain' => true,
                    'landingSiteSettings' => $this->siteSettings($landingSite),
                    'landingSections' => $this->serializeSections($landingSite),
                    'landingPackages' => $this->serializePackages($landingSite),
                    'landingPages' => $this->serializePages($landingSite),
                    'landingFeatures' => $landingSite->features->where('status', 'active')->sortBy('sort_order')->values()->map(fn ($feature) => [
                        'id' => $feature->id, 'slug' => $feature->slug, 'title' => $feature->title,
                        'badgeText' => $feature->badge_text, 'short' => $feature->short_description, 'detail' => $feature->description,
                        'url' => '/features/'.$feature->slug, 'isPrimary' => $feature->is_primary, 'sortOrder' => $feature->sort_order,
                        'videoUrl' => $feature->video_url, 'coverUrl' => $feature->cover_url, 'imageUrl' => $feature->image_url,
                        'benefits' => $feature->benefits_json ?? [], 'seo' => $feature->seo_json ?? [],
                    ])->all(),
                ],
            ])
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            ->header('Pragma', 'no-cache')
            ->header('Expires', '0');
    }

    private function resolveActiveDomain(Request $request): ?LandingSiteDomain
    {
        return LandingSiteDomain::query()
            ->with('landingSite.audienceType')
            ->where('domain', $request->getHost())
            ->where('status', 'active')
            ->first();
    }

    private function buildPageMeta(Request $request, $landingSite): array
    {
        $siteSettings = $this->siteSettings($landingSite);
        $landingName = $siteSettings['siteTitle'] ?: $landingSite->name;
        $path = '/'.ltrim($request->path(), '/');
        if ($path === '//' || $path === '/index.php') {
            $path = '/';
        }

        $canonical = rtrim($request->getSchemeAndHttpHost(), '/') . ($path === '/' ? '/' : $path);
        $defaultImage = $siteSettings['seoImageUrl']
            ?: $siteSettings['logoUrl']
            ?: $siteSettings['faviconUrl']
            ?: global_asset('step-logo-transparent.png');
        $page = $this->resolveRequestedPage($landingSite, $path);
        $seo = (array) ($page?->seo_json ?? $landingSite->seo_json ?? []);
        $title = $this->cleanLandingMetaTitle(trim((string) ($seo['title'] ?? '')), $landingName);
        $description = trim((string) ($seo['description'] ?? '')) ?: ('لندینگ اختصاصی '.$landingName);

        return [
            'siteName' => $landingName,
            'title' => $title,
            'description' => $description,
            'keywords' => trim((string) ($seo['keywords'] ?? '')) ?: trim((string) (($landingSite->seo_json ?? [])['keywords'] ?? '')),
            'robots' => trim((string) ($seo['robots'] ?? '')) ?: trim((string) (($landingSite->seo_json ?? [])['robots'] ?? '')) ?: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
            'canonical' => $canonical,
            'image' => trim((string) ($seo['imageUrl'] ?? '')) ?: $defaultImage,
            'type' => 'website',
        ];
    }

    private function cleanLandingMetaTitle(string $title, string $landingName): string
    {
        if ($title === '') {
            return $landingName;
        }

        $legacyTitles = ['تک اندام', 'تک‌اندام', 'Takandam', 'BarberBook', 'Replit'];

        foreach ($legacyTitles as $legacyTitle) {
            if (str_contains($title, $legacyTitle) && ! str_contains($landingName, $legacyTitle)) {
                return $landingName;
            }
        }

        return $title;
    }

    private function iconMimeType(string $url): string
    {
        $path = parse_url($url, PHP_URL_PATH) ?: $url;

        return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'svg' => 'image/svg+xml',
            'ico' => 'image/x-icon',
            'webp' => 'image/webp',
            'jpg', 'jpeg' => 'image/jpeg',
            default => 'image/png',
        };
    }

    private function resolveRequestedPage($landingSite, string $path)
    {
        if ($path === '/' || $path === '/landing-preview') {
            return $landingSite->pages->firstWhere('page_key', 'home');
        }

        $segments = array_values(array_filter(explode('/', trim($path, '/'))));
        $pageKey = $segments[0] ?? null;
        if ($pageKey === 'landing-preview') {
            $pageKey = $segments[1] ?? null;
        }
        if (! $pageKey) {
            return null;
        }

        return $landingSite->pages->firstWhere('page_key', $pageKey);
    }

    private function serializeSections($landingSite): array
    {
        $homePage = $landingSite->pages->firstWhere('page_key', 'home');

        if (! $homePage) {
            return [];
        }

        return $homePage->sections
            ->sortBy('sort_order')
            ->mapWithKeys(fn ($section): array => [
                $section->section_key => [
                    'id' => $section->id,
                    'name' => $section->name,
                    'status' => $section->status,
                    'sortOrder' => $section->sort_order,
                    'content' => $section->content_json ?? [],
                ],
            ])->all();
    }

    private function serializePages($landingSite): array
    {
        return $landingSite->pages
            ->sortBy('sort_order')
            ->mapWithKeys(fn ($page): array => [
                $page->page_key => [
                    'id' => $page->id,
                    'name' => $page->name,
                    'slug' => $page->slug,
                    'pageKey' => $page->page_key,
                    'status' => $page->status,
                    'sortOrder' => $page->sort_order,
                    'seo' => $page->seo_json ?? [],
                    'settings' => $page->settings_json ?? [],
                ],
            ])->all();
    }

    private function seedDefaultSectionsIfMissing($landingSite): void
    {
        $homePage = $landingSite->pages()->where('page_key', 'home')->first();

        if (! $homePage || $homePage->sections()->exists()) {
            return;
        }

        foreach (LandingSectionRegistry::homeSections() as $section) {
            $homePage->sections()->create([
                'section_key' => $section['section_key'],
                'section_type' => $section['section_type'],
                'name' => $section['name'],
                'status' => 'active',
                'sort_order' => $section['sort_order'],
                'content_json' => $section['content_json'],
                'settings_json' => [],
            ]);
        }
    }

    private function serializePackages($landingSite): array
    {
        return SubscriptionPackage::query()
            ->with('audiencePrices')
            ->where('is_active', true)
            ->customerPurchasable()
            ->orderBy('sort_order')
            ->orderBy('duration_days')
            ->orderByRaw('CASE WHEN user_limit IS NULL THEN 999999 ELSE user_limit END')
            ->get()
            ->map(function (SubscriptionPackage $package) use ($landingSite): array {
                $pricing = $package->pricingFor($landingSite->audience_type_id);

                return [
                    'id' => (string) $package->id,
                    'name' => $package->name,
                    'durationDays' => (int) $package->duration_days,
                    'userLimit' => $package->user_limit !== null ? (int) $package->user_limit : null,
                    'userLimitLabel' => $package->userLimitLabel(),
                    'priceAmount' => $pricing['priceAmount'],
                    'discountedPriceAmount' => $pricing['discountedPriceAmount'],
                    'payableAmount' => $pricing['payableAmount'],
                    'discountAmount' => $pricing['discountAmount'],
                    'showOnLandingHome' => $pricing['showOnLandingHome'],
                    'isLandingRecommended' => $pricing['isLandingRecommended'],
                    'landingSortOrder' => $pricing['landingSortOrder'],
                ];
            })
            ->values()
            ->all();
    }

    private function siteSettings($landingSite): array
    {
        $settings = (array) ($landingSite->settings_json ?? []);

        return [
            'siteTitle' => trim((string) ($settings['siteTitle'] ?? $landingSite->name)),
            'headerLabel' => trim((string) ($settings['headerLabel'] ?? 'Landing')),
            'logoUrl' => trim((string) ($settings['logoUrl'] ?? '')),
            'faviconUrl' => trim((string) ($settings['faviconUrl'] ?? '')) ?: global_asset('favicon.png'),
            'faviconType' => $this->iconMimeType(trim((string) ($settings['faviconUrl'] ?? '')) ?: global_asset('favicon.png')),
            'contactPhones' => array_values(array_filter(array_map(
                static fn ($phone): string => is_string($phone) ? trim($phone) : '',
                (array) ($settings['contactPhones'] ?? [])
            ))),
            'menuItems' => array_values(array_map(static function ($item): array {
                $record = is_array($item) ? $item : [];

                return [
                    'key' => trim((string) ($record['key'] ?? '')),
                    'label' => trim((string) ($record['label'] ?? '')),
                    'enabled' => (bool) ($record['enabled'] ?? false),
                ];
            }, (array) ($settings['menuItems'] ?? []))),
            'seoImageUrl' => trim((string) (($landingSite->seo_json ?? [])['imageUrl'] ?? '')),
        ];
    }
}
