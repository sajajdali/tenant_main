<?php

declare(strict_types=1);

namespace Tests\Unit;

use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class PersianValidationMessagesTest extends TestCase
{
    public function test_it_returns_persian_validation_messages_for_invalid_values(): void
    {
        App::setLocale('fa');

        $validator = Validator::make(
            ['gender' => 'other'],
            ['gender' => ['required', 'in:male,female']],
        );

        $this->assertTrue($validator->fails());
        $this->assertSame('جنسیت انتخاب‌شده معتبر نیست.', $validator->errors()->first('gender'));
    }
}
