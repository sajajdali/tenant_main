<?php

declare(strict_types=1);

namespace App\Support;

use App\Domain\Booking\Models\Service;
use Illuminate\Support\Carbon;

class ServiceScheduleResolver
{
    /**
     * @return array{start_hour: string, end_hour: string, duration_minutes: int, has_override: bool}
     */
    public static function resolve(Service $service, string $date): array
    {
        $settings = $service->settings ?? [];
        $base = [
            'start_hour' => (string) ($settings['start_hour'] ?? '09:00'),
            'end_hour' => (string) ($settings['end_hour'] ?? '21:00'),
            'duration_minutes' => max(5, (int) $service->duration_minutes),
            'has_override' => false,
        ];

        $override = self::matchingOverride($settings, $date);

        if ($override === null) {
            return $base;
        }

        return [
            'start_hour' => (string) ($override['start_hour'] ?? $base['start_hour']),
            'end_hour' => (string) ($override['end_hour'] ?? $base['end_hour']),
            'duration_minutes' => max(5, (int) ($override['duration_minutes'] ?? $base['duration_minutes'])),
            'has_override' => true,
        ];
    }

    public static function hasOverrideForDate(Service $service, string $date): bool
    {
        return self::matchingOverride($service->settings ?? [], $date) !== null;
    }

    /**
     * @param  array<string, mixed>  $settings
     * @return array<string, mixed>|null
     */
    private static function matchingOverride(array $settings, string $date): ?array
    {
        $overrides = is_array($settings['schedule_overrides'] ?? null)
            ? $settings['schedule_overrides']
            : [];

        $dateSpecific = null;
        $weekdaySpecific = null;
        $dayOfWeek = Carbon::createFromFormat('Y-m-d', $date)->dayOfWeek;

        foreach ($overrides as $override) {
            if (! is_array($override)) {
                continue;
            }

            $scope = (string) ($override['scope'] ?? '');

            if ($scope === 'dates' && in_array($date, array_map('strval', (array) ($override['dates'] ?? [])), true)) {
                $dateSpecific = $override;
                break;
            }

            if (
                $scope === 'weekdays'
                && in_array($dayOfWeek, array_map('intval', (array) ($override['weekdays'] ?? [])), true)
                && $weekdaySpecific === null
            ) {
                $weekdaySpecific = $override;
            }
        }

        return $dateSpecific ?? $weekdaySpecific;
    }
}
