<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\AppointmentAvailabilityService;
use Illuminate\Support\Carbon;
use ReflectionMethod;
use Tests\TestCase;

class AppointmentScopedBreakTest extends TestCase
{
    public function test_date_scoped_rest_break_only_blocks_matching_date(): void
    {
        $service = new AppointmentAvailabilityService;
        $method = new ReflectionMethod($service, 'overlapsBreaks');
        $method->setAccessible(true);
        $breaks = [
            [
                'start' => '10:00',
                'end' => '11:00',
                'scope' => 'dates',
                'weekdays' => [],
                'dates' => ['2026-07-03'],
            ],
        ];

        $this->assertTrue($method->invoke(
            $service,
            Carbon::createFromFormat('Y-m-d H:i', '2026-07-03 10:00'),
            Carbon::createFromFormat('Y-m-d H:i', '2026-07-03 10:30'),
            '2026-07-03',
            $breaks,
        ));

        $this->assertFalse($method->invoke(
            $service,
            Carbon::createFromFormat('Y-m-d H:i', '2026-07-04 10:00'),
            Carbon::createFromFormat('Y-m-d H:i', '2026-07-04 10:30'),
            '2026-07-04',
            $breaks,
        ));
    }
}
