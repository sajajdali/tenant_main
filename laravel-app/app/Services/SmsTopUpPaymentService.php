<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\SmsSetting;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantSubscriptionPayment;
use App\Models\SystemSetting;
use App\Services\Sms\SmsCreditService;
use App\Services\Payments\MaliartPaymentClient;
use App\Support\TenantPaymentGateways;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Shetabit\Multipay\Exceptions\InvalidPaymentException;
use Shetabit\Multipay\Invoice;
use Shetabit\Payment\Facade\Payment;

class SmsTopUpPaymentService
{
    public function __construct(
        private readonly SmsCreditService $smsCreditService,
        private readonly MaliartPaymentClient $maliart,
    ) {
    }

    public function settings(?Tenant $tenant = null): array
    {
        $raw = array_merge([
            'enabled' => false,
            'sandbox_enabled' => true,
            'provider' => 'zarinpal',
        ], SystemSetting::getValue('support_payment', []));

        $gateways = TenantPaymentGateways::normalized($raw['gateways'] ?? []);

        if (($raw['zarinpal_merchant_id'] ?? '') !== '' && blank($gateways['zarinpal']['merchantId'] ?? '')) {
            $gateways['zarinpal']['merchantId'] = (string) $raw['zarinpal_merchant_id'];
            $gateways['zarinpal']['enabled'] = true;
        }

        $enabledGateways = TenantPaymentGateways::configuredEnabled($gateways);
        $maliartEnabled = $this->maliart->enabled();
        $provider = (string) ($raw['provider'] ?? ($enabledGateways[0] ?? 'zarinpal'));

        if (! in_array($provider, TenantPaymentGateways::supportedKeys(), true)) {
            $provider = $enabledGateways[0] ?? 'zarinpal';
        }

        return [
            'enabled' => $maliartEnabled || (bool) ($raw['enabled'] ?? false),
            // Central SMS top-up must follow the central Laravel gateway setting only.
            'sandbox_enabled' => $maliartEnabled ? false : (bool) ($raw['sandbox_enabled'] ?? false),
            'provider' => $maliartEnabled ? 'maliart' : $provider,
            'gateways' => $gateways,
            'enabled_gateways' => $maliartEnabled ? [] : $enabledGateways,
            'maliart_enabled' => $maliartEnabled,
        ];
    }

    public function createPayment(Tenant $tenant, int $amount, array $actor, string $callbackUrlTemplate, ?string $gateway = null): array
    {
        $amount = max(0, $amount);
        if ($amount < 10000) {
            throw new RuntimeException(__('payment.sms_top_up.minimum_amount'));
        }

        $useMaliart = $this->maliart->enabled();
        $settings = $this->settings($tenant);
        if (! $useMaliart && ! $settings['enabled'] && ! $settings['sandbox_enabled']) {
            throw new RuntimeException(__('payment.sms_top_up.central_disabled'));
        }

        $payment = TenantSubscriptionPayment::query()->create([
            'tenant_id' => $tenant->id,
            'payment_type' => 'sms_credit_topup',
            'subscription_package_id' => null,
            'status' => 'pending',
            'gateway' => $useMaliart
                ? 'maliart'
                : ($settings['sandbox_enabled'] ? 'sandbox' : $this->resolveGatewaySelection($settings, $gateway)),
            'invoice_number' => $this->makeInvoiceNumber(),
            'amount' => $amount,
            'discount_amount' => 0,
            'payable_amount' => $amount,
            'sandbox_mode' => $useMaliart ? false : (bool) $settings['sandbox_enabled'],
            'initiated_by_tenant_user_id' => (string) ($actor['id'] ?? ''),
            'initiated_by_name' => $actor['name'] ?? null,
            'initiated_by_mobile' => $actor['mobile'] ?? null,
            'initiated_by_role' => $actor['role'] ?? null,
            'expires_at' => now()->addMinutes(30),
            'metadata' => [
                'context' => 'sms_credit_topup',
                'sms_credit_amount' => $amount,
            ],
        ]);

        $payment->items()->create([
            'item_type' => 'sms_credit_topup',
            'title' => __('payment.sms_top_up.title'),
            'description' => __('payment.sms_top_up.description'),
            'quantity' => 1,
            'unit_amount' => $amount,
            'amount' => $amount,
            'discount_amount' => 0,
            'payable_amount' => $amount,
            'metadata' => [
                'credit_amount' => $amount,
            ],
        ]);

        if ($useMaliart) {
            return array_merge(
                ['payment' => $payment->fresh(['items'])],
                $this->startMaliartPayment(
                    payment: $payment,
                    tenant: $tenant,
                    callbackUrlTemplate: $callbackUrlTemplate,
                    description: __('payment.sms_top_up.gateway_description', ['tenant' => $tenant->name]),
                    mobile: (string) ($actor['mobile'] ?? ''),
                ),
            );
        }

        if ($settings['sandbox_enabled']) {
            $result = $this->markPaymentSuccessful($payment, 'sandbox-'.Str::upper(Str::random(10)));

            return [
                'mode' => 'sandbox',
                'payment' => $result['payment'],
                'currentBalance' => $result['currentBalance'],
            ];
        }

        return array_merge(
            ['payment' => $payment->fresh(['items'])],
            $this->startGatewayPayment(
                payment: $payment,
                settings: $settings,
                callbackUrlTemplate: $callbackUrlTemplate,
                description: __('payment.sms_top_up.gateway_description', ['tenant' => $tenant->name]),
                mobile: (string) ($actor['mobile'] ?? ''),
            ),
        );
    }

