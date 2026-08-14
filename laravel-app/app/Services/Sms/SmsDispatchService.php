<?php

declare(strict_types=1);

namespace App\Services\Sms;

use App\Domain\Tenant\Models\SmsOutbound;
use App\Domain\Tenant\Models\SmsSetting;
use App\Domain\Tenant\Models\GeneralSetting;
use App\Jobs\SendSmsOutboundJob;
use App\Support\SmsPricing;
use App\Support\SmsQueue;
use Illuminate\Support\Arr;
use Throwable;

class SmsDispatchService
{
    public function __construct(
        private readonly SmsProviderManager $providers,
        private readonly SmsCreditService $credits,
        private readonly SmsBalanceAlertService $balanceAlerts,
    ) {}

    public function queue(array $payload): SmsOutbound
    {
        $message = SmsPricing::normalizeMessage($this->withAndroidWebAppUrl((string) ($payload['message'] ?? '')));
        $validationError = SmsPricing::validationError($message);

        if ($validationError !== null) {
            throw new \InvalidArgumentException($validationError);
        }

        $mobile = $this->normalizeMobile((string) ($payload['recipient_mobile'] ?? ''));

        if ($mobile === null) {
            throw new \InvalidArgumentException('شماره گیرنده پیام معتبر نمی‌باشد.');
        }

        $pricing = SmsPricing::analyze($message);

        return SmsOutbound::query()->create([
            'campaign_id' => $payload['campaign_id'] ?? null,
            'type' => (string) ($payload['type'] ?? 'manual'),
            'template_key' => Arr::get($payload, 'template_key'),
            'provider' => Arr::get($payload, 'provider'),
            'sender' => Arr::get($payload, 'sender'),
            'recipient_mobile' => $mobile,
            'recipient_name' => Arr::get($payload, 'recipient_name'),
            'message' => $message,
            'message_encoding' => $pricing['encoding'],
            'parts_count' => $pricing['parts_count'],
            'unit_price' => $pricing['unit_price'],
            'total_price' => $pricing['total_price'],
            'status' => (string) ($payload['status'] ?? 'pending'),
            'provider_message_id' => null,
            'error_message' => null,
            'sent_at' => null,
        ]);
    }

    /**
     * Replaces only links generated for this tenant/application. External links
     * intentionally remain untouched when an administrator has used them in a template.
     */
    private function withAndroidWebAppUrl(string $message): string
    {
        $rules = GeneralSetting::query()->value('booking_rules') ?? [];
        $androidApp = is_array($rules['android_app'] ?? null) ? $rules['android_app'] : [];
        $configuredUrl = trim((string) ($androidApp['web_app_url'] ?? ''));

        if (! ($androidApp['enabled'] ?? false) || $configuredUrl === '' || filter_var($configuredUrl, FILTER_VALIDATE_URL) === false) {
            return $message;
        }

        $defaultHost = parse_url(url('/'), PHP_URL_HOST);
        $tenantHost = tenant()?->domains()->value('domain');
        $tenantHost = is_string($tenantHost) ? parse_url(str_contains($tenantHost, '://') ? $tenantHost : 'https://'.$tenantHost, PHP_URL_HOST) : null;
        $systemHosts = array_filter([$defaultHost, $tenantHost], static fn ($host): bool => is_string($host) && $host !== '');
        $configuredBase = rtrim($configuredUrl, '/');

        if ($systemHosts === [] || $configuredBase === '') {
            return $message;
        }

        return (string) preg_replace_callback('/https?:\/\/[^\s<>"\']+/u', function (array $match) use ($systemHosts, $configuredBase): string {
            $candidate = $match[0];
            $suffix = '';

            while ($candidate !== '' && preg_match('/[.,،؛!?]$/u', $candidate) === 1) {
                $suffix = mb_substr($candidate, -1).$suffix;
                $candidate = mb_substr($candidate, 0, -1);
            }

            if (! in_array(parse_url($candidate, PHP_URL_HOST), $systemHosts, true)) {
                return $match[0];
            }

            $path = (string) (parse_url($candidate, PHP_URL_PATH) ?? '');
            $query = parse_url($candidate, PHP_URL_QUERY);
            $fragment = parse_url($candidate, PHP_URL_FRAGMENT);

            return $configuredBase.$path
                . (is_string($query) && $query !== '' ? '?'.$query : '')
                . (is_string($fragment) && $fragment !== '' ? '#'.$fragment : '')
                . $suffix;
        }, $message);
    }

