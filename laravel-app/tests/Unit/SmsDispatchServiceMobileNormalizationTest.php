<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\Sms\SmsDispatchService;
use PHPUnit\Framework\Attributes\DataProvider;
use ReflectionClass;
use Tests\TestCase;

class SmsDispatchServiceMobileNormalizationTest extends TestCase
{
    #[DataProvider('validMobileProvider')]
    public function test_it_normalizes_iranian_and_international_mobile_numbers(string $input, string $expected): void
    {
        $service = (new ReflectionClass(SmsDispatchService::class))->newInstanceWithoutConstructor();

        $this->assertSame($expected, $service->normalizeMobile($input));
    }

    public static function validMobileProvider(): array
    {
        return [
            'iranian local' => ['09123456789', '09123456789'],
            'iranian international with plus' => ['+989123456789', '09123456789'],
            'iranian international with 00' => ['00989123456789', '09123456789'],
            'uk canonical from login selector' => ['447911123456', '447911123456'],
            'uk with plus' => ['+447911123456', '447911123456'],
            'uk with international access prefix' => ['00447911123456', '447911123456'],
            'formatted uk' => ['+44 7911 123 456', '447911123456'],
            'german canonical' => ['4915123456789', '4915123456789'],
            'german with plus' => ['+49 1512 3456789', '4915123456789'],
            'german with international access prefix' => ['0049 1512 3456789', '4915123456789'],
            'french with plus' => ['+33 6 12 34 56 78', '33612345678'],
            'dutch with plus' => ['+31 6 12345678', '31612345678'],
            'austrian with plus' => ['+43 664 1234567', '436641234567'],
            'swiss with plus' => ['+41 79 123 45 67', '41791234567'],
            'italian with plus' => ['+39 320 123 4567', '393201234567'],
            'spanish with plus' => ['+34 612 34 56 78', '34612345678'],
            'swedish with plus' => ['+46 70 123 45 67', '46701234567'],
            'polish with plus' => ['+48 512 345 678', '48512345678'],
            'saudi with plus' => ['+966 51 234 5678', '966512345678'],
        ];
    }

    #[DataProvider('invalidMobileProvider')]
    public function test_it_rejects_numbers_that_are_not_valid_canonical_recipients(string $input): void
    {
        $service = (new ReflectionClass(SmsDispatchService::class))->newInstanceWithoutConstructor();

        $this->assertNull($service->normalizeMobile($input));
    }

    public static function invalidMobileProvider(): array
    {
        return [
            'empty' => [''],
            'too short' => ['4479111'],
            'too long' => ['1234567890123456'],
            'international number cannot start with zero' => ['07911123456'],
        ];
    }
}
