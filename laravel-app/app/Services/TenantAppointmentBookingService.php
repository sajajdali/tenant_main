<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Booking\Models\Appointment;
use App\Domain\Booking\Models\AppointmentPayment;
use App\Domain\Booking\Models\Barber;
use App\Domain\Booking\Models\Customer;
use App\Domain\Booking\Models\Service;
use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\TenantUser;
use App\Events\AppointmentAvailabilityChanged;
use App\Events\AppointmentBooked;
use App\Support\AppointmentPublicLink;
use App\Support\ServiceScheduleResolver;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class TenantAppointmentBookingService
{
    public function __construct(
        private readonly AppointmentCacheService $cacheService,
        private readonly TenantProvisioningService $tenantProvisioningService,
        private readonly AppointmentSmsService $appointmentSmsService,
        private readonly AppointmentReminderService $appointmentReminderService,
        private readonly VipFeatureService $vipFeatureService,
        private readonly CustomerClubService $customerClubService,
    ) {}

    public function prepare(TenantUser $tenantUser, array $validated, ?int $ignorePaymentId = null): array
    {
        if (! in_array($tenantUser->role, ['admin', 'barber'], true) && ! $tenantUser->can_book) {
            throw ValidationException::withMessages([
                'userPhone' => __('tenant.booking.account_disabled'),
            ]);
        }

        $barber = Barber::query()->findOrFail($validated['barberId']);
        $service = Service::query()->findOrFail($validated['sectionId']);

        if ((int) $service->professional_id !== (int) $barber->id) {
            throw ValidationException::withMessages([
                'sectionId' => __('tenant.booking.service_invalid'),
            ]);
        }

        $this->ensureCanManageRequestedProfessional($tenantUser, $barber);

        $startsAt = Carbon::createFromFormat('Y-m-d H:i', "{$validated['date']} {$validated['startTime']}");
        $schedule = ServiceScheduleResolver::resolve($service, (string) $validated['date']);
        $endsAt = $startsAt->copy()->addMinutes($schedule['duration_minutes']);
        $isStaff = in_array($tenantUser->role, ['admin', 'barber'], true);
        $isPastAppointment = $startsAt->lt(now());
        $isForSomeoneElse = (bool) ($validated['isForSomeoneElse'] ?? false);
        $isOffQueueBooking = $isStaff && (bool) ($validated['offQueueBooking'] ?? false);
        $blockedTimeRanges = $barber->settings['blocked_time_ranges'] ?? [];
        $restBreaks = $service->settings['rest_breaks'] ?? [];
        $quickBlockedSlots = $service->settings['quick_blocked_slots'] ?? [];
        $vipFeatureActive = $this->vipFeatureService->syncCurrentTenantState(tenant());
        $vipBreaks = $vipFeatureActive ? ($service->settings['vip_breaks'] ?? []) : [];
        $targetTenantUser = TenantUser::query()->where('mobile', $validated['userPhone'])->first();
        $actorIsVip = ! $isStaff && $tenantUser->role === 'customer' && (bool) $tenantUser->is_vip;
        $targetIsVip = $actorIsVip || ($targetTenantUser?->role === 'customer'
            ? (bool) $targetTenantUser->is_vip
            : (! $isStaff && $tenantUser->role === 'customer' && $validated['userPhone'] === $tenantUser->mobile
                ? (bool) $tenantUser->is_vip
                : false));

        $this->ensurePastBookingActorAllowed($tenantUser, $startsAt);
        $this->ensureCustomerBookingHorizonAllowed($tenantUser, $barber, (string) $validated['date']);

        if (! $isOffQueueBooking) {
            $sectionStartsAt = Carbon::createFromFormat('Y-m-d H:i', "{$validated['date']} {$schedule['start_hour']}");
            $sectionEndsAt = Carbon::createFromFormat('Y-m-d H:i', "{$validated['date']} {$schedule['end_hour']}");

            if ($startsAt->lt($sectionStartsAt) || $endsAt->gt($sectionEndsAt)) {
                throw ValidationException::withMessages([
                    'startTime' => __('tenant.booking.outside_service_hours'),
                ]);
            }

            if ($sectionStartsAt->diffInMinutes($startsAt) % $schedule['duration_minutes'] !== 0) {
                throw ValidationException::withMessages([
                    'startTime' => __('tenant.booking.duration_mismatch'),
                ]);
            }
        }

        if (
            ! $isOffQueueBooking
            && $this->overlapsProfessionalBlock(
                $startsAt,
                $endsAt,
                (string) $validated['date'],
                is_array($blockedTimeRanges) ? $blockedTimeRanges : [],
            )
        ) {
            throw ValidationException::withMessages([
                'startTime' => __('tenant.booking.professional_blocked_range'),
            ]);
        }

        if (! $isStaff) {
            foreach ($restBreaks as $break) {
                if (
                    ! is_array($break)
                    || ! $this->breakAppliesToDate($break, (string) $validated['date'])
                    || empty($break['start'])
                    || empty($break['end'])
                ) {
                    continue;
                }

                $breakStart = Carbon::createFromFormat('Y-m-d H:i', "{$validated['date']} {$break['start']}");
                $breakEnd = Carbon::createFromFormat('Y-m-d H:i', "{$validated['date']} {$break['end']}");

                if ($startsAt->lt($breakEnd) && $endsAt->gt($breakStart)) {
                    throw ValidationException::withMessages([
                        'startTime' => __('tenant.booking.service_break_overlap'),
                    ]);
                }
            }
        }

        if (
            ! $isOffQueueBooking
            && $this->overlapsQuickBlockedSlots(
                $startsAt,
                $endsAt,
                (string) $validated['date'],
                is_array($quickBlockedSlots) ? $quickBlockedSlots : [],
            )
        ) {
            throw ValidationException::withMessages([
                'startTime' => __('tenant.booking.slot_blocked'),
            ]);
        }

        if (! $isStaff) {
            foreach ($vipBreaks as $vipBreak) {
                if (
                    ! is_array($vipBreak)
                    || ! $this->breakAppliesToDate($vipBreak, (string) $validated['date'])
                    || empty($vipBreak['start'])
                    || empty($vipBreak['end'])
                ) {
                    continue;
                }

                $vipStart = Carbon::createFromFormat('Y-m-d H:i', "{$validated['date']} {$vipBreak['start']}");
                $vipEnd = Carbon::createFromFormat('Y-m-d H:i', "{$validated['date']} {$vipBreak['end']}");

                if ($startsAt->lt($vipEnd) && $endsAt->gt($vipStart) && ! $targetIsVip) {
                    throw ValidationException::withMessages([
                        'startTime' => __('tenant.booking.vip_slot_unavailable'),
                    ]);
                }
            }
        }

        $checkConflicts = (bool) ($service->settings['check_conflicts'] ?? true);

        if ($checkConflicts && ! $isOffQueueBooking) {
            $hasBookedOverlap = Appointment::query()
                ->where('professional_id', $barber->id)
                ->where('appointment_date', $validated['date'])
                ->whereIn('status', ['booked'])
                ->where('starts_at', '<', $endsAt)
                ->where('ends_at', '>', $startsAt)
                ->exists();

            $hasPendingPaymentOverlap = AppointmentPayment::query()
                ->where('professional_id', $barber->id)
                ->where('appointment_date', $validated['date'])
                ->where('status', 'pending')
                ->where('expires_at', '>', now())
                ->when($ignorePaymentId, fn ($query) => $query->whereKeyNot($ignorePaymentId))
                ->where(function ($query) use ($startsAt, $endsAt) {
                    $query
                        ->where('start_time', '<', $endsAt->format('H:i:s'))
                        ->where('end_time', '>', $startsAt->format('H:i:s'));
                })
                ->exists();

            if ($hasBookedOverlap || $hasPendingPaymentOverlap) {
                throw ValidationException::withMessages([
                    'startTime' => __('tenant.booking.slot_taken'),
                ]);
            }
        }

        if (! $isStaff) {
            $this->ensureHourlyBookingLimit($tenantUser);

            $sameDayBaseQuery = Appointment::query()
                ->where('appointment_date', $validated['date'])
                ->where('created_by_user_id', $tenantUser->id)
                ->whereIn('status', ['booked', 'completed', 'no_show']);

            $selfCount = (clone $sameDayBaseQuery)
                ->where('customer_phone_snapshot', $tenantUser->mobile)
                ->where(function ($query) {
                    $query
                        ->whereNull('meta->is_for_someone_else')
                        ->orWhere('meta->is_for_someone_else', false);
                })
                ->count();

            $othersCount = (clone $sameDayBaseQuery)
                ->where(function ($query) use ($tenantUser) {
                    $query
                        ->where('meta->is_for_someone_else', true)
                        ->orWhere('customer_phone_snapshot', '!=', $tenantUser->mobile);
                })
                ->count();

            if (! $isForSomeoneElse && $validated['userPhone'] === $tenantUser->mobile && $selfCount >= 1) {
                throw ValidationException::withMessages([
                    'userPhone' => __('tenant.booking.daily_self_limit'),
                ]);
            }

            if (($isForSomeoneElse || $validated['userPhone'] !== $tenantUser->mobile) && $othersCount >= 1) {
                throw ValidationException::withMessages([
                    'userPhone' => __('tenant.booking.daily_others_limit'),
                ]);
            }
        }

        $isVipSlot = false;
        foreach ($vipBreaks as $vipBreak) {
            if (
                ! is_array($vipBreak)
                || ! $this->breakAppliesToDate($vipBreak, (string) $validated['date'])
                || empty($vipBreak['start'])
                || empty($vipBreak['end'])
            ) {
                continue;
            }

            $vipStart = Carbon::createFromFormat('Y-m-d H:i', "{$validated['date']} {$vipBreak['start']}");
            $vipEnd = Carbon::createFromFormat('Y-m-d H:i', "{$validated['date']} {$vipBreak['end']}");

            if ($startsAt->lt($vipEnd) && $endsAt->gt($vipStart)) {
                $isVipSlot = true;
                break;
            }
        }

        return compact('barber', 'service', 'startsAt', 'endsAt', 'isStaff', 'isPastAppointment', 'isForSomeoneElse', 'isOffQueueBooking', 'isVipSlot');
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

    private function ensureHourlyBookingLimit(TenantUser $tenantUser): void
    {
        $bookingRules = GeneralSetting::query()->value('booking_rules') ?? [];
        $hourlyBookingLimit = max(1, (int) ($bookingRules['hourly_booking_limit'] ?? 4));
        $windowStartedAt = now()->subHour();

        $recentAppointments = Appointment::query()
            ->where('created_by_user_id', $tenantUser->id)
            ->where('created_at', '>=', $windowStartedAt)
            ->orderBy('created_at')
            ->get(['id', 'created_at']);

        if ($recentAppointments->count() < $hourlyBookingLimit) {
            return;
        }

        $oldestBlockedAppointment = $recentAppointments->first();
        $retryAt = Carbon::parse($oldestBlockedAppointment?->created_at)->addHour();
        $remainingSeconds = max(0, $retryAt->getTimestamp() - now()->getTimestamp());
        $remainingMinutes = max(1, (int) ceil($remainingSeconds / 60));

        throw ValidationException::withMessages([
            'userPhone' => __('tenant.booking.hourly_limit', [
                'limit' => $hourlyBookingLimit,
                'minutes' => $remainingMinutes,
            ]),
        ]);
    }

    private function ensurePastBookingActorAllowed(TenantUser $tenantUser, Carbon $startsAt): void
    {
        if ($startsAt->lt(now()) && $tenantUser->role !== 'admin') {
            throw ValidationException::withMessages([
                'date' => __('tenant.booking.past_admin_only'),
            ]);
        }
    }

    private function ensureCustomerBookingHorizonAllowed(TenantUser $tenantUser, Barber $barber, string $date): void
    {
        if (in_array($tenantUser->role, ['admin', 'barber'], true)) {
            return;
        }

        $requestedDate = Carbon::createFromFormat('Y-m-d', $date)->startOfDay();
        $latestDate = $this->latestCustomerBookableDate($barber);

        if ($requestedDate->gt($latestDate)) {
            throw ValidationException::withMessages([
                'date' => __('tenant.booking.outside_booking_horizon'),
            ]);
        }
    }

    private function latestCustomerBookableDate(Barber $barber): Carbon
    {
        $settings = $barber->settings ?? [];

        if (($settings['booking_horizon_mode'] ?? 'days') === 'date') {
            $maxDate = trim((string) ($settings['booking_max_date'] ?? ''));

            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $maxDate) === 1) {
                return Carbon::createFromFormat('Y-m-d', $maxDate)->endOfDay();
            }
        }

        return now()->startOfDay()->addDays(max(0, (int) ($settings['booking_max_days'] ?? 30)))->endOfDay();
    }

    /**
     * @param  array<int, array<string, mixed>>  $blocks
     */
    private function overlapsProfessionalBlock(Carbon $start, Carbon $end, string $date, array $blocks): bool
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

    public function book(TenantUser $tenantUser, array $validated, ?int $ignorePaymentId = null): Appointment
    {
        /** @var Appointment $appointment */
        $appointment = DB::transaction(function () use ($validated, $tenantUser, $ignorePaymentId) {
            Barber::query()
                ->whereKey($validated['barberId'])
                ->lockForUpdate()
                ->firstOrFail();

            $prepared = $this->prepare($tenantUser, $validated, $ignorePaymentId);

            if (
                $prepared['isStaff']
                && ! empty($validated['originalUserPhone'])
            ) {
                $this->tenantProvisioningService->syncCustomerIdentity(
                    tenant(),
                    (string) $validated['originalUserPhone'],
                    (string) $validated['userPhone'],
                    (string) $validated['userName'],
                );
            }

            $customer = Customer::query()->updateOrCreate(
                ['phone' => $validated['userPhone']],
                ['name' => $validated['userName']]
            );

            $tenantCustomer = $this->tenantProvisioningService->ensureCustomerExists(
                tenant(),
                $validated['userPhone'],
                $validated['userName'],
            );

            return Appointment::query()->create([
                'customer_id' => $customer->id,
                'created_by_user_id' => $tenantUser->id,
                'professional_id' => $prepared['barber']->id,
                'service_id' => $prepared['service']->id,
                'appointment_date' => $validated['date'],
                'start_time' => $validated['startTime'],
                'end_time' => $prepared['endsAt']->format('H:i'),
                'starts_at' => $prepared['startsAt'],
                'ends_at' => $prepared['endsAt'],
                'status' => 'booked',
                ...$this->appointmentReminderService->scheduleAttributesForStartsAt($prepared['startsAt']),
                'notes' => $validated['notes'] ?? null,
                'booked_by_name_snapshot' => $tenantUser->name,
                'booked_by_phone_snapshot' => $tenantUser->mobile,
                'customer_name_snapshot' => $validated['userName'],
                'customer_phone_snapshot' => $validated['userPhone'],
                'professional_name_snapshot' => $prepared['barber']->name,
                'service_name_snapshot' => $prepared['service']->name,
                'price_amount' => (int) $prepared['service']->price,
                'duration_minutes' => (int) $prepared['startsAt']->diffInMinutes($prepared['endsAt']),
                'public_code' => $this->generateUniquePublicCode(),
                'meta' => [
                    'send_sms' => ! $prepared['isPastAppointment'] && (bool) ($validated['sendSms'] ?? false),
                    'suppress_reminders' => (bool) $prepared['isPastAppointment'],
                    'is_past_entry' => (bool) $prepared['isPastAppointment'],
                    'is_for_someone_else' => $prepared['isForSomeoneElse'],
                    'off_queue_booking' => $prepared['isOffQueueBooking'],
                    'is_vip_slot' => (bool) ($prepared['isVipSlot'] ?? false),
                    'tenant_customer_user_id' => $tenantCustomer->id,
                ],
            ]);
        });

        $this->cacheService->forgetForAppointment((string) tenant('id'), $appointment);

        if (! in_array($tenantUser->role, ['admin', 'barber'], true)) {
            $cacheKey = sprintf('tenant:%s:appointment-booking-alerts', (string) tenant('id'));
            $alerts = Cache::get($cacheKey, []);

            if (! is_array($alerts)) {
                $alerts = [];
            }

            $alerts[] = [
                'id' => sprintf('%s-%s', now()->getPreciseTimestamp(3), $appointment->id),
                'appointment' => [
                    'id' => (string) $appointment->id,
                    'userId' => (string) $appointment->customer_id,
                    'userPhone' => (string) $appointment->customer_phone_snapshot,
                    'userName' => (string) $appointment->customer_name_snapshot,
                    'bookedByUserId' => (string) $tenantUser->id,
                    'bookedByPhone' => (string) ($appointment->booked_by_phone_snapshot ?: $tenantUser->mobile),
                    'bookedByName' => (string) ($appointment->booked_by_name_snapshot ?: $tenantUser->name),
                    'bookedByRole' => $tenantUser->role,
                    'barberId' => (string) $appointment->professional_id,
                    'barberName' => (string) $appointment->professional_name_snapshot,
                    'sectionId' => (string) $appointment->service_id,
                    'sectionName' => (string) $appointment->service_name_snapshot,
                    'date' => $appointment->appointment_date?->toDateString() ?? (string) $appointment->getRawOriginal('appointment_date'),
                    'startTime' => substr((string) $appointment->start_time, 0, 5),
                    'endTime' => substr((string) $appointment->end_time, 0, 5),
                    'status' => 'booked',
                    'notes' => $appointment->notes,
                    'sendSms' => (bool) ($appointment->meta['send_sms'] ?? false),
                    'createdAt' => $appointment->created_at?->toISOString(),
                    'isForSomeoneElse' => (bool) ($appointment->meta['is_for_someone_else'] ?? false),
                    'isOffQueue' => (bool) ($appointment->meta['off_queue_booking'] ?? false),
                ],
                'createdAt' => $appointment->created_at?->toISOString(),
            ];

            Cache::put($cacheKey, array_slice($alerts, -100), now()->addHours(2));
        }

        try {
            event(new AppointmentAvailabilityChanged(
                tenant('id'),
                (string) $appointment->professional_id,
                $validated['date'],
                'created',
                (string) $appointment->id,
            ));
        } catch (\Throwable $exception) {
            Log::warning('Broadcasting appointment availability change failed.', [
                'appointment_id' => $appointment->id,
                'tenant_id' => tenant('id'),
                'error' => $exception->getMessage(),
            ]);
        }

        try {
            event(new AppointmentBooked(
                (string) tenant('id'),
                [
                    'id' => (string) $appointment->id,
                    'barberId' => (string) $appointment->professional_id,
                    'barberName' => $appointment->professional_name_snapshot,
                    'barberUserId' => $appointment->professional?->user_id ? (string) $appointment->professional->user_id : null,
                    'sectionId' => (string) $appointment->service_id,
                    'sectionName' => $appointment->service_name_snapshot,
                    'date' => $appointment->appointment_date,
                    'startTime' => $appointment->start_time,
                    'endTime' => $appointment->end_time,
                    'customerName' => $appointment->customer_name_snapshot,
                    'customerPhone' => $appointment->customer_phone_snapshot,
                    'bookedByUserId' => (string) $tenantUser->id,
                    'bookedByRole' => $tenantUser->role,
                ],
            ));
        } catch (\Throwable $exception) {
            Log::warning('Broadcasting appointment booked event failed.', [
                'appointment_id' => $appointment->id,
                'tenant_id' => tenant('id'),
                'error' => $exception->getMessage(),
            ]);
        }
        $this->appointmentSmsService->sendBookingConfirmation($appointment, $tenantUser);

        try {
            app(AdminMessagingBotNotificationService::class)->appointmentBooked($appointment, $tenantUser);
        } catch (\Throwable $exception) {
            Log::warning('Sending admin messaging bot appointment notification failed.', [
                'appointment_id' => $appointment->id,
                'tenant_id' => tenant('id'),
                'error' => $exception->getMessage(),
            ]);
        }

        if (in_array($tenantUser->role, ['admin', 'barber'], true)) {
            app(TelegramUserNotificationService::class)->appointmentBooked($appointment);
        }

        $this->customerClubService->awardAppointment($appointment);

        return $appointment;
    }

    private function generateUniquePublicCode(): string
    {
        for ($attempt = 0; $attempt < 20; $attempt += 1) {
            $code = AppointmentPublicLink::generateCode();

            if (! Appointment::query()->where('public_code', $code)->exists()) {
                return $code;
            }
        }

        throw ValidationException::withMessages([
            'appointment' => __('tenant.booking.public_link_failed'),
        ]);
    }

    private function ensureCanManageRequestedProfessional(TenantUser $actor, Barber $barber): void
    {
        if ($actor->role !== 'barber') {
            return;
        }

        $actorBarber = Barber::query()->where('user_id', $actor->id)->first();

        if (! $actorBarber || (int) $actorBarber->id !== (int) $barber->id) {
            throw ValidationException::withMessages([
                'barberId' => __('tenant.booking.own_professional_only'),
            ]);
        }

        if (! $actorBarber->can_access_panel) {
            throw ValidationException::withMessages([
                'barberId' => __('tenant.booking.professional_panel_blocked'),
            ]);
        }
    }
}
