<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\NutritionPackage;
use App\Domain\Tenant\Models\NutritionPackageOrder;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Services\NutritionCafeBazaarPurchaseService;
use App\Services\NutritionPackagePaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class NutritionCafeBazaarPurchaseController extends Controller
{
    public function __construct(
        private readonly NutritionCafeBazaarPurchaseService $bazaar,
        private readonly NutritionPackagePaymentService $packagePayments,
    ) {
    }

    public function settings(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->bazaar->publicSettings(),
        ]);
    }

    public function packages(): JsonResponse
    {
        $items = NutritionPackage::query()
            ->where('is_active', true)
            ->whereDoesntHave('children')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn (NutritionPackage $package): array => [
                'id' => (string) $package->id,
                'name' => $package->name,
                'cafebazaarProductId' => $package->cafebazaar_product_id,
                'onlineDietCount' => (int) $package->online_diet_count,
                'offlineDietCount' => (int) $package->offline_diet_count,
                'durationDays' => (int) $package->duration_days,
            ])
            ->values()
            ->all();

        return response()->json([
            'success' => true,
            'data' => [
                'settings' => $this->bazaar->publicSettings(),
                'items' => $items,
            ],
        ]);
    }

    public function createOrder(Request $request): JsonResponse
    {
        $user = $this->user($request);
        abort_unless($user, 401);

        $validated = $request->validate([
            'nutrition_package_id' => ['required', 'integer', 'exists:nutrition_packages,id'],
            'replace_active_subscription' => ['nullable', 'boolean'],
        ]);

        $package = NutritionPackage::query()->findOrFail((int) $validated['nutrition_package_id']);
        $order = $this->bazaar->createOrder(
            $user,
            $package,
            (bool) ($validated['replace_active_subscription'] ?? false),
        );

        return response()->json([
            'success' => true,
            'message' => 'سفارش پرداخت بازار ساخته شد.',
            'data' => [
                'order' => $this->packagePayments->serializeOrder($order->fresh(['package', 'subscription', 'discountCode'])),
                'store' => 'cafebazaar',
                'productId' => (string) data_get($order->meta_json, 'in_app_purchase.product_id'),
                'developerPayload' => (string) data_get($order->meta_json, 'in_app_purchase.developer_payload'),
                'consumeRequired' => true,
                'discountSupported' => false,
            ],
        ]);
    }

    public function verify(Request $request, NutritionPackageOrder $order): JsonResponse
    {
        $user = $this->user($request);
        abort_unless($user, 401);

        $validated = $request->validate([
            'product_id' => ['required', 'string', 'max:191'],
            'purchase_token' => ['required', 'string', 'max:500'],
            'store_order_id' => ['nullable', 'string', 'max:255'],
            'developer_payload' => ['required', 'string', 'max:1000'],
            'purchase_time' => ['nullable'],
            'purchase_state' => ['nullable', 'string', 'max:80'],
            'signed_data' => ['required', 'string', 'max:8000'],
            'raw_purchase' => ['nullable', 'array'],
            'signature' => ['required', 'string', 'max:4000'],
        ]);

        $result = $this->bazaar->verifyOrder($user, $order, $validated);

        return response()->json([
            'success' => true,
            'message' => 'پرداخت بازار تایید شد و پکیج فعال شد.',
            'data' => [
                'order' => $this->packagePayments->serializeOrder($result['order']),
                'subscription' => $this->packagePayments->serializeSubscription($result['order']->subscription),
                'receipt' => $this->serializeReceipt($result['receipt']),
                'consumeRequired' => (bool) $result['consumeRequired'],
            ],
        ]);
    }

    public function recover(Request $request): JsonResponse
    {
        $user = $this->user($request);
        abort_unless($user, 401);

        $validated = $request->validate([
            'purchases' => ['required', 'array', 'min:1', 'max:20'],
            'purchases.*.order_id' => ['required', 'integer', 'exists:nutrition_package_orders,id'],
            'purchases.*.product_id' => ['required', 'string', 'max:191'],
            'purchases.*.purchase_token' => ['required', 'string', 'max:500'],
            'purchases.*.store_order_id' => ['nullable', 'string', 'max:255'],
            'purchases.*.developer_payload' => ['required', 'string', 'max:1000'],
            'purchases.*.purchase_time' => ['nullable'],
            'purchases.*.purchase_state' => ['nullable', 'string', 'max:80'],
            'purchases.*.signed_data' => ['required', 'string', 'max:8000'],
            'purchases.*.raw_purchase' => ['nullable', 'array'],
            'purchases.*.signature' => ['required', 'string', 'max:4000'],
        ]);

        $items = collect($validated['purchases'])
            ->map(function (array $purchase) use ($user): array {
                $order = NutritionPackageOrder::query()->findOrFail((int) $purchase['order_id']);
                $result = $this->bazaar->verifyOrder($user, $order, $purchase);

                return [
                    'order' => $this->packagePayments->serializeOrder($result['order']),
                    'subscription' => $this->packagePayments->serializeSubscription($result['order']->subscription),
                    'receipt' => $this->serializeReceipt($result['receipt']),
                    'consumeRequired' => (bool) $result['consumeRequired'],
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'success' => true,
            'message' => 'خریدهای بازیابی‌شده بررسی شدند.',
            'data' => ['items' => $items],
        ]);
    }

    public function markConsumed(Request $request): JsonResponse
    {
        $user = $this->user($request);
        abort_unless($user, 401);

        $validated = $request->validate([
            'purchase_token' => ['required', 'string', 'max:500'],
        ]);

        $receipt = $this->bazaar->markConsumed($user, (string) $validated['purchase_token']);

        return response()->json([
            'success' => true,
            'data' => [
                'receipt' => $this->serializeReceipt($receipt),
            ],
        ]);
    }

    private function user(Request $request): ?TenantUser
    {
        /** @var TenantUser|null $user */
        $user = $request->user('sanctum') ?? Auth::guard('tenant_web')->user();

        return $user;
    }

    private function serializeReceipt($receipt): ?array
    {
        if (! $receipt) {
            return null;
        }

        return [
            'id' => (string) $receipt->id,
            'store' => $receipt->store,
            'productId' => $receipt->product_id,
            'purchaseToken' => $receipt->purchase_token,
            'storeOrderId' => $receipt->store_order_id,
            'status' => $receipt->status,
            'verifiedAt' => $receipt->verified_at?->toIso8601String(),
            'grantedAt' => $receipt->granted_at?->toIso8601String(),
            'consumedReportedAt' => $receipt->consumed_reported_at?->toIso8601String(),
        ];
    }
}
