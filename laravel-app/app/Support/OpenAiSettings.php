<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\SystemSetting;
use Illuminate\Support\Facades\Crypt;
use Throwable;

class OpenAiSettings
{
    public const SYSTEM_KEY = 'openai_settings';

    public static function defaults(): array
    {
        return [
            'enabled' => false,
            'provider' => 'openai',
            'api_key' => '',
            'model' => 'gpt-4.1-mini',
            'model_version' => '',
            'base_url' => 'https://api.openai.com/v1/chat/completions',
            'timeout_seconds' => 90,
            'temperature' => 0.3,
            'proxy_enabled' => (bool) config('services.openai.proxy_enabled', false),
            'proxy_url' => (string) config('services.openai.proxy_url', ''),
            'system_prompt' => '',
            'model_display_names' => [],
            'nutrition_token_unit_price_toman' => 1,
            'nutrition_initial_token_grant' => 2500,
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

    public static function public(): array
    {
        $settings = static::get();
        $settings['api_key'] = static::maskApiKey((string) ($settings['api_key'] ?? ''));

        return $settings;
    }

    private static function normalize(array $value): array
    {
        $defaults = static::defaults();
        $apiKey = trim((string) ($value['api_key'] ?? ''));

        if ($apiKey !== '' && ! str_starts_with($apiKey, 'sk-') && ! str_starts_with($apiKey, '••••')) {
            $apiKey = static::decryptApiKey($apiKey);
        }

        return [
            'enabled' => (bool) ($value['enabled'] ?? $defaults['enabled']),
            'provider' => 'openai',
            'api_key' => $apiKey,
            'model' => trim((string) ($value['model'] ?? $defaults['model'])) ?: $defaults['model'],
            'model_version' => trim((string) ($value['model_version'] ?? $defaults['model_version'])),
            'base_url' => trim((string) ($value['base_url'] ?? $defaults['base_url'])) ?: $defaults['base_url'],
            'timeout_seconds' => max(10, (int) ($value['timeout_seconds'] ?? $defaults['timeout_seconds'])),
            'temperature' => max(0, min(2, (float) ($value['temperature'] ?? $defaults['temperature']))),
            'proxy_enabled' => (bool) ($value['proxy_enabled'] ?? $defaults['proxy_enabled']),
            'proxy_url' => trim((string) ($value['proxy_url'] ?? $defaults['proxy_url'])),
            'system_prompt' => trim((string) ($value['system_prompt'] ?? $defaults['system_prompt'])),
            'model_display_names' => static::normalizeModelDisplayNames($value['model_display_names'] ?? $defaults['model_display_names']),
            'nutrition_token_unit_price_toman' => max(1, (int) ($value['nutrition_token_unit_price_toman'] ?? $defaults['nutrition_token_unit_price_toman'])),
            'nutrition_initial_token_grant' => max(0, (int) ($value['nutrition_initial_token_grant'] ?? $defaults['nutrition_initial_token_grant'])),
        ];
    }

    public static function nutritionTokenUnitPriceToman(): int
    {
        return max(1, (int) (static::get()['nutrition_token_unit_price_toman'] ?? static::defaults()['nutrition_token_unit_price_toman']));
    }

    public static function nutritionInitialTokenGrant(): int
    {
        return max(0, (int) (static::get()['nutrition_initial_token_grant'] ?? static::defaults()['nutrition_initial_token_grant']));
    }

    public static function modelDisplayName(string $model): string
    {
        $model = trim($model);

        if ($model === '') {
            return '';
        }

        $displayNames = static::get()['model_display_names'] ?? [];

        return trim((string) ($displayNames[$model] ?? '')) ?: $model;
    }

    public static function modelDisplayNamesToText(array $displayNames): string
    {
        $lines = [];

        foreach (static::normalizeModelDisplayNames($displayNames) as $model => $label) {
            $lines[] = "{$model} = {$label}";
        }

        return implode(PHP_EOL, $lines);
    }

    public static function parseModelDisplayNamesText(?string $value): array
    {
        $items = [];
        $lines = preg_split('/\R/', (string) $value) ?: [];

        foreach ($lines as $line) {
            $line = trim($line);

            if ($line === '') {
                continue;
            }

            $parts = preg_split('/\s*(?:=|=>|:)\s*/', $line, 2);

            if (! is_array($parts) || count($parts) < 2) {
                continue;
            }

            $model = trim((string) $parts[0]);
            $label = trim((string) $parts[1]);

            if ($model !== '' && $label !== '') {
                $items[$model] = $label;
            }
        }

        return $items;
    }

    private static function normalizeModelDisplayNames(mixed $value): array
    {
        if (is_string($value)) {
            $value = static::parseModelDisplayNamesText($value);
        }

        if (! is_array($value)) {
            return [];
        }

        $items = [];

        foreach ($value as $model => $label) {
            $model = trim((string) $model);
            $label = trim((string) $label);

            if ($model !== '' && $label !== '') {
                $items[$model] = $label;
            }
        }

        return $items;
    }

    public static function persistable(array $value, ?string $existingApiKey = null): array
    {
        $normalized = static::normalize(array_merge(static::defaults(), $value));
        $apiKey = trim((string) ($value['api_key'] ?? ''));

        if ($apiKey === '' && $existingApiKey !== null && $existingApiKey !== '') {
            $apiKey = $existingApiKey;
        }

        $normalized['api_key'] = $apiKey !== '' ? Crypt::encryptString($apiKey) : '';

        return $normalized;
    }

    private static function decryptApiKey(string $value): string
    {
        try {
            return trim(Crypt::decryptString($value));
        } catch (Throwable) {
            return trim($value);
        }
    }

    private static function maskApiKey(string $apiKey): string
    {
        $trimmed = trim($apiKey);

        if ($trimmed === '') {
            return '';
        }

        if (mb_strlen($trimmed) <= 8) {
            return '••••••••';
        }

        return mb_substr($trimmed, 0, 6) . '••••••' . mb_substr($trimmed, -4);
    }
}
