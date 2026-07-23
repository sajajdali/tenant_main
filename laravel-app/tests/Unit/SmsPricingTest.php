<?php

namespace Tests\Unit;

use App\Support\SmsPricing;
use PHPUnit\Framework\TestCase;

class SmsPricingTest extends TestCase
{
    public function test_it_calculates_persian_short_message(): void
    {
        $result = SmsPricing::analyze('سلام دنیا', 2, [
            'persian_price' => 120,
            'english_price' => 250,
        ]);

        $this->assertSame('persian', $result['encoding']);
        $this->assertSame(1, $result['parts_count']);
        $this->assertSame(120, $result['unit_price']);
        $this->assertSame(240, $result['total_price']);
    }

    public function test_it_calculates_english_multipart_message(): void
    {
        $message = str_repeat('A', 161);
        $result = SmsPricing::analyze($message, 1, [
            'persian_price' => 120,
            'english_price' => 250,
        ]);

        $this->assertSame('english', $result['encoding']);
        $this->assertSame(2, $result['parts_count']);
        $this->assertSame(500, $result['unit_price']);
        $this->assertSame(500, $result['total_price']);
    }

    public function test_it_rejects_messages_longer_than_limit(): void
    {
        $error = SmsPricing::validationError(str_repeat('س', 901));

        $this->assertNotNull($error);
    }
}
