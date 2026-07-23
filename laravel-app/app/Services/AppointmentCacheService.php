<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Booking\Models\Appointment;
use Illuminate\Support\CarbonInterface;
use Illuminate\Support\Facades\Cache;

class AppointmentCacheService
{
    private const TTL_SECONDS = 60;

    public function rememberDayList(string $tenantId, string $date, ?int $barberId, callable $callback): mixed
    {
        return Cache::remember(
            $this->dayListKey($tenantId, $date, $barberId),
            now()->addSeconds(self::TTL_SECONDS),
            $callback,
        );
    }

    public function forgetDayList(string $tenantId, string $date, ?int $barberId): void
    {
        Cache::forget($this->dayListKey($tenantId, $date, $barberId));
        Cache::forget($this->dayListKey($tenantId, $date, null));
    }

    public function forgetForAppointment(string $tenantId, Appointment $appointment): void
    {
        $date = $appointment->appointment_date instanceof CarbonInterface
            ? $appointment->appointment_date->toDateString()
            : (string) $appointment->getRawOriginal('appointment_date');

        $this->forgetDayList($tenantId, $date, (int) $appointment->professional_id);
    }

    private function dayListKey(string $tenantId, string $date, ?int $barberId): string
    {
        return "tenant:{$tenantId}:appointments:date:{$date}:barber:" . ($barberId ?: 'all');
    }
}