    public function createManualPayment(Tenant $tenant, int $amount, array $actor, array $options = []): array
    {
        $amount = max(0, $amount);
        if ($amount <= 0) {
            throw new RuntimeException(__('payment.sms_top_up.positive_amount'));
        }

        $countsAsRevenue = (bool) ($options['counts_as_revenue'] ?? false);
        $manualPaymentMethod = $countsAsRevenue ? (string) ($options['payment_method'] ?? '') : '';

        $payment = TenantSubscriptionPayment::query()->create([
            'tenant_id' => $tenant->id,
            'payment_type' => 'sms_credit_topup',
            'subscription_package_id' => null,
            'status' => 'pending',
            'gateway' => $this->manualGateway($manualPaymentMethod, $countsAsRevenue),
            'invoice_number' => $this->makeInvoiceNumber(),
            'amount' => $amount,
            'discount_amount' => 0,
            'payable_amount' => $amount,
            'sandbox_mode' => false,
            'initiated_by_tenant_user_id' => (string) ($actor['id'] ?? ''),
            'initiated_by_name' => $actor['name'] ?? null,
            'initiated_by_mobile' => $actor['mobile'] ?? null,
            'initiated_by_role' => $actor['role'] ?? null,
            'paid_at' => now(),
            'expires_at' => now()->addMinutes(30),
            'metadata' => [
                'context' => 'sms_credit_topup',
                'sms_credit_amount' => $amount,
                'counts_as_revenue' => $countsAsRevenue,
                'manual_payment_method' => $manualPaymentMethod !== '' ? $manualPaymentMethod : null,
                'admin_manual' => true,
                'manual_note' => trim((string) ($options['note'] ?? '')),
                'manual_registered_by_user_id' => $options['registered_by_user_id'] ?? null,
                'manual_registered_by_name' => $options['registered_by_name'] ?? null,
            ],
        ]);

        $payment->items()->create([
            'item_type' => 'sms_credit_topup',
            'title' => __('payment.sms_top_up.title'),
            'description' => __('payment.sms_top_up.description'),
            'quantity' => 1,
            'unit_amount' => $amount,
            'amount' => $amount,
            'discount_amount' => 0,
            'payable_amount' => $amount,
            'metadata' => [
                'credit_amount' => $amount,
            ],
        ]);

        return $this->markPaymentSuccessful(
            $payment,
            (string) ($options['reference_id'] ?? ('manual-'.Str::upper(Str::random(10)))),
        );
    }

    public function verifyPayment(Tenant $tenant, TenantSubscriptionPayment $payment): array
    {
        abort_if((string) $payment->tenant_id !== (string) $tenant->id, 404);

        if ($payment->status === 'paid') {
            return [
                'payment' => $payment->fresh(['items']),
                'currentBalance' => $this->currentBalance($tenant),
            ];
        }

        if ((string) $payment->gateway === 'maliart') {
            return $this->verifyMaliartPayment($tenant, $payment);
        }

        $settings = $this->settings($tenant);
        $gateway = (string) ($payment->gateway ?: $settings['provider']);
        $gatewaySettings = $settings['gateways'][$gateway] ?? null;
        $transactionId = (string) ($payment->authority ?? '');

        if (! $gatewaySettings || blank($transactionId)) {
            throw new RuntimeException(__('payment.sms_top_up.verification_data_missing'));
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
            'discountAmount' => (int) $payment->discount_amount,
            'payableAmount' => (int) $payment->payable_amount,
            'sandboxMode' => (bool) $payment->sandbox_mode,
            'referenceId' => $payment->reference_id,
            'paidAt' => $payment->paid_at?->toIso8601String(),
            'createdAt' => $payment->created_at?->toIso8601String(),
            'initiatedByName' => $payment->initiated_by_name,
            'initiatedByMobile' => $payment->initiated_by_mobile,
            'failureReason' => $payment->failure_reason,
        ];
    }

