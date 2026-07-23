<?php

declare(strict_types=1);

namespace App\Services\Landing;

use App\Domain\Landing\Models\DomainTldPrice;
use App\Domain\Landing\Models\LandingOrder;
use App\Domain\Tenant\Models\Domain as TenantDomain;

class LandingDomainAvailabilityService
{
    public function inspect(string $domain): array
    {
        $normalizedDomain = $this->normalizeDomain($domain);
        $tld = $this->extractTld($normalizedDomain);
        $tldPrice = $tld !== null
            ? DomainTldPrice::query()->where('tld', $tld)->where('is_active', true)->first()
            : null;

        if ($normalizedDomain === '' || $tld === null) {
            return [
                'domain' => $normalizedDomain,
                'tld' => $tld,
                'status' => 'invalid',
                'available' => false,
                'message' => 'دامنه واردشده معتبر نیست.',
                'price' => null,
                'source' => 'validator',
                'payload' => null,
            ];
        }

        if ($tldPrice === null) {
            return [
                'domain' => $normalizedDomain,
                'tld' => $tld,
                'status' => 'unsupported_tld',
                'available' => false,
                'message' => 'پسوند انتخاب‌شده هنوز در تنظیمات فروش دامنه تعریف نشده است.',
                'price' => null,
                'source' => 'catalog',
                'payload' => null,
            ];
        }

        if (TenantDomain::query()->where('domain', $normalizedDomain)->exists()) {
            return [
                'domain' => $normalizedDomain,
                'tld' => $tld,
                'status' => 'reserved',
                'available' => false,
                'message' => 'این دامنه قبلاً ثبت شده است؛ لطفاً نام دیگری انتخاب کنید.',
                'price' => (int) $tldPrice->register_price_amount,
                'source' => 'local',
                'payload' => null,
            ];
        }

        if (LandingOrder::query()
            ->where('requested_domain', $normalizedDomain)
            ->whereNotIn('status', [LandingOrder::STATUS_REJECTED, LandingOrder::STATUS_CANCELLED])
            ->exists()) {
            return [
                'domain' => $normalizedDomain,
                'tld' => $tld,
                'status' => 'reserved',
                'available' => false,
                'message' => 'این دامنه قبلاً ثبت شده است؛ لطفاً نام دیگری انتخاب کنید.',
                'price' => (int) $tldPrice->register_price_amount,
                'source' => 'local',
                'payload' => null,
            ];
        }

        $whoisResult = $this->lookupViaWhois($normalizedDomain);

        return [
            'domain' => $normalizedDomain,
            'tld' => $tld,
            'status' => $whoisResult['status'],
            'available' => $whoisResult['available'],
            'message' => $whoisResult['message'],
            'price' => (int) $tldPrice->register_price_amount,
            'source' => $whoisResult['source'],
            'payload' => $whoisResult['payload'],
        ];
    }

    public function normalizeDomain(string $domain): string
    {
        $normalized = mb_strtolower(trim($domain));
        $normalized = preg_replace('#^https?://#', '', $normalized) ?? $normalized;
        $normalized = strtok($normalized, '/?:#') ?: $normalized;

        return trim($normalized, '. ');
    }

    public function extractTld(string $domain): ?string
    {
        if ($domain === '' || ! str_contains($domain, '.')) {
            return null;
        }

        $knownTlds = DomainTldPrice::query()
            ->where('is_active', true)
            ->orderByRaw('LENGTH(tld) DESC')
            ->pluck('tld')
            ->map(static fn (string $tld): string => mb_strtolower(trim($tld)))
            ->all();

        foreach ($knownTlds as $tld) {
            if ($tld !== '' && str_ends_with($domain, $tld)) {
                return $tld;
            }
        }

        $segments = explode('.', $domain);

        if (count($segments) < 2) {
            return null;
        }

        return '.'.implode('.', array_slice($segments, 1));
    }

    private function lookupViaWhois(string $domain): array
    {
        $whoisBinary = trim((string) shell_exec('command -v whois 2>/dev/null'));

        if ($whoisBinary === '') {
            return [
                'status' => 'unknown',
                'available' => false,
                'message' => 'ابزار بررسی دامنه روی سرور فعال نیست و این دامنه باید دستی بررسی شود.',
                'source' => 'whois-unavailable',
                'payload' => null,
            ];
        }

        $rawOutput = shell_exec($whoisBinary.' '.escapeshellarg($domain).' 2>&1');
        $rawOutput = trim((string) $rawOutput);
        $normalizedOutput = mb_strtolower($rawOutput);

        if ($rawOutput === '') {
            return [
                'status' => 'unknown',
                'available' => false,
                'message' => 'پاسخ روشنی از whois دریافت نشد و بررسی این دامنه باید دستی انجام شود.',
                'source' => 'whois',
                'payload' => null,
            ];
        }

        $availablePatterns = [
            'no match for',
            'not found',
            'no entries found',
            'status: available',
            'no object found',
            'domain not found',
        ];

        foreach ($availablePatterns as $pattern) {
            if (str_contains($normalizedOutput, $pattern)) {
                return [
                    'status' => 'available',
                    'available' => true,
                    'message' => 'این دامنه آزاد است و می‌توانید آن را ثبت کنید.',
                    'source' => 'whois',
                    'payload' => ['raw' => mb_substr($rawOutput, 0, 4000)],
                ];
            }
        }

        return [
            'status' => 'registered',
            'available' => false,
            'message' => 'این دامنه قبلاً ثبت شده است؛ لطفاً نام دیگری انتخاب کنید.',
            'source' => 'whois',
            'payload' => ['raw' => mb_substr($rawOutput, 0, 4000)],
        ];
    }
}
