<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\TenantSubscriptionPayment;
use App\Http\Controllers\Controller;
use App\Services\NutritionTokenService;
use App\Services\NutritionTokenTopUpPaymentService;
use App\Support\TenantPaymentGateways;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class NutritionTokenController extends Controller
{
    public function __construct(
        private readonly NutritionTokenService $tokens,
        private readonly NutritionTokenTopUpPaymentService $payments,
    ) {
    }

    public function dashboard(Request $request): JsonResponse
    {
        $this->abortUnlessNutritionAdmin($request);

        $payload = $this->tokens->dashboardPayloadForSearch(
            search: (string) $request->query('q', ''),
        );
        $payload['paymentSettings'] = $this->payments->settingsPayload(tenant());

        return response()->json([
            'success' => true,
            'data' => $payload,
        ]);
    }

    public function history(Request $request): JsonResponse
    {
        $this->abortUnlessNutritionAdmin($request);

        return response()->json([
            'success' => true,
            'data' => $this->tokens->historyPayload(
                search: (string) $request->query('q', ''),
                perPage: (int) $request->integer('per_page', 25),
            ),
        ]);
    }

    public function pay(Request $request): JsonResponse
    {
        $actor = $this->abortUnlessNutritionAdmin($request);

        $validated = $request->validate([
            'amount' => ['required', 'integer', 'min:10000'],
            'gateway' => ['nullable', 'in:'.implode(',', TenantPaymentGateways::supportedKeys())],
        ]);

        $callbackUrl = request()->getSchemeAndHttpHost().route('tenant.nutrition.tokens.callback', [], false).'?payment=__PAYMENT__';
        $result = $this->payments->createPayment(
            tenant(),
            (int) $validated['amount'],
            $actor,
            $callbackUrl,
            isset($validated['gateway']) ? (string) $validated['gateway'] : null,
        );

        return response()->json([
            'success' => true,
            'data' => [
                'mode' => $result['mode'],
                'paymentUrl' => $result['paymentUrl'] ?? null,
                'redirectForm' => $result['redirectForm'] ?? null,
                'payment' => $this->payments->serializePayment($result['payment']),
                'currentTokens' => $result['currentTokens'] ?? null,
            ],
            'message' => $result['mode'] === 'sandbox'
                ? __('tenant.nutrition.token_sandbox_completed')
                : __('tenant.nutrition.token_payment_created'),
        ]);
    }

    public function callback(Request $request): RedirectResponse
    {
        $authority = (string) $request->query('Authority', '');
        $status = (string) $request->query('Status', '');
        $paymentId = (int) $request->integer('payment');

        $payment = TenantSubscriptionPayment::query()
            ->where('tenant_id', tenant('id'))
            ->where('payment_type', 'nutrition_token_topup')
            ->when($paymentId > 0, fn ($query) => $query->where('id', $paymentId))
            ->when($paymentId <= 0 && $authority !== '', fn ($query) => $query->where('authority', $authority))
            ->latest('id')
            ->first();

        abort_if(! $payment, 404);

        if ((string) $payment->gateway !== 'maliart' && $status !== '' && strtoupper($status) !== 'OK') {
          $this->payments->markPaymentCancelled($payment, __('tenant.payments.cancelled_by_user'));
          return $this->redirectForPayment($payment, 'cancelled');
        }

        try {
            $result = $this->payments->verifyPayment(tenant(), $payment);
            return $this->redirectForPayment($result['payment'], 'success', null, (int) $result['currentTokens']);
        } catch (\Throwable $exception) {
            return $this->redirectForPayment($payment->fresh(), 'failed', $exception->getMessage());
        }
    }

    private function redirectForPayment(TenantSubscriptionPayment $payment, string $status, ?string $message = null, ?int $currentTokens = null): RedirectResponse
    {
        $gatewayLabel = (string) $payment->gateway === 'maliart'
            ? __('payment.direct_gateway')
            : (TenantPaymentGateways::definitions()[(string) $payment->gateway]['label'] ?? (string) $payment->gateway);

        $query = http_build_query(array_filter([
            'status' => $status,
            'amount' => (int) $payment->payable_amount,
            'purchasedTokens' => (int) data_get($payment->metadata, 'tokens_amount', $payment->payable_amount),
            'unitPriceToman' => (int) data_get($payment->metadata, 'unit_price_toman', 1),
            'tokens' => $currentTokens ?? data_get($payment->metadata, 'token_balance_after'),
            'reference' => $payment->reference_id,
            'paymentId' => $payment->invoice_number,
            'paidAt' => $payment->paid_at?->toIso8601String(),
            'bank' => $gatewayLabel,
            'message' => $message,
        ], static fn ($value) => $value !== null && $value !== ''));

        return redirect('/panel/nutrition/tokens/top-up/result'.($query !== '' ? '?'.$query : ''));
    }

    private function abortUnlessNutritionAdmin(Request $request)
    {
        $user = $request->user('tenant_web');
        abort_unless($user?->role === 'admin', 403, __('authorization.nutrition_admin_section'));

        return $user;
    }
}
