<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\GeneralSetting;
use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;

class MessagingBotSettingsController extends Controller
{
    private const CHANNELS = ['telegram', 'bale'];
    private const DEFAULT_API_BASE_URLS = [
        'telegram' => 'https://api.telegram.org/bot',
        'bale' => 'https://tapi.bale.ai/bot',
    ];

    public function show(Request $request): JsonResponse
    {
        $this->ensurePrimaryAdmin($request);

        return response()->json([
            'success' => true,
            'data' => [
                ...$this->payload(),
                'moduleActive' => true,
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $this->ensurePrimaryAdmin($request);

        $validated = $request->validate([
            'telegram' => ['nullable', 'array'],
            'telegram.enabled' => ['nullable', 'boolean'],
            'telegram.token' => ['nullable', 'string', 'max:255'],
            'telegram.welcome_text' => ['nullable', 'string', 'max:2000'],
            'telegram.remove_welcome_image' => ['nullable', 'boolean'],
            'telegram.welcome_image' => ['nullable', 'file', 'image', 'max:4096'],
            'bale' => ['nullable', 'array'],
            'bale.enabled' => ['nullable', 'boolean'],
            'bale.token' => ['nullable', 'string', 'max:255'],
            'bale.api_base_url' => ['nullable', 'url', 'max:255'],
            'bale.welcome_text' => ['nullable', 'string', 'max:2000'],
            'bale.remove_welcome_image' => ['nullable', 'boolean'],
            'bale.welcome_image' => ['nullable', 'file', 'image', 'max:4096'],
        ]);

        $general = GeneralSetting::query()->firstOrCreate([], [
            'timezone' => 'Asia/Tehran',
            'currency' => 'IRR',
            'booking_rules' => [],
        ]);
        $bookingRules = $general->booking_rules ?? [];
        $settings = is_array($bookingRules['messaging_bots'] ?? null) ? $bookingRules['messaging_bots'] : [];

        foreach (self::CHANNELS as $channel) {
            $current = is_array($settings[$channel] ?? null) ? $settings[$channel] : [];
            $incoming = is_array($validated[$channel] ?? null) ? $validated[$channel] : [];

            if (array_key_exists('enabled', $incoming)) {
                $current['enabled'] = (bool) $incoming['enabled'];
            }

            if (array_key_exists('token', $incoming) && trim((string) $incoming['token']) !== '') {
                $current['token'] = Crypt::encryptString(trim((string) $incoming['token']));
            }

            if (array_key_exists('api_base_url', $incoming)) {
                $current['api_base_url'] = rtrim(trim((string) $incoming['api_base_url']), '/');
            }

            if (array_key_exists('welcome_text', $incoming)) {
                $current['welcome_text'] = trim((string) $incoming['welcome_text']);
            }

            if (! empty($incoming['remove_welcome_image'])) {
                $this->deleteTenantMediaFile($current['welcome_image_path'] ?? null);
                unset($current['welcome_image_path']);
            }

            if ($request->hasFile($channel.'.welcome_image')) {
                $this->deleteTenantMediaFile($current['welcome_image_path'] ?? null);
                /** @var UploadedFile $image */
                $image = $request->file($channel.'.welcome_image');
                $current['welcome_image_path'] = $image->store($channel.'-bot', 'media_public');
                $this->recordTenantMediaFile($current['welcome_image_path'], (int) $image->getSize());
            }

            $settings[$channel] = $current;
        }

        $bookingRules['messaging_bots'] = $settings;
        $general->update(['booking_rules' => $bookingRules]);

        $webhookResults = collect(self::CHANNELS)
            ->mapWithKeys(fn (string $channel) => [$channel => $this->syncWebhook($channel)])
            ->all();
        $message = __('tenant.messaging_bots.saved');
        $attempted = collect($webhookResults)->filter(fn (array $result) => $result['attempted']);
        if ($attempted->isNotEmpty()) {
            $failed = $attempted->filter(fn (array $result) => ! $result['ok'])->keys()->all();
            $message = $failed === []
                ? __('tenant.messaging_bots.saved_with_webhooks')
                : __('tenant.messaging_bots.saved_with_failed_webhooks', [
                    'channels' => implode(__('tenant.messaging_bots.channel_separator'), array_map(fn (string $channel) => $this->channelLabel($channel), $failed)),
                ]);
        }

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => [
                ...$this->payload(),
                'moduleActive' => true,
            ],
        ]);
    }

    public function setWebhook(Request $request, string $channel): JsonResponse
    {
        $this->ensurePrimaryAdmin($request);
        $channel = $this->normalizeChannel($channel);
        $label = $this->channelLabel($channel);

        $token = $this->token($channel);

        if ($token === '') {
            return response()->json([
                'success' => false,
                'message' => __('tenant.messaging_bots.token_required', ['channel' => $label]),
                'data' => $this->webhookPayload($channel, false, __('tenant.messaging_bots.token_missing')),
            ], 422);
        }

        $webhookUrl = $this->webhookUrl($channel);
        $response = $this->botHttpClient($channel, 20)->post($this->botApiUrl($channel, $token, 'setWebhook'), [
            'url' => $webhookUrl,
            'allowed_updates' => ['message', 'callback_query'],
        ]);

        $bot = $response->json();
        $ok = (bool) ($bot['ok'] ?? false);
        $message = $ok
            ? __('tenant.messaging_bots.webhook_saved', ['channel' => $label])
            : (string) ($bot['description'] ?? __('tenant.messaging_bots.webhook_failed', ['channel' => $label]));

        return response()->json([
            'success' => $ok,
            'message' => $message,
            'data' => $this->webhookPayload($channel, $ok, $message),
        ], $ok ? 200 : 422);
    }

    public function webhookInfo(Request $request, string $channel): JsonResponse
    {
        $this->ensurePrimaryAdmin($request);
        $channel = $this->normalizeChannel($channel);

        $token = $this->token($channel);

        if ($token === '') {
            return response()->json([
                'success' => true,
                'data' => $this->webhookPayload($channel, false, __('tenant.messaging_bots.token_missing')),
            ]);
        }

        $response = $this->botHttpClient($channel, 15)->get($this->botApiUrl($channel, $token, 'getWebhookInfo'));
        $bot = $response->json();
        $result = is_array($bot['result'] ?? null) ? $bot['result'] : [];
        $configuredUrl = $this->webhookUrl($channel);
        $currentUrl = (string) ($result['url'] ?? '');

        return response()->json([
            'success' => (bool) ($bot['ok'] ?? false),
            'message' => (string) ($bot['description'] ?? ''),
            'data' => [
                'configured' => $currentUrl === $configuredUrl,
                'expectedUrl' => $configuredUrl,
                'currentUrl' => $currentUrl,
                'pendingUpdateCount' => (int) ($result['pending_update_count'] ?? 0),
                'lastErrorDate' => isset($result['last_error_date']) ? (int) $result['last_error_date'] : null,
                'lastErrorMessage' => $result['last_error_message'] ?? null,
                'maxConnections' => isset($result['max_connections']) ? (int) $result['max_connections'] : null,
                'raw' => $result,
            ],
        ]);
    }

    private function payload(): array
    {
        $general = GeneralSetting::query()->first();
        $bookingRules = $general?->booking_rules ?? [];
        $settings = is_array($bookingRules['messaging_bots'] ?? null) ? $bookingRules['messaging_bots'] : [];

        return $this->payloadFromSettings($settings);
    }

    private function payloadFromSettings(array $settings): array
    {
        return [
            'telegram' => $this->channelPayload('telegram', $settings['telegram'] ?? []),
            'bale' => $this->channelPayload('bale', $settings['bale'] ?? []),
        ];
    }

    private function channelPayload(string $channel, array $settings): array
    {
        $token = $this->decryptToken((string) ($settings['token'] ?? ''));

        return [
            'enabled' => (bool) ($settings['enabled'] ?? false),
            'token' => '',
            'tokenConfigured' => $token !== '',
            'tokenMasked' => $this->maskToken($token),
            'apiBaseUrl' => $this->apiBaseUrl($channel, $settings),
            'webhookUrl' => $this->webhookUrl($channel),
            'welcomeText' => (string) ($settings['welcome_text'] ?? ''),
            'welcomeImageUrl' => $this->tenantMediaUrl($settings['welcome_image_path'] ?? null),
        ];
    }

    private function token(string $channel): string
    {
        $general = GeneralSetting::query()->first();
        $bookingRules = $general?->booking_rules ?? [];
        $settings = is_array($bookingRules['messaging_bots'][$channel] ?? null)
            ? $bookingRules['messaging_bots'][$channel]
            : [];

        return $this->decryptToken((string) ($settings['token'] ?? ''));
    }

    private function webhookPayload(string $channel, bool $configured, string $message): array
    {
        return [
            'configured' => $configured,
            'expectedUrl' => $this->webhookUrl($channel),
            'currentUrl' => null,
            'pendingUpdateCount' => 0,
            'lastErrorDate' => null,
            'lastErrorMessage' => $message,
            'maxConnections' => null,
            'raw' => [],
        ];
    }

    /**
     * @return array{attempted: bool, ok: bool, message: string}
     */
    private function syncWebhook(string $channel): array
    {
        $settings = $this->channelSettings($channel);
        $token = $this->token($channel);

        if (! (bool) ($settings['enabled'] ?? false) || $token === '') {
            return [
                'attempted' => false,
                'ok' => false,
                'message' => __('tenant.messaging_bots.token_missing'),
            ];
        }

        $response = $this->botHttpClient($channel, 20)->post($this->botApiUrl($channel, $token, 'setWebhook'), [
            'url' => $this->webhookUrl($channel),
            'allowed_updates' => ['message', 'callback_query'],
        ]);

        $bot = $response->json();
        $ok = (bool) ($bot['ok'] ?? false);
        $label = $this->channelLabel($channel);

        return [
            'attempted' => true,
            'ok' => $ok,
            'message' => $ok
                ? __('tenant.messaging_bots.webhook_saved', ['channel' => $label])
                : (string) ($bot['description'] ?? __('tenant.messaging_bots.webhook_failed', ['channel' => $label])),
        ];
    }

    private function channelLabel(string $channel): string
    {
        return __('tenant.messaging_bots.channels.'.$channel);
    }

    private function botHttpClient(string $channel, int $timeout): PendingRequest
    {
        $client = Http::timeout($timeout);
        $settings = SystemSetting::getValue('telegram_bot', []);
        $socksAddress = trim((string) ($settings['socks_address'] ?? ''));

        if ($channel === 'telegram' && (bool) ($settings['socks_enabled'] ?? false) && $socksAddress !== '') {
            $client = $client->withOptions(['proxy' => $socksAddress]);
        }

        return $client;
    }

    private function botApiUrl(string $channel, string $token, string $method): string
    {
        return $this->apiBaseUrl($channel, $this->channelSettings($channel)).$token.'/'.$method;
    }

    private function apiBaseUrl(string $channel, array $settings): string
    {
        $baseUrl = rtrim(trim((string) ($settings['api_base_url'] ?? '')), '/');

        return $baseUrl !== '' ? $baseUrl : self::DEFAULT_API_BASE_URLS[$channel];
    }

    private function webhookUrl(string $channel): string
    {
        return url("/api/v1/messaging-bots/{$channel}/webhook");
    }

    private function channelSettings(string $channel): array
    {
        $general = GeneralSetting::query()->first();
        $bookingRules = $general?->booking_rules ?? [];
        $bots = is_array($bookingRules['messaging_bots'] ?? null) ? $bookingRules['messaging_bots'] : [];

        return is_array($bots[$channel] ?? null) ? $bots[$channel] : [];
    }

    private function normalizeChannel(string $channel): string
    {
        abort_unless(in_array($channel, self::CHANNELS, true), 404);

        return $channel;
    }

    private function decryptToken(string $token): string
    {
        if ($token === '') {
            return '';
        }

        try {
            return Crypt::decryptString($token);
        } catch (DecryptException) {
            return '';
        }
    }

    private function maskToken(string $token): string
    {
        if ($token === '') {
            return '';
        }

        $visible = mb_substr($token, -4);

        return '••••••••'.$visible;
    }

    private function ensurePrimaryAdmin(Request $request): void
    {
        $actor = $request->user('tenant_web');
        $tenant = tenant();
        $ownerUserId = $tenant?->owner_user_id ? (int) $tenant->owner_user_id : null;

        abort_unless(
            $actor
                && $actor->role === 'admin'
                && $actor->central_user_id !== null
                && $ownerUserId !== null
                && (int) $actor->central_user_id === $ownerUserId,
            403,
            __('authorization.super_admin_only')
        );
    }
}
