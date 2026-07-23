<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Landing\Models\LandingOrderPayment;
use App\Domain\Tenant\Models\TenantSubscriptionPayment;
use App\Models\AdminActionLog;
use App\Models\SalesCommissionLedger;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class AdminRevenueAdjustmentService
{
    public function __construct(
        private readonly SalesWalletService $wallets,
    ) {
    }

    public function reverseTenantPayment(TenantSubscriptionPayment $payment, string $mode, string $reason, User $actor): void
    {
        if ($payment->status !== 'paid') {
            throw new RuntimeException('فقط پرداخت‌های موفق قابل ابطال درآمد هستند.');
        }

        if ((bool) ($payment->sandbox_mode ?? false)) {
            throw new RuntimeException('پرداخت‌های سندباکس قابل ابطال درآمد واقعی نیستند.');
        }

        if (! $this->countsAsRevenue($payment->metadata)) {
            throw new RuntimeException('درآمد این پرداخت قبلاً از گزارش‌های مالی حذف شده است.');
        }

        DB::connection('central')->transaction(function () use ($payment, $mode, $reason, $actor): void {
            $lockedPayment = TenantSubscriptionPayment::query()
                ->with(['tenant:id,name'])
                ->lockForUpdate()
                ->findOrFail($payment->id);

            if (! $this->countsAsRevenue($lockedPayment->metadata)) {
                throw new RuntimeException('درآمد این پرداخت قبلاً از گزارش‌های مالی حذف شده است.');
            }

            $lockedPayment->update([
                'metadata' => array_merge($lockedPayment->metadata ?? [], [
                    'counts_as_revenue' => false,
                    'revenue_adjustment_mode' => $mode,
                    'revenue_adjusted_at' => now()->toIso8601String(),
                    'revenue_adjusted_by_user_id' => $actor->id,
                    'revenue_adjusted_by_name' => $actor->name,
                    'revenue_adjustment_reason' => $reason,
                ]),
            ]);

            SalesCommissionLedger::query()
                ->where('tenant_subscription_payment_id', $lockedPayment->id)
                ->where('status', 'recorded')
                ->get()
                ->each(fn (SalesCommissionLedger $ledger) => $this->wallets->reverseCommissionCredits($ledger, $actor, $reason));

            if (AdminActionLog::tableExists()) {
                AdminActionLog::query()->create([
                    'action_type' => $mode === 'refund' ? 'payment_refunded' : 'payment_revenue_voided',
                    'actor_user_id' => $actor->id,
                    'tenant_id' => $lockedPayment->tenant_id,
                    'tenant_subscription_payment_id' => $lockedPayment->id,
                    'title' => ($mode === 'refund' ? 'استرداد وجه' : 'حذف درآمد').' '.$lockedPayment->invoice_number,
                    'reason' => $reason,
                    'meta_json' => [
                        'payment_type' => $lockedPayment->payment_type,
                        'invoice_number' => $lockedPayment->invoice_number,
                        'amount' => (int) $lockedPayment->payable_amount,
                        'tenant_name' => $lockedPayment->tenant?->name,
                        'mode' => $mode,
                    ],
                    'occurred_at' => now(),
                ]);
            }
        });
    }

    public function reverseLandingPayment(LandingOrderPayment $payment, string $mode, string $reason, User $actor): void
    {
        if ($payment->status !== 'paid') {
            throw new RuntimeException('فقط پرداخت‌های موفق قابل ابطال درآمد هستند.');
        }

        if ((bool) ($payment->sandbox_mode ?? false)) {
            throw new RuntimeException('پرداخت‌های سندباکس قابل ابطال درآمد واقعی نیستند.');
        }

        if (! $this->countsAsRevenue($payment->meta_json)) {
            throw new RuntimeException('درآمد این پرداخت قبلاً از گزارش‌های مالی حذف شده است.');
        }

        DB::connection('central')->transaction(function () use ($payment, $mode, $reason, $actor): void {
            $lockedPayment = LandingOrderPayment::query()
                ->with(['order.tenant:id,name'])
                ->lockForUpdate()
                ->findOrFail($payment->id);

            if (! $this->countsAsRevenue($lockedPayment->meta_json)) {
                throw new RuntimeException('درآمد این پرداخت قبلاً از گزارش‌های مالی حذف شده است.');
            }

            $lockedPayment->update([
                'meta_json' => array_merge($lockedPayment->meta_json ?? [], [
                    'counts_as_revenue' => false,
                    'revenue_adjustment_mode' => $mode,
                    'revenue_adjusted_at' => now()->toIso8601String(),
                    'revenue_adjusted_by_user_id' => $actor->id,
                    'revenue_adjusted_by_name' => $actor->name,
                    'revenue_adjustment_reason' => $reason,
                ]),
            ]);

            $order = $lockedPayment->order;

            SalesCommissionLedger::query()
                ->where(function ($query) use ($order): void {
                    $query->where('landing_order_id', $order?->id);

                    if ($order?->tenant_id) {
                        $query->orWhere('source_type', 'tenant_setup:'.$order->tenant_id);
                    }
                })
                ->where('status', 'recorded')
                ->get()
                ->each(fn (SalesCommissionLedger $ledger) => $this->wallets->reverseCommissionCredits($ledger, $actor, $reason));

            if (AdminActionLog::tableExists()) {
                AdminActionLog::query()->create([
                    'action_type' => $mode === 'refund' ? 'landing_payment_refunded' : 'landing_payment_revenue_voided',
                    'actor_user_id' => $actor->id,
                    'tenant_id' => $order?->tenant_id,
                    'landing_order_payment_id' => $lockedPayment->id,
                    'title' => ($mode === 'refund' ? 'استرداد وجه' : 'حذف درآمد').' '.$lockedPayment->invoice_number,
                    'reason' => $reason,
                    'meta_json' => [
                        'invoice_number' => $lockedPayment->invoice_number,
                        'landing_order_id' => $order?->id,
                        'order_number' => $order?->order_number,
                        'amount' => (int) ($order?->total_amount ?? $lockedPayment->amount),
                        'tenant_name' => $order?->tenant?->name,
                        'mode' => $mode,
                    ],
                    'occurred_at' => now(),
                ]);
            }
        });
    }

    private function countsAsRevenue(?array $meta): bool
    {
        return (bool) (($meta ?? [])['counts_as_revenue'] ?? true);
    }
}
