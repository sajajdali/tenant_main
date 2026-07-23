<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Booking\Models\Appointment;
use App\Domain\Booking\Models\AppointmentPayment;
use App\Domain\Booking\Models\Barber;
use App\Domain\Booking\Models\Service;
use App\Domain\Tenant\Models\TenantUser;
use App\Support\ServiceScheduleResolver;
use Illuminate\Support\Carbon;

class AppointmentAvailabilityService
{
    /**
     * @return array<int, Barber>
     */
    public function activeBarbers(): array
    {
        return Barber::query()
            ->where('is_active', true)
            ->whereHas('services', fn ($query) => $query->where('is_active', true))
            ->orderBy('sort_order')
            ->orderByDesc('created_at')
            ->get()
            ->all();
    }

    /**
     * @return array<int, Service>
     */
    public function activeServicesForBarber(int $barberId): array
    {
        return Service::query()
            ->where('professional_id', $barberId)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderByDesc('created_at')
            ->get()
            ->all();
    }

    /**
     * @return array<int, string>
     */
    public function bookableDates(Barber $barber, Service $service, ?TenantUser $actor = null, int $limit = 14): array
    {
        $dates = [];
        $today = now()->startOfDay();
        $lastDay = $this->isStaff($actor)
            ? $today->copy()->addDays(365)->endOfDay()
            : $this->lastBookableDay($barber, $today);

        for ($date = $today->copy(); $date->lte($lastDay) && count($dates) < $limit; $date->addDay()) {
            $dateString = $date->toDateString();

            if (! $this->isDateAllowed($barber, $service, $dateString, $actor)) {
                continue;
            }

            if ($this->availableSlots($barber, $service, $dateString, $actor) !== []) {
                $dates[] = $dateString;
            }
        }

        return $dates;
    }

    /**
     * @return array<int, array{start: string, end: string}>
     */
    public function availableSlots(Barber $barber, Service $service, string $date, ?TenantUser $actor = null): array
    {
        if (! $this->isDateAllowed($barber, $service, $date, $actor)) {
            return [];
        }

        $settings = $service->settings ?? [];
        $schedule = ServiceScheduleResolver::resolve($service, $date);
        $duration = $schedule['duration_minutes'];
        $dayStart = Carbon::createFromFormat('Y-m-d H:i', "{$date} {$schedule['start_hour']}");
        $dayEnd = Carbon::createFromFormat('Y-m-d H:i', "{$date} {$schedule['end_hour']}");

        if ($dayStart->gte($dayEnd)) {
            return [];
        }

        $earliest = match ($actor?->role) {
            'admin' => null,
            'barber' => now(),
            default => $this->earliestBookableMoment($barber),
        };
        $checkConflicts = (bool) ($settings['check_conflicts'] ?? true);
        $restBreaks = is_array($settings['rest_breaks'] ?? null) ? $settings['rest_breaks'] : [];
        $vipBreaks = is_array($settings['vip_breaks'] ?? null) ? $settings['vip_breaks'] : [];
        $quickBlockedSlots = is_array($settings['quick_blocked_slots'] ?? null) ? $settings['quick_blocked_slots'] : [];
        $blockedTimeRanges = is_array($barber->settings['blocked_time_ranges'] ?? null)
            ? $barber->settings['blocked_time_ranges']
            : [];
        $actorIsVip = $actor?->role === 'customer' && (bool) $actor->is_vip;
        $busyRanges = $checkConflicts ? $this->busyRanges((int) $barber->id, $date) : [];
        $slots = [];

        for ($cursor = $dayStart->copy(); $cursor->copy()->addMinutes($duration)->lte($dayEnd); $cursor->addMinutes($duration)) {
            $slotEnd = $cursor->copy()->addMinutes($duration);

            if ($earliest !== null && $cursor->lt($earliest)) {
                continue;
            }

            if ($this->overlapsProfessionalBlocks($cursor, $slotEnd, $date, $blockedTimeRanges)) {
                continue;
            }

            if ($this->overlapsBreaks($cursor, $slotEnd, $date, $restBreaks)) {
                continue;
            }

            if ($this->overlapsQuickBlockedSlots($cursor, $slotEnd, $date, $quickBlockedSlots)) {
                continue;
            }

            if (! $actorIsVip && $this->overlapsVipBreaks($cursor, $slotEnd, $date, $vipBreaks)) {
                continue;
            }

            if ($this->overlapsBusyRange($cursor, $slotEnd, $busyRanges)) {
                continue;
            }

            $slots[] = [
                'start' => $cursor->format('H:i'),
                'end' => $slotEnd->format('H:i'),
            ];
        }

        return $slots;
    }

