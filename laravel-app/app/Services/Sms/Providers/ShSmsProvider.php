<?php

declare(strict_types=1);

namespace App\Services\Sms\Providers;

use App\Contracts\SmsProvider;
use App\Domain\Tenant\Models\SmsSetting;
use App\Support\SmsGatewaySettings;
use App\Support\TenantSandboxMode;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;
use Throwable;

class ShSmsProvider implements SmsProvider
{
    public function supports(string $provider): bool
    {
        return $provider === 'shsms';
    }

    public function send(SmsSetting $setting, string $mobile, string $message, array $context = []): array
    {
        $template = trim((string) ($context['provider_template'] ?? ''));
        $params = array_values(array_map(
            fn (mixed $value): string => $this->normalizeTemplateParam((string) $value),
            is_array($context['provider_params'] ?? null) ? $context['provider_params'] : [],
        ));

        if ($template === '') {
            throw new InvalidArgumentException('نام قالب SHSMS برای این پیام ثبت نشده است.');
        }

        if (count($params) > 10) {
            throw new InvalidArgumentException('تعداد پارامترهای قالب SHSMS بیشتر از حد مجاز است.');
        }

        if (TenantSandboxMode::smsEnabled(null, SmsGatewaySettings::sandboxEnabled())) {
            return [
                'ok' => true,
                'provider_message_id' => 'shsms-sandbox-'.now()->timestamp,
                'message' => 'ارسال سندباکس SHSMS انجام شد.',
            ];
        }

        $apiKey = SmsGatewaySettings::shSmsApiKey();

        if ($apiKey === '') {
            return ['ok' => false, 'provider_message_id' => null, 'message' => 'کلید API سرویس SHSMS ثبت نشده است.'];
        }

        try {
            $response = Http::withHeaders(['X-API-Key' => $apiKey])
                ->acceptJson()
                ->asJson()
                ->connectTimeout(5)
                ->timeout(15)
                ->post(SmsGatewaySettings::shSmsBaseUrl().'/sms/send', [
                    'receptor' => $mobile,
                    'template' => $template,
                    'param' => $params,
                ]);

            $ok = $response->successful();
            $providerMessage = trim((string) $response->json('message', ''));

            if (! $ok) {
                Log::warning('SHSMS template request rejected.', [
                    'tenant_id' => function_exists('tenant') ? tenant('id') : null,
                    'event' => 'shsms.response',
                    'http_status' => $response->status(),
                    'template' => $template,
                    'recipient' => $mobile,
                    'provider_message' => $providerMessage,
                ]);
            }

            return [
                'ok' => $ok,
                'provider_message_id' => $response->json('id') ?? $response->json('message_id'),
                'message' => $providerMessage !== '' ? $providerMessage : ($ok ? 'ارسال شد.' : 'ارسال SHSMS ناموفق بود.'),
            ];
        } catch (Throwable $exception) {
            Log::error('Unexpected SHSMS failure.', [
                'tenant_id' => function_exists('tenant') ? tenant('id') : null,
                'event' => 'shsms.response',
                'template' => $template,
                'recipient' => $mobile,
                'exception_class' => $exception::class,
                'provider_message' => $exception->getMessage(),
            ]);

            throw $exception;
        }
    }

    public function sendMany(SmsSetting $setting, array $mobiles, string $message, ?string $sender = null, array $context = []): array
    {
        $entries = [];

        foreach ($mobiles as $mobile) {
            $result = $this->send($setting, (string) $mobile, $message, $context);

            if (! ($result['ok'] ?? false)) {
                return ['ok' => false, 'message' => $result['message'] ?? 'ارسال SHSMS ناموفق بود.', 'entries' => $entries];
            }

            $entries[] = [
                'provider_message_id' => $result['provider_message_id'] ?? null,
                'sender' => null,
                'receptor' => $mobile,
                'message' => $message,
            ];
        }

        return ['ok' => true, 'message' => 'ارسال شد.', 'entries' => $entries];
    }

    private function normalizeTemplateParam(string $value): string
    {
        $value = trim($value);
        $value = preg_replace('/\s+/u', '‌', $value) ?? $value;

        return mb_substr($value, 0, 200);
    }
}
