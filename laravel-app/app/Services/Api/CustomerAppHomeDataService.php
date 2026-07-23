<?php

declare(strict_types=1);

namespace App\Services\Api;

use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\Tenant;
use App\Http\Controllers\Tenant\NutritionLandingSettingsController;
use Illuminate\Support\Facades\Storage;

class CustomerAppHomeDataService
{
    public function payload(?string $requestedDomain = null, ?string $scheme = null): array
    {
        /** @var Tenant $tenant */
        $tenant = tenant()->loadMissing(['audienceType', 'domains']);
        $generalSettings = GeneralSetting::query()->first();
        $rules = $generalSettings?->booking_rules ?? [];
        $appearance = is_array($rules['appearance'] ?? null) ? $rules['appearance'] : [];
        $baseUrl = $this->baseUrl($requestedDomain, $scheme);
        $landing = NutritionLandingSettingsController::dataFromRules($rules);
        $variantKey = (string) ($landing['activeVariant'] ?? 'classic');
        $variant = is_array($landing['variants'][$variantKey] ?? null)
            ? $landing['variants'][$variantKey]
            : ($landing['variants']['classic'] ?? []);
        $content = is_array($variant['content'] ?? null) ? $variant['content'] : [];

        return [
            'domain' => [
                'host' => parse_url($baseUrl, PHP_URL_HOST),
                'baseUrl' => $baseUrl,
            ],
            'brand' => [
                'name' => trim((string) ($appearance['store_name'] ?? '')) ?: $tenant->name,
                'logoUrl' => $this->tenantMediaUrl($appearance['logo_path'] ?? null, $baseUrl),
                'faviconUrl' => $this->tenantMediaUrl($appearance['favicon_path'] ?? null, $baseUrl),
            ],
            'home' => [
                'topBadge' => $this->text($content['topbar_badge'] ?? null, 'وب اپلیکیشن دریافت رژیم'),
                'imageUrl' => $this->absoluteUrl($variant['imageUrl'] ?? null, $baseUrl)
                    ?? $baseUrl.'/booking-app/nutrition-hero.jpg',
                'eyebrow' => $this->text($content['eyebrow'] ?? null, 'شروع سبک زندگی دقیق‌تر'),
                'title' => [
                    'beforeHighlight' => $this->text($content['title_intro'] ?? null, 'برای دریافت رژیم اختصاصی'),
                    'highlight' => $this->text($content['title_highlight'] ?? null, 'نسخه اختصاصی رژیم'),
                    'afterHighlight' => $this->text($content['title_outro'] ?? null, 'شروع کنید'),
                ],
                'description' => $this->text(
                    $content['description'] ?? null,
                    'برنامه غذایی شما می تواند بر اساس شرایط بدنی، سبک زندگی و هدف شخصیتان تنظیم شود. برای شروع فقط کافی است وارد مرحله دریافت رژیم شوید.',
                ),
                'quote' => [
                    'label' => $this->text($content['quote_label'] ?? null, 'شعار پیشنهادی'),
                    'title' => $this->text($content['quote_text'] ?? null, 'رژیمی که فقط یک لیست غذا نیست؛'),
                    'subtitle' => $this->text($content['quote_subtext'] ?? null, 'نقشه راهی برای سبک زندگی پایدار شماست.'),
                ],
                'actions' => [
                    'booking' => [
                        'label' => 'ورود به نوبت دهی',
                        'url' => $baseUrl.'/booking',
                    ],
                    'profile' => [
                        'title' => $this->text($content['cta_title'] ?? null, 'ورود به پروفایل'),
                        'subtitle' => $this->text($content['cta_subtitle'] ?? null, 'ورود به صفحه اصلی اپلیکیشن تغذیه'),
                        'url' => $baseUrl.'/nutrition',
                    ],
                ],
            ],
        ];
    }

    private function baseUrl(?string $requestedDomain, ?string $scheme): string
    {
        $host = $this->normalizeDomain($requestedDomain)
            ?: request()->getHost();
        $resolvedScheme = in_array($scheme, ['http', 'https'], true) ? $scheme : request()->getScheme();

        return $resolvedScheme.'://'.$host;
    }

    private function normalizeDomain(?string $domain): ?string
    {
        $normalized = trim((string) $domain);

        if ($normalized === '') {
            return null;
        }

        $host = parse_url(str_contains($normalized, '://') ? $normalized : 'http://'.$normalized, PHP_URL_HOST);

        if (! is_string($host) || $host === '') {
            return null;
        }

        return $host.($this->portFromDomain($normalized) ?? '');
    }

    private function portFromDomain(string $domain): ?string
    {
        $port = parse_url(str_contains($domain, '://') ? $domain : 'http://'.$domain, PHP_URL_PORT);

        return is_int($port) ? ':'.$port : null;
    }

    private function text(mixed $value, string $fallback): string
    {
        $normalized = trim((string) $value);

        return $normalized !== '' ? $normalized : $fallback;
    }

    private function tenantMediaUrl(mixed $path, string $baseUrl): ?string
    {
        $relativePath = ltrim((string) $path, '/');

        if ($relativePath === '') {
            return null;
        }

        $url = tenant() ? tenant_asset($relativePath) : Storage::disk('media_public')->url($relativePath);

        return $this->absoluteUrl($url, $baseUrl);
    }

    private function absoluteUrl(mixed $url, string $baseUrl): ?string
    {
        $normalized = trim((string) $url);

        if ($normalized === '') {
            return null;
        }

        $path = parse_url($normalized, PHP_URL_PATH) ?: '';
        $query = parse_url($normalized, PHP_URL_QUERY);

        if ($path === '') {
            return null;
        }

        return $baseUrl.$path.($query ? '?'.$query : '');
    }
}
