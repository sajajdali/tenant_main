<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Domain\Tenant\Models\NutritionDietRequest;
use App\Domain\Tenant\Models\SmsOutbound;
use App\Domain\Tenant\Models\SmsSetting;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantUser;
use App\Services\ArmanivaDietRequestSmsService;
use App\Services\Sms\SmsDispatchService;
use App\Support\JalaliDate;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Stancl\Tenancy\Contracts\Tenant as TenantContract;
use Tests\TestCase;

class ArmanivaDietRequestSmsServiceTest extends TestCase
{
    private string $originalConnection;

    protected function setUp(): void
    {
        parent::setUp();

        $this->originalConnection = (string) config('database.default');

        config([
            'app.locale' => 'fa',
            'database.default' => 'sqlite',
            'database.connections.sqlite.database' => ':memory:',
            'database.connections.sqlite.foreign_key_constraints' => false,
        ]);

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::create('sms_settings', function (Blueprint $table): void {
            $table->id();
            $table->boolean('enabled')->default(false);
            $table->string('provider')->nullable();
            $table->json('credentials')->nullable();
            $table->json('templates')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        app()->forgetInstance(TenantContract::class);
        DB::purge('sqlite');
        config(['database.default' => $this->originalConnection]);
        Mockery::close();

        parent::tearDown();
    }

    public function test_it_queues_a_manager_sms_for_every_armaniva_diet_request(): void
    {
        $this->bindTenantWithDomains(['https://www.armaniva.ir/']);

        $setting = SmsSetting::query()->create([
            'enabled' => false,
            'provider' => 'kavenegar',
            'credentials' => ['sender' => '1000'],
            'templates' => [],
        ]);

        $dispatch = Mockery::mock(SmsDispatchService::class);
        $requestedAt = Carbon::parse('2026-10-28 14:35:00', 'Asia/Tehran');
        $dispatch->shouldReceive('dispatchQueued')
            ->once()
            ->with($setting, Mockery::on(function (array $payload) use ($requestedAt): bool {
                return $payload['recipient_mobile'] === '09125189404'
                    && $payload['recipient_name'] === 'مدیر کل'
                    && $payload['type'] === 'nutrition_diet_manager_alert'
                    && $payload['template_key'] === 'armanivaDietRequestCreated'
                    && $payload['allow_negative_balance'] === true
                    && str_contains($payload['message'], 'یک درخواست رژیم برای مریم احمدی ارسال شده است.')
                    && str_contains($payload['message'], 'الگوی رژیم: کاهش وزن')
                    && str_contains($payload['message'], 'تاریخ درخواست: '.JalaliDate::format($requestedAt))
                    && str_contains($payload['message'], 'ساعت: ۱۴:۳۵');
            }))
            ->andReturn(new SmsOutbound);

        $user = new TenantUser(['name' => 'مریم احمدی', 'mobile' => '09120000000']);
        $dietRequest = new NutritionDietRequest([
            'request_type' => 'ai',
            'diet_template_name' => 'کاهش وزن',
        ]);
        $dietRequest->forceFill(['created_at' => $requestedAt]);
        $dietRequest->setRelation('user', $user);

        (new ArmanivaDietRequestSmsService($dispatch))->notify($dietRequest);
    }

    public function test_it_does_not_queue_the_manager_sms_for_another_tenant(): void
    {
        $this->bindTenantWithDomains(['example.ir']);

        $dispatch = Mockery::mock(SmsDispatchService::class);
        $dispatch->shouldNotReceive('dispatchQueued');

        (new ArmanivaDietRequestSmsService($dispatch))->notify(new NutritionDietRequest);
    }

    /** @param array<int, string> $domains */
    private function bindTenantWithDomains(array $domains): void
    {
        $relation = Mockery::mock();
        $relation->shouldReceive('pluck')->once()->with('domain')->andReturn(collect($domains));

        $tenant = Mockery::mock(Tenant::class)->makePartial();
        $tenant->shouldReceive('domains')->once()->andReturn($relation);

        app()->instance(TenantContract::class, $tenant);
    }
}
