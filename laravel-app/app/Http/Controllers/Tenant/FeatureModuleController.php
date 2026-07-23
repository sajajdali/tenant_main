<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\FeatureModule;
use App\Http\Controllers\Controller;
use App\Services\FeatureModuleBillingService;
use App\Services\SupportRenewalPaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FeatureModuleController extends Controller
{
    public function __construct(
        private readonly FeatureModuleBillingService $billing,
        private readonly SupportRenewalPaymentService $payments,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $this->billing->listForTenant(tenant()),
            ],
        ]);
    }

    public function previewActivation(Request $request, FeatureModule $featureModule): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);

        return response()->json([
            'success' => true,
            'data' => $this->payments->previewFeatureModuleActivation(tenant(), $featureModule),
        ]);
    }

    public function activate(Request $request, FeatureModule $featureModule): JsonResponse
    {
        $actor = $this->abortUnlessTenantAdmin($request);
        $callbackUrl = request()->getSchemeAndHttpHost().route('tenant.support-renewal.callback', [], false).'?payment=__PAYMENT__';
        $result = $this->payments->createFeatureModuleActivationPayment(tenant(), $featureModule, [
            'id' => $actor->getAuthIdentifier(),
            'name' => $actor->name,
            'mobile' => $actor->mobile,
            'role' => $actor->role,
        ], $callbackUrl);

        return response()->json([
            'success' => true,
            'data' => [
                'mode' => $result['mode'],
                'paymentUrl' => $result['paymentUrl'] ?? null,
                'redirectForm' => $result['redirectForm'] ?? null,
            ],
            'message' => $result['mode'] === 'sandbox'
                ? __('tenant.feature_modules.sandbox_activated')
                : __('tenant.feature_modules.payment_created'),
        ]);
    }

    private function abortUnlessTenantAdmin(Request $request)
    {
        $user = $request->user('tenant_web');
        abort_unless($user?->role === 'admin', 403, __('authorization.primary_admin_section'));

        return $user;
    }
}
