<?php

declare(strict_types=1);

namespace App\Services\Landing;

use App\Domain\Landing\Models\LandingCustomer;
use Carbon\CarbonInterface;

class LandingCustomerService
{
    public function findByMobile(string $mobile): ?LandingCustomer
    {
        return LandingCustomer::query()
            ->where('mobile', $this->normalizeMobile($mobile))
            ->first();
    }

    public function findOrCreateByMobile(string $mobile, array $attributes = []): LandingCustomer
    {
        $normalizedMobile = $this->normalizeMobile($mobile);
        $payload = $this->normalizeProfileAttributes($attributes);

        /** @var LandingCustomer $customer */
        $customer = LandingCustomer::query()->firstOrCreate(
            ['mobile' => $normalizedMobile],
            array_merge(['status' => 'active'], $payload),
        );

        if (! $customer->wasRecentlyCreated && $payload !== []) {
            $customer->fill($payload);
            $customer->save();
        }

        return $customer->fresh();
    }

    public function updateProfile(LandingCustomer $customer, array $attributes): LandingCustomer
    {
        $payload = $this->normalizeProfileAttributes($attributes);

        if (array_key_exists('mobile', $attributes)) {
            $payload['mobile'] = $this->normalizeMobile((string) $attributes['mobile']);
        }

        $customer->fill($payload);
        $customer->save();

        return $customer->fresh();
    }

    public function markLogin(LandingCustomer $customer): LandingCustomer
    {
        $customer->forceFill([
            'last_login_at' => now(),
            'status' => $customer->status ?: 'active',
        ])->save();

        return $customer->fresh();
    }

    private function normalizeProfileAttributes(array $attributes): array
    {
        $firstName = isset($attributes['first_name']) ? trim((string) $attributes['first_name']) : null;
        $lastName = isset($attributes['last_name']) ? trim((string) $attributes['last_name']) : null;
        $fullName = trim(implode(' ', array_filter([$firstName, $lastName], fn (?string $value): bool => $value !== null && $value !== '')));

        $payload = [
            'first_name' => $firstName !== '' ? $firstName : null,
            'last_name' => $lastName !== '' ? $lastName : null,
            'full_name' => $fullName !== '' ? $fullName : null,
            'email' => $this->nullableTrim($attributes['email'] ?? null),
            'gender' => $this->nullableTrim($attributes['gender'] ?? null),
            'national_code' => $this->nullableTrim($attributes['national_code'] ?? $attributes['nationalCode'] ?? null),
            'province_name' => $this->nullableTrim($attributes['province_name'] ?? $attributes['provinceName'] ?? null),
            'city_name' => $this->nullableTrim($attributes['city_name'] ?? $attributes['cityName'] ?? null),
            'address_line' => $this->nullableTrim($attributes['address_line'] ?? $attributes['addressLine'] ?? null),
            'postal_code' => $this->nullableTrim($attributes['postal_code'] ?? $attributes['postalCode'] ?? null),
            'status' => $this->nullableTrim($attributes['status'] ?? null),
        ];

        if (array_key_exists('province_id', $attributes) || array_key_exists('provinceId', $attributes)) {
            $payload['province_id'] = $this->nullableInt($attributes['province_id'] ?? $attributes['provinceId']);
        }

        if (array_key_exists('city_id', $attributes) || array_key_exists('cityId', $attributes)) {
            $payload['city_id'] = $this->nullableInt($attributes['city_id'] ?? $attributes['cityId']);
        }

        if (array_key_exists('birth_date', $attributes) || array_key_exists('birthDate', $attributes)) {
            $payload['birth_date'] = $this->normalizeBirthDate($attributes['birth_date'] ?? $attributes['birthDate']);
        }

        return array_filter(
            $payload,
            static fn ($value): bool => $value !== null
        );
    }

    private function normalizeMobile(string $mobile): string
    {
        $normalized = preg_replace('/\D+/', '', $mobile) ?? '';

        if (str_starts_with($normalized, '989') && strlen($normalized) === 12) {
            return '0'.substr($normalized, 2);
        }

        if (str_starts_with($normalized, '9') && strlen($normalized) === 10) {
            return '0'.$normalized;
        }

        return $normalized;
    }

    private function normalizeBirthDate(mixed $value): ?string
    {
        if ($value instanceof CarbonInterface) {
            return $value->format('Y-m-d');
        }

        $stringValue = trim((string) $value);

        return $stringValue !== '' ? $stringValue : null;
    }

    private function nullableTrim(mixed $value): ?string
    {
        $trimmed = trim((string) $value);

        return $trimmed !== '' ? $trimmed : null;
    }

    private function nullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (int) $value;
    }
}
