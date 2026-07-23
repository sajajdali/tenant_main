<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\SystemSetting;
use Illuminate\Support\Collection;

class SmsSenderRegistry
{
    public const SYSTEM_KEY = 'sms_sender_registry';

    public static function defaults(): array
    {
        return [
            'default_sender' => null,
            'senders' => [],
        ];
    }

    public static function get(): array
    {
        return static::normalize(SystemSetting::getValue(static::SYSTEM_KEY, static::defaults()));
    }

    public static function normalize(array $input): array
    {
        $senders = collect($input['senders'] ?? [])
            ->map(function ($item): array {
                $number = preg_replace('/[^0-9+]/', '', trim((string) ($item['number'] ?? ''))) ?? '';

                return [
                    'number' => $number,
                    'label' => trim((string) ($item['label'] ?? '')),
                ];
            })
            ->filter(fn (array $item): bool => $item['number'] !== '')
            ->unique('number')
            ->values();

        $defaultSender = trim((string) ($input['default_sender'] ?? ''));

        if ($defaultSender === '' || ! $senders->contains(fn (array $item): bool => $item['number'] === $defaultSender)) {
            $defaultSender = $senders->first()['number'] ?? null;
        }

        return [
            'default_sender' => $defaultSender,
            'senders' => $senders->map(fn (array $item): array => [
                'number' => $item['number'],
                'label' => $item['label'],
                'is_default' => $defaultSender !== null && $item['number'] === $defaultSender,
            ])->all(),
        ];
    }

    public static function put(array $value): void
    {
        SystemSetting::putValue(static::SYSTEM_KEY, static::normalize($value));
    }

    public static function numbers(): Collection
    {
        return collect(static::get()['senders'] ?? [])->pluck('number')->values();
    }

    public static function defaultSender(): ?string
    {
        $settings = static::get();

        return $settings['default_sender'] ?? null;
    }
}