    private function earliestBookableMoment(Barber $barber): Carbon
    {
        $settings = $barber->settings ?? [];

        if (($settings['booking_lead_mode'] ?? 'today') === 'days') {
            return now()->startOfDay()->addDays(max(1, (int) ($settings['booking_lead_days'] ?? 1)));
        }

        return now()->addHours(max(0, (int) ($settings['booking_lead_hours'] ?? 2)));
    }

    private function lastBookableDay(Barber $barber, Carbon $today): Carbon
    {
        $settings = $barber->settings ?? [];

        if (($settings['booking_horizon_mode'] ?? 'days') === 'date') {
            $maxDate = trim((string) ($settings['booking_max_date'] ?? ''));

            if ($maxDate !== '') {
                return Carbon::createFromFormat('Y-m-d', $maxDate)->endOfDay();
            }
        }

        return $today->copy()->addDays(max(0, (int) ($settings['booking_max_days'] ?? 30)))->endOfDay();
    }

    private function isDateAllowed(Barber $barber, Service $service, string $date, ?TenantUser $actor = null): bool
    {
        $barberSettings = $barber->settings ?? [];
        $serviceSettings = $service->settings ?? [];
        $carbon = Carbon::createFromFormat('Y-m-d', $date);

        if ($carbon->lt(now()->startOfDay())) {
            return false;
        }

        if (! $this->isStaff($actor) && $carbon->gt($this->lastBookableDay($barber, now()->startOfDay()))) {
            return false;
        }

        $workDays = $serviceSettings['work_days'] ?? [0, 1, 2, 3, 4, 6];
        if (
            ! ServiceScheduleResolver::hasOverrideForDate($service, $date)
            && is_array($workDays)
            && ! in_array($carbon->dayOfWeek, array_map('intval', $workDays), true)
        ) {
            return false;
        }

        if (in_array($date, array_map('strval', (array) ($barberSettings['disabled_dates'] ?? [])), true)) {
            return false;
        }

        if (in_array($date, array_map('strval', (array) ($serviceSettings['disabled_dates'] ?? [])), true)) {
            return false;
        }

        $activeRanges = is_array($barberSettings['active_ranges'] ?? null) ? $barberSettings['active_ranges'] : [];
        if ($activeRanges !== [] && ! $this->dateInRanges($date, $activeRanges)) {
            return false;
        }

        $disabledRanges = is_array($serviceSettings['disabled_date_ranges'] ?? null) ? $serviceSettings['disabled_date_ranges'] : [];

        return ! $this->dateInRanges($date, $disabledRanges);
    }

    private function isStaff(?TenantUser $actor): bool
    {
        return in_array($actor?->role, ['admin', 'barber'], true);
    }

