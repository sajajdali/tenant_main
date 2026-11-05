<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\CustomerClubSetting;
use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\SmsSetting;
use App\Services\Sms\SmsDispatchService;
use App\Support\SmsGatewaySettings;
use App\Support\SmsQueue;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

class CustomerBirthdaySmsService
{
    public function __construct(private readonly SmsDispatchService $smsDispatch)
    {
    }

    public function queueTodaysMessages(int $chunkSize = 100, ?Carbon $now = null): int
    {
        if (! $this->hasRequiredTables()) {
            return 0;
        }

        $now = ($now ?? Carbon::now('Asia/Tehran'))->copy()->timezone('Asia/Tehran');
        $settings = CustomerClubSetting::query()->first();
        $templateName = trim((string) ($settings?->birthday_sms_template_name ?? ''));
        $smsSetting = SmsSetting::query()->first();

        if (! $settings?->birthday_sms_enabled
            || $templateName === ''
            || ! $smsSetting?->enabled
            || SmsGatewaySettings::shSmsApiKey() === ''
        ) {
            return 0;
        }

        $businessName = $this->businessName();
        $queued = 0;
        $query = DB::table('users as u')
            ->when(Schema::hasTable('sms_blacklists'), function ($query): void {
                $query->leftJoin('sms_blacklists as blacklist', 'blacklist.phone', '=', 'u.mobile')
                    ->whereNull('blacklist.id');
            })
            ->where('u.role', 'customer')
            ->where('u.is_active', true)
            ->whereNotNull('u.birth_date')
            ->whereNotNull('u.mobile')
            ->where('u.mobile', '<>', '')
            ->whereMonth('u.birth_date', $now->month)
            ->whereDay('u.birth_date', $now->day)
            ->select(['u.id', 'u.name', 'u.mobile'])
            ->orderBy('u.id');

        $query->chunkById(max(1, $chunkSize), function ($users) use ($smsSetting, $templateName, $businessName, $now, &$queued): void {
            foreach ($users as $user) {
                if ($this->queueForUser($smsSetting, $templateName, $businessName, $user, $now)) {
                    $queued++;
                }
            }
        }, 'u.id', 'id');

        return $queued;
    }

    private function queueForUser(SmsSetting $smsSetting, string $templateName, string $businessName, object $user, Carbon $now): bool
    {
        try {
            return DB::transaction(function () use ($smsSetting, $templateName, $businessName, $user, $now): bool {
                $inserted = DB::table('customer_birthday_sms_sends')->insertOrIgnore([
                    'user_id' => (int) $user->id,
                    'sms_outbound_id' => null,
                    'birthday_year' => $now->year,
                    'birthday_date' => $now->toDateString(),
                    'template_name' => $templateName,
                    'queued_at' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                if ($inserted !== 1) {
                    return false;
                }

                $customerName = trim((string) ($user->name ?? '')) ?: 'کاربر';
                $outbound = $this->smsDispatch->dispatchQueued($smsSetting, [
                    'type' => 'customer_birthday',
                    'template_key' => 'customerBirthday',
                    'provider' => 'shsms',
                    'provider_template' => $templateName,
                    'provider_params' => [$customerName, $businessName],
                    'recipient_mobile' => (string) $user->mobile,
                    'recipient_name' => $customerName,
                    'message' => "{$customerName} عزیز، تولدتان مبارک. با آرزوی سلامتی و شادی؛ {$businessName}",
                    'queue' => SmsQueue::TRANSACTIONAL,
                    'after_commit' => true,
                ]);

                DB::table('customer_birthday_sms_sends')
                    ->where('user_id', (int) $user->id)
                    ->where('birthday_year', $now->year)
                    ->update([
                        'sms_outbound_id' => $outbound->id,
                        'queued_at' => now(),
                        'updated_at' => now(),
                    ]);

                return true;
            });
        } catch (Throwable $exception) {
            report($exception);

            return false;
        }
    }

    private function businessName(): string
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $appearance = is_array($rules['appearance'] ?? null) ? $rules['appearance'] : [];
        $storeName = trim((string) ($appearance['store_name'] ?? ''));

        return $storeName !== '' ? $storeName : (string) (tenant()?->name ?? 'مجموعه');
    }

    private function hasRequiredTables(): bool
    {
        return Schema::hasTable('customer_club_settings')
            && Schema::hasColumn('customer_club_settings', 'birthday_sms_enabled')
            && Schema::hasTable('customer_birthday_sms_sends')
            && Schema::hasTable('sms_outbounds')
            && Schema::hasColumn('sms_outbounds', 'provider_template')
            && Schema::hasTable('sms_settings')
            && Schema::hasTable('users');
    }
}
