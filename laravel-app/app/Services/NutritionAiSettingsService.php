<?php

declare(strict_types=1);

namespace App\Services;

use App\Support\OpenAiSettings;

class NutritionAiSettingsService
{
    public function settings(): array
    {
        return OpenAiSettings::get();
    }

    public function ensureConfigured(): array
    {
        $settings = $this->settings();

        if (($settings['enabled'] ?? false) !== true) {
            throw new \RuntimeException('تنظیمات AI تغذیه هنوز فعال نشده است.');
        }

        if (($settings['provider'] ?? 'openai') !== 'openai') {
            throw new \RuntimeException('در حال حاضر فقط OpenAI پشتیبانی می‌شود.');
        }

        if ($this->requiresApiKey($settings) && (! is_string($settings['api_key'] ?? null) || trim((string) $settings['api_key']) === '')) {
            throw new \RuntimeException('کلید API مربوط به OpenAI ثبت نشده است.');
        }

        if (! is_string($settings['model'] ?? null) || trim((string) $settings['model']) === '') {
            throw new \RuntimeException('مدل OpenAI برای تولید رژیم تنظیم نشده است.');
        }

        return $settings;
    }

    private function requiresApiKey(array $settings): bool
    {
        $endpoint = strtolower(trim((string) ($settings['base_url'] ?? '')));

        return str_contains($endpoint, 'openai.com');
    }
}
