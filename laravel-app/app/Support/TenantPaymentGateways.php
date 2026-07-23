<?php

declare(strict_types=1);

namespace App\Support;

final class TenantPaymentGateways
{
    public static function definitions(): array
    {
        return [
            'zibal' => [
                'label' => 'زیبال',
                'currency' => 'T',
                'fields' => [
                    'merchantId' => ['label' => 'مرچنت آیدی', 'required' => true],
                ],
            ],
            'saman' => [
                'label' => 'سامان',
                'currency' => 'T',
                'fields' => [
                    'merchantId' => ['label' => 'مرچنت آیدی', 'required' => true],
                    'password' => ['label' => 'رمز درگاه', 'required' => true],
                ],
            ],
            'digipay' => [
                'label' => 'دیجی‌پی',
                'currency' => 'R',
                'fields' => [
                    'username' => ['label' => 'نام کاربری', 'required' => true],
                    'password' => ['label' => 'رمز عبور', 'required' => true],
                    'clientId' => ['label' => 'Client ID', 'required' => true],
                    'clientSecret' => ['label' => 'Client Secret', 'required' => true],
                ],
            ],
            'asanpardakht' => [
                'label' => 'آسان پرداخت',
                'currency' => 'T',
                'fields' => [
                    'username' => ['label' => 'نام کاربری', 'required' => true],
                    'password' => ['label' => 'رمز عبور', 'required' => true],
                    'merchantConfigID' => ['label' => 'Merchant Config ID', 'required' => true],
                ],
            ],
            'parsian' => [
                'label' => 'پارسیان',
                'currency' => 'T',
                'fields' => [
                    'merchantId' => ['label' => 'مرچنت آیدی', 'required' => true],
                ],
            ],
            'pasargad' => [
                'label' => 'پاسارگاد',
                'currency' => 'T',
                'fields' => [
                    'userName' => ['label' => 'نام کاربری', 'required' => true],
                    'password' => ['label' => 'رمز عبور', 'required' => true],
                    'merchantId' => ['label' => 'مرچنت آیدی', 'required' => true],
                    'terminalCode' => ['label' => 'Terminal Code', 'required' => true],
                ],
            ],
            'zarinpal' => [
                'label' => 'زرین‌پال',
                'currency' => 'T',
                'fields' => [
                    'merchantId' => ['label' => 'مرچنت آیدی', 'required' => true],
                ],
            ],
        ];
    }

    public static function supportedKeys(): array
    {
        return array_keys(static::definitions());
    }

    public static function defaultSettings(): array
    {
        $defaults = [];

        foreach (static::definitions() as $gateway => $definition) {
            $defaults[$gateway] = ['enabled' => false];

            foreach ($definition['fields'] as $field => $meta) {
                $defaults[$gateway][$field] = '';
            }
        }

        return $defaults;
    }

    public static function normalized(array $input): array
    {
        $defaults = static::defaultSettings();

        foreach (static::definitions() as $gateway => $definition) {
            $gatewayInput = $input[$gateway] ?? [];
            $defaults[$gateway]['enabled'] = (bool) ($gatewayInput['enabled'] ?? false);

            foreach (array_keys($definition['fields']) as $field) {
                $defaults[$gateway][$field] = trim((string) ($gatewayInput[$field] ?? ''));
            }
        }

        return $defaults;
    }

    public static function validationRules(string $prefix = 'gateways'): array
    {
        $rules = [
            $prefix => ['nullable', 'array'],
        ];

        foreach (static::definitions() as $gateway => $definition) {
            $rules["{$prefix}.{$gateway}.enabled"] = ['nullable', 'boolean'];

            foreach ($definition['fields'] as $field => $meta) {
                $rule = ['nullable', 'string', 'max:255'];

                if (($meta['required'] ?? false) === true) {
                    array_unshift($rule, "required_if:{$prefix}.{$gateway}.enabled,true");
                }

                $rules["{$prefix}.{$gateway}.{$field}"] = $rule;
            }
        }

        return $rules;
    }

    public static function configuredEnabled(array $gateways): array
    {
        $enabled = [];

        foreach (static::definitions() as $gateway => $definition) {
            $settings = $gateways[$gateway] ?? [];

            if (! ($settings['enabled'] ?? false)) {
                continue;
            }

            $isConfigured = true;

            foreach ($definition['fields'] as $field => $meta) {
                if (($meta['required'] ?? false) && blank($settings[$field] ?? null)) {
                    $isConfigured = false;
                    break;
                }
            }

            if ($isConfigured) {
                $enabled[] = $gateway;
            }
        }

        return $enabled;
    }

    public static function driverConfig(string $gateway, array $settings, string $callbackUrl): array
    {
        $currency = static::definitions()[$gateway]['currency'] ?? 'T';

        return match ($gateway) {
            'zibal' => [
                'merchantId' => $settings['merchantId'] ?? '',
                'callbackUrl' => $callbackUrl,
                'currency' => $currency,
            ],
            'saman' => [
                'merchantId' => $settings['merchantId'] ?? '',
                'password' => $settings['password'] ?? '',
                'callbackUrl' => $callbackUrl,
                'currency' => $currency,
            ],
            'digipay' => [
                'username' => $settings['username'] ?? '',
                'password' => $settings['password'] ?? '',
                'client_id' => $settings['clientId'] ?? '',
                'client_secret' => $settings['clientSecret'] ?? '',
                'callbackUrl' => $callbackUrl,
                'currency' => $currency,
            ],
            'asanpardakht' => [
                'username' => $settings['username'] ?? '',
                'password' => $settings['password'] ?? '',
                'merchantConfigID' => $settings['merchantConfigID'] ?? '',
                'callbackUrl' => $callbackUrl,
                'currency' => $currency,
            ],
            'parsian' => [
                'merchantId' => $settings['merchantId'] ?? '',
                'callbackUrl' => $callbackUrl,
                'currency' => $currency,
            ],
            'pasargad' => [
                'userName' => $settings['userName'] ?? '',
                'password' => $settings['password'] ?? '',
                'merchantId' => $settings['merchantId'] ?? '',
                'terminalCode' => $settings['terminalCode'] ?? '',
                'callbackUrl' => $callbackUrl,
                'currency' => $currency,
            ],
            'zarinpal' => [
                'merchantId' => $settings['merchantId'] ?? '',
                'callbackUrl' => $callbackUrl,
                'currency' => $currency,
            ],
            default => [],
        };
    }
}
