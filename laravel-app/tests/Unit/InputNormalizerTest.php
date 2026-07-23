<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\InputNormalizer;
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
}
