<?php

declare(strict_types=1);

namespace App\Contracts;

use App\Domain\Tenant\Models\SmsSetting;

interface SmsProvider
{
    public function supports(string $provider): bool;

    public function send(SmsSetting $setting, string $mobile, string $message): array;

    public function sendMany(SmsSetting $setting, array $mobiles, string $message, ?string $sender = null): array;
}
