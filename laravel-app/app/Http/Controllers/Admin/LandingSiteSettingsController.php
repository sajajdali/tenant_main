<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Landing\Models\LandingSite;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class LandingSiteSettingsController extends Controller
{
    public function edit(LandingSite $landingSite): View
    {
        $landingSite->loadMissing('audienceType.checkoutSetting');
        $settings = $landingSite->settings_json ?? [];
        $seo = $landingSite->seo_json ?? [];
        $checkoutSetting = $landingSite->audienceType?->checkoutSetting;

        return view('admin.landing-sites.settings', [
            'landingSite' => $landingSite,
            'settingsValues' => [
                'siteTitle' => (string) ($settings['siteTitle'] ?? $landingSite->name),
                'headerLabel' => (string) ($settings['headerLabel'] ?? 'Landing'),
                'logoUrl' => (string) ($settings['logoUrl'] ?? ''),
                'faviconUrl' => (string) ($settings['faviconUrl'] ?? ''),
                'contactPhones' => array_values(array_filter(
                    array_map(
                        static fn ($phone): string => is_string($phone) ? trim($phone) : '',
                        (array) ($settings['contactPhones'] ?? ['0912-000-0000', '0935-000-0000', '021-0000-0000'])
                    )
                )),
                'menuItems' => $this->normalizeMenuItems($settings['menuItems'] ?? []),
                'checkoutPricing' => [
                    'setupFeeAmount' => (int) ($checkoutSetting->setup_fee_amount ?? 0),
                    'setupFeeLabel' => (string) ($checkoutSetting->setup_fee_label ?? 'هزینه نصب و راه‌اندازی'),
                    'domainIrPriceAmount' => isset($settings['checkoutPricing']['domainIrPriceAmount']) ? (int) $settings['checkoutPricing']['domainIrPriceAmount'] : null,
                ],
            ],
            'seoValues' => [
                'title' => (string) ($seo['title'] ?? ''),
                'description' => (string) ($seo['description'] ?? ''),
                'keywords' => (string) ($seo['keywords'] ?? ''),
                'robots' => (string) ($seo['robots'] ?? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'),
                'imageUrl' => (string) ($seo['imageUrl'] ?? ''),
            ],
        ]);
    }

    public function update(Request $request, LandingSite $landingSite): RedirectResponse
    {
        $validated = $request->validate([
            'site_title' => ['required', 'string', 'max:255'],
            'header_label' => ['nullable', 'string', 'max:255'],
            'logo' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,svg', 'max:8192'],
            'favicon' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,svg,ico', 'max:4096'],
            'remove_logo' => ['nullable', 'boolean'],
            'remove_favicon' => ['nullable', 'boolean'],
            'seo_image' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,avif', 'max:8192'],
            'remove_seo_image' => ['nullable', 'boolean'],
            'contact_phones' => ['nullable', 'array'],
            'contact_phones.*' => ['nullable', 'string', 'max:64'],
            'menu_items' => ['nullable', 'array'],
            'menu_items.*.key' => ['required_with:menu_items', 'string', Rule::in(['home', 'about', 'features', 'plans', 'faq', 'contact', 'orders'])],
            'menu_items.*.label' => ['nullable', 'string', 'max:255'],
            'menu_items.*.enabled' => ['nullable', 'boolean'],
            'domain_ir_price_amount' => ['nullable', 'integer', 'min:0'],
            'seo_title' => ['nullable', 'string', 'max:255'],
            'seo_description' => ['nullable', 'string', 'max:1000'],
            'seo_keywords' => ['nullable', 'string', 'max:1000'],
            'seo_robots' => ['nullable', 'string', 'max:255'],
            'seo_image_url' => ['nullable', 'string', 'max:2048'],
        ]);

        $settings = $landingSite->settings_json ?? [];

        if ($request->boolean('remove_logo')) {
            $settings['logoUrl'] = '';
        } elseif ($request->hasFile('logo')) {
            $path = $request->file('logo')->store('landing-assets/logos', 'public');
            $settings['logoUrl'] = asset(Storage::disk('public')->url($path));
        }

        if ($request->boolean('remove_favicon')) {
            $settings['faviconUrl'] = '';
        } elseif ($request->hasFile('favicon')) {
            $path = $request->file('favicon')->store('landing-assets/favicons', 'public');
            $settings['faviconUrl'] = asset(Storage::disk('public')->url($path));
        }

        $seoImageUrl = trim((string) ($validated['seo_image_url'] ?? ''));
        if ($request->boolean('remove_seo_image')) {
            $seoImageUrl = '';
        } elseif ($request->hasFile('seo_image')) {
            $path = $request->file('seo_image')->store('landing-assets/seo-images', 'public');
            $seoImageUrl = asset(Storage::disk('public')->url($path));
        }

        $settings['siteTitle'] = trim((string) $validated['site_title']);
        $settings['headerLabel'] = trim((string) ($validated['header_label'] ?? ''));
        $settings['contactPhones'] = array_values(array_filter(
            array_map(
                static fn ($phone): string => trim((string) $phone),
                (array) ($validated['contact_phones'] ?? [])
            )
        ));
        $settings['menuItems'] = $this->normalizeMenuItems((array) ($validated['menu_items'] ?? []));
        $settings['checkoutPricing'] = [
            'domainIrPriceAmount' => array_key_exists('domain_ir_price_amount', $validated) && $validated['domain_ir_price_amount'] !== null
                ? (int) $validated['domain_ir_price_amount']
                : null,
        ];

        $landingSite->update([
            'settings_json' => $settings,
            'seo_json' => [
                'title' => trim((string) ($validated['seo_title'] ?? '')),
                'description' => trim((string) ($validated['seo_description'] ?? '')),
                'keywords' => trim((string) ($validated['seo_keywords'] ?? '')),
                'robots' => trim((string) ($validated['seo_robots'] ?? '')) ?: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
                'imageUrl' => $seoImageUrl,
            ],
            'updated_by_user_id' => $request->user()?->id,
        ]);

        return redirect()
            ->route('admin.landing-sites.show', $landingSite)
            ->with('success', 'تنظیمات کلی لندینگ ذخیره شد.');
    }

    private function normalizeMenuItems(array $items): array
    {
        $defaults = [
            'home' => ['key' => 'home', 'label' => 'صفحه اصلی', 'enabled' => true],
            'about' => ['key' => 'about', 'label' => 'درباره ما', 'enabled' => true],
            'features' => ['key' => 'features', 'label' => 'امکانات سیستم', 'enabled' => true],
            'plans' => ['key' => 'plans', 'label' => 'مقایسه پلن ها', 'enabled' => true],
            'faq' => ['key' => 'faq', 'label' => 'سوالات متداول', 'enabled' => true],
            'contact' => ['key' => 'contact', 'label' => 'تماس با ما', 'enabled' => true],
            'orders' => ['key' => 'orders', 'label' => 'سوابق سفارش', 'enabled' => true],
        ];

        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $key = (string) ($item['key'] ?? '');
            if (!array_key_exists($key, $defaults)) {
                continue;
            }

            $defaults[$key]['label'] = trim((string) ($item['label'] ?? $defaults[$key]['label']));
            $defaults[$key]['enabled'] = (bool) ($item['enabled'] ?? false);
        }

        return array_values($defaults);
    }
}