    public function currentBalance(Tenant $tenant): int
    {
        $balance = 0;

        $tenant->run(function () use (&$balance): void {
            $balance = $this->smsCreditService->balance(SmsSetting::query()->first());
        });

        return $balance;
    }

    private function markPaymentSuccessful(TenantSubscriptionPayment $payment, string $referenceId): array
    {
        return DB::connection('central')->transaction(function () use ($payment, $referenceId): array {
            $lockedPayment = TenantSubscriptionPayment::query()->with(['items'])->lockForUpdate()->findOrFail($payment->id);

            if ($lockedPayment->status === 'paid') {
                $tenant = Tenant::query()->findOrFail($lockedPayment->tenant_id);

                return [
                    'payment' => $lockedPayment->fresh(['items']),
                    'currentBalance' => $this->currentBalance($tenant),
                ];
            }

            $tenant = Tenant::query()->findOrFail($lockedPayment->tenant_id);
            $creditedAmount = (int) ($lockedPayment->metadata['sms_credit_amount'] ?? $lockedPayment->payable_amount);
            $currentBalance = 0;

            $tenant->run(function () use (&$currentBalance, $creditedAmount): void {
                $smsSetting = SmsSetting::query()->firstOrCreate([], [
                    'enabled' => false,
                    'provider' => null,
                    'credentials' => [],
                    'templates' => [],
                ]);

                $this->smsCreditService->addCredit($smsSetting, $creditedAmount);
                $currentBalance = $this->smsCreditService->balance($smsSetting->fresh());
            });

            $lockedPayment->update([
                'status' => 'paid',
                'reference_id' => $referenceId,
                'paid_at' => now(),
                'metadata' => array_merge($lockedPayment->metadata ?? [], [
                    'sms_credit_amount' => $creditedAmount,
                    'credited_at' => now()->toIso8601String(),
                    'credit_balance_after' => $currentBalance,
                ]),
            ]);

            return [
                'payment' => $lockedPayment->fresh(['items']),
                'currentBalance' => $currentBalance,
            ];
        });
    }

    private function resolveGatewaySelection(array $settings, ?string $gateway): string
    {
        $requested = trim((string) ($gateway ?? ''));
        $enabledGateways = $settings['enabled_gateways'] ?? [];
        $defaultProvider = (string) ($settings['provider'] ?? '');
        $selected = $requested !== '' ? $requested : $defaultProvider;

        if (! in_array($selected, $enabledGateways, true)) {
            throw new RuntimeException(__('payment.sms_top_up.gateway_incomplete'));
        }

        return $selected;
    }

    private function startGatewayPayment(
        TenantSubscriptionPayment $payment,
        array $settings,
        string $callbackUrlTemplate,
        string $description,
        string $mobile,
    ): array {
        $gateway = (string) ($payment->gateway ?? '');
        $gatewaySettings = $settings['gateways'][$gateway] ?? null;

        if (! $gatewaySettings) {
            throw new RuntimeException(__('payment.sms_top_up.central_gateway_incomplete'));
        }

        $callbackUrl = str_replace(['{payment}', '__PAYMENT__'], (string) $payment->id, $callbackUrlTemplate);
        $invoice = (new Invoice())
            ->amount((int) $payment->payable_amount)
            ->detail('description', $description)
            ->detail('mobile', $mobile);

        $paymentManager = Payment::via($gateway)
            ->config(TenantPaymentGateways::driverConfig($gateway, $gatewaySettings, $callbackUrl))
            ->callbackUrl($callbackUrl);

        $paymentManager->purchase($invoice, function ($driver, $transactionId) use ($payment): void {
            $payment->update([
                'authority' => (string) $transactionId,
            ]);
        });

        $redirectForm = $paymentManager->pay()->jsonSerialize();
        $paymentUrl = is_array($redirectForm) ? (string) ($redirectForm['action'] ?? '') : '';

        return [
            'mode' => 'gateway',
            'paymentUrl' => $paymentUrl !== '' ? $paymentUrl : null,
            'redirectForm' => $redirectForm,
        ];
    }

