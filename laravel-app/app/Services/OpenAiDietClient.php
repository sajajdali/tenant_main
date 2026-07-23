<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class OpenAiDietClient
{
    private const MIN_SAFE_TIMEOUT_SECONDS = 240;
    private const CONNECT_TIMEOUT_SECONDS = 30;
    private const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

    /**
     * @param  array<int, array<string, mixed>>  $messages
     * @param  array<string, mixed>  $schema
     * @return array{
     *   raw: array<string, mixed>,
     *   content: array<string, mixed>,
     *   usage: array{promptTokens: int, completionTokens: int, totalTokens: int}
     * }
     */
    public function generateStructuredDiet(array $settings, array $messages, array $schema): array
    {
        $endpoint = $this->resolveEndpoint((string) ($settings['base_url'] ?? self::DEFAULT_ENDPOINT));
        $timeoutSeconds = max(self::MIN_SAFE_TIMEOUT_SECONDS, (int) ($settings['timeout_seconds'] ?? self::MIN_SAFE_TIMEOUT_SECONDS));
        $this->extendExecutionTime($timeoutSeconds);
        $payload = [
            'model' => (string) $settings['model'],
            'temperature' => (float) ($settings['temperature'] ?? 0.3),
            'messages' => $messages,
            'response_format' => [
                'type' => 'json_schema',
                'json_schema' => [
                    'name' => 'nutrition_diet_prescription',
                    'strict' => true,
                    'schema' => $schema,
                ],
            ],
        ];

        $proxyUrl = $this->effectiveProxyUrl($settings);

        $request = Http::acceptJson()
            ->withHeaders([
                'Connection' => 'close',
                'Expect' => '',
            ])
            ->connectTimeout($this->connectTimeoutSeconds($timeoutSeconds))
            ->timeout($timeoutSeconds)
            ->withOptions($this->openAiTransportOptions($settings));

        $apiKey = trim((string) ($settings['api_key'] ?? ''));

        if ($apiKey !== '') {
            $request = $request->withToken($apiKey);
        }

        try {
            $response = $request
                ->acceptJson()
                ->post($endpoint, $payload);
        } catch (Throwable $exception) {
            $this->logTransportFailure($endpoint, $apiKey, $payload, $exception, $proxyUrl);

            throw $exception;
        }

        if (! $response->successful()) {
            if ($this->isUnsupportedTemperatureResponse($response->status(), (string) $response->body()) && array_key_exists('temperature', $payload)) {
                $retryPayload = $payload;
                unset($retryPayload['temperature']);

                try {
                    $response = $request
                        ->acceptJson()
                        ->post($endpoint, $retryPayload);
                } catch (Throwable $exception) {
                    $this->logTransportFailure($endpoint, $apiKey, $retryPayload, $exception, $proxyUrl);

                    throw $exception;
                }

                if ($response->successful()) {
                    $payload = $retryPayload;
                }
            }
        }

        if (! $response->successful()) {
            $this->logFailedRequest($endpoint, $apiKey, $payload, $response->status(), (string) $response->body(), $response->headers(), $proxyUrl);
            throw new RuntimeException('ارتباط با OpenAI موفق نبود: ' . $response->body());
        }

        /** @var array<string, mixed> $responsePayload */
        $responsePayload = $response->json() ?? [];
        $content = data_get($responsePayload, 'choices.0.message.content');

        if (! is_string($content) || trim($content) === '') {
            $this->logUnexpectedSuccessfulResponse(
                $endpoint,
                $apiKey,
                $payload,
                $response->status(),
                $responsePayload,
                'missing_or_non_string_message_content'
            );
            throw new RuntimeException('OpenAI پاسخی با محتوای معتبر JSON برنگرداند.');
        }

        $decoded = json_decode($content, true);

        if (! is_array($decoded)) {
            $this->logUnexpectedSuccessfulResponse(
                $endpoint,
                $apiKey,
                $payload,
                $response->status(),
                $responsePayload,
                'message_content_is_not_valid_json'
            );
            throw new RuntimeException('JSON خروجی OpenAI قابل پردازش نبود.');
        }

        $usage = [
            'promptTokens' => max(0, (int) data_get($responsePayload, 'usage.prompt_tokens', 0)),
            'completionTokens' => max(0, (int) data_get($responsePayload, 'usage.completion_tokens', 0)),
            'totalTokens' => max(0, (int) data_get($responsePayload, 'usage.total_tokens', 0)),
        ];

        return [
            'raw' => $responsePayload,
            'content' => $decoded,
            'usage' => $usage,
        ];
    }

    private function resolveEndpoint(string $value): string
    {
        $endpoint = trim($value);

        if ($endpoint === '') {
            return self::DEFAULT_ENDPOINT;
        }

        $normalized = rtrim($endpoint, '/');

        if (preg_match('#/v\d+$#', $normalized) === 1) {
            return $normalized . '/chat/completions';
        }

        return $endpoint;
    }

    /**
     * @return array<string, mixed>
     */
    public function openAiTransportOptions(array $settings): array
    {
        $curlOptions = [];

        if (defined('CURLOPT_HTTP_VERSION') && defined('CURL_HTTP_VERSION_1_1')) {
            $curlOptions[CURLOPT_HTTP_VERSION] = CURL_HTTP_VERSION_1_1;
        }

        if (defined('CURLOPT_TCP_KEEPALIVE')) {
            $curlOptions[CURLOPT_TCP_KEEPALIVE] = 1;
        }

        $options = [];
        $proxyUrl = $this->effectiveProxyUrl($settings);

        if ($proxyUrl !== '') {
            $options['proxy'] = $proxyUrl;
            $scheme = strtolower((string) parse_url($proxyUrl, PHP_URL_SCHEME));

            if (defined('CURLOPT_PROXY')) {
                $curlOptions[CURLOPT_PROXY] = $proxyUrl;
            }

            if ($scheme === 'socks5h' && defined('CURLOPT_PROXYTYPE') && defined('CURLPROXY_SOCKS5_HOSTNAME')) {
                $curlOptions[CURLOPT_PROXYTYPE] = CURLPROXY_SOCKS5_HOSTNAME;
            } elseif ($scheme === 'socks5' && defined('CURLOPT_PROXYTYPE') && defined('CURLPROXY_SOCKS5')) {
                $curlOptions[CURLOPT_PROXYTYPE] = CURLPROXY_SOCKS5;
            } elseif ($scheme === 'socks4' && defined('CURLOPT_PROXYTYPE') && defined('CURLPROXY_SOCKS4')) {
                $curlOptions[CURLOPT_PROXYTYPE] = CURLPROXY_SOCKS4;
            }
        }

        if ($curlOptions !== []) {
            $options['curl'] = $curlOptions;
        }

        return $options;
    }

    private function effectiveProxyUrl(array $settings): string
    {
        $proxyUrl = $this->normalizeProxyUrl((string) ($settings['proxy_url'] ?? ''));

        return (bool) ($settings['proxy_enabled'] ?? false) && $proxyUrl !== '' ? $proxyUrl : '';
    }

    private function normalizeProxyUrl(string $proxyUrl): string
    {
        $trimmed = trim($proxyUrl);

        if ($trimmed === '') {
            return '';
        }

        if (preg_match('#^[a-z][a-z0-9+.-]*://#i', $trimmed) === 1) {
            return $trimmed;
        }

        return 'socks5h://' . $trimmed;
    }

    private function isUnsupportedTemperatureResponse(int $status, string $body): bool
    {
        if ($status !== 400) {
            return false;
        }

        $decoded = json_decode($body, true);
        $param = is_array($decoded) ? (string) data_get($decoded, 'error.param', '') : '';
        $code = is_array($decoded) ? (string) data_get($decoded, 'error.code', '') : '';
        $message = is_array($decoded) ? (string) data_get($decoded, 'error.message', '') : $body;

        return $param === 'temperature'
            && ($code === 'unsupported_value' || str_contains(strtolower($message), 'temperature'));
    }

    private function extendExecutionTime(int $timeoutSeconds): void
    {
        $seconds = min(900, max(self::MIN_SAFE_TIMEOUT_SECONDS + 30, $timeoutSeconds + 30));

        if (function_exists('set_time_limit')) {
            @set_time_limit($seconds);
        }

        @ini_set('max_execution_time', (string) $seconds);
    }

    private function connectTimeoutSeconds(int $timeoutSeconds): int
    {
        return max(self::CONNECT_TIMEOUT_SECONDS, $timeoutSeconds);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function logTransportFailure(string $endpoint, string $apiKey, array $payload, Throwable $exception, string $proxyUrl = ''): void
    {
        $headers = [
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
            'Connection' => 'close',
            'Expect' => '',
        ];

        if ($apiKey !== '') {
            $headers['Authorization'] = 'Bearer ' . $apiKey;
        }

        $maskedHeaders = $headers;

        if (isset($maskedHeaders['Authorization'])) {
            $maskedHeaders['Authorization'] = 'Bearer ' . $this->maskSecret($apiKey);
        }

        Log::channel('nutrition_ai')->error('Nutrition AI transport failed', [
            'method' => 'POST',
            'url' => $endpoint,
            'curl' => $this->buildCurlCommand($endpoint, $headers, $payload, $proxyUrl),
            'curl_masked' => $this->buildCurlCommand($endpoint, $maskedHeaders, $payload, $this->maskProxyUrl($proxyUrl)),
            'request_headers' => $maskedHeaders,
            'request_payload' => $payload,
            'proxy_enabled' => $proxyUrl !== '',
            'proxy_url' => $this->maskProxyUrl($proxyUrl),
            'exception_class' => $exception::class,
            'exception_message' => $exception->getMessage(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array<string, array<int, string>>  $responseHeaders
     */
    private function logFailedRequest(string $endpoint, string $apiKey, array $payload, int $status, string $responseBody, array $responseHeaders, string $proxyUrl = ''): void
    {
        $headers = [
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
        ];

        if ($apiKey !== '') {
            $headers['Authorization'] = 'Bearer ' . $apiKey;
        }

        $maskedHeaders = $headers;

        if (isset($maskedHeaders['Authorization'])) {
            $maskedHeaders['Authorization'] = 'Bearer ' . $this->maskSecret($apiKey);
        }

        Log::channel('nutrition_ai')->error('Nutrition AI request failed', [
            'method' => 'POST',
            'url' => $endpoint,
            'curl' => $this->buildCurlCommand($endpoint, $headers, $payload, $proxyUrl),
            'curl_masked' => $this->buildCurlCommand($endpoint, $maskedHeaders, $payload, $this->maskProxyUrl($proxyUrl)),
            'request_headers' => $maskedHeaders,
            'request_payload' => $payload,
            'proxy_enabled' => $proxyUrl !== '',
            'proxy_url' => $this->maskProxyUrl($proxyUrl),
            'response_status' => $status,
            'response_headers' => $responseHeaders,
            'response_body' => $responseBody,
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>  $responsePayload
     */
    private function logUnexpectedSuccessfulResponse(
        string $endpoint,
        string $apiKey,
        array $payload,
        int $status,
        array $responsePayload,
        string $reason
    ): void {
        $headers = [
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
        ];

        if ($apiKey !== '') {
            $headers['Authorization'] = 'Bearer ' . $this->maskSecret($apiKey);
        }

        Log::channel('nutrition_ai')->warning('Nutrition AI response shape was unexpected', [
            'reason' => $reason,
            'method' => 'POST',
            'url' => $endpoint,
            'request_headers' => $headers,
            'request_payload' => $payload,
            'response_status' => $status,
            'response_payload' => $responsePayload,
        ]);
    }

    /**
     * @param  array<string, string>  $headers
     * @param  array<string, mixed>  $payload
     */
    private function buildCurlCommand(string $endpoint, array $headers, array $payload, string $proxyUrl = ''): string
    {
        $parts = ['curl', '--http1.1', '-X', 'POST', escapeshellarg($endpoint)];

        if ($proxyUrl !== '') {
            $parts[] = '--proxy';
            $parts[] = escapeshellarg($proxyUrl);
        }

        foreach ($headers as $name => $value) {
            $parts[] = '-H';
            $parts[] = escapeshellarg($name . ': ' . $value);
        }

        $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $parts[] = '--data';
        $parts[] = escapeshellarg($json === false ? '{}' : $json);

        return implode(' ', $parts);
    }

    private function maskSecret(string $value): string
    {
        $trimmed = trim($value);

        if ($trimmed === '') {
            return '';
        }

        if (strlen($trimmed) <= 8) {
            return '********';
        }

        return substr($trimmed, 0, 4) . str_repeat('*', max(strlen($trimmed) - 8, 4)) . substr($trimmed, -4);
    }

    private function maskProxyUrl(string $proxyUrl): string
    {
        $trimmed = trim($proxyUrl);

        if ($trimmed === '') {
            return '';
        }

        $parts = parse_url($trimmed);

        if (! is_array($parts) || ! isset($parts['user'])) {
            return $trimmed;
        }

        $scheme = isset($parts['scheme']) ? $parts['scheme'] . '://' : '';
        $host = (string) ($parts['host'] ?? '');
        $port = isset($parts['port']) ? ':' . $parts['port'] : '';
        $path = (string) ($parts['path'] ?? '');

        return $scheme . $parts['user'] . ':********@' . $host . $port . $path;
    }
}
