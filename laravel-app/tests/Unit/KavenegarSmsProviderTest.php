<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Domain\Tenant\Models\SmsSetting;
use App\Services\Sms\Providers\KavenegarSmsProvider;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class KavenegarSmsProviderTest extends TestCase
{
    public function test_it_sends_over_http_with_bounded_timeouts_and_normalizes_the_response(): void
    {
        config()->set('services.kavenegar', [
            'use_http' => true,
            'connect_timeout_seconds' => 5,
            'timeout_seconds' => 15,
        ]);

        $capturedOptions = [];

        Http::fake(function ($request, array $options) use (&$capturedOptions) {
            $capturedOptions = $options;

            return Http::response([
                'return' => [
                    'status' => 200,
                    'message' => 'تایید شد',
                ],
                'entries' => [[
                    'messageid' => 123456,
                    'sender' => '10004346',
                    'receptor' => '09376020827',
                    'message' => 'کد ورود: 2565',
                ]],
            ]);
        });

        $setting = new SmsSetting;
        $setting->credentials = ['sender' => '10004346'];

        $result = $this->provider()->send($setting, '09376020827', 'کد ورود: 2565');

        $this->assertTrue($result['ok']);
        $this->assertSame('123456', $result['provider_message_id']);
        $this->assertSame(5, $capturedOptions['connect_timeout'] ?? null);
        $this->assertSame(15, $capturedOptions['timeout'] ?? null);

        Http::assertSent(function ($request): bool {
            parse_str($request->body(), $body);

            return $request->method() === 'POST'
                && $request->url() === 'http://api.kavenegar.com/v1/test-api-key/sms/send.json'
                && ($body['receptor'] ?? null) === '09376020827'
                && ($body['sender'] ?? null) === '10004346'
                && ($body['message'] ?? null) === 'کد ورود: 2565';
        });
    }

    public function test_it_returns_the_provider_error_response(): void
    {
        config()->set('services.kavenegar.use_http', true);

        Http::fake([
            '*' => Http::response([
                'return' => [
                    'status' => 412,
                    'message' => 'ارسال کننده نامعتبر است',
                ],
                'entries' => [],
            ]),
        ]);

        $setting = new SmsSetting;
        $setting->credentials = ['sender' => 'invalid'];

        $result = $this->provider()->send($setting, '09376020827', 'کد ورود: 2565');

        $this->assertFalse($result['ok']);
        $this->assertSame('ارسال کننده نامعتبر است', $result['message']);
    }

    #[DataProvider('internationalReceptorProvider')]
    public function test_it_formats_international_receptors_with_the_kavenegar_double_zero_prefix(
        string $mobile,
        string $expectedReceptor,
    ): void {
        config()->set('services.kavenegar.use_http', true);

        Http::fake([
            '*' => Http::response([
                'return' => [
                    'status' => 200,
                    'message' => 'تایید شد',
                ],
                'entries' => [[
                    'messageid' => 123456,
                    'receptor' => $expectedReceptor,
                    'message' => 'Login code: 2565',
                ]],
            ]),
        ]);

        $setting = new SmsSetting;
        $setting->credentials = ['sender' => '10004346'];

        $result = $this->provider()->send($setting, $mobile, 'Login code: 2565');

        $this->assertTrue($result['ok']);
        Http::assertSent(function ($request) use ($expectedReceptor): bool {
            parse_str($request->body(), $body);

            return ($body['receptor'] ?? null) === $expectedReceptor;
        });
    }

    public static function internationalReceptorProvider(): array
    {
        return [
            'canonical UK number' => ['447868192616', '00447868192616'],
            'UK number with plus' => ['+447868192616', '00447868192616'],
            'UK number with international access prefix' => ['00447868192616', '00447868192616'],
            'Germany' => ['4915123456789', '004915123456789'],
            'France' => ['33612345678', '0033612345678'],
            'Netherlands' => ['31612345678', '0031612345678'],
            'Austria' => ['436641234567', '00436641234567'],
            'Switzerland' => ['41791234567', '0041791234567'],
            'Italy' => ['393201234567', '00393201234567'],
            'Spain' => ['34612345678', '0034612345678'],
            'Sweden' => ['46701234567', '0046701234567'],
            'Poland' => ['48512345678', '0048512345678'],
            'United States' => ['12025550123', '0012025550123'],
            'Saudi Arabia' => ['966512345678', '00966512345678'],
            'canonical Qatar number from Kavenegar documentation' => ['974211234565', '00974211234565'],
        ];
    }

    private function provider(): KavenegarSmsProvider
    {
        return new class extends KavenegarSmsProvider
        {
            protected function apiKey(): string
            {
                return 'test-api-key';
            }

            protected function sandboxEnabled(): bool
            {
                return false;
            }
        };
    }
}
