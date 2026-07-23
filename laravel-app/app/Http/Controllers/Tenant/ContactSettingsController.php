<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\GeneralSetting;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContactSettingsController extends Controller
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
            'phones' => ['nullable', 'array'],
            'phones.*.id' => ['nullable', 'string', 'max:120'],
            'phones.*.title' => ['nullable', 'string', 'max:255'],
            'phones.*.number' => ['nullable', 'string', 'max:30'],
            'locationEnabled' => ['required', 'boolean'],
            'provinceId' => ['nullable', 'integer'],
            'provinceName' => ['nullable', 'string', 'max:255'],
            'cityId' => ['nullable', 'integer'],
            'cityName' => ['nullable', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
            'address' => ['nullable', 'string', 'max:2000'],
        ]);

        if ((bool) $validated['locationEnabled']) {
            abort_if(empty($validated['provinceId']) || empty($validated['cityId']), 422, __('tenant.contact.location_city_required'));
            abort_if(! isset($validated['latitude'], $validated['longitude']), 422, __('tenant.contact.location_point_required'));
        }

        $general = GeneralSetting::query()->firstOrCreate([], [
            'timezone' => 'Asia/Tehran',
            'currency' => 'IRR',
            'booking_rules' => [],
        ]);

        $rules = $general->booking_rules ?? [];
        $contact = [
            'enabled' => (bool) $validated['enabled'],
            'phones' => collect($validated['phones'] ?? [])
                ->map(fn (array $item) => [
                    'id' => (string) ($item['id'] ?? ''),
                    'title' => trim((string) ($item['title'] ?? '')),
                    'number' => trim((string) ($item['number'] ?? '')),
                ])
                ->filter(fn (array $item) => $item['title'] !== '' || $item['number'] !== '')
                ->values()
                ->all(),
            'location' => [
                'enabled' => (bool) $validated['locationEnabled'],
                'province_id' => isset($validated['provinceId']) ? (int) $validated['provinceId'] : null,
                'province_name' => (string) ($validated['provinceName'] ?? ''),
                'city_id' => isset($validated['cityId']) ? (int) $validated['cityId'] : null,
                'city_name' => (string) ($validated['cityName'] ?? ''),
                'latitude' => isset($validated['latitude']) ? (float) $validated['latitude'] : null,
                'longitude' => isset($validated['longitude']) ? (float) $validated['longitude'] : null,
                'address' => (string) ($validated['address'] ?? ''),
            ],
        ];

        $rules['contact_page'] = $contact;

        $general->update([
            'booking_rules' => $rules,
        ]);

        return response()->json([
            'success' => true,
            'message' => __('tenant.contact.settings_saved'),
            'data' => $this->payload(),
        ]);
    }

    private function payload(): array
    {
        $general = GeneralSetting::query()->first();
        $rules = $general?->booking_rules ?? [];
        $contact = $rules['contact_page'] ?? [];
        $location = $contact['location'] ?? [];

        return [
            'enabled' => (bool) ($contact['enabled'] ?? false),
            'phones' => array_values($contact['phones'] ?? []),
            'locationEnabled' => (bool) ($location['enabled'] ?? false),
            'provinceId' => isset($location['province_id']) ? (int) $location['province_id'] : null,
            'provinceName' => (string) ($location['province_name'] ?? ''),
            'cityId' => isset($location['city_id']) ? (int) $location['city_id'] : null,
            'cityName' => (string) ($location['city_name'] ?? ''),
            'latitude' => isset($location['latitude']) ? (float) $location['latitude'] : null,
            'longitude' => isset($location['longitude']) ? (float) $location['longitude'] : null,
            'address' => (string) ($location['address'] ?? ''),
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
}
