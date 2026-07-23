<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\TenantSubscriptionPayment;
use App\Http\Controllers\Controller;
use App\Services\DomainRenewalPaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class DomainRenewalController extends Controller
{
    public function __construct(
        private readonly DomainRenewalPaymentService $service,
    ) {
    }

    public function overview(Request $request): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);

        return response()->json([
            'success' => true,
            'data' => $this->service->overview(tenant()),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $actor = $this->abortUnlessTenantAdmin($request);

        $validated = $request->validate([
            'gateway' => ['nullable', 'in:'.implode(',', \App\Support\TenantPaymentGateways::supportedKeys())],
        ]);

        $callbackUrl = request()->getSchemeAndHttpHost().route('tenant.domain-renewal.callback', [], false).'?payment=__PAYMENT__';
        $result = $this->service->createPayment(tenant(), [
            'id' => $actor->getAuthIdentifier(),
            'name' => $actor->name,
            'mobile' => $actor->mobile,
            'role' => $actor->role,
        ], $callbackUrl, isset($validated['gateway']) ? (string) $validated['gateway'] : null);

        return response()->json([
            'success' => true,
            'data' => [
                'mode' => $result['mode'],
                'paymentUrl' => $result['paymentUrl'] ?? null,
                'redirectForm' => $result['redirectForm'] ?? null,
                'payment' => $this->service->serializePayment($result['payment']),
            ],
            'message' => $result['mode'] === 'sandbox'
                ? __('tenant.domain_renewal.sandbox_completed')
                : __('tenant.domain_renewal.payment_created'),
        ]);
    }

    public function callback(Request $request): RedirectResponse
    {
        $authority = (string) $request->query('Authority', '');
        $status = (string) $request->query('Status', '');
        $paymentId = (int) $request->integer('payment');

        $payment = TenantSubscriptionPayment::query()
            ->where('tenant_id', tenant('id'))
            ->where('payment_type', 'domain_renewal')
            ->when($paymentId > 0, fn ($query) => $query->where('id', $paymentId))
            ->when($paymentId <= 0 && $authority !== '', fn ($query) => $query->where('authority', $authority))
            ->latest('id')
            ->first();

        abort_if(! $payment, 404);

        if ((string) $payment->gateway !== 'maliart' && $status !== '' && strtoupper($status) !== 'OK') {
            $this->service->markPaymentCancelled($payment, __('tenant.payments.cancelled_by_user'));

            return $this->redirectForPayment($payment, 'cancelled');
        }

        try {
            $this->service->verifyPayment(tenant(), $payment);

            return $this->redirectForPayment($payment->fresh(), 'success');
        } catch (\Throwable $exception) {
            return $this->redirectForPayment($payment->fresh(), 'failed', $exception->getMessage());
        }
    }

    public function history(Request $request): JsonResponse
    {
        $this->abortUnlessTenantAdmin($request);

        $perPage = min(20, max(5, (int) $request->integer('per_page', 10)));
        $payments = TenantSubscriptionPayment::query()
            ->where('tenant_id', tenant('id'))
            ->where('payment_type', 'domain_renewal')
            ->latest('id')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => collect($payments->items())->map(fn (TenantSubscriptionPayment $payment) => $this->service->serializePayment($payment))->values(),
                'currentPage' => $payments->currentPage(),
                'lastPage' => $payments->lastPage(),
                'perPage' => $payments->perPage(),
                'total' => $payments->total(),
            ],
        ]);
    }

    private function redirectForPayment(TenantSubscriptionPayment $payment, string $status, ?string $message = null): RedirectResponse
    {
        $params = http_build_query(array_filter([
            'payment' => $status,
            'message' => $message,
            'invoice' => $payment->invoice_number,
        ]));

        return redirect('/panel/domain-renewal'.($params !== '' ? '?'.$params : ''));
    }

    private function abortUnlessTenantAdmin(Request $request)
    {
        $user = $request->user('tenant_web');
        abort_unless($user?->role === 'admin', 403, __('authorization.primary_admin_section'));

        return $user;
    }
}
