<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\SmsSetting;
use App\Domain\Tenant\Models\TenantUser;
use App\Services\Sms\SmsDispatchService;
use App\Support\SmsTemplateRegistry;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

class NutritionMealLogReminderService
{
    private const FIRST_TEMPLATE_KEY = 'mealLogInactiveThreeDaysFirst';
    private const SECOND_TEMPLATE_KEY = 'mealLogInactiveThreeDaysSecond';
    private const MAX_REMINDERS_PER_PRESCRIPTION = 2;

    public function __construct(private readonly SmsDispatchService $smsDispatch)
    {
    }

    public function queueDueReminders(int $limit = 200, ?Carbon $now = null): int
    {
        if (! $this->hasRequiredTables()) {
            return 0;
        }

        $now = ($now ?? now())->copy();
        $threshold = $now->copy()->subDays(3);
        $today = $now->toDateString();
        $queued = 0;

        $smsSetting = SmsSetting::query()->first();

        if (! $smsSetting || ! (bool) $smsSetting->enabled || trim((string) $smsSetting->provider) === '') {
            return 0;
        }

        $templates = is_array($smsSetting->templates['nutrition_v2'] ?? null) ? $smsSetting->templates['nutrition_v2'] : [];
        $approvedTemplates = [
            1 => SmsTemplateRegistry::approvedNutritionTemplate($templates, self::FIRST_TEMPLATE_KEY),
            2 => SmsTemplateRegistry::approvedNutritionTemplate($templates, self::SECOND_TEMPLATE_KEY),
        ];
        $nutritionEnabled = (bool) ($smsSetting->templates['nutrition_enabled'] ?? false);

        if (! $nutritionEnabled || ! $this->hasAnyEnabledTemplate($approvedTemplates)) {
            return 0;
        }

        $prescriptions = DB::table('nutrition_diet_prescriptions as pr')
            ->join('users as u', 'u.id', '=', 'pr.user_id')
            ->leftJoin('sms_blacklists as blacklist', 'blacklist.phone', '=', 'u.mobile')
            ->leftJoin('nutrition_meal_log_reminders as sent_reminders', 'sent_reminders.nutrition_diet_prescription_id', '=', 'pr.id')
            ->where('pr.status', 'active')
            ->where('pr.is_current', true)
            ->whereNotNull('pr.published_at')
            ->where(function ($query) use ($threshold): void {
                $query->whereDate('pr.started_at', '<=', $threshold->toDateString())
                    ->orWhere(function ($nested) use ($threshold): void {
                        $nested->whereNull('pr.started_at')
                            ->where('pr.published_at', '<=', $threshold);
                    });
            })
            ->where(function ($query) use ($today): void {
                $query->whereNull('pr.ends_at')
                    ->orWhereDate('pr.ends_at', '>=', $today);
            })
            ->where('u.role', 'customer')
            ->where('u.is_active', true)
            ->whereNotNull('u.mobile')
            ->where('u.mobile', '<>', '')
            ->whereNull('blacklist.id')
            ->whereNotExists(function ($query) use ($threshold): void {
                $query->selectRaw('1')
                    ->from('nutrition_meal_logs as log')
                    ->whereColumn('log.user_id', 'pr.user_id')
                    ->where(function ($nested) use ($threshold): void {
                        $nested->where('log.created_at', '>=', $threshold)
                            ->orWhere('log.consumed_at', '>=', $threshold)
                            ->orWhereDate('log.consumed_date', '>=', $threshold->toDateString());
                    });
            })
            ->groupBy('pr.id', 'pr.user_id', 'u.name', 'u.mobile')
            ->havingRaw('COUNT(sent_reminders.id) < ?', [self::MAX_REMINDERS_PER_PRESCRIPTION])
            ->havingRaw('(COUNT(sent_reminders.id) = 0 OR MAX(sent_reminders.queued_at) <= ?)', [$threshold])
            ->select([
                'pr.id as prescription_id',
                'pr.user_id',
                'u.name',
                'u.mobile',
            ])
            ->selectRaw('COUNT(sent_reminders.id) as reminder_count')
            ->orderBy('pr.id')
            ->limit(max(1, $limit))
            ->get();

        foreach ($prescriptions as $prescription) {
            $reminderNumber = ((int) ($prescription->reminder_count ?? 0)) + 1;
            $template = $approvedTemplates[$reminderNumber] ?? null;

            if (! $template || ! (bool) ($template['enabled'] ?? false)) {
                continue;
            }

            if ($this->queueReminder($smsSetting, $template, $prescription, $reminderNumber, $today, $threshold)) {
                $queued++;
            }
        }

        return $queued;
    }

