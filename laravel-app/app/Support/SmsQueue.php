<?php

declare(strict_types=1);

namespace App\Support;

class SmsQueue
{
    public const OTP = 'otp';
    public const TRANSACTIONAL = 'sms-transactional';
    public const CAMPAIGN = 'sms-campaign';

    public const HIGH = self::TRANSACTIONAL;
    public const LOW = self::CAMPAIGN;
}
