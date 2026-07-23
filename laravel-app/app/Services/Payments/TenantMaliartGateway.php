<?php

declare(strict_types=1);

namespace App\Services\Payments;

use App\Domain\Tenant\Models\Tenant;
use RuntimeException;

class TenantMaliartGateway
{
    public function __construct(private readonly MaliartPaymentClient $client)
    {
    }

    public function enabled(): bool
    {
        $tenant = tenant();

        return $tenant instanceof Tenant
            && (bool) data_get($tenant->getAttribute('payment_overrides'), 'maliart_enabled', false);
    }

    public function start(string $orderId, int $amount, string $type, string $description, string $returnUrl, string $name = '', string $mobile = ''): array
    {
        $remote = $this->client->create([
            'order_id' => $orderId,
            'amount' => $amount,
            'currency' => 'IRT',
            'type' => $type,
            'description' => $description,
            'return_url' => $returnUrl,
            'customer' => ['name' => $name, 'mobile' => $mobile],
            'metadata' => [
                'tenant_id' => (string) tenant('id'),
                'source' => 'tenant_customer_payment',
            ],
        ]);

        $paymentId = trim((string) ($remote['payment_id'] ?? ''));
        $paymentUrl = trim((string) ($remote['payment_url'] ?? ''));
        if ($paymentId === '' || $paymentUrl === '') {
            throw new RuntimeException(__('payment.sms_top_up.maliart_invalid_response'));
        }

        return ['paymentId' => $paymentId, 'paymentUrl' => $paymentUrl];
    }

    public function verify(string $paymentId, string $orderId, int $amount): string
    {
        $remote = $this->client->status($paymentId);
        if ((string) ($remote['payment_id'] ?? '') !== $paymentId
            || (string) ($remote['order_id'] ?? '') !== $orderId
            || (int) ($remote['amount'] ?? -1) !== $amount
            || (string) ($remote['currency'] ?? '') !== 'IRT'
            || (string) ($remote['status'] ?? '') !== 'paid') {
            throw new RuntimeException(__('payment.sms_top_up.maliart_invalid_response'));
        }

        return trim((string) ($remote['reference_id'] ?? '')) ?: $paymentId;
    }
}