    private function queueReminder(SmsSetting $smsSetting, array $template, object $prescription, int $reminderNumber, string $today, Carbon $threshold): bool
    {
        try {
            return DB::transaction(function () use ($smsSetting, $template, $prescription, $reminderNumber, $today, $threshold): bool {
                if (! $this->prescriptionIsStillDue((int) $prescription->prescription_id, $reminderNumber, $today, $threshold)) {
                    return false;
                }

                $inserted = DB::table('nutrition_meal_log_reminders')->insertOrIgnore([
                    'nutrition_diet_prescription_id' => (int) $prescription->prescription_id,
                    'user_id' => (int) $prescription->user_id,
                    'sms_outbound_id' => null,
                    'template_key' => (string) ($template['key'] ?? $this->templateKeyForReminder($reminderNumber)),
                    'reminder_number' => $reminderNumber,
                    'reminder_due_date' => $today,
                    'queued_at' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                if ($inserted !== 1) {
                    return false;
                }

                $user = new TenantUser([
                    'name' => (string) ($prescription->name ?? ''),
                    'mobile' => (string) ($prescription->mobile ?? ''),
                ]);

                $outbound = $this->smsDispatch->dispatchQueued($smsSetting, [
                    'type' => 'nutrition_meal_log_reminder',
                    'template_key' => (string) ($template['key'] ?? $this->templateKeyForReminder($reminderNumber)),
                    'recipient_mobile' => (string) $prescription->mobile,
                    'recipient_name' => (string) ($prescription->name ?? ''),
                    'message' => $this->render((string) ($template['body'] ?? ''), $user),
                ]);

                DB::table('nutrition_meal_log_reminders')
                    ->where('nutrition_diet_prescription_id', (int) $prescription->prescription_id)
                    ->where('reminder_number', $reminderNumber)
                    ->update([
                        'sms_outbound_id' => $outbound->id,
                        'queued_at' => now(),
                        'updated_at' => now(),
                    ]);

                return true;
            });
        } catch (Throwable) {
            return false;
        }
    }

    /**
     * @param  array<int, array<string, mixed>|null>  $templates
     */
    private function hasAnyEnabledTemplate(array $templates): bool
    {
        foreach ($templates as $template) {
            if ($template && (bool) ($template['enabled'] ?? false)) {
                return true;
            }
        }

        return false;
    }

    private function templateKeyForReminder(int $reminderNumber): string
    {
        return $reminderNumber === 1 ? self::FIRST_TEMPLATE_KEY : self::SECOND_TEMPLATE_KEY;
    }

    private function prescriptionIsStillDue(int $prescriptionId, int $reminderNumber, string $today, Carbon $threshold): bool
    {
        if ($reminderNumber < 1 || $reminderNumber > self::MAX_REMINDERS_PER_PRESCRIPTION) {
            return false;
        }

        $prescription = DB::table('nutrition_diet_prescriptions')
            ->where('id', $prescriptionId)
            ->lockForUpdate()
            ->first(['id', 'user_id', 'status', 'is_current', 'started_at', 'ends_at', 'published_at']);

        if (! $prescription
            || (string) $prescription->status !== 'active'
            || ! (bool) $prescription->is_current
            || $prescription->published_at === null
            || ($prescription->ends_at !== null && Carbon::parse($prescription->ends_at)->toDateString() < $today)
        ) {
            return false;
        }

        $startedAt = $prescription->started_at !== null
            ? Carbon::parse($prescription->started_at)
            : Carbon::parse($prescription->published_at);

        if ($startedAt->gt($threshold)) {
            return false;
        }

        $sentReminders = DB::table('nutrition_meal_log_reminders')
            ->where('nutrition_diet_prescription_id', $prescriptionId)
            ->orderByDesc('reminder_number')
            ->get(['reminder_number', 'queued_at']);

        if ($sentReminders->count() !== $reminderNumber - 1) {
            return false;
        }

        if ($sentReminders->isNotEmpty()) {
            $lastQueuedAt = $sentReminders->first()->queued_at;

            if ($lastQueuedAt === null || Carbon::parse($lastQueuedAt)->gt($threshold)) {
                return false;
            }
        }

        return ! DB::table('nutrition_meal_logs as log')
            ->where('log.user_id', (int) $prescription->user_id)
            ->where(function ($query) use ($threshold): void {
                $query->where('log.created_at', '>=', $threshold)
                    ->orWhere('log.consumed_at', '>=', $threshold)
                    ->orWhereDate('log.consumed_date', '>=', $threshold->toDateString());
            })
            ->exists();
    }

    private function render(string $body, TenantUser $user): string
    {
        return strtr($body, [
            '{{customer_name}}' => trim((string) ($user->name ?? 'کاربر')) ?: 'کاربر',
            '{{business_name}}' => $this->businessName(),
            '{{profile_url}}' => url('/nutrition/profile'),
            '{{panel_url}}' => url('/nutrition/profile'),
            '{{purchase_url}}' => url('/nutrition/membership/packages'),
        ]);
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
        return Schema::hasTable('nutrition_diet_prescriptions')
            && Schema::hasTable('nutrition_meal_logs')
            && Schema::hasTable('nutrition_meal_log_reminders')
            && Schema::hasTable('sms_outbounds')
            && Schema::hasTable('sms_settings')
            && Schema::hasTable('users');
    }
}
