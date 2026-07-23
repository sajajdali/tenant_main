<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantSubscriptionPayment;
use App\Domain\Tenant\Models\TenantUser;
use App\Services\Payments\MaliartTenantPaymentService;
use App\Support\OpenAiSettings;
use App\Support\TenantPaymentGateways;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Shetabit\Multipay\Exceptions\InvalidPaymentException;
use Shetabit\Multipay\Invoice;
use Shetabit\Payment\Facade\Payment;

class NutritionTokenTopUpPaymentService
{
    public function __construct(
        private readonly SmsTopUpPaymentService $paymentSettings,
        private readonly NutritionTokenService $tokens,
        private readonly MaliartTenantPaymentService $maliart,
    ) {
    }

    public function settingsPayload(?Tenant $tenant = null): array
    {
        $settings = $this->paymentSettings->settings($tenant);

        return [
            'maliartEnabled' => (bool) ($settings['maliart_enabled'] ?? false),
            'sandboxEnabled' => (bool) ($settings['sandbox_enabled'] ?? false),
            'provider' => $settings['provider'] ?? null,
            'enabledGateways' => $settings['enabled_gateways'] ?? [],
        ];
    }

    public function createPayment(Tenant $tenant, int $amount, TenantUser $actor, string $callbackUrlTemplate, ?string $gateway = null): array
    {
        $tokensAmount = max(0, $amount);
        if ($tokensAmount < 10000) {
            throw new RuntimeException(__('payment.nutrition_token_top_up.minimum_tokens'));
        }

        $unitPriceToman = OpenAiSettings::nutritionTokenUnitPriceToman();
        $payableAmount = $tokensAmount * $unitPriceToman;
        if ($payableAmount < 100000) {
            throw new RuntimeException(__('payment.nutrition_token_top_up.minimum_payable'));
        }

        $settings = $this->paymentSettings->settings($tenant);
        if (! $settings['enabled'] && ! $settings['sandbox_enabled']) {
            throw new RuntimeException(__('payment.nutrition_token_top_up.disabled'));
        }

        $payment = TenantSubscriptionPayment::query()->create([
            'tenant_id' => $tenant->id,
            'payment_type' => 'nutrition_token_topup',
            'subscription_package_id' => null,
            'status' => 'pending',
            'gateway' => $settings['sandbox_enabled'] ? 'sandbox' : $this->resolveGatewaySelection($settings, $gateway),
            'invoice_number' => $this->makeInvoiceNumber(),
            'amount' => $payableAmount,
            'discount_amount' => 0,
            'payable_amount' => $payableAmount,
            'sandbox_mode' => (bool) $settings['sandbox_enabled'],
            'initiated_by_tenant_user_id' => (string) $actor->id,
            'initiated_by_name' => $actor->name,
            'initiated_by_mobile' => $actor->mobile,
            'initiated_by_role' => $actor->role,
            'expires_at' => now()->addMinutes(30),
            'metadata' => [
                'context' => 'nutrition_token_topup',
                'tokens_amount' => $tokensAmount,
                'unit_price_toman' => $unitPriceToman,
            ],
        ]);

        $payment->items()->create([
            'item_type' => 'nutrition_token_topup',
            'title' => __('payment.nutrition_token_top_up.title'),
            'description' => __('payment.nutrition_token_top_up.description'),
            'quantity' => $tokensAmount,
            'unit_amount' => $unitPriceToman,
            'amount' => $payableAmount,
            'discount_amount' => 0,
            'payable_amount' => $payableAmount,
            'metadata' => [
                'tokens_amount' => $tokensAmount,
                'unit_price_toman' => $unitPriceToman,
            ],
        ]);

        if ($settings['sandbox_enabled']) {
            $result = $this->markPaymentSuccessful($payment, 'sandbox-'.Str::upper(Str::random(10)));

            return [
                'mode' => 'sandbox',
                'payment' => $result['payment'],
                'currentTokens' => $result['currentTokens'],
            ];
        }

        return array_merge(
            ['payment' => $payment->fresh(['items'])],
            $this->startGatewayPayment(
                payment: $payment,
                settings: $settings,
                callbackUrlTemplate: $callbackUrlTemplate,
                description: __('payment.nutrition_token_top_up.gateway_description', ['tenant' => $tenant->name]),
                mobile: (string) $actor->mobile,
            ),
        );
    }

    public function verifyPayment(Tenant $tenant, TenantSubscriptionPayment $payment): array
    {
        abort_if((string) $payment->tenant_id !== (string) $tenant->id, 404);

        if ($payment->status === 'paid') {
            return [
                'payment' => $payment->fresh(['items']),
                'currentTokens' => $this->tokens->wallet()->balance_tokens,
            ];
        }

        if ((string) $payment->gateway === 'maliart') {
            return $this->markPaymentSuccessful($payment, $this->maliart->verifiedReference($payment));
        }

        $settings = $this->paymentSettings->settings($tenant);
        $gateway = (string) ($payment->gateway ?: $settings['provider']);
        $gatewaySettings = $settings['gateways'][$gateway] ?? null;
        $transactionId = (string) ($payment->authority ?? '');

        if (! $gatewaySettings || blank($transactionId)) {
            throw new RuntimeException(__('payment.nutrition_token_top_up.verification_data_missing'));
        }

        try {
            $receipt = Payment::via($gateway)
                ->config(TenantPaymentGateways::driverConfig($gateway, $gatewaySettings, ''))
                ->amount((int) $payment->payable_amount)
                ->transactionId($transactionId)
                ->verify();
        } catch (InvalidPaymentException $exception) {
            $payment->update([
                'status' => 'failed',
                'failure_reason' => $exception->getMessage(),
            ]);

            throw $exception;
        }

        return $this->markPaymentSuccessful($payment, (string) $receipt->getReferenceId());
    }

