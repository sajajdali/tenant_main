<?php

declare(strict_types=1);

namespace App\Services\Sms\Providers;

use App\Contracts\SmsProvider;
use App\Domain\Tenant\Models\SmsSetting;
use App\Support\SmsGatewaySettings;
use App\Support\TenantSandboxMode;
use Kavenegar\Exceptions\ApiException;
use Kavenegar\Exceptions\HttpException;
use Kavenegar\KavenegarApi;

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
        $apiKey = SmsGatewaySettings::kavenegarApiKey();
        $resolvedSender = trim((string) ($sender ?? ($setting->credentials['sender'] ?? '')));

        if (TenantSandboxMode::smsEnabled(null, SmsGatewaySettings::sandboxEnabled())) {
            return [
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
        }

        if ($apiKey === '') {
            return [
                'ok' => false,
                'message' => 'کلید API کاوه‌نگار ثبت نشده است.',
                'entries' => [],
            ];
        }

        try {
            $api = new KavenegarApi(
                $apiKey,
                (bool) config('services.kavenegar.use_http', false),
            );
            $entries = $api->Send($resolvedSender !== '' ? $resolvedSender : null, $mobiles, $message);
            $normalizedEntries = collect(is_array($entries) ? $entries : [$entries])
                ->filter()
                ->map(fn ($entry): array => [
                    'provider_message_id' => isset($entry->messageid) ? (string) $entry->messageid : null,
                    'sender' => isset($entry->sender) ? (string) $entry->sender : ($resolvedSender !== '' ? $resolvedSender : null),
                    'receptor' => isset($entry->receptor) ? (string) $entry->receptor : null,
                    'message' => isset($entry->message) ? (string) $entry->message : $message,
                ])
                ->values()
                ->all();

            return [
                'ok' => true,
                'message' => 'ارسال شد.',
                'entries' => $normalizedEntries,
            ];
        } catch (ApiException|HttpException $exception) {
            return [
                'ok' => false,
                'message' => $exception->getMessage(),
                'entries' => [],
            ];
        }
    }
}
