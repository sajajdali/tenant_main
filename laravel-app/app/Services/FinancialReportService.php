<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Landing\Models\LandingOrderPayment;
use App\Domain\Tenant\Models\TenantSubscriptionPayment;
use App\Models\SalesCommissionLedger;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

class FinancialReportService
{
    public function __construct(
        private readonly FinancialLedgerService $financialLedgerService,
    ) {
    }

    public function report(): array
    {
        $periods = [
            'current_month' => [
                'label' => 'ماه جاری',
                'start' => now()->startOfMonth()->toImmutable(),
                'end' => now()->endOfMonth()->toImmutable(),
            ],
            'previous_month' => [
                'label' => 'ماه قبل',
                'start' => now()->subMonthNoOverflow()->startOfMonth()->toImmutable(),
                'end' => now()->subMonthNoOverflow()->endOfMonth()->toImmutable(),
            ],
            'total' => [
                'label' => 'کل',
                'start' => null,
                'end' => null,
            ],
        ];

        $landingPayments = LandingOrderPayment::query()
            ->with('order')
            ->where('status', 'paid')
            ->where('sandbox_mode', false)
            ->get()
            ->filter(fn (LandingOrderPayment $payment): bool => $this->countsAsRevenue($payment->meta_json))
            ->values();

        $tenantPayments = TenantSubscriptionPayment::query()
            ->where('status', 'paid')
            ->where('sandbox_mode', false)
            ->get()
            ->filter(fn (TenantSubscriptionPayment $payment): bool => $this->countsAsRevenue($payment->metadata))
            ->values();

        $commissionLedgers = SalesCommissionLedger::query()
            ->with(['tenantSubscriptionPayment', 'landingOrder.payments'])
            ->get()
            ->filter(fn (SalesCommissionLedger $ledger): bool => $this->isRealLedger($ledger))
            ->values();

        $smsGiftExpenses = $this->financialLedgerService->smsGiftExpenses();

        $resultPeriods = [];

        foreach ($periods as $key => $period) {
            $start = $period['start'];
            $end = $period['end'];

            $periodLanding = $landingPayments->filter(fn (LandingOrderPayment $payment): bool => $this->inPeriod($payment->paid_at, $start, $end));
            $periodTenantPayments = $tenantPayments->filter(fn (TenantSubscriptionPayment $payment): bool => $this->inPeriod($payment->paid_at, $start, $end));
            $periodLedgers = $commissionLedgers->filter(fn (SalesCommissionLedger $ledger): bool => $this->inPeriod($ledger->occurred_at, $start, $end));
            $periodSmsGifts = $smsGiftExpenses->filter(fn ($entry): bool => $this->inPeriod($entry->occurred_at, $start, $end));
            $periodTenantSetupLedgers = $periodLedgers->filter(
                fn (SalesCommissionLedger $ledger): bool => str_starts_with((string) $ledger->source_type, 'tenant_setup:')
            );

            $grossRevenue = [
                'initial_purchase' => (int) $periodLanding->sum(fn (LandingOrderPayment $payment) => (int) ($payment->order?->total_amount ?? $payment->amount))
                    + (int) $periodTenantSetupLedgers->sum('net_amount'),
                'support_renewal' => (int) $periodTenantPayments
                    ->where('payment_type', 'support_renewal')
                    ->filter(fn (TenantSubscriptionPayment $payment): bool => ! (bool) ($payment->metadata['is_upgrade'] ?? false))
                    ->sum('payable_amount'),
                'support_upgrade' => (int) $periodTenantPayments
                    ->where('payment_type', 'support_renewal')
                    ->filter(fn (TenantSubscriptionPayment $payment): bool => (bool) ($payment->metadata['is_upgrade'] ?? false))
                    ->sum('payable_amount'),
                'feature_module_activation' => (int) $periodTenantPayments
                    ->where('payment_type', 'feature_module_activation')
                    ->sum('payable_amount'),
                'sms_credit_topup' => (int) $periodTenantPayments
                    ->where('payment_type', 'sms_credit_topup')
                    ->sum('payable_amount'),
            ];

            $initialBreakdown = [
                'package' => (int) $periodLanding->sum(fn (LandingOrderPayment $payment) => (int) ($payment->order?->package_price_amount ?? 0)),
                'setup_fee' => (int) $periodLanding->sum(fn (LandingOrderPayment $payment) => (int) ($payment->order?->setup_fee_amount ?? 0))
                    + (int) $periodTenantSetupLedgers->sum('net_amount'),
                'domain' => (int) $periodLanding->sum(fn (LandingOrderPayment $payment) => (int) ($payment->order?->domain_price_amount ?? 0)),
            ];

            $costs = [
                'sales_expert_commission' => (int) $periodLedgers->sum('sales_expert_amount'),
                'sales_manager_commission' => (int) $periodLedgers->sum('sales_manager_amount'),
                'sms_free_credit' => (int) $periodSmsGifts->sum('amount'),
            ];
            $costs['total_commission'] = $costs['sales_expert_commission'] + $costs['sales_manager_commission'];
            $costs['total_costs'] = $costs['total_commission'] + $costs['sms_free_credit'];

            $grossTotal = array_sum($grossRevenue);

            $resultPeriods[$key] = [
                'label' => $period['label'],
                'grossRevenue' => $grossRevenue,
                'grossTotal' => $grossTotal,
                'initialBreakdown' => $initialBreakdown,
                'costs' => $costs,
                'netRevenue' => $grossTotal - $costs['total_costs'],
            ];
        }

        return [
            'periods' => $resultPeriods,
            'revenueLabels' => [
                'initial_purchase' => 'خرید اولیه',
                'support_renewal' => 'تمدید پنل',
                'support_upgrade' => 'ارتقا و مابه‌التفاوت',
                'feature_module_activation' => 'خرید ماژول پولی',
                'sms_credit_topup' => 'شارژ پیامک',
            ],
            'initialBreakdownLabels' => [
                'package' => 'اشتراک اولیه',
                'setup_fee' => 'هزینه نصب و راه‌اندازی',
                'domain' => 'دامنه',
            ],
            'costLabels' => [
                'sales_expert_commission' => 'سهم کارشناس فروش',
                'sales_manager_commission' => 'سهم مدیر فروش',
                'total_commission' => 'جمع پورسانت فروش',
                'sms_free_credit' => 'هزینه شارژ رایگان پیامک',
                'total_costs' => 'جمع هزینه‌ها',
            ],
        ];
    }

