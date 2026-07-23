<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Tenant\Models\TenantSubscriptionPayment;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class SmsRevenueService
{
    public const SYSTEM_KEY = 'sms_revenue_tracking';

    public function __construct(
        private readonly FinancialLedgerService $financialLedgerService,
    ) {
    }

    public function summary(): array
    {
        $realPayments = TenantSubscriptionPayment::query()
            ->where('payment_type', 'sms_credit_topup')
            ->where('status', 'paid')
            ->where('sandbox_mode', false)
            ->get()
            ->filter(fn (TenantSubscriptionPayment $payment): bool => (bool) ($payment->metadata['counts_as_revenue'] ?? true));

        $totalRevenue = (int) $realPayments->sum('payable_amount');

        $sandboxRevenue = (int) TenantSubscriptionPayment::query()
            ->where('payment_type', 'sms_credit_topup')
            ->where('status', 'paid')
            ->where('sandbox_mode', true)
            ->sum('payable_amount');

        $giftExpense = (int) $this->financialLedgerService
            ->smsGiftExpenses()
            ->sum('amount');

        $withdrawals = $this->withdrawals();
        $totalWithdrawn = (int) $withdrawals->sum('amount');
        $netRevenue = max(0, $totalRevenue - $giftExpense);

        return [
            'totalRevenue' => $totalRevenue,
            'sandboxRevenue' => $sandboxRevenue,
            'giftExpense' => $giftExpense,
            'netRevenue' => $netRevenue,
            'totalWithdrawn' => $totalWithdrawn,
            'availableToWithdraw' => max(0, $netRevenue - $totalWithdrawn),
            'withdrawalsCount' => $withdrawals->count(),
        ];
    }

    public function withdrawals(): Collection
    {
        $raw = SystemSetting::getValue(static::SYSTEM_KEY, [
            'withdrawals' => [],
        ]);

        return collect($raw['withdrawals'] ?? [])
            ->filter(fn ($item) => is_array($item))
            ->map(function (array $item): array {
                return [
                    'id' => (string) ($item['id'] ?? Str::uuid()->toString()),
                    'amount' => max(0, (int) ($item['amount'] ?? 0)),
                    'note' => trim((string) ($item['note'] ?? '')),
                    'reference' => trim((string) ($item['reference'] ?? '')),
                    'processedByUserId' => isset($item['processed_by_user_id']) ? (int) $item['processed_by_user_id'] : null,
                    'processedByName' => trim((string) ($item['processed_by_name'] ?? '')),
                    'processedAt' => (string) ($item['processed_at'] ?? ''),
                    'availableAfter' => max(0, (int) ($item['available_after'] ?? 0)),
                ];
            })
            ->sortByDesc('processedAt')
            ->values();
    }

    public function recordWithdrawal(int $amount, ?string $note, ?string $reference, User $actor): array
    {
        $amount = max(0, $amount);
        if ($amount <= 0) {
            throw new RuntimeException('مبلغ برداشت باید بیشتر از صفر باشد.');
        }

        return DB::connection('central')->transaction(function () use ($amount, $note, $reference, $actor): array {
            $setting = SystemSetting::query()
                ->lockForUpdate()
                ->firstOrCreate(
                    ['key' => static::SYSTEM_KEY],
                    ['value' => ['withdrawals' => []]],
                );

            $value = is_array($setting->value) ? $setting->value : ['withdrawals' => []];
            $withdrawals = collect($value['withdrawals'] ?? [])->filter(fn ($item) => is_array($item))->values();
            $summary = $this->summary();
            $available = (int) ($summary['availableToWithdraw'] ?? 0);

            if ($amount > $available) {
                throw new RuntimeException('مبلغ برداشت نباید از درآمد قابل برداشت پیامک بیشتر باشد.');
            }

            $withdrawals->push([
                'id' => (string) Str::uuid(),
                'amount' => $amount,
                'note' => trim((string) ($note ?? '')),
                'reference' => trim((string) ($reference ?? '')),
                'processed_by_user_id' => (int) $actor->getAuthIdentifier(),
                'processed_by_name' => $actor->name,
                'processed_at' => now()->toIso8601String(),
                'available_after' => $available - $amount,
            ]);

            $setting->update([
                'value' => [
                    'withdrawals' => $withdrawals->values()->all(),
                ],
            ]);

            return $this->summary();
        });
    }
}
