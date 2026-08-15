<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantSubscriptionPayment;
use App\Services\Payments\MaliartPaymentClient;
use App\Services\Payments\MaliartTenantPaymentService;
use Tests\TestCase;

class MaliartTenantPaymentServiceTest extends TestCase
{
    public function test_it_sends_internal_toman_amounts_to_maliart_as_rial(): void
    {
        $client = new class extends MaliartPaymentClient {
            public array $payload = [];

            public function create(array $payload): array
            {
                $this->payload = $payload;

                return [
                    'payment_id' => 'mp_100',
                    'payment_url' => 'https://maliart.example/pay/mp_100',
                    'status' => 'pending',
                ];
            }
        };

        $payment = new class([
            'invoice_number' => 'SMS-TEST-100',
            'payment_type' => 'sms_credit_topup',
            'payable_amount' => 125000,
            'initiated_by_name' => 'Test User',
            'metadata' => [],
        ]) extends TenantSubscriptionPayment {
            public function update(array $attributes = [], array $options = []): bool
            {
                $this->forceFill($attributes);

                return true;
            }
        };
        $payment->id = 10;
        $payment->exists = true;
        $payment->setConnection('central');

        $tenant = new Tenant();
        $tenant->id = 'tenant-test';
        $tenant->name = 'Tenant Test';

        (new MaliartTenantPaymentService($client))->start(
            $payment,
            $tenant,
            'https://tenant.example/payment/{payment}/callback',
            'Test payment',
            '09120000000',
        );

        $this->assertSame(1250000, $client->payload['amount']);
        $this->assertSame('IRR', $client->payload['currency']);
    }

    public function test_it_accepts_rial_amounts_returned_from_bank_status(): void
    {
        $client = new class extends MaliartPaymentClient {
            public function status(string $paymentId): array
            {
                return [
                    'payment_id' => $paymentId,
                    'order_id' => 'SMS-TEST-101',
                    'amount' => 1250000,
                    'currency' => 'IRR',
                    'status' => 'paid',
                    'reference_id' => 'REF-101',
                ];
            }
        };

        $payment = new TenantSubscriptionPayment([
            'invoice_number' => 'SMS-TEST-101',
            'payable_amount' => 125000,
            'authority' => 'mp_101',
            'metadata' => ['maliart_payment_id' => 'mp_101'],
        ]);

        $reference = (new MaliartTenantPaymentService($client))->verifiedReference($payment);

        $this->assertSame('REF-101', $reference);
    }
}
