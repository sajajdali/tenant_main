<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\NutritionPackage;
use App\Domain\Tenant\Models\NutritionPackageOrder;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Services\NutritionPackagePaymentService;
use App\Support\TenantAudienceScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
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

            return redirect()->route('tenant.nutrition.package-payments.result', [
                'status' => 'success',
                'order' => $verified->id,
                'tracking' => $verified->reference_id ?: ($verified->invoice_number ?: (string) $verified->id),
            ]);
        } catch (ValidationException $exception) {
            return $this->failedPaymentRedirect($order);
        } catch (\Throwable $exception) {
            report($exception);

            return $this->failedPaymentRedirect($order);
        }
    }

    /**
     * Opens a signed, server-hosted payment form so API clients only need to
     * open paymentUrl and never handle gateway-specific POST fields.
     */
    public function gatewayRedirect(NutritionPackageOrder $order): \Illuminate\Contracts\View\View
    {
        abort_unless($order->status === 'pending' && (! $order->expires_at || $order->expires_at->isFuture()), 404);

        $redirect = data_get($order->meta_json, 'gateway_redirect');
        abort_unless(is_array($redirect) && filled($redirect['action'] ?? null), 404);

        return view('tenant.nutrition-package-payment-redirect', [
            'action' => (string) $redirect['action'],
            'method' => strtoupper((string) ($redirect['method'] ?? 'POST')),
            'inputs' => is_array($redirect['inputs'] ?? null) ? $redirect['inputs'] : [],
        ]);
    }

    private function failedPaymentRedirect(NutritionPackageOrder $order): RedirectResponse
    {
        $query = http_build_query([
            'status' => 'failed',
            'order' => $order->id,
            'tracking' => $order->invoice_number ?: (string) $order->id,
            'package' => (string) $order->nutrition_package_id,
            'discount' => (string) ($order->discount_code_snapshot['code'] ?? ''),
        ]);

        return redirect(route('tenant.nutrition.package-payments.result').'?'.$query);
    }

    public function resultPage(Request $request): \Illuminate\Contracts\View\View
    {
        $orderId = (int) $request->integer('order');
        $status = $request->string('status')->toString();
        $status = in_array($status, ['success', 'failed', 'cancelled'], true) ? $status : 'pending';
        $tracking = trim($request->string('tracking')->toString());
        $rules = \App\Domain\Tenant\Models\GeneralSetting::query()->value('booking_rules') ?? [];
        $androidApp = is_array($rules['android_app'] ?? null) ? $rules['android_app'] : [];
        $webAppUrl = trim((string) ($androidApp['web_app_url'] ?? ''));
        $returnUrl = ($androidApp['enabled'] ?? false) && filter_var($webAppUrl, FILTER_VALIDATE_URL)
            ? $this->appendPaymentResultToUrl($webAppUrl, $orderId, $status, $tracking)
            : null;

        return view('tenant.nutrition-package-payment-result', [
            'status' => $status,
            'orderId' => $orderId,
            'tracking' => $tracking,
            'returnUrl' => $returnUrl,
        ]);
    }

    public function orderStatus(Request $request, NutritionPackageOrder $order): JsonResponse
    {
        $user = $this->user($request);
        abort_unless($user && (int) $order->user_id === (int) $user->id, 404);

        return response()->json([
            'success' => true,
            'data' => [
                'order' => $this->service->serializeOrder($order->fresh(['package', 'subscription', 'discountCode'])),
                'subscription' => $this->service->serializeSubscription($this->service->activeSubscriptionForUser($user)),
            ],
        ]);
    }

    public function retry(Request $request, NutritionPackageOrder $order): JsonResponse
    {
        $user = $this->user($request);
        abort_unless($user && (int) $order->user_id === (int) $user->id, 404);

        $rateLimitKey = 'nutrition-package-payment-retry:'.$user->id.':'.$order->id;
        if (RateLimiter::tooManyAttempts($rateLimitKey, 5)) {
            return response()->json([
                'message' => __('tenant.nutrition.package_payment_retry_rate_limited'),
            ], 429);
        }

        RateLimiter::hit($rateLimitKey, 60);
        $callbackUrl = route('tenant.nutrition.package-payments.callback', ['order' => '__ORDER__']);
        $result = $this->service->retry($user, $order, $callbackUrl);

        return response()->json([
            'success' => true,
            'message' => $result['mode'] === 'sandbox'
                ? __('tenant.nutrition.package_sandbox_activated')
                : __('tenant.nutrition.redirecting_to_gateway'),
            'data' => $result,
        ]);
    }

    private function appendPaymentResultToUrl(string $url, int $orderId, string $status, string $tracking): string
    {
        $parts = parse_url($url);
        $scheme = $parts['scheme'] ?? 'https';
        $host = $parts['host'] ?? '';
        $port = isset($parts['port']) ? ':'.$parts['port'] : '';

        if ($host === '') {
            return $url;
        }

        // The configured value identifies the web app host. The Flutter return
        // route is always stable, so it cannot accidentally become `/?order=…`.
        $query = array_filter([
            'status' => $status,
            'order' => $orderId > 0 ? (string) $orderId : null,
            'tracking' => $tracking !== '' ? $tracking : null,
        ], static fn (?string $value): bool => $value !== null && $value !== '');

        return $scheme.'://'.$host.$port.'/payment-result?'.http_build_query($query);
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
        abort_unless(TenantAudienceScope::currentTenantUsesNutrition(), 404);
        $this->ensureAdmin($request);

        $orders = $this->service->adminOrders([
            'q' => $request->string('q')->toString(),
            'user' => $request->string('user')->toString(),
            'mobile' => $request->string('mobile')->toString(),
            'date_from' => $request->string('date_from')->toString(),
            'date_to' => $request->string('date_to')->toString(),
        ], (int) $request->integer('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $orders->getCollection()->values()->all(),
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
        abort_unless(in_array($request->user('tenant_web')?->role, ['admin', 'barber'], true), 403, __('authorization.admin_or_specialist_allowed'));
    }
}
