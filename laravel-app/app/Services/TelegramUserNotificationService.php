<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Booking\Models\Appointment;
use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\TenantUser;
use App\Models\SystemSetting;
use App\Support\JalaliDate;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramUserNotificationService
{
    private const CHANNELS = ['telegram', 'bale'];
    private const DEFAULT_API_BASE_URLS = [
        'telegram' => 'https://api.telegram.org/bot',
        'bale' => 'https://tapi.bale.ai/bot',
    ];

    public function notifyUser(TenantUser $user, string $text): void
    {
        foreach (self::CHANNELS as $channel) {
            $chatId = (string) Cache::get($this->userChatKey($channel, (int) $user->id), '');
            $token = $this->token($channel);

            if ($chatId === '' || $token === '') {
                continue;
            }

            try {
                $this->botHttpClient($channel, 10)->post($this->botApiUrl($channel, $token, 'sendMessage'), [
                    'chat_id' => $chatId,
                    'text' => $text,
                ]);
            } catch (\Throwable $exception) {
                Log::warning('Messaging bot user notification failed.', [
                    'tenant_id' => tenant('id'),
                    'channel' => $channel,
                    'tenant_user_id' => $user->id,
                    'error' => $exception->getMessage(),
                ]);
            }
        }
    }

    public function notifyMobile(string $mobile, string $text): void
    {
        $user = TenantUser::query()
            ->where('mobile', $mobile)
            ->where('is_active', true)
            ->first();

        if ($user) {
            $this->notifyUser($user, $text);
        }
    }

    public function appointmentBooked(Appointment $appointment): void
    {
        $this->notifyMobile((string) $appointment->customer_phone_snapshot, "نوبت شما ثبت شد.\n".$this->appointmentText($appointment));
    }

    public function appointmentCancelled(Appointment $appointment): void
    {
        $this->notifyMobile((string) $appointment->customer_phone_snapshot, "نوبت شما لغو شد.\n".$this->appointmentText($appointment));
    }

    public function appointmentChanged(Appointment $appointment, string $previousDate, string $previousTime): void
    {
        $newDate = $appointment->appointment_date?->toDateString() ?? (string) $appointment->getRawOriginal('appointment_date');
        $newTime = substr((string) $appointment->start_time, 0, 5);
        $text = "نوبت شما جابجا شد.\n"
            .'از: '.$this->dateLabel($previousDate).' ساعت '.JalaliDate::toPersianDigits($previousTime)."\n"
            .'به: '.$this->dateLabel($newDate).' ساعت '.JalaliDate::toPersianDigits($newTime)."\n\n"
            .$this->appointmentText($appointment);

        $this->notifyMobile((string) $appointment->customer_phone_snapshot, $text);
    }

    public function adminChatMessage(TenantUser $user, string $body, int $attachmentsCount = 0): void
    {
        $body = trim($body);
        $text = 'پیام جدید از مدیریت دریافت کردید.';

        if ($body !== '') {
            $text .= "\n\n".mb_substr($body, 0, 1000);
        }

        if ($attachmentsCount > 0) {
            $text .= "\n\nتعداد فایل پیوست: ".JalaliDate::toPersianDigits((string) $attachmentsCount);
        }

        $this->notifyUser($user, $text);
    }

    private function appointmentText(Appointment $appointment): string
    {
        return 'کد: '.JalaliDate::toPersianDigits((string) $appointment->public_code)."\n"
            .'بخش: '.(string) $appointment->service_name_snapshot."\n"
            .'روز: '.$this->dateLabel($appointment->appointment_date?->toDateString() ?? '')."\n"
            .'ساعت: '.JalaliDate::toPersianDigits(substr((string) $appointment->start_time, 0, 5));
    }

    private function dateLabel(string $date): string
    {
        if ($date === '') {
            return '—';
        }

        return JalaliDate::format($date);
    }

    private function token(string $channel): string
    {
        $token = (string) ($this->channelSettings($channel)['token'] ?? '');

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

    private function botApiUrl(string $channel, string $token, string $method): string
    {
        $settings = $this->channelSettings($channel);
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
