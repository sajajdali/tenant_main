<?php

declare(strict_types=1);

namespace App\Support;

class InputNormalizer
{
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
        return self::digitsOnly($value);
    }
}