    /**
     * @param  array<int, array<string, mixed>>  $ranges
     */
    private function dateInRanges(string $date, array $ranges): bool
    {
        foreach ($ranges as $range) {
            if (! is_array($range)) {
                continue;
            }

            $start = (string) ($range['start'] ?? $range['from'] ?? '');
            $end = (string) ($range['end'] ?? $range['to'] ?? $start);

            if ($start !== '' && $end !== '' && $date >= $start && $date <= $end) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<int, array{start: Carbon, end: Carbon}>  $busyRanges
     */
    private function overlapsBusyRange(Carbon $start, Carbon $end, array $busyRanges): bool
    {
        foreach ($busyRanges as $range) {
            if ($start->lt($range['end']) && $end->gt($range['start'])) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<int, array<string, mixed>>  $breaks
     */
    private function overlapsBreaks(Carbon $start, Carbon $end, string $date, array $breaks): bool
    {
        foreach ($breaks as $break) {
            if (
                ! is_array($break)
                || ! $this->breakAppliesToDate($break, $date)
                || empty($break['start'])
                || empty($break['end'])
            ) {
                continue;
            }

            $breakStart = Carbon::createFromFormat('Y-m-d H:i', "{$date} {$break['start']}");
            $breakEnd = Carbon::createFromFormat('Y-m-d H:i', "{$date} {$break['end']}");

            if ($start->lt($breakEnd) && $end->gt($breakStart)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<int, array<string, mixed>>  $breaks
     */
    private function overlapsVipBreaks(Carbon $start, Carbon $end, string $date, array $breaks): bool
    {
        foreach ($breaks as $break) {
            if (
                ! is_array($break)
                || ! $this->breakAppliesToDate($break, $date)
                || empty($break['start'])
                || empty($break['end'])
            ) {
                continue;
            }

            $breakStart = Carbon::createFromFormat('Y-m-d H:i', "{$date} {$break['start']}");
            $breakEnd = Carbon::createFromFormat('Y-m-d H:i', "{$date} {$break['end']}");

            if ($start->lt($breakEnd) && $end->gt($breakStart)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<int, array<string, mixed>>  $slots
     */
    private function overlapsQuickBlockedSlots(Carbon $start, Carbon $end, string $date, array $slots): bool
    {
        foreach ($slots as $slot) {
            if (
                ! is_array($slot)
                || (string) ($slot['date'] ?? '') !== $date
                || empty($slot['start'])
                || empty($slot['end'])
            ) {
                continue;
            }

            $blockedStart = Carbon::createFromFormat('Y-m-d H:i', "{$date} {$slot['start']}");
            $blockedEnd = Carbon::createFromFormat('Y-m-d H:i', "{$date} {$slot['end']}");

            if ($start->lt($blockedEnd) && $end->gt($blockedStart)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $break
     */
    private function breakAppliesToDate(array $break, string $date): bool
    {
        $scope = (string) ($break['scope'] ?? 'all');

        if ($scope === 'weekdays') {
            $weekdays = array_map('intval', (array) ($break['weekdays'] ?? []));

            return in_array(Carbon::createFromFormat('Y-m-d', $date)->dayOfWeek, $weekdays, true);
        }

        if ($scope === 'dates') {
            return in_array($date, array_map('strval', (array) ($break['dates'] ?? [])), true);
        }

        return true;
    }

    /**
     * @param  array<int, array<string, mixed>>  $blocks
     */
    private function overlapsProfessionalBlocks(Carbon $start, Carbon $end, string $date, array $blocks): bool
    {
        foreach ($blocks as $block) {
            if (
                ! is_array($block)
                || ($block['date'] ?? null) !== $date
                || empty($block['start'])
                || empty($block['end'])
            ) {
                continue;
            }

            $blockStart = Carbon::createFromFormat('Y-m-d H:i', "{$date} {$block['start']}");
            $blockEnd = Carbon::createFromFormat('Y-m-d H:i', "{$date} {$block['end']}");

            if ($start->lt($blockEnd) && $end->gt($blockStart)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<int, array{start: Carbon, end: Carbon}>
     */
    private function busyRanges(int $barberId, string $date): array
    {
        $appointments = Appointment::query()
            ->where('professional_id', $barberId)
            ->where('appointment_date', $date)
            ->whereIn('status', ['booked'])
            ->get(['starts_at', 'ends_at'])
            ->map(fn (Appointment $appointment): array => [
                'start' => Carbon::parse($appointment->starts_at),
                'end' => Carbon::parse($appointment->ends_at),
            ]);

        $payments = AppointmentPayment::query()
            ->where('professional_id', $barberId)
            ->where('appointment_date', $date)
            ->where('status', 'pending')
            ->where('expires_at', '>', now())
            ->get(['appointment_date', 'start_time', 'end_time'])
            ->map(fn (AppointmentPayment $payment): array => [
                'start' => Carbon::createFromFormat('Y-m-d H:i:s', "{$date} {$payment->start_time}"),
                'end' => Carbon::createFromFormat('Y-m-d H:i:s', "{$date} {$payment->end_time}"),
            ]);

        return $appointments->concat($payments)->values()->all();
    }
}
