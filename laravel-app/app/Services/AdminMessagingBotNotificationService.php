<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Booking\Models\Appointment;
use App\Domain\Booking\Models\Barber;
use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\OnlineChatConversation;
use App\Domain\Tenant\Models\TenantUser;
use App\Models\SystemSetting;
use App\Support\JalaliDate;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AdminMessagingBotNotificationService
{
    private const CHANNELS = ['telegram', 'bale'];
    private const DEFAULT_API_BASE_URLS = [
        'telegram' => 'https://api.telegram.org/bot',
        'bale' => 'https://tapi.bale.ai/bot',
    ];

    public function appointmentBooked(Appointment $appointment, TenantUser $bookedBy): void
    {
        $appointment->loadMissing('professional');

        $text = "نوبت جدید ثبت شد.\n"
            .'ثبت‌کننده: '.($bookedBy->name ?: $bookedBy->mobile).' - '.$bookedBy->mobile."\n"
            .'مشتری: '.(string) $appointment->customer_name_snapshot.' - '.(string) $appointment->customer_phone_snapshot."\n"
            .'بخش: '.(string) $appointment->service_name_snapshot."\n"
            .'مسئول: '.(string) $appointment->professional_name_snapshot."\n"
            .'روز: '.$this->dateLabel($appointment->appointment_date?->toDateString() ?? (string) $appointment->getRawOriginal('appointment_date'))."\n"
            .'ساعت: '.JalaliDate::toPersianDigits(substr((string) $appointment->start_time, 0, 5)).' تا '.JalaliDate::toPersianDigits(substr((string) $appointment->end_time, 0, 5))."\n"
            .'کد نوبت: '.JalaliDate::toPersianDigits((string) $appointment->public_code);

        $replyMarkup = $this->urlKeyboard('مشاهده جزئیات نوبت', url('/s/'.(string) $appointment->public_code));

        foreach ($this->appointmentRecipients($appointment) as $recipient) {
            $this->notifyUser($recipient, $text, $replyMarkup);
        }
    }

    public function customerChatMessage(OnlineChatConversation $conversation, TenantUser $customer, string $body, int $attachmentsCount = 0): void
    {
        $body = trim($body);
        $text = "پیام جدید در چت آنلاین.\n"
            .'کاربر: '.($customer->name ?: 'کاربر').' - '.$customer->mobile;

        if ($body !== '') {
            $text .= "\n\n".mb_substr($body, 0, 1200);
        }

        if ($attachmentsCount > 0) {
            $text .= "\n\nتعداد فایل پیوست: ".JalaliDate::toPersianDigits((string) $attachmentsCount);
        }

        $replyMarkup = $this->urlKeyboard('باز کردن چت در پنل', url('/panel/online-chat?conversation='.(string) $conversation->id));

        foreach ($this->panelRecipients() as $recipient) {
            $this->notifyUser($recipient, $text, $replyMarkup);
        }
    }

    /**
     * @return \Illuminate\Support\Collection<int, TenantUser>
     */
    private function appointmentRecipients(Appointment $appointment): \Illuminate\Support\Collection
    {
        $barberUserId = Barber::query()
            ->whereKey($appointment->professional_id)
            ->value('user_id');

        return TenantUser::query()
            ->where('is_active', true)
            ->whereIn('role', ['admin', 'barber'])
            ->get()
            ->filter(function (TenantUser $user) use ($barberUserId): bool {
                if ($user->role === 'admin') {
                    return true;
                }

                return $barberUserId !== null
                    && (int) $user->id === (int) $barberUserId
                    && Barber::query()
                        ->where('user_id', $user->id)
                        ->where('can_access_panel', true)
                        ->exists();
            })
            ->values();
    }

    /**
     * @return \Illuminate\Support\Collection<int, TenantUser>
     */
    private function panelRecipients(): \Illuminate\Support\Collection
    {
        return TenantUser::query()
            ->where('is_active', true)
            ->whereIn('role', ['admin', 'barber'])
            ->get()
            ->filter(function (TenantUser $user): bool {
                if ($user->role === 'admin') {
                    return true;
                }

                return Barber::query()
                    ->where('user_id', $user->id)
                    ->where('can_access_panel', true)
                    ->exists();
            })
            ->values();
    }

    private function notifyUser(TenantUser $user, string $text, ?array $replyMarkup = null): void
    {
        foreach (self::CHANNELS as $channel) {
            $settings = $this->channelSettings($channel);
            $token = $this->token($settings);
            $chatId = (string) Cache::get($this->userChatKey($channel, (int) $user->id), '');

            if ($chatId === '' || $token === '') {
                continue;
            }

            $payload = [
                'chat_id' => $chatId,
                'text' => $text,
            ];

            if ($replyMarkup !== null) {
                $payload['reply_markup'] = $replyMarkup;
            }

            try {
                $this->botHttpClient($channel, 10)->post($this->botApiUrl($channel, $settings, $token, 'sendMessage'), $payload);
            } catch (\Throwable $exception) {
                Log::warning('Admin messaging bot notification failed.', [
                    'tenant_id' => tenant('id'),
                    'channel' => $channel,
                    'tenant_user_id' => $user->id,
                    'error' => $exception->getMessage(),
                ]);
            }
        }
    }

    private function urlKeyboard(string $label, string $url): array
    {
        return [
            'inline_keyboard' => [
                [
                    ['text' => $label, 'url' => $url],
                ],
            ],
        ];
    }

    private function dateLabel(string $date): string
    {
        if ($date === '') {
            return '—';
        }

        return JalaliDate::format($date);
    }

    private function token(array $settings): string
    {
        $token = (string) ($settings['token'] ?? '');

        if ($token === '') {
            return '';
        }

        try {
            return Crypt::decryptString($token);
        } catch (\Throwable) {
            return '';
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function channelSettings(string $channel): array
    {
        $bookingRules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $bots = is_array($bookingRules['messaging_bots'] ?? null) ? $bookingRules['messaging_bots'] : [];
        $settings = is_array($bots[$channel] ?? null) ? $bots[$channel] : [];

        return (bool) ($settings['enabled'] ?? false) ? $settings : [];
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

    private function botApiUrl(string $channel, array $settings, string $token, string $method): string
    {
        $baseUrl = rtrim(trim((string) ($settings['api_base_url'] ?? '')), '/');

        if ($baseUrl === '') {
            $baseUrl = self::DEFAULT_API_BASE_URLS[$channel];
        }

        return $baseUrl.$token.'/'.$method;
    }

    private function userChatKey(string $channel, int $userId): string
    {
        if ($channel === 'telegram') {
            return sprintf('tenant:%s:telegram-user-chat:%s', (string) tenant('id'), $userId);
        }

        return sprintf('tenant:%s:%s-user-chat:%s', (string) tenant('id'), $channel, $userId);
    }
}
