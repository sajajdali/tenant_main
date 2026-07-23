<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantFeatureModule;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Services\OnlineChatService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OnlineChatSettingsController extends Controller
{
    public function show(Request $request, OnlineChatService $service): JsonResponse
    {
        $actor = $this->actor($request);
        $service->authorizePanelActor($actor);
        $service->abortUnlessModuleActive();

        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];

        return response()->json([
            'success' => true,
            'data' => self::dataFromRules($rules, tenant()),
        ]);
    }

    public function update(Request $request, OnlineChatService $service): JsonResponse
    {
        $actor = $this->actor($request);
        $service->authorizePanelActor($actor);
        $service->abortUnlessModuleActive();

        $validated = $request->validate([
            'show_on_booking_page' => ['required', 'boolean'],
            'show_in_menu' => ['required', 'boolean'],
        ]);

        $general = GeneralSetting::query()->firstOrCreate([], [
            'booking_rules' => [],
        ]);

        $rules = $general->booking_rules ?? [];
        $rules['online_chat'] = [
            'show_on_booking_page' => (bool) $validated['show_on_booking_page'],
            'show_in_menu' => (bool) $validated['show_in_menu'],
        ];

        $general->update([
            'booking_rules' => $rules,
        ]);

        return response()->json([
            'success' => true,
            'message' => __('tenant.online_chat.settings_saved'),
            'data' => self::dataFromRules($rules, tenant()),
        ]);
    }

    public static function dataFromRules(array $rules, ?Tenant $tenant = null): array
    {
        $moduleActive = false;

        if ($tenant) {
            $moduleActive = TenantFeatureModule::query()
                ->with('featureModule')
                ->where('tenant_id', $tenant->id)
                ->where('status', 'active')
                ->where(function ($query): void {
                    $query->whereNull('expires_at')
                        ->orWhereDate('expires_at', '>=', now()->toDateString());
                })
                ->get()
                ->contains(fn (TenantFeatureModule $item) => $item->featureModule?->slug === OnlineChatService::MODULE_SLUG);
        }

        $settings = $rules['online_chat'] ?? [];

        return [
            'moduleActive' => $moduleActive,
            'showOnBookingPage' => array_key_exists('show_on_booking_page', $settings)
                ? (bool) $settings['show_on_booking_page']
                : $moduleActive,
            'showInMenu' => (bool) ($settings['show_in_menu'] ?? false),
        ];
    }

    private function actor(Request $request): TenantUser
    {
        /** @var TenantUser|null $actor */
        $actor = $request->user('tenant_web');

        abort_if(! $actor, 401);

        return $actor;
    }
}
