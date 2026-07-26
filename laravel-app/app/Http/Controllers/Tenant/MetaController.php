<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Booking\Models\Barber;
use App\Domain\Booking\Models\Service;
use App\Domain\Tenant\Models\GeneralSetting;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\ArticleSettingsController;
use App\Http\Controllers\Tenant\NutritionLandingSettingsController;
use App\Http\Controllers\Tenant\OnlineChatSettingsController;
use App\Services\CustomerClubService;
use App\Services\TenantFeatureModuleManager;
use App\Services\VipFeatureService;
use App\Services\TenantStorageService;
use App\Support\AudienceSpecializedCourseSettings;
use App\Support\TenantAudienceLabels;
use App\Support\TenantIrDomain;
use App\Support\TenantLocale;
use App\Support\TenantSupport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MetaController extends Controller
{
    public function __construct(
        private readonly VipFeatureService $vipFeatureService,
        private readonly TenantStorageService $tenantStorage,
        private readonly TenantFeatureModuleManager $featureModules,
        private readonly CustomerClubService $customerClubService,
    ) {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $tenant = tenant()->loadMissing(['audienceType', 'subscriptionPackage']);
        $this->vipFeatureService->syncCurrentTenantState($tenant);
        $barbersCount = Barber::query()->count();
        $servicesCount = Service::query()->count();
        $support = TenantSupport::summary($tenant);
        $domainRenewal = TenantIrDomain::summary($tenant);
        $audience = $tenant->audienceType;
        $audienceLabels = TenantAudienceLabels::for($audience);
        $generalSettings = GeneralSetting::query()->first();
        $rules = $generalSettings?->booking_rules ?? [];
        $localeMeta = TenantLocale::meta($generalSettings, $request);
        $storePage = $rules['store_page'] ?? [];
        $storeHome = $storePage['home'] ?? [];
        $activeFeatureModules = $this->featureModules->activeForMeta($tenant);
        $isNutritionAudience = in_array($audience?->slug, ['nutritionists', 'nutrition-doctors'], true);
        $appointmentBookingDisabled = $isNutritionAudience && (bool) ($rules['appointment_booking_disabled'] ?? false);

        return response()->json([
            'success' => true,
            'data' => [
                'tenant_id' => tenant('id'),
                ...$localeMeta,
                'tenant_domains' => $tenant->domains->pluck('domain')->values(),
                'setupCompleted' => $barbersCount > 0 && $servicesCount > 0,
                'barbersCount' => $barbersCount,
                'servicesCount' => $servicesCount,
                'supportEndsAt' => $support['supportEndsAt'],
                'supportExpired' => $support['supportExpired'],
                'supportDaysRemaining' => $support['supportDaysRemaining'],
                'storage' => $this->tenantStorage->usage($tenant),
                'irDomain' => $domainRenewal,
                'domainRenewal' => $domainRenewal,
                'panelAccessLocked' => $tenant->isPanelAccessLocked(),
                'panelAccessMessage' => $tenant->isPanelAccessLocked() ? $tenant->panelAccessMessage() : null,
                'galleryEnabled' => (bool) ($rules['gallery_enabled'] ?? false),
                'contactEnabled' => (bool) ((($rules['contact_page'] ?? [])['enabled'] ?? false)),
                'storeEnabled' => (bool) ($storePage['enabled'] ?? true),
                'appointmentBookingDisabled' => $appointmentBookingDisabled,
                'customerCancellationCutoffHours' => max(1, (int) ($rules['customer_cancellation_cutoff_hours'] ?? 2)),
                'articlesSettings' => ArticleSettingsController::settingsFromRules($rules),
                'articleCategories' => ArticleSettingsController::categoryTree(),
                'articleTags' => ArticleSettingsController::tagItems(),
                'storeHomeSettings' => [
                    'showCategories' => (bool) ($storeHome['show_categories'] ?? true),
                    'showBestsellers' => (bool) ($storeHome['show_bestsellers'] ?? true),
                    'showGraphicBanner' => (bool) ($storeHome['show_graphic_banner'] ?? true),
                    'showPopularProducts' => (bool) ($storeHome['show_popular_products'] ?? true),
                    'showLatestProducts' => (bool) ($storeHome['show_latest_products'] ?? true),
                    'showFaq' => (bool) ($storeHome['show_faq'] ?? true),
                    'showBannerOnMainSite' => (bool) ($storeHome['show_banner_on_main_site'] ?? false),
                    'preferStoreAsDefaultLanding' => (bool) ($storeHome['prefer_store_as_default_landing'] ?? false),
                    'showBookingEntryOnStore' => (bool) ($storeHome['show_booking_entry_on_store'] ?? false),
                    'mainSiteBannerImageUrl' => $this->tenantMediaUrl($storeHome['main_site_banner_image_path'] ?? null),
                    'mainSiteBannerTitle' => isset($storeHome['main_site_banner_title']) ? trim((string) $storeHome['main_site_banner_title']) : null,
                    'mainSiteBannerDescription' => isset($storeHome['main_site_banner_description']) ? trim((string) $storeHome['main_site_banner_description']) : null,
                    'graphicBannerImageUrl' => $this->tenantMediaUrl($storeHome['graphic_banner_image_path'] ?? null),
                    'graphicBannerBadge' => isset($storeHome['graphic_banner_badge']) ? trim((string) $storeHome['graphic_banner_badge']) : null,
                    'graphicBannerTitle' => isset($storeHome['graphic_banner_title']) ? trim((string) $storeHome['graphic_banner_title']) : null,
                    'graphicBannerDescription' => isset($storeHome['graphic_banner_description']) ? trim((string) $storeHome['graphic_banner_description']) : null,
                    'graphicBannerButtonLabel' => isset($storeHome['graphic_banner_button_label']) ? trim((string) $storeHome['graphic_banner_button_label']) : null,
                    'graphicBannerLink' => isset($storeHome['graphic_banner_link']) ? trim((string) $storeHome['graphic_banner_link']) : null,
                ],
                'audience' => $audience ? [
                    'id' => (string) $audience->id,
                    'name' => $audienceLabels['name'],
                    'slug' => $audience->slug,
                    'singularLabel' => $audienceLabels['singular'],
                    'pluralLabel' => $audienceLabels['plural'],
                    'businessLabel' => $audienceLabels['business'],
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
                    'userLimit' => $tenant->subscriptionPackage->user_limit !== null ? (int) $tenant->subscriptionPackage->user_limit : null,
                    'userLimitLabel' => $tenant->subscriptionPackage->userLimitLabel(),
                ] : null,
                'activeFeatureModules' => $activeFeatureModules,
                'customerClubSettings' => $this->customerClubService->publicStatusForTenant($tenant),
                'onlineChatSettings' => OnlineChatSettingsController::dataFromRules($rules, $tenant),
                'nutritionLanding' => $isNutritionAudience
                    ? NutritionLandingSettingsController::dataFromRules($rules)
                    : null,
            ],
        ]);
    }
}