    private function inPeriod($date, ?CarbonImmutable $start, ?CarbonImmutable $end): bool
    {
        if (! $date) {
            return false;
        }

        $value = CarbonImmutable::parse($date);

        if ($start && $value->lt($start)) {
            return false;
        }

        if ($end && $value->gt($end)) {
            return false;
        }

        return true;
    }

    private function isRealLedger(SalesCommissionLedger $ledger): bool
    {
        if ($ledger->tenantSubscriptionPayment) {
            return ! (bool) $ledger->tenantSubscriptionPayment->sandbox_mode
                && $ledger->tenantSubscriptionPayment->status === 'paid'
                && $ledger->status === 'recorded';
        }

        if ($ledger->landingOrder) {
            $paidPayment = $ledger->landingOrder->payments
                ->first(fn (LandingOrderPayment $payment): bool => $payment->status === 'paid');

            return $paidPayment
                ? ! (bool) $paidPayment->sandbox_mode
                    && $ledger->status === 'recorded'
                    && $this->countsAsRevenue($paidPayment->meta_json)
                : false;
        }

        return str_starts_with((string) $ledger->source_type, 'tenant_setup:')
            && $ledger->status === 'recorded';
    }

    private function countsAsRevenue(?array $meta): bool
    {
        return (bool) (($meta ?? [])['counts_as_revenue'] ?? true);
    }
}
