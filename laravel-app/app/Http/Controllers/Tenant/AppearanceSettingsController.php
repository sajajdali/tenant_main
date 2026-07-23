<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\GeneralSetting;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

class AppearanceSettingsController extends Controller
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
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));

        $validated = $request->validate([
            'storeName' => ['nullable', 'string', 'max:255'],
            'bookingHeaderTitle' => ['nullable', 'string', 'max:255'],
            'bookingTemplate' => ['nullable', 'in:default,pink,blue,green,red,purple,yellow,olive'],
            'themeMode' => ['nullable', 'in:dark,light'],
            'customThemeEnabled' => ['required', 'boolean'],
            'primaryTheme' => ['nullable', 'in:amber,rose,emerald,sky,violet,copper,teal,indigo,pink,lime,ruby,cyan,orange,blue'],
            'accentTheme' => ['nullable', 'in:amber,rose,emerald,sky,violet,copper,teal,indigo,pink,lime,ruby,cyan,orange,blue'],
            'backgroundTheme' => ['nullable', 'in:slate,midnight,ocean,forest,plum,charcoal,dusk,espresso,aurora,stone'],
            'cardTheme' => ['nullable', 'in:slate,navy,graphite,plum,forest,midnight,charcoal,ocean,sand,mocha,steel,wine'],
            'removeLogo' => ['nullable', 'boolean'],
            'removeFavicon' => ['nullable', 'boolean'],
            'logo' => ['nullable', 'file', 'image', 'max:4096'],
            'favicon' => ['nullable', 'file', 'image', 'max:2048'],
        ]);

        $general = GeneralSetting::query()->firstOrCreate([], [
            'timezone' => 'Asia/Tehran',
            'currency' => 'IRR',
            'booking_rules' => [],
        ]);

        $rules = $general->booking_rules ?? [];
        $appearance = $rules['appearance'] ?? [];

        if (! empty($validated['removeLogo'])) {
            $this->deletePhysicalFile($appearance['logo_path'] ?? null);
            unset($appearance['logo_path']);
        }

        if (! empty($validated['removeFavicon'])) {
            $this->deletePhysicalFile($appearance['favicon_path'] ?? null);
            unset($appearance['favicon_path']);
        }

        if ($request->hasFile('logo')) {
            $this->deletePhysicalFile($appearance['logo_path'] ?? null);
            /** @var UploadedFile $logo */
            $logo = $request->file('logo');
            $appearance['logo_path'] = $logo->store('branding', 'media_public');
            $this->recordTenantMediaFile($appearance['logo_path'], (int) $logo->getSize());
        }

        if ($request->hasFile('favicon')) {
            $this->deletePhysicalFile($appearance['favicon_path'] ?? null);
            /** @var UploadedFile $favicon */
            $favicon = $request->file('favicon');
            $appearance['favicon_path'] = $favicon->store('branding', 'media_public');
            $this->recordTenantMediaFile($appearance['favicon_path'], (int) $favicon->getSize());
        }

        $appearance['store_name'] = (string) ($validated['storeName'] ?? '');
        $appearance['booking_header_title'] = (string) ($validated['bookingHeaderTitle'] ?? '');
        $appearance['booking_template'] = $validated['bookingTemplate'] ?? 'default';
        $appearance['theme_mode'] = 'dark';
        $appearance['custom_theme_enabled'] = false;
        $appearance['primary_theme'] = 'amber';
        $appearance['accent_theme'] = 'amber';
        $appearance['background_theme'] = 'slate';
        $appearance['card_theme'] = 'navy';

        $rules['appearance'] = $appearance;

        $general->update([
            'booking_rules' => $rules,
        ]);

        return response()->json([
            'success' => true,
            'message' => __('tenant.settings.appearance_saved'),
            'data' => $this->payload(),
        ]);
    }

    private function payload(): array
    {
        $general = GeneralSetting::query()->first();
        $rules = $general?->booking_rules ?? [];
        $appearance = $rules['appearance'] ?? [];

        return [
            'storeName' => $appearance['store_name'] ?? '',
            'bookingHeaderTitle' => $appearance['booking_header_title'] ?? '',
            'logoUrl' => $this->tenantMediaUrl($appearance['logo_path'] ?? null),
            'faviconUrl' => $this->tenantMediaUrl($appearance['favicon_path'] ?? null),
            'bookingTemplate' => $appearance['booking_template'] ?? 'default',
            'themeMode' => 'dark',
            'customThemeEnabled' => false,
            'primaryTheme' => 'amber',
            'accentTheme' => 'amber',
            'backgroundTheme' => 'slate',
            'cardTheme' => 'navy',
        ];
    }

    private function deletePhysicalFile(?string $path): void
    {
        $this->deleteTenantMediaFile($path);
    }
}
