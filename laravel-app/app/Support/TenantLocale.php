<?php

declare(strict_types=1);

namespace App\Support;

use App\Domain\Tenant\Models\GeneralSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;

class TenantLocale
{
    public static function supported(): array
    {
        $supported = config('localization.supported', []);

        return is_array($supported) ? $supported : [];
    }

    public static function supportedLocales(): array
    {
        return array_keys(self::supported());
    }

    public static function enabledLocales(): array
    {
        return array_keys(array_filter(
            self::supported(),
            static fn (array $locale): bool => (bool) ($locale['enabled'] ?? true),
        ));
    }

    public static function selectableLocales(): array
    {
        return array_keys(array_filter(
            self::supported(),
            static fn (array $locale): bool => (bool) ($locale['enabled'] ?? true) && (bool) ($locale['selectable'] ?? true),
        ));
    }

    public static function countries(): array
    {
        $countries = config('localization.countries', []);

        return is_array($countries) ? $countries : [];
    }

    public static function supportedCountries(): array
    {
        return array_keys(self::countries());
    }

    public static function enabledCountries(): array
    {
        return array_keys(array_filter(
            self::countries(),
            static fn (array $country): bool => (bool) ($country['enabled'] ?? true),
        ));
    }

    public static function selectableCountries(): array
    {
        return array_keys(array_filter(
            self::countries(),
            static fn (array $country): bool => (bool) ($country['enabled'] ?? true) && (bool) ($country['selectable'] ?? true),
        ));
    }

    public static function fallback(): string
    {
        return self::normalize(config('localization.fallback_locale')) ?? 'fa';
    }

    public static function default(): string
    {
        return self::normalize(config('localization.default_locale')) ?? self::fallback();
    }

    public static function defaultCountry(): string
    {
        return self::normalizeCountry(config('localization.default_country')) ?? 'IR';
    }

    public static function normalize(mixed $locale): ?string
    {
        $value = strtolower(trim((string) $locale));

        if ($value === '') {
            return null;
        }

        $value = str_replace('_', '-', $value);
        $base = explode('-', $value)[0] ?? $value;

        return in_array($base, self::enabledLocales(), true) ? $base : null;
    }

    public static function normalizeCountry(mixed $country): ?string
    {
        $value = strtoupper(trim((string) $country));

        if ($value === '') {
            return null;
        }

        return in_array($value, self::enabledCountries(), true) ? $value : null;
    }

    public static function fromRules(array $rules): ?string
    {
        $localization = is_array($rules['localization'] ?? null) ? $rules['localization'] : [];

        return self::normalize($localization['locale'] ?? $rules['locale'] ?? null);
    }

    public static function countryFromRules(array $rules): ?string
    {
        $localization = is_array($rules['localization'] ?? null) ? $rules['localization'] : [];

        return self::normalizeCountry($localization['country'] ?? $rules['country'] ?? null);
    }

    public static function fromRequest(?Request $request): ?string
    {
        if (! $request) {
            return null;
        }

        return self::normalize($request->query('locale'))
            ?? self::normalize($request->headers->get('X-App-Locale'))
            ?? self::normalize($request->headers->get('X-Locale'));
    }

    public static function resolve(?GeneralSetting $generalSetting = null, ?Request $request = null): string
    {
        $rules = $generalSetting?->booking_rules ?? [];

        return self::fromRequest($request)
            ?? self::fromRules(is_array($rules) ? $rules : [])
            ?? self::default();
    }

    public static function apply(?GeneralSetting $generalSetting = null, ?Request $request = null): string
    {
        $locale = self::resolve($generalSetting, $request);
        App::setLocale($locale);

        return $locale;
    }

    public static function configFor(string $locale): array
    {
        $supported = self::supported();
        $locale = self::normalize($locale) ?? self::fallback();

        return $supported[$locale] ?? $supported[self::fallback()] ?? [];
    }

    public static function meta(?GeneralSetting $generalSetting = null, ?Request $request = null): array
    {
        $locale = self::resolve($generalSetting, $request);
        $config = self::configFor($locale);
        $fallbackConfig = self::configFor(self::fallback());
        $rules = $generalSetting?->booking_rules ?? [];
        $country = self::countryFromRules(is_array($rules) ? $rules : []) ?? self::defaultCountry();

        return [
            'locale' => $locale,
            'fallbackLocale' => self::fallback(),
            'supportedLocales' => self::selectableLocales(),
            'country' => $country,
            'defaultCountry' => self::defaultCountry(),
            'supportedCountries' => self::selectableCountries(),
            'dir' => (string) ($config['dir'] ?? $fallbackConfig['dir'] ?? ''),
            'htmlLang' => (string) ($config['html_lang'] ?? $locale),
            'ogLocale' => (string) ($config['og_locale'] ?? $fallbackConfig['og_locale'] ?? ''),
            'dateLocale' => (string) ($config['date_locale'] ?? $fallbackConfig['date_locale'] ?? $locale),
            'calendar' => (string) ($config['calendar'] ?? $fallbackConfig['calendar'] ?? ''),
            'numberingSystem' => (string) ($config['numbering_system'] ?? $fallbackConfig['numbering_system'] ?? ''),
            'currency' => (string) ($config['currency'] ?? $fallbackConfig['currency'] ?? ''),
        ];
    }
}
