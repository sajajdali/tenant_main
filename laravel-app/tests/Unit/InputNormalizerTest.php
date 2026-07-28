<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\InputNormalizer;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class InputNormalizerTest extends TestCase
{
    public function test_digits_only_converts_persian_and_arabic_digits_to_english_digits(): void
    {
        $this->assertSame('1234', InputNormalizer::digitsOnly('۱۲۳۴'));
        $this->assertSame('1234', InputNormalizer::digitsOnly('١٢٣٤'));
    }

    public function test_digits_only_removes_non_digit_characters_after_conversion(): void
    {
        $this->assertSame('1234', InputNormalizer::digitsOnly(' کد: ۱۲۳۴ '));
    }

    #[DataProvider('mobileNormalizationProvider')]
    public function test_mobile_normalizes_iranian_and_international_formats(string $input, string $expected): void
    {
        $this->assertSame($expected, InputNormalizer::mobile($input));
    }

    public static function mobileNormalizationProvider(): array
    {
        return [
            'Iran local' => ['09123456789', '09123456789'],
            'Iran without trunk prefix' => ['9123456789', '09123456789'],
            'Iran with plus country code' => ['+989123456789', '09123456789'],
            'Iran with international access prefix' => ['00989123456789', '09123456789'],
            'UK canonical' => ['447533460303', '447533460303'],
            'UK with plus country code' => ['+44 7533 460303', '447533460303'],
            'UK with international access prefix' => ['0044 7533 460303', '447533460303'],
            'Germany with plus country code' => ['+49 1512 3456789', '4915123456789'],
            'Germany with international access prefix' => ['0049 1512 3456789', '4915123456789'],
        ];
    }

    #[DataProvider('mobileValidationProvider')]
    public function test_mobile_validation_applies_iran_rules_only_to_iranian_local_numbers(
        string $input,
        bool $expected,
    ): void {
        $this->assertSame($expected, InputNormalizer::isValidMobile($input));
    }

    public static function mobileValidationProvider(): array
    {
        return [
            'valid Iran local' => ['09123456789', true],
            'invalid Iran prefix' => ['08123456789', false],
            'invalid Iran length' => ['0912345678', false],
            'valid UK' => ['447533460303', true],
            'valid Germany' => ['4915123456789', true],
            'valid France' => ['33612345678', true],
            'international number too short' => ['4475334', false],
        ];
    }
}
