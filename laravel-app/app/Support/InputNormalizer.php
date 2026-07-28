<?php

declare(strict_types=1);

namespace App\Support;

class InputNormalizer
{
    public const MOBILE_PATTERN = '/^(?:09\d{9}|[1-9]\d{7,14})$/';

    public static function digits(?string $value): string
    {
        if (! $value) {
            return '';
        }

        return strtr($value, [
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        ]);
    }

    public static function digitsOnly(?string $value): string
    {
        return preg_replace('/\D+/', '', self::digits($value)) ?? '';
    }

    public static function mobile(?string $value): string
    {
        $raw = trim(self::digits($value));
        $normalized = self::digitsOnly($raw);

        if (str_starts_with($normalized, '0098') && strlen($normalized) === 14) {
            return '0'.substr($normalized, 4);
        }

        if (str_starts_with($normalized, '98') && strlen($normalized) === 12) {
            return '0'.substr($normalized, 2);
        }

        if (str_starts_with($raw, '+')) {
            return $normalized;
        }

        if (str_starts_with($normalized, '00')) {
            return substr($normalized, 2);
        }

        if (str_starts_with($normalized, '9') && strlen($normalized) === 10) {
            return '0'.$normalized;
        }

        return $normalized;
    }

    public static function mobileRule(): string
    {
        return 'regex:'.self::MOBILE_PATTERN;
    }

    public static function isValidMobile(?string $value): bool
    {
        return preg_match(self::MOBILE_PATTERN, self::mobile($value)) === 1;
    }
}
