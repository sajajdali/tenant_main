<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\TenantSubscriptionPayment;
use App\Http\Controllers\Controller;
use App\Services\SmsTopUpPaymentService;
use App\Support\TenantPaymentGateways;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class SmsTopUpPaymentController extends Controller
{
    public function __construct(private readonly SmsTopUpPaymentService $service)
    {
    }

    public function store(Request $request): JsonResponse
    {
        $actor = $this->abortUnlessTenantAdmin($request);

        $validated = $request->validate([
            'amount' => ['required', 'integer', 'min:10000'],
            'gateway' => ['nullable', 'in:'.implode(',', TenantPaymentGateways::supportedKeys())],
        ]);

        $callbackUrl = request()->getSchemeAndHttpHost().route('tenant.sms-top-up.callback', [], false).'?payment=__PAYMENT__';
        $result = $this->service->createPayment(
            tenant(),
            (int) $validated['amount'],
            [
                'id' => $actor->getAuthIdentifier(),
                'name' => $actor->name,
                'mobile' => $actor->mobile,
                'role' => $actor->role,
            ],
            $callbackUrl,
            isset($validated['gateway']) ? (string) $validated['gateway'] : null,
        );

        return response()->json([
            'success' => true,
            'data' => [
                'mode' => $result['mode'],
                'paymentUrl' => $result['paymentUrl'] ?? null,
                'redirectForm' => $result['redirectForm'] ?? null,
                'payment' => $this->service->serializePayment($result['payment']),
                'currentBalance' => $result['currentBalance'] ?? null,
            ],
            'message' => $result['mode'] === 'sandbox'
                ? __('payment.sms_top_up.sandbox_success')
                : __('payment.sms_top_up.created'),
        ]);
    }

    public function callback(Request $request): RedirectResponse
    {
        $authority = (string) $request->query('Authority', '');
        $status = (string) $request->query('Status', '');
        $paymentId = (int) $request->integer('payment');

        $payment = TenantSubscriptionPayment::query()
            ->where('tenant_id', tenant('id'))
            ->where('payment_type', 'sms_credit_topup')
            ->when($paymentId > 0, fn ($query) => $query->where('id', $paymentId))
            ->when($paymentId <= 0 && $authority !== '', fn ($query) => $query->where('authority', $authority))
            ->latest('id')
            ->first();

        abort_if(! $payment, 404);

        if ((string) $payment->gateway !== 'maliart' && $status !== '' && strtoupper($status) !== 'OK') {
            $this->service->markPaymentCancelled($payment, __('payment.common.user_cancelled'));

            return $this->redirectForPayment($payment, 'cancelled');
        }

        try {
            $result = $this->service->verifyPayment(tenant(), $payment);

            return $this->redirectForPayment($result['payment'], 'success', null, (int) $result['currentBalance']);
        } catch (\Throwable $exception) {
            return $this->redirectForPayment($payment->fresh(), 'failed', $exception->getMessage());
        }
    }

    private function redirectForPayment(
        TenantSubscriptionPayment $payment,
        string $status,
        ?string $message = null,
        ?int $currentBalance = null,
    ): RedirectResponse {
        $gatewayLabel = (string) $payment->gateway === 'maliart'
            ? __('payment.direct_gateway')
            : (TenantPaymentGateways::definitions()[(string) $payment->gateway]['label'] ?? (string) $payment->gateway);

        $query = http_build_query(array_filter([
            'status' => $status,
            'amount' => (int) $payment->payable_amount,
            'balance' => $currentBalance ?? $this->service->currentBalance(tenant()),
            'reference' => $payment->reference_id,
            'paymentId' => $payment->invoice_number,
            'paidAt' => $payment->paid_at?->toIso8601String(),
            'bank' => $gatewayLabel,
            'message' => $message,
        ], static fn ($value) => $value !== null && $value !== ''));

        return redirect('/panel/sms-settings/top-up/result'.($query !== '' ? '?'.$query : ''));
    }

    private function abortUnlessTenantAdmin(Request $request)
    {
        $user = $request->user('tenant_web');
        abort_unless($user?->role === 'admin', 403, __('authorization.primary_admin_section'));

        return $user;
    }
}
