<?php

declare(strict_types=1);

namespace App\Services\Payments;

use App\Models\SystemSetting;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class MaliartPaymentClient
{
    public static function amountAsToman(int $amount, ?string $currency): int
    {
        $normalizedCurrency = strtoupper(trim((string) $currency));

        return in_array($normalizedCurrency, ['IRR', 'R', 'RIAL'], true)
            ? (int) floor($amount / 10)
            : $amount;
    }

    public function enabled(): bool
    {
        $settings = SystemSetting::getValue('maliart_payment', []);

        return array_key_exists('enabled', $settings)
            ? (bool) $settings['enabled']
            : (bool) config('services.maliart_payment.enabled', false);
    }

    public function create(array $payload): array
    {
        return $this->request('POST', '/payment.php?action=create', $payload);
    }

    public function status(string $paymentId): array
    {
        return $this->request('GET', '/payment.php?action=status&payment_id='.rawurlencode($paymentId));
    }

    private function request(string $method, string $uri, ?array $payload = null): array
    {
        $baseUrl = rtrim((string) config('services.maliart_payment.base_url'), '/');

        if ($baseUrl === '') {
            throw new RuntimeException(__('payment.sms_top_up.maliart_not_configured'));
        }

        $body = $payload === null
            ? ''
            : json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $method = strtoupper($method);

        try {
            $request = $this->http()->acceptJson();

            $response = $body === ''
                ? $request->send($method, $baseUrl.$uri)
                : $request->withBody($body, 'application/json')->send($method, $baseUrl.$uri);
        } catch (ConnectionException $exception) {
            throw new RuntimeException(__('payment.sms_top_up.maliart_unreachable'), previous: $exception);
        }

        $decoded = $response->json();
        if (! $response->successful() || ! is_array($decoded) || ($decoded['success'] ?? false) !== true || ! is_array($decoded['data'] ?? null)) {
            $message = is_array($decoded) ? trim((string) ($decoded['message'] ?? '')) : '';
            throw new RuntimeException($message !== '' ? $message : __('payment.sms_top_up.maliart_invalid_response'));
        }

        return $decoded['data'];
    }

    private function http(): PendingRequest
    {
        return Http::timeout(max(5, (int) config('services.maliart_payment.timeout_seconds', 20)))
            ->connectTimeout(5)
            ->retry(2, 250, throw: false);
    }
}
