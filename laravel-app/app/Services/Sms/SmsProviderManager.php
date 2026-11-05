<?php

declare(strict_types=1);

namespace App\Services\Sms;

use App\Contracts\SmsProvider;
use App\Services\Sms\Providers\KavenegarSmsProvider;
use App\Services\Sms\Providers\ShSmsProvider;
use InvalidArgumentException;

class SmsProviderManager
{
    /** @var array<int, SmsProvider> */
    private array $providers;

    public function __construct()
    {
        $this->providers = [
            new KavenegarSmsProvider(),
            new ShSmsProvider(),
        ];
    }

    public function driver(string $provider): SmsProvider
    {
        foreach ($this->providers as $driver) {
            if ($driver->supports($provider)) {
                return $driver;
            }
        }

        throw new InvalidArgumentException("SMS provider [{$provider}] پشتیبانی نمی‌شود.");
    }
}
