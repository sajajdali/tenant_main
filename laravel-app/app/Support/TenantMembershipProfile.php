<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Validation\ValidationException;

class TenantMembershipProfile
{
    public static function defaultRequirements(): array
    {
        return [
            'email' => ['enabled' => false, 'required' => false],
            'gender' => ['enabled' => false, 'required' => false],
            'nationalCode' => ['enabled' => false, 'required' => false],
            'birthDate' => ['enabled' => false, 'required' => false],
            'location' => ['enabled' => false, 'required' => false],
            'jobTitle' => ['enabled' => false, 'required' => false],
        ];
    }

    public static function normalizeRequirements(?array $requirements): array
    {
        $defaults = self::defaultRequirements();

        foreach (array_keys($defaults) as $field) {
            $enabled = (bool) data_get($requirements, "{$field}.enabled", false);
            $defaults[$field] = [
                'enabled' => $enabled,
                'required' => $enabled && (bool) data_get($requirements, "{$field}.required", false),
            ];
        }

        return $defaults;
    }

    public static function validationRules(bool $withName = false): array
    {
        $rules = [
            'email' => ['nullable', 'email:rfc', 'max:255'],
            'gender' => ['nullable', 'in:male,female'],
            'nationalCode' => ['nullable', 'regex:/^\d{10}$/'],
            'birthDate' => ['nullable', 'date_format:Y-m-d'],
            'provinceId' => ['nullable', 'integer', 'min:1'],
            'provinceName' => ['nullable', 'string', 'max:255'],
            'cityId' => ['nullable', 'integer', 'min:1'],
            'cityName' => ['nullable', 'string', 'max:255'],
            'jobTitle' => ['nullable', 'string', 'max:255'],
        ];

        if ($withName) {
            $rules['name'] = ['required', 'string', 'min:3', 'max:255'];
        }

        return $rules;
    }

    public static function validationMessages(): array
    {
        return [
            'name.required' => 'نام را وارد کنید.',
            'name.min' => 'نام باید حداقل ۳ حرف باشد.',
            'email.email' => 'ایمیل معتبر نیست.',
            'email.max' => 'ایمیل خیلی طولانی است.',
            'gender.in' => 'جنسیت انتخاب‌شده معتبر نیست.',
            'nationalCode.regex' => 'کد ملی باید ۱۰ رقم باشد.',
            'birthDate.date_format' => 'تاریخ تولد معتبر نیست.',
            'provinceId.integer' => 'استان انتخاب‌شده معتبر نیست.',
            'cityId.integer' => 'شهر انتخاب‌شده معتبر نیست.',
            'jobTitle.max' => 'عنوان شغل خیلی طولانی است.',
        ];
    }

    public static function prepareAttributes(array $validated): array
    {
        $provinceId = isset($validated['provinceId']) ? (int) $validated['provinceId'] : null;
        $cityId = isset($validated['cityId']) ? (int) $validated['cityId'] : null;

        return [
            'email' => self::blankToNull($validated['email'] ?? null),
            'gender' => self::blankToNull($validated['gender'] ?? null),
            'national_code' => self::digitsOrNull($validated['nationalCode'] ?? null),
            'birth_date' => self::blankToNull($validated['birthDate'] ?? null),
            'province_id' => $provinceId ?: null,
            'province_name' => $provinceId ? self::blankToNull($validated['provinceName'] ?? null) : null,
            'city_id' => $cityId ?: null,
            'city_name' => $cityId ? self::blankToNull($validated['cityName'] ?? null) : null,
            'job_title' => self::blankToNull($validated['jobTitle'] ?? null),
        ];
    }

    public static function assertRequirements(array $validated, array $requirements): void
    {
        $normalized = self::normalizeRequirements($requirements);
        $errors = [];

        if (($normalized['email']['required'] ?? false) && self::blankToNull($validated['email'] ?? null) === null) {
            $errors['email'] = 'ایمیل را وارد کنید.';
        }

        if (($normalized['gender']['required'] ?? false) && self::blankToNull($validated['gender'] ?? null) === null) {
            $errors['gender'] = 'جنسیت را وارد کنید.';
        }

        if (($normalized['nationalCode']['required'] ?? false) && self::digitsOrNull($validated['nationalCode'] ?? null) === null) {
            $errors['nationalCode'] = 'کد ملی را وارد کنید.';
        }

        if (($normalized['birthDate']['required'] ?? false) && self::blankToNull($validated['birthDate'] ?? null) === null) {
            $errors['birthDate'] = 'تاریخ تولد را وارد کنید.';
        }

        $provinceId = isset($validated['provinceId']) ? (int) $validated['provinceId'] : null;
        $cityId = isset($validated['cityId']) ? (int) $validated['cityId'] : null;
        $locationEnabled = (bool) ($normalized['location']['enabled'] ?? false);
        $locationRequired = (bool) ($normalized['location']['required'] ?? false);

        if ($locationEnabled && (($provinceId && ! $cityId) || ($cityId && ! $provinceId))) {
            if (! $provinceId) {
                $errors['provinceId'] = 'استان محل سکونت را کامل انتخاب کنید.';
            }

            if (! $cityId) {
                $errors['cityId'] = 'شهر محل سکونت را کامل انتخاب کنید.';
            }
        }

        if ($locationRequired && (! $provinceId || ! $cityId)) {
            $errors['provinceId'] = $errors['provinceId'] ?? 'استان محل سکونت را وارد کنید.';
            $errors['cityId'] = $errors['cityId'] ?? 'شهر محل سکونت را وارد کنید.';
        }

        if (($normalized['jobTitle']['required'] ?? false) && self::blankToNull($validated['jobTitle'] ?? null) === null) {
            $errors['jobTitle'] = 'شغل را وارد کنید.';
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    private static function blankToNull(mixed $value): ?string
    {
        $normalized = trim((string) $value);

        return $normalized !== '' ? $normalized : null;
    }

    private static function digitsOrNull(mixed $value): ?string
    {
        $digits = InputNormalizer::digits((string) $value);

        return $digits !== '' ? $digits : null;
    }
}
