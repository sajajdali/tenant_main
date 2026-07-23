<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\OpenAiDietClient;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class OpenAiDietClientProxyTest extends TestCase
{
    public function test_it_applies_configured_socks_proxy_to_openai_requests(): void
    {
        $capturedOptions = [];

        Http::fake(function ($request, array $options) use (&$capturedOptions) {
            $capturedOptions = $options;

            return Http::response([
                'choices' => [
                    [
                        'message' => [
                            'content' => '{"ok":true}',
                        ],
                    ],
                ],
                'usage' => [
                    'prompt_tokens' => 10,
                    'completion_tokens' => 5,
                    'total_tokens' => 15,
                ],
            ]);
        });

        app(OpenAiDietClient::class)->generateStructuredDiet(
            [
                'model' => 'gpt-4.1-mini',
                'api_key' => 'sk-test',
                'base_url' => 'https://api.openai.com/v1/chat/completions',
                'timeout_seconds' => 300,
                'proxy_enabled' => true,
                'proxy_url' => 'socks5h://sajjad:Sajjad%4016022@5.202.47.241:45888',
            ],
            [
                ['role' => 'user', 'content' => 'test'],
            ],
            [
                'type' => 'object',
                'properties' => [
                    'ok' => ['type' => 'boolean'],
                ],
                'required' => ['ok'],
                'additionalProperties' => false,
            ],
        );

        $this->assertSame('socks5h://sajjad:Sajjad%4016022@5.202.47.241:45888', $capturedOptions['proxy'] ?? null);
        $this->assertSame('socks5h://sajjad:Sajjad%4016022@5.202.47.241:45888', $capturedOptions['curl'][CURLOPT_PROXY] ?? null);
        $this->assertSame(300, $capturedOptions['connect_timeout'] ?? null);
        $this->assertSame(300, $capturedOptions['timeout'] ?? null);

        if (defined('CURLPROXY_SOCKS5_HOSTNAME')) {
            $this->assertSame(CURLPROXY_SOCKS5_HOSTNAME, $capturedOptions['curl'][CURLOPT_PROXYTYPE] ?? null);
        }

        Http::assertSent(fn ($request): bool => $request->url() === 'https://api.openai.com/v1/chat/completions');
    }

    public function test_it_does_not_apply_proxy_when_disabled(): void
    {
        $capturedOptions = [];

        Http::fake(function ($request, array $options) use (&$capturedOptions) {
            $capturedOptions = $options;

            return Http::response([
                'choices' => [
                    [
                        'message' => [
                            'content' => '{"ok":true}',
                        ],
                    ],
                ],
                'usage' => [
                    'prompt_tokens' => 10,
                    'completion_tokens' => 5,
                    'total_tokens' => 15,
                ],
            ]);
        });

        app(OpenAiDietClient::class)->generateStructuredDiet(
            [
                'model' => 'gpt-4.1-mini',
                'api_key' => 'sk-test',
                'base_url' => 'https://api.openai.com/v1/chat/completions',
                'proxy_enabled' => false,
                'proxy_url' => 'socks5h://127.0.0.1:1080',
            ],
            [
                ['role' => 'user', 'content' => 'test'],
            ],
            [
                'type' => 'object',
                'properties' => [
                    'ok' => ['type' => 'boolean'],
                ],
                'required' => ['ok'],
                'additionalProperties' => false,
            ],
        );

        $this->assertArrayNotHasKey('proxy', $capturedOptions);
        $this->assertArrayNotHasKey(CURLOPT_PROXY, $capturedOptions['curl'] ?? []);
        $this->assertArrayNotHasKey(CURLOPT_PROXYTYPE, $capturedOptions['curl'] ?? []);
    }

    public function test_it_treats_proxy_without_scheme_as_socks5h(): void
    {
        $capturedOptions = [];

        Http::fake(function ($request, array $options) use (&$capturedOptions) {
            $capturedOptions = $options;

            return Http::response([
                'choices' => [
                    [
                        'message' => [
                            'content' => '{"ok":true}',
                        ],
                    ],
                ],
                'usage' => [
                    'prompt_tokens' => 10,
                    'completion_tokens' => 5,
                    'total_tokens' => 15,
                ],
            ]);
        });

        app(OpenAiDietClient::class)->generateStructuredDiet(
            [
                'model' => 'gpt-4.1-mini',
                'api_key' => 'sk-test',
                'base_url' => 'https://api.openai.com/v1/chat/completions',
                'proxy_enabled' => true,
                'proxy_url' => '127.0.0.1:1080',
            ],
            [
                ['role' => 'user', 'content' => 'test'],
            ],
            [
                'type' => 'object',
                'properties' => [
                    'ok' => ['type' => 'boolean'],
                ],
                'required' => ['ok'],
                'additionalProperties' => false,
            ],
        );

        $this->assertSame('socks5h://127.0.0.1:1080', $capturedOptions['proxy'] ?? null);
        $this->assertSame('socks5h://127.0.0.1:1080', $capturedOptions['curl'][CURLOPT_PROXY] ?? null);

        if (defined('CURLPROXY_SOCKS5_HOSTNAME')) {
            $this->assertSame(CURLPROXY_SOCKS5_HOSTNAME, $capturedOptions['curl'][CURLOPT_PROXYTYPE] ?? null);
        }
    }

    public function test_it_retries_without_temperature_when_model_rejects_custom_temperature(): void
    {
        $payloads = [];

        Http::fake(function ($request) use (&$payloads) {
            $payloads[] = $request->data();

            if (count($payloads) === 1) {
                return Http::response([
                    'error' => [
                        'message' => "Unsupported value: 'temperature' does not support 0.2 with this model. Only the default (1) value is supported.",
                        'type' => 'invalid_request_error',
                        'param' => 'temperature',
                        'code' => 'unsupported_value',
                    ],
                ], 400);
            }

            return Http::response([
                'choices' => [
                    [
                        'message' => [
                            'content' => '{"ok":true}',
                        ],
                    ],
                ],
                'usage' => [
                    'prompt_tokens' => 10,
                    'completion_tokens' => 5,
                    'total_tokens' => 15,
                ],
            ]);
        });

        $result = app(OpenAiDietClient::class)->generateStructuredDiet(
            [
                'model' => 'gpt-5-mini',
                'api_key' => 'sk-test',
                'base_url' => 'https://api.openai.com/v1/chat/completions',
                'temperature' => 0.2,
            ],
            [
                ['role' => 'user', 'content' => 'test'],
            ],
            [
                'type' => 'object',
                'properties' => [
                    'ok' => ['type' => 'boolean'],
                ],
                'required' => ['ok'],
                'additionalProperties' => false,
            ],
        );

        $this->assertTrue($result['content']['ok']);
        $this->assertCount(2, $payloads);
        $this->assertArrayHasKey('temperature', $payloads[0]);
        $this->assertArrayNotHasKey('temperature', $payloads[1]);
    }
}
