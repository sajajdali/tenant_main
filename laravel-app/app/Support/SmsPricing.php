<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\SystemSetting;

class SmsPricing
{
    public const SYSTEM_KEY = 'sms_pricing';
    public const MAX_MESSAGE_LENGTH = 900;

    public static function normalizeMessage(string $message): string
    {
        return trim(str_replace(["\r\n", "\r"], "\n", $message));
    }

    public static function validationError(string $message): ?string
    {
        $normalizedMessage = static::normalizeMessage($message);
        $charactersCount = mb_strlen($normalizedMessage);

        if ($charactersCount === 0) {
            return 'متن پیام خالی است.';
        }

        if ($charactersCount > static::MAX_MESSAGE_LENGTH) {
            return 'متن پیام خالی است و یا طول آن بیشتر از حد مجاز می‌باشد.';
        }

        return null;
    }

    public static function defaults(): array
    {
        return [
            'persian_price' => 0,
            'english_price' => 0,
            'persian_single_limit' => 70,
            'persian_multi_limit' => 67,
            'english_single_limit' => 160,
            'english_multi_limit' => 153,
        ];
    }

    public static function get(): array
    {
        return static::normalize(SystemSetting::getValue(static::SYSTEM_KEY, static::defaults()));
    }

    public static function put(array $value): void
    {
        SystemSetting::putValue(static::SYSTEM_KEY, static::normalize($value));
    }

    public static function normalize(array $input): array
    {
        $defaults = static::defaults();

        return [
            'persian_price' => max(0, (int) ($input['persian_price'] ?? $defaults['persian_price'])),
            'english_price' => max(0, (int) ($input['english_price'] ?? $defaults['english_price'])),
            'persian_single_limit' => max(1, (int) ($input['persian_single_limit'] ?? $defaults['persian_single_limit'])),
            'persian_multi_limit' => max(1, (int) ($input['persian_multi_limit'] ?? $defaults['persian_multi_limit'])),
            'english_single_limit' => max(1, (int) ($input['english_single_limit'] ?? $defaults['english_single_limit'])),
            'english_multi_limit' => max(1, (int) ($input['english_multi_limit'] ?? $defaults['english_multi_limit'])),
        ];
    }

    public static function analyze(string $message, int $recipientsCount = 1, ?array $pricing = null): array
    {
        $pricing = static::normalize($pricing ?? static::get());
        $normalizedMessage = static::normalizeMessage($message);
        $charactersCount = mb_strlen($normalizedMessage);
        $encoding = static::detectEncoding($normalizedMessage);

        if ($charactersCount === 0) {
            return [
                'encoding' => $encoding,
                'characters_count' => 0,
                'parts_count' => 0,
                'unit_price' => 0,
                'total_price' => 0,
                'recipients_count' => max(0, $recipientsCount),
            ];
        }

        $singleLimit = $encoding === 'english'
            ? $pricing['english_single_limit']
            : $pricing['persian_single_limit'];
        $multiLimit = $encoding === 'english'
            ? $pricing['english_multi_limit']
            : $pricing['persian_multi_limit'];
        $partsCount = $charactersCount <= $singleLimit
            ? 1
            : (int) ceil($charactersCount / $multiLimit);
        $basePrice = $encoding === 'english'
            ? $pricing['english_price']
            : $pricing['persian_price'];
        $unitPrice = $basePrice * $partsCount;
        $safeRecipientsCount = max(0, $recipientsCount);

        return [
            'encoding' => $encoding,
            'characters_count' => $charactersCount,
            'parts_count' => $partsCount,
            'unit_price' => $unitPrice,
            'total_price' => $unitPrice * $safeRecipientsCount,
            'recipients_count' => $safeRecipientsCount,
        ];
    }

    public static function detectEncoding(string $message): string
    {
        if ($message === '') {
            return 'persian';
        }

        return preg_match('/^[\x00-\x7F]*$/', $message) === 1 ? 'english' : 'persian';
    }
}