    public function dispatchNow(SmsSetting $setting, array $payload): array
    {
        $resolvedProvider = (string) ($payload['provider'] ?? $setting->provider);
        $resolvedSender = $payload['sender'] ?? ($setting->credentials['sender'] ?? null);

        $outbound = $this->queue([
            ...$payload,
            'provider' => $resolvedProvider,
            'sender' => $resolvedSender,
        ]);

        return $this->sendOutbound($outbound, $setting, [
            'provider' => $resolvedProvider,
            'sender' => $resolvedSender,
            'allow_negative_balance' => (bool) ($payload['allow_negative_balance'] ?? false),
        ]);
    }

    public function dispatchQueued(SmsSetting $setting, array $payload): SmsOutbound
    {
        $resolvedProvider = (string) ($payload['provider'] ?? $setting->provider);
        $resolvedSender = $payload['sender'] ?? ($setting->credentials['sender'] ?? null);

        $outbound = $this->queue([
            ...$payload,
            'provider' => $resolvedProvider,
            'sender' => $resolvedSender,
        ]);

        SendSmsOutboundJob::dispatch(
            (string) tenant('id'),
            (int) $outbound->id,
            (bool) ($payload['allow_negative_balance'] ?? false),
            (string) ($payload['queue'] ?? SmsQueue::TRANSACTIONAL),
        );

        return $outbound;
    }

    public function dispatchManyNow(SmsSetting $setting, array $payloads, string $message, array $context = []): array
    {
        $message = SmsPricing::normalizeMessage($this->withAndroidWebAppUrl($message));
        $validationError = SmsPricing::validationError($message);
        $resolvedProvider = (string) ($context['provider'] ?? $setting->provider);
        $resolvedSender = $context['sender'] ?? ($setting->credentials['sender'] ?? null);

        if ($validationError !== null) {
            throw new \InvalidArgumentException($validationError);
        }

        $outbounds = [];

        foreach ($payloads as $payload) {
            $outbounds[] = $this->queue([
                'campaign_id' => $context['campaign_id'] ?? null,
                'type' => $context['type'] ?? 'manual',
                'template_key' => $context['template_key'] ?? null,
                'provider' => $resolvedProvider,
                'sender' => $resolvedSender,
                'recipient_mobile' => $payload['recipient_mobile'] ?? '',
                'recipient_name' => $payload['recipient_name'] ?? null,
                'message' => $message,
                'status' => $context['status'] ?? 'pending',
            ]);
        }

        $allowNegative = (bool) ($context['allow_negative_balance'] ?? false);

        if ((! $setting->enabled && ! $allowNegative) || $resolvedProvider === '') {
            foreach ($outbounds as $outbound) {
                $outbound->update([
                    'provider' => $resolvedProvider,
                    'sender' => (string) ($resolvedSender ?? ''),
                    'status' => 'failed',
                    'error_message' => 'سرویس پیامک فعال یا پیکربندی نشده است.',
                ]);
            }

            return [
                'ok' => false,
                'message' => 'سرویس پیامک فعال یا پیکربندی نشده است.',
                'outbounds' => array_map(fn (SmsOutbound $item) => $item->fresh(), $outbounds),
            ];
        }

        $sendableOutbounds = [];
        $blockedOutbounds = [];
        $availableBalance = $this->credits->balance($setting);

        foreach ($outbounds as $outbound) {
            $cost = (int) $outbound->total_price;

            if ($allowNegative || $availableBalance >= $cost) {
                $sendableOutbounds[] = $outbound;
                if (! $allowNegative) {
                    $availableBalance -= $cost;
                }
            } else {
                $blockedOutbounds[] = $outbound;
            }
        }

        foreach ($blockedOutbounds as $outbound) {
            $outbound->update([
                'provider' => $resolvedProvider,
                'sender' => (string) ($resolvedSender ?? ''),
                'status' => 'failed',
                'error_message' => 'شارژ پیامک کافی نیست.',
            ]);
        }

        if ($sendableOutbounds === []) {
            return [
                'ok' => false,
                'message' => 'شارژ پیامک کافی نیست.',
                'entries' => [],
                'outbounds' => array_map(fn (SmsOutbound $item) => $item->fresh(), $outbounds),
            ];
        }

        $mobiles = array_map(fn (SmsOutbound $item): string => $item->recipient_mobile, $sendableOutbounds);

        try {
            $driver = $this->providers->driver($resolvedProvider);
            $result = $driver->sendMany($setting, $mobiles, $message, (string) ($resolvedSender ?? ''));
        } catch (Throwable $exception) {
            $result = [
                'ok' => false,
                'message' => $exception->getMessage(),
                'entries' => [],
            ];
        }

        foreach ($sendableOutbounds as $index => $outbound) {
            $entry = $result['entries'][$index] ?? null;
            $ok = (bool) ($result['ok'] ?? false);

            if ($ok) {
                try {
                    $this->credits->charge($setting->fresh(), $outbound, $allowNegative);
                    if (! $allowNegative) {
                        $this->balanceAlerts->afterSuccessfulCharge($setting->fresh());
                    }
                } catch (Throwable $exception) {
                    $ok = false;
                    $result['message'] = $exception->getMessage();
                    $entry = null;
                }
            }

            $outbound->update([
                'provider' => $resolvedProvider,
                'sender' => $entry['sender'] ?? (string) ($resolvedSender ?? ''),
                'status' => $ok ? 'sent' : 'failed',
                'provider_message_id' => $entry['provider_message_id'] ?? null,
                'error_message' => $ok ? null : (string) ($result['message'] ?? 'ارسال ناموفق بود.'),
                'sent_at' => $ok ? now() : null,
            ]);
        }

        return [
            ...$result,
            'outbounds' => array_map(fn (SmsOutbound $item) => $item->fresh(), $outbounds),
        ];
    }

