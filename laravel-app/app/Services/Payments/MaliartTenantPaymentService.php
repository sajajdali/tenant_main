<?php

declare(strict_types=1);

namespace App\Services\Payments;

use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantSubscriptionPayment;
use RuntimeException;

class MaliartTenantPaymentService
{
    public function __construct(private readonly MaliartPaymentClient $client)
    {
    }

    public function enabled(): bool
    {
        return $this->client->enabled();
    }

    public function start(
        TenantSubscriptionPayment $payment,
        Tenant $tenant,
        string $callbackUrlTemplate,
        string $description,
        string $mobile = '',
    ): array {
        $callbackUrl = str_replace(['{payment}', '__PAYMENT__'], (string) $payment->id, $callbackUrlTemplate);
        $remote = $this->client->create([
            'order_id' => (string) $payment->invoice_number,
            'amount' => (int) $payment->payable_amount,
            'currency' => 'IRT',
            'type' => (string) $payment->payment_type,
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
                'payment_type' => (string) $payment->payment_type,
            ],
        ]);

        $remotePaymentId = trim((string) ($remote['payment_id'] ?? ''));
        $paymentUrl = trim((string) ($remote['payment_url'] ?? ''));
        if ($remotePaymentId === '' || $paymentUrl === '') {
            throw new RuntimeException(__('payment.sms_top_up.maliart_invalid_response'));
        }

        $payment->update([
            'gateway' => 'maliart',
            'authority' => $remotePaymentId,
            'sandbox_mode' => false,
            'metadata' => array_merge((array) ($payment->metadata ?? []), [
                'maliart_payment_id' => $remotePaymentId,
                'maliart_status' => (string) ($remote['status'] ?? 'pending'),
            ]),
        ]);

        return [
            'mode' => 'gateway',
            'paymentUrl' => $paymentUrl,
            'redirectForm' => null,
        ];
    }

    public function verifiedReference(TenantSubscriptionPayment $payment): string
    {
        $remotePaymentId = trim((string) data_get($payment->metadata, 'maliart_payment_id', $payment->authority));
        if ($remotePaymentId === '') {
            throw new RuntimeException(__('payment.sms_top_up.verification_data_missing'));
        }

        $remote = $this->client->status($remotePaymentId);
        $remoteAmount = MaliartPaymentClient::amountAsToman(
            (int) ($remote['amount'] ?? -1),
            (string) ($remote['currency'] ?? ''),
        );

        if ((string) ($remote['payment_id'] ?? '') !== $remotePaymentId
            || (string) ($remote['order_id'] ?? '') !== (string) $payment->invoice_number
            || $remoteAmount !== (int) $payment->payable_amount
            || (string) ($remote['status'] ?? '') !== 'paid') {
            throw new RuntimeException(__('payment.sms_top_up.maliart_invalid_response'));
        }

        return trim((string) ($remote['reference_id'] ?? '')) ?: $remotePaymentId;
    }
}