    private function startMaliartPayment(
        TenantSubscriptionPayment $payment,
        Tenant $tenant,
        string $callbackUrlTemplate,
        string $description,
        string $mobile,
    ): array {
        $callbackUrl = str_replace(['{payment}', '__PAYMENT__'], (string) $payment->id, $callbackUrlTemplate);

        try {
            $remote = $this->maliart->create([
                'order_id' => (string) $payment->invoice_number,
                'amount' => (int) $payment->payable_amount,
                'currency' => 'IRT',
                'type' => 'sms_credit_topup',
                'description' => $description,
                'return_url' => $callbackUrl,
                'customer' => [
                    'name' => (string) ($payment->initiated_by_name ?? ''),
                    'mobile' => $mobile,
                ],
                'metadata' => [
                    'tenant_id' => (string) $tenant->id,
                    'local_payment_id' => (string) $payment->id,
                    'invoice_number' => (string) $payment->invoice_number,
                ],
            ]);
        } catch (\Throwable $exception) {
            $payment->update([
                'status' => 'failed',
                'failure_reason' => $exception->getMessage(),
            ]);

            throw $exception;
        }

        $remotePaymentId = trim((string) ($remote['payment_id'] ?? ''));
        $paymentUrl = trim((string) ($remote['payment_url'] ?? ''));
        $remoteRedirectForm = is_array($remote['redirect_form'] ?? null) ? $remote['redirect_form'] : null;
        if ($remotePaymentId === '' || $paymentUrl === '') {
            $payment->update([
                'status' => 'failed',
                'failure_reason' => __('payment.sms_top_up.maliart_invalid_response'),
            ]);
            throw new RuntimeException(__('payment.sms_top_up.maliart_invalid_response'));
        }

        $payment->update([
            'authority' => $remotePaymentId,
            'metadata' => array_merge($payment->metadata ?? [], [
                'maliart_payment_id' => $remotePaymentId,
                'maliart_status' => (string) ($remote['status'] ?? 'pending'),
            ]),
        ]);

        return [
            'mode' => 'gateway',
            'paymentUrl' => $paymentUrl,
            'redirectForm' => $remoteRedirectForm === null ? null : [
                'action' => trim((string) ($remoteRedirectForm['action'] ?? $paymentUrl)),
                'method' => strtoupper(trim((string) ($remoteRedirectForm['method'] ?? 'POST'))),
                'inputs' => collect(is_array($remoteRedirectForm['inputs'] ?? null) ? $remoteRedirectForm['inputs'] : [])
                    ->mapWithKeys(static fn ($value, $key): array => [(string) $key => (string) $value])
                    ->all(),
            ],
        ];
    }

    private function verifyMaliartPayment(Tenant $tenant, TenantSubscriptionPayment $payment): array
    {
        abort_if((string) $payment->tenant_id !== (string) $tenant->id, 404);

        $remotePaymentId = trim((string) data_get($payment->metadata, 'maliart_payment_id', $payment->authority));
        if ($remotePaymentId === '') {
            throw new RuntimeException(__('payment.sms_top_up.verification_data_missing'));
        }

        $remote = $this->maliart->status($remotePaymentId);
        $remoteStatus = (string) ($remote['status'] ?? '');
        $remoteOrderId = (string) ($remote['order_id'] ?? '');
        $remoteAmount = (int) ($remote['amount'] ?? 0);
        $remoteCurrency = (string) ($remote['currency'] ?? '');

        if ($remoteOrderId !== (string) $payment->invoice_number || $remoteAmount !== (int) $payment->payable_amount || $remoteCurrency !== 'IRT') {
            $payment->update([
                'status' => 'failed',
                'failure_reason' => __('payment.sms_top_up.maliart_mismatch'),
            ]);
            throw new RuntimeException(__('payment.sms_top_up.maliart_mismatch'));
        }

        if ($remoteStatus !== 'paid') {
            $payment->update([
                'status' => in_array($remoteStatus, ['failed', 'cancelled', 'expired'], true) ? $remoteStatus : 'pending',
                'failure_reason' => __('payment.sms_top_up.maliart_not_paid'),
                'metadata' => array_merge($payment->metadata ?? [], ['maliart_status' => $remoteStatus]),
            ]);
            throw new RuntimeException(__('payment.sms_top_up.maliart_not_paid'));
        }

        $referenceId = trim((string) ($remote['reference_id'] ?? ''));
        if ($referenceId === '') {
            throw new RuntimeException(__('payment.sms_top_up.maliart_reference_missing'));
        }

        return $this->markPaymentSuccessful($payment, $referenceId);
    }

    private function makeInvoiceNumber(): string
    {
        return 'SMS-'.now()->format('YmdHis').'-'.Str::upper(Str::random(6));
    }

    private function manualGateway(string $paymentMethod, bool $countsAsRevenue): string
    {
        if (! $countsAsRevenue) {
            return 'manual_no_charge';
        }

        return match ($paymentMethod) {
            'card_to_card' => 'manual_card_to_card',
            default => 'manual_online',
        };
    }
}
