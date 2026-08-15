<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\Payments\MaliartPaymentClient;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MaliartPaymentClientTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.maliart_payment', [
            'enabled' => true,
            'base_url' => 'https://maliart.example',
            'client_id' => 'barberbook',
            'secret' => 'test-secret',
            'timeout_seconds' => 10,
        ]);
    }

    public function test_it_creates_a_payment(): void
    {
        Http::fake([
            'https://maliart.example/payment.php?action=create' => Http::response([
                'success' => true,
                'data' => [
                    'payment_id' => 'mp_test',
                    'payment_url' => 'https://maliart.example/payment.php?token=test',
                    'status' => 'pending',
                ],
            ], 201),
        ]);

        $payload = [
            'order_id' => 'SMS-TEST-1001',
            'amount' => 10000,
            'currency' => 'IRT',
            'type' => 'sms_credit_topup',
            'description' => 'SMS top-up test',
            'return_url' => 'https://tenant.example/sms-top-up/callback?payment=1',
        ];

        $result = app(MaliartPaymentClient::class)->create($payload);

        $this->assertSame('mp_test', $result['payment_id']);
        Http::assertSent(function ($request) use ($payload): bool {
            $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);

            return $request->method() === 'POST'
                && $request->url() === 'https://maliart.example/payment.php?action=create'
                && $request->body() === $body;
        });
    }

    public function test_it_reads_payment_status(): void
    {
        Http::fake([
            'https://maliart.example/payment.php?action=status&payment_id=mp_test' => Http::response([
                'success' => true,
                'data' => [
                    'payment_id' => 'mp_test',
                    'order_id' => 'SMS-TEST-1001',
                    'amount' => 10000,
                    'currency' => 'IRT',
                    'status' => 'paid',
                    'reference_id' => '123456',
                ],
            ]),
        ]);

        $result = app(MaliartPaymentClient::class)->status('mp_test');

        $this->assertSame('paid', $result['status']);
        Http::assertSent(fn ($request): bool => $request->method() === 'GET');
    }

    public function test_it_keeps_toman_amounts_for_irt_currency(): void
    {
        $this->assertSame(125000, MaliartPaymentClient::amountAsToman(125000, 'IRT'));
        $this->assertSame(125000, MaliartPaymentClient::amountAsToman(125000, 'T'));
    }

    public function test_it_converts_bank_rial_amounts_back_to_toman(): void
    {
        $this->assertSame(125000, MaliartPaymentClient::amountAsToman(1250000, 'IRR'));
        $this->assertSame(125000, MaliartPaymentClient::amountAsToman(1250000, 'RIAL'));
    }

    public function test_it_converts_internal_toman_amounts_to_bank_rial(): void
    {
        $this->assertSame(1250000, MaliartPaymentClient::amountAsRial(125000));
    }
}
