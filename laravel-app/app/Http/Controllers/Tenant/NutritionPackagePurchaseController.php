<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\NutritionPackage;
use App\Domain\Tenant\Models\NutritionPackageOrder;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Services\NutritionPackagePaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class NutritionPackagePurchaseController extends Controller
{
    public function __construct(
        private readonly NutritionPackagePaymentService $service,
    ) {
    }

    public function preview(Request $request): JsonResponse
    {
        $user = $this->user($request);
        abort_unless($user, 401);

        $validated = $request->validate([
            'nutrition_package_id' => ['required', 'integer', 'exists:nutrition_packages,id'],
            'discount_code' => ['nullable', 'string', 'max:80'],
        ]);

        $package = NutritionPackage::query()->findOrFail((int) $validated['nutrition_package_id']);

        return response()->json([
            'success' => true,
            'data' => $this->service->preview($package, $validated['discount_code'] ?? null),
        ]);
    }

    public function checkout(Request $request): JsonResponse
    {
        $user = $this->user($request);
        abort_unless($user, 401);

        $validated = $request->validate([
            'nutrition_package_id' => ['required', 'integer', 'exists:nutrition_packages,id'],
            'gateway' => ['nullable', 'string', 'max:40'],
            'discount_code' => ['nullable', 'string', 'max:80'],
            'replace_active_subscription' => ['nullable', 'boolean'],
        ]);

        $package = NutritionPackage::query()->findOrFail((int) $validated['nutrition_package_id']);
        $callbackUrl = route('tenant.nutrition.package-payments.callback', ['order' => '__ORDER__']);
        $result = $this->service->checkout(
            $user,
            $package,
            $validated['gateway'] ?? null,
            $validated['discount_code'] ?? null,
            $callbackUrl,
            (bool) ($validated['replace_active_subscription'] ?? false),
        );

        return response()->json([
            'success' => true,
            'message' => $result['mode'] === 'sandbox'
                ? __('tenant.nutrition.package_sandbox_activated')
                : __('tenant.nutrition.redirecting_to_gateway'),
            'data' => $result,
        ]);
    }

    public function callback(NutritionPackageOrder $order): RedirectResponse
    {
        try {
            $verified = $this->service->verify($order);
            $subscription = $verified->subscription;

            return redirect('/nutrition/membership/package-result?status=success&order='
                . urlencode((string) $verified->id)
                . '&invoice=' . urlencode($verified->invoice_number)
                . '&reference=' . urlencode((string) ($verified->reference_id ?? ''))
                . '&endsAt=' . urlencode((string) ($subscription?->ends_at?->toDateString() ?? ''))
            );
        } catch (ValidationException $exception) {
            return $this->failedPaymentRedirect($order);
        } catch (\Throwable $exception) {
            report($exception);

            return $this->failedPaymentRedirect($order);
        }
    }

    private function failedPaymentRedirect(NutritionPackageOrder $order): RedirectResponse
    {
        $query = http_build_query([
            'status' => 'failed',
            'tracking' => $order->invoice_number ?: (string) $order->id,
            'package' => (string) $order->nutrition_package_id,
            'discount' => (string) ($order->discount_code_snapshot['code'] ?? ''),
        ]);

        return redirect('/nutrition/membership/package-result?'.$query);
    }

    public function mySummary(Request $request): JsonResponse
    {
        $user = $this->user($request);
        abort_unless($user, 401);

        $subscription = $this->service->activeSubscriptionForUser($user);
        $orders = $this->service->userOrders($user, (int) $request->integer('per_page', 10));

        return response()->json([
            'success' => true,
            'data' => [
                'subscription' => $this->service->serializeSubscription($subscription),
                'orders' => [
                    'items' => $orders->getCollection()->map(fn ($item) => $this->service->serializeOrder($item))->values()->all(),
                    'page' => $orders->currentPage(),
                    'perPage' => $orders->perPage(),
                    'total' => $orders->total(),
                    'lastPage' => $orders->lastPage(),
                ],
            ],
        ]);
    }

    public function adminOrders(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $orders = $this->service->adminOrders((int) $request->integer('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $orders->getCollection()->map(fn ($item) => $this->service->serializeOrder($item))->values()->all(),
                'page' => $orders->currentPage(),
                'perPage' => $orders->perPage(),
                'total' => $orders->total(),
                'lastPage' => $orders->lastPage(),
            ],
        ]);
    }

    private function user(Request $request): ?TenantUser
    {
        /** @var TenantUser|null $user */
        $user = $request->user('sanctum') ?? Auth::guard('tenant_web')->user();

        return $user;
    }

    private function ensureAdmin(Request $request): void
    {
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));
    }
}
