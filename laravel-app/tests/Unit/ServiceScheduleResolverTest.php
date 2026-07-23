<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Domain\Booking\Models\Service;
use App\Support\ServiceScheduleResolver;
use Tests\TestCase;

class ServiceScheduleResolverTest extends TestCase
{
    public function test_date_override_takes_priority_over_weekday_override(): void
    {
        $service = new Service;
        $service->forceFill([
            'duration_minutes' => 60,
            'settings' => [
                'start_hour' => '09:00',
                'end_hour' => '20:00',
                'schedule_overrides' => [
                    [
                        'scope' => 'weekdays',
                        'weekdays' => [5],
                        'dates' => [],
                        'start_hour' => '09:00',
                        'end_hour' => '11:00',
                        'duration_minutes' => 45,
                    ],
                    [
                        'scope' => 'dates',
                        'weekdays' => [],
                        'dates' => ['2026-07-03'],
                        'start_hour' => '10:00',
                        'end_hour' => '14:00',
                        'duration_minutes' => 30,
                    ],
                ],
            ],
        ]);

        $schedule = ServiceScheduleResolver::resolve($service, '2026-07-03');

        $this->assertSame('10:00', $schedule['start_hour']);
        $this->assertSame('14:00', $schedule['end_hour']);
        $this->assertSame(30, $schedule['duration_minutes']);
        $this->assertTrue($schedule['has_override']);
    }

    public function test_weekday_override_matches_its_day(): void
    {
        $service = new Service;
        $service->forceFill([
            'duration_minutes' => 60,
            'settings' => [
                'start_hour' => '09:00',
                'end_hour' => '20:00',
                'schedule_overrides' => [
                    [
                        'scope' => 'weekdays',
                        'weekdays' => [5],
                        'dates' => [],
                        'start_hour' => '09:00',
                        'end_hour' => '11:00',
                        'duration_minutes' => 45,
                    ],
                ],
            ],
        ]);

        $this->assertTrue(ServiceScheduleResolver::hasOverrideForDate($service, '2026-07-03'));

        $schedule = ServiceScheduleResolver::resolve($service, '2026-07-03');

        $this->assertSame('09:00', $schedule['start_hour']);
        $this->assertSame('11:00', $schedule['end_hour']);
        $this->assertSame(45, $schedule['duration_minutes']);
    }
}
