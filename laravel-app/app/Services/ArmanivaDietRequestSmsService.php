<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\NutritionDietRequest;
use App\Domain\Tenant\Models\SmsSetting;
use App\Services\Sms\SmsDispatchService;
use App\Support\JalaliDate;
use App\Support\SmsSenderRegistry;
use Illuminate\Support\Str;
use Throwable;

class ArmanivaDietRequestSmsService
{
    private const DOMAIN = 'armaniva.ir';
    private const MANAGER_MOBILE = '09125189404';

    public function __construct(private readonly SmsDispatchService $smsDispatch)
    {
    }

    public function notify(NutritionDietRequest $dietRequest): void
    {
        try {
            $this->queueManagerSms($dietRequest);
        } catch (Throwable $exception) {
            // The diet request is already committed. An SMS outage must not
            // turn a successful customer request into an API failure.
            report($exception);
        }
    }

    private function queueManagerSms(NutritionDietRequest $dietRequest): void
    {
        if (! $this->isArmanivaTenant()) {
            return;
        }

        $smsSetting = SmsSetting::query()->first();

        if (! $smsSetting) {
            $smsSetting = SmsSetting::query()->create([
                'enabled' => true,
                'provider' => 'kavenegar',
                'credentials' => [
                    'sender' => SmsSenderRegistry::defaultSender() ?? '',
                ],
                'templates' => [],
            ]);
        }

        if (trim((string) $smsSetting->provider) === '') {
            return;
        }

        $dietRequest->loadMissing('user');
        $requestedAt = $dietRequest->created_at ?? now();

        $message = trans('armaniva.diet_request_manager_sms', [
            'customer' => trim((string) ($dietRequest->user?->name ?: 'کاربر')),
            'diet' => trim((string) ($dietRequest->diet_template_name ?: 'رژیم جدید')),
            'date' => JalaliDate::format($requestedAt),
            'time' => JalaliDate::toPersianDigits($requestedAt->format('H:i')),
        ], locale: 'fa');

        $this->smsDispatch->dispatchQueued($smsSetting, [
            'type' => 'nutrition_diet_manager_alert',
            'template_key' => 'armanivaDietRequestCreated',
            'recipient_mobile' => self::MANAGER_MOBILE,
            'recipient_name' => 'مدیر کل',
            'message' => $message,
            'allow_negative_balance' => true,
        ]);
    }

    private function isArmanivaTenant(): bool
    {
        $tenant = tenant();

        if (! $tenant || ! method_exists($tenant, 'domains')) {
            return false;
        }

        return $tenant->domains()
            ->pluck('domain')
            ->contains(fn (mixed $domain): bool => $this->normalizeDomain((string) $domain) === self::DOMAIN);
    }

    private function normalizeDomain(string $domain): string
    {
        $domain = Str::lower(trim($domain));
        $host = parse_url(str_contains($domain, '://') ? $domain : 'https://'.$domain, PHP_URL_HOST);

        return (string) preg_replace('/^www\./', '', rtrim((string) $host, '.'));
    }
}
