<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Domain\Tenant\Models\SmsOutbound;
use App\Domain\Tenant\Models\SmsSetting;
use App\Services\NutritionMealLogReminderService;
use App\Services\Sms\SmsDispatchService;
use App\Support\SmsTemplateRegistry;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class NutritionMealLogReminderServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();
        Mockery::close();

        parent::tearDown();
    }

    public function test_it_sends_each_inactive_meal_log_reminder_once_per_active_diet(): void
    {
        $this->withReminderDatabase(function (): void {
            Carbon::setTestNow('2026-08-09 10:20:00');
            $this->seedSmsSetting();
            $userId = $this->createCustomer();
            $prescriptionId = $this->createPrescription($userId, [
                'started_at' => '2026-08-01',
                'ends_at' => '2026-08-20',
                'published_at' => '2026-08-01 08:00:00',
            ]);
            $service = $this->service();

            $this->assertSame(1, $service->queueDueReminders(10, Carbon::parse('2026-08-09 10:20:00')));
            $this->assertSame(0, $service->queueDueReminders(10, Carbon::parse('2026-08-09 10:25:00')));

            $this->assertSame(1, $service->queueDueReminders(10, Carbon::parse('2026-08-12 10:21:00')));
            $this->assertSame(0, $service->queueDueReminders(10, Carbon::parse('2026-08-16 10:21:00')));

            $reminders = DB::table('nutrition_meal_log_reminders')
                ->where('nutrition_diet_prescription_id', $prescriptionId)
                ->orderBy('reminder_number')
                ->get(['reminder_number', 'template_key']);

            $this->assertCount(2, $reminders);
            $this->assertSame(1, (int) $reminders[0]->reminder_number);
            $this->assertSame('mealLogInactiveThreeDaysFirst', $reminders[0]->template_key);
            $this->assertSame(2, (int) $reminders[1]->reminder_number);
            $this->assertSame('mealLogInactiveThreeDaysSecond', $reminders[1]->template_key);
            $this->assertSame(2, DB::table('sms_outbounds')->count());
        });
    }

    public function test_it_does_not_send_when_diet_is_not_active_for_three_days_or_has_recent_food_logs(): void
    {
        $this->withReminderDatabase(function (): void {
            $this->seedSmsSetting();
            $service = $this->service();
            $now = Carbon::parse('2026-08-09 10:20:00');

            $newUserId = $this->createCustomer('09120000002');
            $this->createPrescription($newUserId, [
                'started_at' => '2026-08-08',
                'ends_at' => '2026-08-20',
                'published_at' => '2026-08-08 08:00:00',
            ]);

            $loggedUserId = $this->createCustomer('09120000003');
            $this->createPrescription($loggedUserId, [
                'started_at' => '2026-08-01',
                'ends_at' => '2026-08-20',
                'published_at' => '2026-08-01 08:00:00',
            ]);
            DB::table('nutrition_meal_logs')->insert([
                'user_id' => $loggedUserId,
                'consumed_date' => '2026-08-08',
                'consumed_at' => '2026-08-08 12:00:00',
                'created_at' => '2026-08-08 12:00:00',
                'updated_at' => '2026-08-08 12:00:00',
            ]);

            $expiredUserId = $this->createCustomer('09120000004');
            $this->createPrescription($expiredUserId, [
                'started_at' => '2026-08-01',
                'ends_at' => '2026-08-08',
                'published_at' => '2026-08-01 08:00:00',
            ]);

            $this->assertSame(0, $service->queueDueReminders(10, $now));
            $this->assertSame(0, DB::table('nutrition_meal_log_reminders')->count());
        });
    }

    private function service(): NutritionMealLogReminderService
    {
        $dispatch = Mockery::mock(SmsDispatchService::class);
        $dispatch->shouldReceive('dispatchQueued')
            ->andReturnUsing(function (SmsSetting $setting, array $payload): SmsOutbound {
                return SmsOutbound::query()->create([
                    'type' => (string) $payload['type'],
                    'template_key' => (string) $payload['template_key'],
                    'provider' => (string) $setting->provider,
                    'sender' => '1000',
                    'recipient_mobile' => (string) $payload['recipient_mobile'],
                    'recipient_name' => (string) ($payload['recipient_name'] ?? ''),
                    'message' => (string) $payload['message'],
                    'message_encoding' => 'utf-8',
                    'parts_count' => 1,
                    'unit_price' => 1,
                    'total_price' => 1,
                    'status' => 'pending',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });

        return new NutritionMealLogReminderService($dispatch);
    }

    private function seedSmsSetting(): void
    {
        DB::table('sms_settings')->insert([
            'enabled' => true,
            'provider' => 'fake',
            'credentials' => json_encode(['sender' => '1000']),
            'templates' => json_encode([
                'nutrition_enabled' => true,
                'nutrition_v2' => SmsTemplateRegistry::normalizeNutritionCollection([]),
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function createCustomer(string $mobile = '09120000001'): int
    {
        return (int) DB::table('users')->insertGetId([
            'name' => 'کاربر تست',
            'mobile' => $mobile,
            'role' => 'customer',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createPrescription(int $userId, array $overrides = []): int
    {
        return (int) DB::table('nutrition_diet_prescriptions')->insertGetId([
            ...[
                'user_id' => $userId,
                'status' => 'active',
                'is_current' => true,
                'started_at' => '2026-08-01',
                'ends_at' => '2026-08-20',
                'published_at' => '2026-08-01 08:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            ...$overrides,
        ]);
    }

    private function withReminderDatabase(callable $callback): void
    {
        config([
            'database.default' => 'sqlite',
            'database.connections.sqlite.database' => ':memory:',
            'database.connections.sqlite.foreign_key_constraints' => false,
        ]);
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('nutrition_meal_log_reminders');
        Schema::dropIfExists('nutrition_meal_logs');
        Schema::dropIfExists('nutrition_diet_prescriptions');
        Schema::dropIfExists('sms_blacklists');
        Schema::dropIfExists('sms_outbounds');
        Schema::dropIfExists('sms_settings');
        Schema::dropIfExists('general_settings');
        Schema::dropIfExists('users');

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('name')->nullable();
            $table->string('mobile')->nullable();
            $table->string('role')->default('customer');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('general_settings', function (Blueprint $table): void {
            $table->id();
            $table->json('booking_rules')->nullable();
            $table->timestamps();
        });

        Schema::create('sms_settings', function (Blueprint $table): void {
            $table->id();
            $table->boolean('enabled')->default(false);
            $table->string('provider')->nullable();
            $table->json('credentials')->nullable();
            $table->json('templates')->nullable();
            $table->timestamps();
        });

        Schema::create('sms_outbounds', function (Blueprint $table): void {
            $table->id();
            $table->string('type')->nullable();
            $table->string('template_key')->nullable();
            $table->string('provider')->nullable();
            $table->string('sender')->nullable();
            $table->string('recipient_mobile');
            $table->string('recipient_name')->nullable();
            $table->text('message');
            $table->string('message_encoding')->nullable();
            $table->unsignedInteger('parts_count')->default(1);
            $table->unsignedInteger('unit_price')->default(0);
            $table->unsignedInteger('total_price')->default(0);
            $table->string('status')->default('pending');
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();
        });

        Schema::create('sms_blacklists', function (Blueprint $table): void {
            $table->id();
            $table->string('phone');
            $table->timestamps();
        });

        Schema::create('nutrition_diet_prescriptions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id');
            $table->string('status')->default('active');
            $table->boolean('is_current')->default(true);
            $table->date('started_at')->nullable();
            $table->date('ends_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });

        Schema::create('nutrition_meal_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id');
            $table->foreignId('nutrition_diet_prescription_id')->nullable();
            $table->date('consumed_date')->nullable();
            $table->timestamp('consumed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('nutrition_meal_log_reminders', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('nutrition_diet_prescription_id');
            $table->foreignId('user_id');
            $table->foreignId('sms_outbound_id')->nullable();
            $table->string('template_key', 120);
            $table->unsignedTinyInteger('reminder_number');
            $table->date('reminder_due_date');
            $table->timestamp('queued_at')->nullable();
            $table->timestamps();
            $table->unique(['nutrition_diet_prescription_id', 'reminder_number'], 'nutrition_meal_log_reminders_once_unique');
        });

        try {
            $callback();
        } finally {
            Schema::dropIfExists('nutrition_meal_log_reminders');
            Schema::dropIfExists('nutrition_meal_logs');
            Schema::dropIfExists('nutrition_diet_prescriptions');
            Schema::dropIfExists('sms_blacklists');
            Schema::dropIfExists('sms_outbounds');
            Schema::dropIfExists('sms_settings');
            Schema::dropIfExists('general_settings');
            Schema::dropIfExists('users');
        }
    }
}