    public function markPaymentCancelled(TenantSubscriptionPayment $payment, ?string $reason = null): void
    {
        if ($payment->status === 'paid') {
            return;
        }

        $payment->update([
            'status' => 'cancelled',
            'failure_reason' => $reason,
        ]);
    }

    public function serializePayment(TenantSubscriptionPayment $payment): array
    {
        return [
            'id' => (string) $payment->id,
            'invoiceNumber' => $payment->invoice_number,
            'paymentType' => $payment->payment_type,
            'status' => $payment->status,
            'gateway' => $payment->gateway,
            'amount' => (int) $payment->amount,
            'payableAmount' => (int) $payment->payable_amount,
            'tokensAmount' => (int) data_get($payment->metadata, 'tokens_amount', $payment->payable_amount),
            'unitPriceToman' => (int) data_get($payment->metadata, 'unit_price_toman', OpenAiSettings::nutritionTokenUnitPriceToman()),
            'sandboxMode' => (bool) $payment->sandbox_mode,
            'referenceId' => $payment->reference_id,
            'paidAt' => $payment->paid_at?->toIso8601String(),
            'createdAt' => $payment->created_at?->toIso8601String(),
        ];
    }

    private function markPaymentSuccessful(TenantSubscriptionPayment $payment, string $referenceId): array
    {
        return DB::connection('central')->transaction(function () use ($payment, $referenceId): array {
            $lockedPayment = TenantSubscriptionPayment::query()->with(['items'])->lockForUpdate()->findOrFail($payment->id);

            if ($lockedPayment->status === 'paid') {
                return [
                    'payment' => $lockedPayment->fresh(['items']),
                    'currentTokens' => $this->tokens->wallet()->balance_tokens,
                ];
            }

            $lockedPayment->update([
                'status' => 'paid',
                'reference_id' => $referenceId,
                'paid_at' => now(),
                'failure_reason' => null,
            ]);

            $actor = null;
            if ($lockedPayment->initiated_by_tenant_user_id !== null) {
                $actor = TenantUser::query()->find($lockedPayment->initiated_by_tenant_user_id);
            }

            $tokensAmount = max(0, (int) data_get($lockedPayment->metadata, 'tokens_amount', $lockedPayment->payable_amount));

            $ledger = $this->tokens->creditTokens(
                amount: $tokensAmount,
                actor: $actor,
                reasonTitle: __('payment.nutrition_token_top_up.reason_title'),
                eventType: 'topup',
                meta: [
                    'invoice_number' => $lockedPayment->invoice_number,
                    'payment_id' => $lockedPayment->id,
                    'paid_amount_toman' => (int) $lockedPayment->payable_amount,
                    'unit_price_toman' => (int) data_get($lockedPayment->metadata, 'unit_price_toman', OpenAiSettings::nutritionTokenUnitPriceToman()),
                ],
            );

            $lockedPayment->update([
                'metadata' => array_merge((array) ($lockedPayment->metadata ?? []), [
                    'token_balance_after' => $ledger->balance_after,
                ]),
            ]);

            return [
                'payment' => $lockedPayment->fresh(['items']),
                'currentTokens' => (int) $ledger->balance_after,
            ];
        });
    }

    private function startGatewayPayment(TenantSubscriptionPayment $payment, array $settings, string $callbackUrlTemplate, string $description, string $mobile): array
    {
        $gateway = (string) $payment->gateway;

        if ($gateway === 'maliart') {
            return $this->maliart->start($payment, tenant(), $callbackUrlTemplate, $description, $mobile);
        }

        $callbackUrl = str_replace('__PAYMENT__', (string) $payment->id, $callbackUrlTemplate);

        $invoice = (new Invoice())
            ->amount((int) $payment->payable_amount)
            ->detail('description', $description)
            ->detail('mobile', $mobile);

        $paymentManager = Payment::via($gateway)
            ->config(TenantPaymentGateways::driverConfig($gateway, $settings['gateways'][$gateway], $callbackUrl))
            ->callbackUrl($callbackUrl);

        $paymentManager->purchase($invoice, function ($driver, $transactionId) use ($payment): void {
            $payment->update([
                'authority' => (string) $transactionId,
            ]);
        });

        return [
            'mode' => 'gateway',
            'paymentUrl' => null,
            'redirectForm' => $paymentManager->pay()->jsonSerialize(),
        ];
    }

    private function makeInvoiceNumber(): string
    {
        do {
            $number = 'NT-'.now()->format('ymd').'-'.Str::upper(Str::random(6));
        } while (TenantSubscriptionPayment::query()->where('invoice_number', $number)->exists());

        return $number;
    }

    private function resolveGatewaySelection(array $settings, ?string $selected): string
    {
        if (($settings['maliart_enabled'] ?? false) === true) {
            return 'maliart';
        }

        if ($settings['sandbox_enabled']) {
            return 'sandbox';
        }

        $selected = (string) ($selected ?? '');
        if ($selected !== '' && in_array($selected, $settings['enabled_gateways'], true)) {
            return $selected;
        }

        $fallback = (string) ($settings['provider'] ?? ($settings['enabled_gateways'][0] ?? ''));
        if ($fallback === '' || ! in_array($fallback, $settings['enabled_gateways'], true)) {
            throw new RuntimeException(__('payment.nutrition_token_top_up.gateway_missing'));
        }

        return $fallback;
    }
}
