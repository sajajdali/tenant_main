<?php

declare(strict_types=1);

namespace App\Services\Sms\Providers;

use App\Contracts\SmsProvider;
use App\Domain\Tenant\Models\SmsSetting;
use App\Support\SmsGatewaySettings;
use App\Support\TenantSandboxMode;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class KavenegarSmsProvider implements SmsProvider
{
    public function supports(string $provider): bool
    {
        return $provider === 'kavenegar';
    }

    public function send(SmsSetting $setting, string $mobile, string $message): array
    {
        $result = $this->sendMany($setting, [$mobile], $message);
        $firstEntry = $result['entries'][0] ?? null;

        return [
            'ok' => (bool) ($result['ok'] ?? false),
            'provider_message_id' => $firstEntry['provider_message_id'] ?? null,
            'message' => (string) ($result['message'] ?? ''),
            'entry' => $firstEntry,
        ];
    }

    public function sendMany(SmsSetting $setting, array $mobiles, string $message, ?string $sender = null): array
    {
        $apiKey = $this->apiKey();
        $resolvedSender = trim((string) ($sender ?? ($setting->credentials['sender'] ?? '')));
        $sandboxEnabled = $this->sandboxEnabled();
        $providerMobiles = array_map(
            fn (string $mobile): string => $this->formatReceptor($mobile),
            $mobiles,
        );
        $logContext = [
            'tenant_id' => function_exists('tenant') ? tenant('id') : null,
            'recipients' => array_values($mobiles),
            'provider_recipients' => $providerMobiles,
            'recipient_count' => count($mobiles),
            'sender' => $resolvedSender !== '' ? $resolvedSender : null,
            'sandbox' => $sandboxEnabled,
            'transport' => (bool) config('services.kavenegar.use_http', false) ? 'http' : 'https',
        ];

        Log::debug('Kavenegar SMS request prepared.', [
            ...$logContext,
            'event' => 'kavenegar.request',
            'message_length' => mb_strlen($message),
        ]);

        if ($sandboxEnabled) {
            $result = [
                'ok' => true,
                'message' => 'ارسال سندباکس انجام شد.',
                'entries' => collect($mobiles)
                    ->values()
                    ->map(fn (string $mobile, int $index): array => [
                        'provider_message_id' => 'sandbox-'.now()->timestamp.'-'.($index + 1),
                        'sender' => $resolvedSender !== '' ? $resolvedSender : null,
                        'receptor' => $mobile,
                        'message' => $message,
                    ])
                    ->all(),
            ];

            return $result;
        }

        if ($apiKey === '') {
            $result = [
                'ok' => false,
                'message' => 'کلید API کاوه‌نگار ثبت نشده است.',
                'entries' => [],
            ];

            return $result;
        }

        try {
            $transport = (bool) config('services.kavenegar.use_http', true) ? 'http' : 'https';
            $connectTimeout = max(1, (int) config('services.kavenegar.connect_timeout_seconds', 5));
            $timeout = max($connectTimeout, (int) config('services.kavenegar.timeout_seconds', 15));
            $url = sprintf(
                '%s://api.kavenegar.com/v1/%s/sms/send.json',
                $transport,
                rawurlencode($apiKey),
            );

            $response = Http::asForm()
                ->acceptJson()
                ->connectTimeout($connectTimeout)
                ->timeout($timeout)
                ->post($url, [
                    'receptor' => implode(',', $providerMobiles),
                    'sender' => $resolvedSender !== '' ? $resolvedSender : null,
                    'message' => $message,
                ]);

            $providerStatus = (int) $response->json('return.status', $response->status());
            $providerMessage = trim((string) $response->json('return.message', ''));
            $entries = $response->json('entries', []);
            $rawResponseEntries = collect(is_array($entries) ? $entries : [])
                ->filter()
                ->map(fn ($entry): array => is_array($entry) ? $entry : (array) $entry)
                ->values()
                ->all();

            if (! $response->successful() || $providerStatus !== 200) {
                $result = [
                    'ok' => false,
                    'message' => $providerMessage !== '' ? $providerMessage : __('api.auth.sms_provider_invalid_response'),
                    'entries' => [],
                ];

                Log::error('Kavenegar SMS response rejected.', [
                    ...$logContext,
                    'event' => 'kavenegar.response',
                    'ok' => false,
                    'http_status' => $response->status(),
                    'provider_status' => $providerStatus,
                    'provider_message' => $result['message'],
                    'response_entries' => $rawResponseEntries,
                ]);

                return $result;
            }

            $normalizedEntries = collect($rawResponseEntries)
                ->filter()
                ->map(fn ($entry): array => [
                    'provider_message_id' => isset($entry['messageid']) ? (string) $entry['messageid'] : null,
                    'sender' => isset($entry['sender']) ? (string) $entry['sender'] : ($resolvedSender !== '' ? $resolvedSender : null),
                    'receptor' => isset($entry['receptor']) ? (string) $entry['receptor'] : null,
                    'message' => isset($entry['message']) ? (string) $entry['message'] : $message,
                ])
                ->values()
                ->all();

            $result = [
                'ok' => true,
                'message' => 'ارسال شد.',
                'entries' => $normalizedEntries,
            ];

            return $result;
        } catch (Throwable $exception) {
            Log::error('Unexpected Kavenegar SMS failure.', [
                ...$logContext,
                'event' => 'kavenegar.response',
                'ok' => false,
                'provider_status' => $exception->getCode(),
                'provider_message' => $exception->getMessage(),
                'exception_class' => $exception::class,
            ]);
            throw $exception;
        }
    }

    protected function apiKey(): string
    {
        return SmsGatewaySettings::kavenegarApiKey();
    }

    protected function sandboxEnabled(): bool
    {
        return TenantSandboxMode::smsEnabled(null, SmsGatewaySettings::sandboxEnabled());
    }

    private function formatReceptor(string $mobile): string
    {
        $trimmed = trim($mobile);
        $hasInternationalPlus = str_starts_with($trimmed, '+');
        $digits = preg_replace('/\D+/', '', $trimmed) ?? '';

        if ($digits === '' || str_starts_with($digits, '00')) {
            return $digits;
        }

        if ($hasInternationalPlus) {
            return '00'.$digits;
        }

        if (preg_match('/^0?9\d{9}$/', $digits) === 1) {
            return $digits;
        }

        // The login UI stores every non-Iranian number in canonical E.164
        // digits. Kavenegar requires international receptors to use the
        // international access prefix (00) followed by the country code.
        return preg_match('/^[1-9]\d{7,14}$/', $digits) === 1
            ? '00'.$digits
            : $digits;
    }
}
