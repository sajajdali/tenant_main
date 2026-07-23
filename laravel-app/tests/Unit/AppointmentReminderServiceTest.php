<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Domain\Booking\Models\Appointment;
use App\Domain\Tenant\Models\SmsOutbound;
use App\Jobs\SendAppointmentReminderSmsJob;
use App\Services\AppointmentReminderService;
use App\Services\AppointmentSmsService;
use App\Support\SmsTemplateRegistry;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class AppointmentReminderServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();
        Mockery::close();

        parent::tearDown();
    }

    public function test_it_calculates_independent_24_hour_and_3_hour_due_times(): void
    {
        $service = $this->service();
        $startsAt = Carbon::parse('2026-07-01 18:30:00');

        $attributes = $service->scheduleAttributesForStartsAt(
            $startsAt,
            Carbon::parse('2026-06-29 12:00:00'),
        );

        $this->assertSame('2026-06-30 18:30:00', $attributes['reminder_due_at']?->format('Y-m-d H:i:s'));
        $this->assertSame('2026-07-01 15:30:00', $attributes['reminder_3h_due_at']?->format('Y-m-d H:i:s'));
    }

    public function test_past_appointments_are_created_without_any_reminder_schedule(): void
    {
        $attributes = $this->service()->scheduleAttributesForStartsAt(
            Carbon::parse('2026-07-01 10:00:00'),
            Carbon::parse('2026-07-02 12:00:00'),
        );

        $this->assertNull($attributes['reminder_due_at']);
        $this->assertNull($attributes['reminder_3h_due_at']);
    }

    public function test_rescheduling_rearms_only_reminders_whose_new_due_time_is_in_the_future(): void
    {
        Carbon::setTestNow('2026-07-01 12:00:00');

        $appointment = new Appointment;
        $appointment->forceFill([
            'reminder_sent_at' => Carbon::parse('2026-06-30 10:00:00'),
            'reminder_3h_sent_at' => Carbon::parse('2026-07-01 10:30:00'),
            'reminder_locked_at' => Carbon::parse('2026-07-01 11:50:00'),
            'reminder_3h_locked_at' => Carbon::parse('2026-07-01 11:50:00'),
        ]);

        // The new appointment is 5 hours away: the 24h due time is already
        // past, while the 3h due time is still two hours in the future.
        $attributes = $this->service()->rescheduleAttributes(
            $appointment,
            Carbon::parse('2026-07-01 17:00:00'),
        );

        $this->assertNotNull($attributes['reminder_sent_at']);
        $this->assertNull($attributes['reminder_3h_sent_at']);
        $this->assertNull($attributes['reminder_locked_at']);
        $this->assertNull($attributes['reminder_3h_locked_at']);
    }

    public function test_rescheduling_inside_both_windows_preserves_sent_state_to_prevent_duplicates(): void
    {
        Carbon::setTestNow('2026-07-01 12:00:00');

        $appointment = new Appointment;
        $appointment->forceFill([
            'reminder_sent_at' => Carbon::parse('2026-06-30 12:00:00'),
            'reminder_3h_sent_at' => Carbon::parse('2026-07-01 11:00:00'),
        ]);

        $attributes = $this->service()->rescheduleAttributes(
            $appointment,
            Carbon::parse('2026-07-01 14:00:00'),
        );

        $this->assertNotNull($attributes['reminder_sent_at']);
        $this->assertNotNull($attributes['reminder_3h_sent_at']);
    }

    public function test_three_hour_default_template_is_active_approved_and_sendable(): void
    {
        $normalized = SmsTemplateRegistry::normalizeCollection([]);
        $approved = SmsTemplateRegistry::approvedTemplate([], 'reminderThreeHours');

        $this->assertTrue($normalized['reminderThreeHours']['enabled']);
        $this->assertSame('approved', $normalized['reminderThreeHours']['approval_status']);
        $this->assertTrue($normalized['reminderThreeHours']['approved_enabled']);
        $this->assertNotSame('', trim((string) $normalized['reminderThreeHours']['body']));
        $this->assertNotNull($approved);
    }

    public function test_each_reminder_uses_separate_due_sent_and_lock_columns(): void
    {
        $definitions = AppointmentReminderService::definitions();

        $this->assertCount(2, $definitions);
        $this->assertCount(2, array_unique(array_column($definitions, 'due_column')));
        $this->assertCount(2, array_unique(array_column($definitions, 'sent_column')));
        $this->assertCount(2, array_unique(array_column($definitions, 'locked_column')));
    }

    public function test_reminder_definitions_keep_the_requested_safe_send_windows(): void
    {
        $definitions = AppointmentReminderService::definitions();

        $this->assertSame(15 * 60, $definitions[AppointmentReminderService::TYPE_24_HOURS]['min_remaining_minutes']);
        $this->assertSame(48 * 60, $definitions[AppointmentReminderService::TYPE_24_HOURS]['max_remaining_minutes']);
        $this->assertSame(2 * 60, $definitions[AppointmentReminderService::TYPE_3_HOURS]['min_remaining_minutes']);
        $this->assertSame(3 * 60, $definitions[AppointmentReminderService::TYPE_3_HOURS]['max_remaining_minutes']);
    }

    public function test_due_reminders_are_locked_and_queued_only_once(): void
    {
        $this->withReminderDatabase(function (): void {
            Queue::fake();
            $now = Carbon::parse('2026-07-01 12:00:00');
            $dayReminderAppointment = $this->createAppointment([
                'starts_at' => '2026-07-02 08:00:00',
                'reminder_due_at' => '2026-07-01 11:00:00',
            ]);
            $threeHourReminderAppointment = $this->createAppointment([
                'starts_at' => '2026-07-01 14:30:00',
                'reminder_3h_due_at' => '2026-07-01 11:30:00',
            ]);

            $sms = Mockery::mock(AppointmentSmsService::class);
            $sms->shouldReceive('isReminderEnabled')->with('reminder')->twice()->andReturnTrue();
            $sms->shouldReceive('isReminderEnabled')->with('reminderThreeHours')->twice()->andReturnTrue();
            $service = new AppointmentReminderService($sms);

            $this->assertSame(2, $service->queueDueReminderJobs('tenant-1', $now));
            $this->assertSame(0, $service->queueDueReminderJobs('tenant-1', $now));

            Queue::assertPushed(SendAppointmentReminderSmsJob::class, 2);
            Queue::assertPushed(SendAppointmentReminderSmsJob::class, fn ($job) => $job->appointmentId === $dayReminderAppointment->id && $job->reminderType === AppointmentReminderService::TYPE_24_HOURS);
            Queue::assertPushed(SendAppointmentReminderSmsJob::class, fn ($job) => $job->appointmentId === $threeHourReminderAppointment->id && $job->reminderType === AppointmentReminderService::TYPE_3_HOURS);
        });
    }

    public function test_two_hour_appointment_only_queues_the_three_hour_reminder(): void
    {
        $this->withReminderDatabase(function (): void {
            Queue::fake();
            $now = Carbon::parse('2026-07-01 12:00:00');
            $appointment = $this->createAppointment([
                'starts_at' => '2026-07-01 14:00:00',
                'reminder_due_at' => '2026-06-30 14:00:00',
                'reminder_3h_due_at' => '2026-07-01 11:00:00',
            ]);

            $sms = Mockery::mock(AppointmentSmsService::class);
            $sms->shouldReceive('isReminderEnabled')->with('reminder')->once()->andReturnTrue();
            $sms->shouldReceive('isReminderEnabled')->with('reminderThreeHours')->once()->andReturnTrue();

            $this->assertSame(
                1,
                (new AppointmentReminderService($sms))->queueDueReminderJobs('tenant-1', $now),
            );

            Queue::assertNotPushed(
                SendAppointmentReminderSmsJob::class,
                fn ($job) => $job->appointmentId === $appointment->id
                    && $job->reminderType === AppointmentReminderService::TYPE_24_HOURS,
            );
            Queue::assertPushed(
                SendAppointmentReminderSmsJob::class,
                fn ($job) => $job->appointmentId === $appointment->id
                    && $job->reminderType === AppointmentReminderService::TYPE_3_HOURS,
            );
        });
    }

    public function test_reminders_are_not_queued_after_their_minimum_remaining_time(): void
    {
        $this->withReminderDatabase(function (): void {
            Queue::fake();
            $now = Carbon::parse('2026-07-01 12:00:00');
            $this->createAppointment([
                'starts_at' => '2026-07-01 13:59:59',
                'reminder_due_at' => '2026-06-30 13:59:59',
                'reminder_3h_due_at' => '2026-07-01 10:59:59',
            ]);

            $sms = Mockery::mock(AppointmentSmsService::class);
            $sms->shouldReceive('isReminderEnabled')->with('reminder')->once()->andReturnTrue();
            $sms->shouldReceive('isReminderEnabled')->with('reminderThreeHours')->once()->andReturnTrue();

            $this->assertSame(
                0,
                (new AppointmentReminderService($sms))->queueDueReminderJobs('tenant-1', $now),
            );
            Queue::assertNothingPushed();
        });
    }

    public function test_reminders_are_not_queued_before_their_maximum_remaining_time(): void
    {
        $this->withReminderDatabase(function (): void {
            Queue::fake();
            $now = Carbon::parse('2026-07-01 12:00:00');
            $this->createAppointment([
                'starts_at' => '2026-07-03 13:00:00',
                'reminder_due_at' => '2026-07-01 11:00:00',
            ]);
            $this->createAppointment([
                'starts_at' => '2026-07-01 15:00:01',
                'reminder_3h_due_at' => '2026-07-01 11:00:00',
            ]);

            $sms = Mockery::mock(AppointmentSmsService::class);
            $sms->shouldReceive('isReminderEnabled')->with('reminder')->once()->andReturnTrue();
            $sms->shouldReceive('isReminderEnabled')->with('reminderThreeHours')->once()->andReturnTrue();

            $this->assertSame(
                0,
                (new AppointmentReminderService($sms))->queueDueReminderJobs('tenant-1', $now),
            );
            Queue::assertNothingPushed();
        });
    }

    public function test_disabled_reminders_are_not_locked_or_queued(): void
    {
        $this->withReminderDatabase(function (): void {
            Queue::fake();
            $appointment = $this->createAppointment([
                'starts_at' => '2026-07-01 18:00:00',
                'reminder_due_at' => '2026-07-01 11:00:00',
                'reminder_3h_due_at' => '2026-07-01 11:30:00',
            ]);

            $sms = Mockery::mock(AppointmentSmsService::class);
            $sms->shouldReceive('isReminderEnabled')->with('reminder')->once()->andReturnFalse();
            $sms->shouldReceive('isReminderEnabled')->with('reminderThreeHours')->once()->andReturnFalse();

            $queued = (new AppointmentReminderService($sms))->queueDueReminderJobs(
                'tenant-1',
                Carbon::parse('2026-07-01 12:00:00'),
            );

            $this->assertSame(0, $queued);
            $this->assertNull($appointment->fresh()?->reminder_locked_at);
            $this->assertNull($appointment->fresh()?->reminder_3h_locked_at);
            Queue::assertNothingPushed();
        });
    }

    public function test_cancelled_deleted_and_moved_appointments_are_rejected_again_at_send_time(): void
    {
        $this->withReminderDatabase(function (): void {
            $now = Carbon::parse('2026-07-01 12:00:00');
            $sms = Mockery::mock(AppointmentSmsService::class);
            $sms->shouldNotReceive('sendReminderNow');
            $service = new AppointmentReminderService($sms);

            $cancelled = $this->createAppointment([
                'status' => 'cancelled',
                'starts_at' => '2026-07-01 18:00:00',
                'reminder_3h_due_at' => '2026-07-01 11:00:00',
            ]);
            $moved = $this->createAppointment([
                'starts_at' => '2026-07-02 18:00:00',
                'reminder_3h_due_at' => '2026-07-02 15:00:00',
            ]);
            $deleted = $this->createAppointment([
                'starts_at' => '2026-07-01 18:00:00',
                'reminder_3h_due_at' => '2026-07-01 11:00:00',
            ]);
            $deletedId = $deleted->id;
            $deleted->delete();

            $this->assertFalse($service->sendDueReminder($cancelled->id, AppointmentReminderService::TYPE_3_HOURS, $now));
            $this->assertFalse($service->sendDueReminder($moved->id, AppointmentReminderService::TYPE_3_HOURS, $now));
            $this->assertFalse($service->sendDueReminder($deletedId, AppointmentReminderService::TYPE_3_HOURS, $now));
        });
    }

    public function test_suppressed_past_entry_can_never_send_a_stale_reminder_job(): void
    {
        $this->withReminderDatabase(function (): void {
            $now = Carbon::parse('2026-07-01 12:00:00');
            $appointment = $this->createAppointment([
                'starts_at' => '2026-07-01 14:30:00',
                'reminder_3h_due_at' => '2026-07-01 11:00:00',
                'reminder_3h_locked_at' => $now,
                'meta' => ['suppress_reminders' => true, 'is_past_entry' => true],
            ]);

            $sms = Mockery::mock(AppointmentSmsService::class);
            $sms->shouldNotReceive('sendReminderNow');

            $this->assertFalse((new AppointmentReminderService($sms))->sendDueReminder(
                $appointment->id,
                AppointmentReminderService::TYPE_3_HOURS,
                $now,
            ));
            $this->assertNull($appointment->fresh()?->reminder_3h_sent_at);
        });
    }

    public function test_successful_send_is_recorded_once_and_a_second_job_cannot_duplicate_it(): void
    {
        $this->withReminderDatabase(function (): void {
            $now = Carbon::parse('2026-07-01 12:00:00');
            $appointment = $this->createAppointment([
                'starts_at' => '2026-07-01 14:30:00',
                'reminder_3h_due_at' => '2026-07-01 11:00:00',
                'reminder_3h_locked_at' => $now,
            ]);

            $sentOutbound = new SmsOutbound;
            $sentOutbound->forceFill(['status' => 'sent']);
            $sms = Mockery::mock(AppointmentSmsService::class);
            $sms->shouldReceive('sendReminderNow')
                ->once()
                ->with(Mockery::type(Appointment::class), 'reminderThreeHours')
                ->andReturn($sentOutbound);
            $service = new AppointmentReminderService($sms);

            $this->assertTrue($service->sendDueReminder($appointment->id, AppointmentReminderService::TYPE_3_HOURS, $now));
            $this->assertFalse($service->sendDueReminder($appointment->id, AppointmentReminderService::TYPE_3_HOURS, $now));
            $this->assertNotNull($appointment->fresh()?->reminder_3h_sent_at);
            $this->assertNull($appointment->fresh()?->reminder_3h_locked_at);
        });
    }

    public function test_failed_gateway_attempt_is_not_marked_sent_and_waits_for_lock_ttl_before_retry(): void
    {
        $this->withReminderDatabase(function (): void {
            $now = Carbon::parse('2026-07-01 12:00:00');
            $appointment = $this->createAppointment([
                'starts_at' => '2026-07-01 14:30:00',
                'reminder_3h_due_at' => '2026-07-01 11:00:00',
                'reminder_3h_locked_at' => $now,
            ]);

            $failedOutbound = new SmsOutbound;
            $failedOutbound->forceFill(['status' => 'failed']);
            $sms = Mockery::mock(AppointmentSmsService::class);
            $sms->shouldReceive('sendReminderNow')->once()->andReturn($failedOutbound);

            $this->assertFalse((new AppointmentReminderService($sms))->sendDueReminder(
                $appointment->id,
                AppointmentReminderService::TYPE_3_HOURS,
                $now,
            ));

            $fresh = $appointment->fresh();
            $this->assertNull($fresh?->reminder_3h_sent_at);
            $this->assertNotNull($fresh?->reminder_3h_locked_at);
        });
    }

    public function test_delayed_three_hour_job_is_rejected_below_two_hours_remaining(): void
    {
        $this->withReminderDatabase(function (): void {
            $now = Carbon::parse('2026-07-01 12:00:01');
            $appointment = $this->createAppointment([
                'starts_at' => '2026-07-01 14:00:00',
                'reminder_3h_due_at' => '2026-07-01 11:00:00',
                'reminder_3h_locked_at' => '2026-07-01 12:00:00',
            ]);

            $sms = Mockery::mock(AppointmentSmsService::class);
            $sms->shouldNotReceive('sendReminderNow');

            $this->assertFalse((new AppointmentReminderService($sms))->sendDueReminder(
                $appointment->id,
                AppointmentReminderService::TYPE_3_HOURS,
                $now,
            ));
            $this->assertNull($appointment->fresh()?->reminder_3h_sent_at);
        });
    }

    public function test_delayed_day_reminder_is_rejected_below_fifteen_hours_remaining(): void
    {
        $this->withReminderDatabase(function (): void {
            $now = Carbon::parse('2026-07-01 12:00:01');
            $appointment = $this->createAppointment([
                'starts_at' => '2026-07-02 03:00:00',
                'reminder_due_at' => '2026-07-01 03:00:00',
                'reminder_locked_at' => '2026-07-01 12:00:00',
            ]);

            $sms = Mockery::mock(AppointmentSmsService::class);
            $sms->shouldNotReceive('sendReminderNow');

            $this->assertFalse((new AppointmentReminderService($sms))->sendDueReminder(
                $appointment->id,
                AppointmentReminderService::TYPE_24_HOURS,
                $now,
            ));
            $this->assertNull($appointment->fresh()?->reminder_sent_at);
        });
    }

    private function service(): AppointmentReminderService
    {
        return new AppointmentReminderService(Mockery::mock(AppointmentSmsService::class));
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function createAppointment(array $attributes = []): Appointment
    {
        return Appointment::query()->create([
            'status' => 'booked',
            'starts_at' => '2026-07-01 18:00:00',
            'customer_phone_snapshot' => '09121234567',
            'reminder_due_at' => null,
            'reminder_sent_at' => null,
            'reminder_locked_at' => null,
            'reminder_3h_due_at' => null,
            'reminder_3h_sent_at' => null,
            'reminder_3h_locked_at' => null,
            ...$attributes,
        ]);
    }

    private function withReminderDatabase(callable $callback): void
    {
        $originalDefault = (string) config('database.default');

        config([
            'database.default' => 'reminder_testing',
            'database.connections.reminder_testing' => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
                'foreign_key_constraints' => true,
            ],
        ]);
        DB::purge('reminder_testing');

        Schema::create('appointments', function (Blueprint $table): void {
            $table->id();
            $table->string('status')->default('booked');
            $table->dateTime('starts_at')->nullable();
            $table->string('customer_phone_snapshot')->nullable();
            $table->dateTime('reminder_due_at')->nullable();
            $table->dateTime('reminder_sent_at')->nullable();
            $table->dateTime('reminder_locked_at')->nullable();
            $table->dateTime('reminder_3h_due_at')->nullable();
            $table->dateTime('reminder_3h_sent_at')->nullable();
            $table->dateTime('reminder_3h_locked_at')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
        });

        try {
            $callback();
        } finally {
            DB::disconnect('reminder_testing');
            config(['database.default' => $originalDefault]);
            DB::purge($originalDefault);
        }
    }
}