    public function sendOutbound(SmsOutbound $outbound, SmsSetting $setting, array $context = []): array
    {
        $resolvedProvider = (string) ($context['provider'] ?? $setting->provider);
        $resolvedSender = (string) ($context['sender'] ?? ($setting->credentials['sender'] ?? ''));

        $allowNegative = (bool) ($context['allow_negative_balance'] ?? false);

        if ((! $setting->enabled && ! $allowNegative) || $resolvedProvider === '') {
            $outbound->update([
                'provider' => $resolvedProvider,
                'sender' => $resolvedSender,
                'status' => 'failed',
                'error_message' => 'سرویس پیامک فعال یا پیکربندی نشده است.',
            ]);

            return [
                'ok' => false,
                'message' => 'سرویس پیامک فعال یا پیکربندی نشده است.',
                'outbound' => $outbound->fresh(),
            ];
        }

        if (! $this->credits->canSend($setting, $outbound, $allowNegative)) {
            $outbound->update([
                'provider' => $resolvedProvider,
                'sender' => $resolvedSender,
                'status' => 'failed',
                'error_message' => 'شارژ پیامک کافی نیست.',
            ]);

            return [
                'ok' => false,
                'message' => 'شارژ پیامک کافی نیست.',
                'outbound' => $outbound->fresh(),
            ];
        }

        try {
            $driver = $this->providers->driver($resolvedProvider);
            $result = $driver->send($setting, $outbound->recipient_mobile, $outbound->message);
        } catch (Throwable $exception) {
            $result = [
                'ok' => false,
                'message' => $exception->getMessage(),
            ];
        }

        if (($result['ok'] ?? false) === true) {
            try {
                $this->credits->charge($setting->fresh(), $outbound, $allowNegative);
                if (! $allowNegative) {
                    $this->balanceAlerts->afterSuccessfulCharge($setting->fresh());
                }
            } catch (Throwable $exception) {
                $result = [
                    'ok' => false,
                    'message' => $exception->getMessage(),
                ];
            }
        }

        $outbound->update([
            'provider' => $resolvedProvider,
            'sender' => $resolvedSender,
            'status' => ($result['ok'] ?? false) ? 'sent' : 'failed',
            'provider_message_id' => $result['provider_message_id'] ?? null,
            'error_message' => ($result['ok'] ?? false) ? null : (string) ($result['message'] ?? 'ارسال ناموفق بود.'),
            'sent_at' => ($result['ok'] ?? false) ? now() : null,
        ]);

        return [
            ...$result,
            'outbound' => $outbound->fresh(),
        ];
    }

    public function normalizeMobile(string $mobile): ?string
    {
        $normalized = preg_replace('/[^0-9+]/', '', trim($mobile)) ?? '';

        if ($normalized === '') {
            return null;
        }

        if (str_starts_with($normalized, '+98')) {
            $normalized = '0'.substr($normalized, 3);
        } elseif (str_starts_with($normalized, '0098')) {
            $normalized = '0'.substr($normalized, 4);
        } elseif (str_starts_with($normalized, '98') && strlen($normalized) === 12) {
            $normalized = '0'.substr($normalized, 2);
        } elseif (str_starts_with($normalized, '9') && strlen($normalized) === 10) {
            $normalized = '0'.$normalized;
        } elseif (str_starts_with($normalized, '+')) {
            $normalized = substr($normalized, 1);
        } elseif (str_starts_with($normalized, '00')) {
            $normalized = substr($normalized, 2);
        }

        if (preg_match('/^09\d{9}$/', $normalized) === 1) {
            return $normalized;
        }

        // Non-Iranian numbers arrive from the country-aware login field in
        // canonical E.164 form without the leading plus sign.
        return preg_match('/^[1-9]\d{7,14}$/', $normalized) === 1 ? $normalized : null;
    }
}
