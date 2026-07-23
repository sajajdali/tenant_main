<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Booking\Models\Appointment;
use App\Jobs\SendAppointmentReminderSmsJob;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AppointmentReminderService
{
    public const TYPE_24_HOURS = '24h';

    public const TYPE_3_HOURS = '3h';

    private const LOCK_TTL_MINUTES = 60;

    public function __construct(
        private readonly AppointmentSmsService $appointmentSmsService,
    ) {}

    /**
     * @return array<string, array{template_key:string,due_column:string,sent_column:string,locked_column:string,hours:int,min_remaining_minutes:int,max_remaining_minutes:int}>
     */
    public static function definitions(): array
    {
        return [
            self::TYPE_24_HOURS => [
                'template_key' => 'reminder',
                'due_column' => 'reminder_due_at',
                'sent_column' => 'reminder_sent_at',
                'locked_column' => 'reminder_locked_at',
                'hours' => 24,
                'min_remaining_minutes' => 15 * 60,
                'max_remaining_minutes' => 48 * 60,
            ],
            self::TYPE_3_HOURS => [
                'template_key' => 'reminderThreeHours',
                'due_column' => 'reminder_3h_due_at',
                'sent_column' => 'reminder_3h_sent_at',
                'locked_column' => 'reminder_3h_locked_at',
                'hours' => 3,
                'min_remaining_minutes' => 2 * 60,
                'max_remaining_minutes' => 3 * 60,
            ],
        ];
    }

    public function dueAtForStartsAt(
        CarbonInterface|string|null $startsAt,
        string $reminderType = self::TYPE_24_HOURS,
    ): ?Carbon {
        if ($startsAt === null || $startsAt === '') {
            return null;
        }

        $definition = $this->definition($reminderType);

        return Carbon::parse($startsAt)->subHours($definition['hours']);
    }

    /**
     * @return array<string, Carbon|null>
     */
    public function scheduleAttributesForStartsAt(
        CarbonInterface|string|null $startsAt,
        ?CarbonInterface $now = null,
    ): array
    {
        $attributes = [];
        $startsAtValue = $startsAt === null || $startsAt === '' ? null : Carbon::parse($startsAt);
        $nowValue = Carbon::parse($now ?? now());

        foreach (self::definitions() as $type => $definition) {
            $attributes[$definition['due_column']] = $startsAtValue?->lte($nowValue)
                ? null
                : $this->dueAtForStartsAt($startsAtValue, $type);
        }

        return $attributes;
    }

    /**
     * Re-arm only reminders whose new due time is still in the future. If a
     * reminder was already sent and the moved appointment remains inside that
     * reminder window, preserving sent_at prevents an immediate duplicate.
     *
     * @return array<string, Carbon|null>
     */
    public function rescheduleAttributes(
        Appointment $appointment,
        CarbonInterface|string $startsAt,
        ?CarbonInterface $now = null,
    ): array {
        $now = Carbon::parse($now ?? now());
        $attributes = [];

        foreach (self::definitions() as $type => $definition) {
            $dueAt = $this->dueAtForStartsAt($startsAt, $type);
            $attributes[$definition['due_column']] = $dueAt;
            $attributes[$definition['locked_column']] = null;

            if ($dueAt?->gt($now)) {
                $attributes[$definition['sent_column']] = null;
            } else {
                $attributes[$definition['sent_column']] = $appointment->getAttribute($definition['sent_column']);
            }
        }

        return $attributes;
    }

    /**
     * @return array<string, null>
     */
    public function releaseLockAttributes(): array
    {
        $attributes = [];

        foreach (self::definitions() as $definition) {
            $attributes[$definition['locked_column']] = null;
        }

        return $attributes;
    }

    public function queueDueReminderJobs(string $tenantId, ?CarbonInterface $now = null, int $limit = 500): int
    {
        $now = Carbon::parse($now ?? now());
        $staleBefore = $now->copy()->subMinutes(self::LOCK_TTL_MINUTES);
        $queued = 0;

        foreach (self::definitions() as $reminderType => $definition) {
            if (! $this->appointmentSmsService->isReminderEnabled($definition['template_key'])) {
                continue;
            }

            Appointment::query()
                ->where('status', 'booked')
                ->whereNotNull($definition['due_column'])
                ->where($definition['due_column'], '<=', $now)
                ->whereBetween('starts_at', [
                    $now->copy()->addMinutes($definition['min_remaining_minutes']),
                    $now->copy()->addMinutes($definition['max_remaining_minutes']),
                ])
                ->where(function ($query): void {
                    $query
                        ->whereNull('meta->suppress_reminders')
                        ->orWhere('meta->suppress_reminders', false);
                })
                ->whereNull($definition['sent_column'])
                ->whereNotNull('customer_phone_snapshot')
                ->where('customer_phone_snapshot', '!=', '')
                ->where(function ($query) use ($staleBefore, $definition): void {
                    $query
                        ->whereNull($definition['locked_column'])
                        ->orWhere($definition['locked_column'], '<=', $staleBefore);
                })
                ->orderBy($definition['due_column'])
                ->limit($limit)
                ->pluck('id')
                ->each(function (int $appointmentId) use ($tenantId, $reminderType, $now, $staleBefore, &$queued): void {
                    if (! $this->lockDueAppointment($appointmentId, $reminderType, $now, $staleBefore)) {
                        return;
                    }

                    SendAppointmentReminderSmsJob::dispatch($tenantId, $appointmentId, $reminderType);
                    $queued++;
                });
        }

        return $queued;
    }

    public function sendDueReminder(
        int $appointmentId,
        string $reminderType = self::TYPE_24_HOURS,
        ?CarbonInterface $now = null,
    ): bool {
        $now = Carbon::parse($now ?? now());
        $definition = $this->definition($reminderType);

        return (bool) DB::transaction(function () use ($appointmentId, $reminderType, $definition, $now): bool {
            /** @var Appointment|null $appointment */
            $appointment = Appointment::query()->lockForUpdate()->find($appointmentId);

            // A hard-deleted appointment resolves to null. A cancelled,
            // completed, moved or expired appointment fails isSendable.
            if (! $appointment || ! $this->isSendable($appointment, $reminderType, $now)) {
                return false;
            }

            // This job already runs on the transactional SMS queue. Sending
            // here avoids creating a second stale outbound job that could run
            // after the appointment is cancelled or moved.
            $outbound = $this->appointmentSmsService->sendReminderNow(
                $appointment,
                $definition['template_key'],
            );

            if (! $outbound) {
                $appointment->forceFill([$definition['locked_column'] => null])->save();

                return false;
            }

            // Keep a failed attempt locked for the TTL instead of marking it
            // sent or retrying every five minutes. A later scheduler pass can
            // retry it, while reminder_sent_at continues to mean real success.
            if ($outbound->status !== 'sent') {
                return false;
            }

            $appointment->forceFill([
                $definition['sent_column'] => $now,
                $definition['locked_column'] => null,
            ])->save();

            return true;
        });
    }

    private function lockDueAppointment(
        int $appointmentId,
        string $reminderType,
        CarbonInterface $now,
        CarbonInterface $staleBefore,
    ): bool {
        $definition = $this->definition($reminderType);

        return Appointment::query()
            ->whereKey($appointmentId)
            ->where('status', 'booked')
            ->whereNotNull($definition['due_column'])
            ->where($definition['due_column'], '<=', $now)
            ->where('starts_at', '>', $now)
            ->where(function ($query): void {
                $query
                    ->whereNull('meta->suppress_reminders')
                    ->orWhere('meta->suppress_reminders', false);
            })
            ->whereNull($definition['sent_column'])
            ->whereNotNull('customer_phone_snapshot')
            ->where('customer_phone_snapshot', '!=', '')
            ->where(function ($query) use ($staleBefore, $definition): void {
                $query
                    ->whereNull($definition['locked_column'])
                    ->orWhere($definition['locked_column'], '<=', $staleBefore);
            })
            ->update([$definition['locked_column'] => $now]) === 1;
    }

    private function isSendable(Appointment $appointment, string $reminderType, CarbonInterface $now): bool
    {
        $definition = $this->definition($reminderType);

        if ($appointment->status !== 'booked') {
            return false;
        }

        if ((bool) ($appointment->meta['suppress_reminders'] ?? false)) {
            return false;
        }

        $sentAt = $appointment->getAttribute($definition['sent_column']);
        $dueAt = $appointment->getAttribute($definition['due_column']);

        if ($sentAt !== null || $dueAt === null) {
            return false;
        }

        if (Carbon::parse($dueAt)->gt($now) || $appointment->starts_at?->lte($now)) {
            return false;
        }

        $startsAt = Carbon::parse($appointment->starts_at);
        $earliestAllowedStart = $now->copy()->addMinutes($definition['min_remaining_minutes']);
        $latestAllowedStart = $now->copy()->addMinutes($definition['max_remaining_minutes']);

        // Repeat the time-window guard at execution time. A reminder can sit
        // in a delayed queue after it was valid at dispatch time, and must not
        // be sent after its useful window has passed.
        if ($startsAt->lt($earliestAllowedStart) || $startsAt->gt($latestAllowedStart)) {
            return false;
        }

        return trim((string) $appointment->customer_phone_snapshot) !== '';
    }

    /**
     * @return array{template_key:string,due_column:string,sent_column:string,locked_column:string,hours:int,min_remaining_minutes:int,max_remaining_minutes:int}
     */
    private function definition(string $reminderType): array
    {
        $definition = self::definitions()[$reminderType] ?? null;

        if ($definition === null) {
            throw new \InvalidArgumentException("Unsupported appointment reminder type [{$reminderType}].");
        }

        return $definition;
    }
}
