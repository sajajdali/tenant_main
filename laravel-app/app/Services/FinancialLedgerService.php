<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Landing\Models\LandingOrder;
use App\Domain\Tenant\Models\SubscriptionPackage;
use App\Domain\Tenant\Models\Tenant;
use App\Models\FinancialLedgerEntry;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

class FinancialLedgerService
{
    public function recordSmsGiftExpense(int $amount, array $context = []): void
    {
        if (! $this->ledgerTableExists()) {
            return;
        }

        $amount = max(0, $amount);

        if ($amount <= 0) {
            return;
        }

        $sourceType = trim((string) ($context['source_type'] ?? ''));
        $sourceId = (string) ($context['source_id'] ?? '');

        if ($sourceType === '' || $sourceId === '') {
            return;
        }

        FinancialLedgerEntry::query()->updateOrCreate(
            [
                'entry_type' => 'sms_free_credit_gift',
                'source_type' => $sourceType,
                'source_id' => $sourceId,
            ],
            [
                'direction' => 'expense',
                'tenant_id' => $context['tenant_id'] ?? null,
                'title' => $context['title'] ?? 'هزینه شارژ رایگان پیامک',
                'amount' => $amount,
                'occurred_at' => $context['occurred_at'] ?? now(),
                'meta_json' => $context['meta'] ?? [],
            ],
        );
    }

    public function smsGiftExpenses(): Collection
    {
        if (! $this->ledgerTableExists()) {
            return collect();
        }

        $this->syncHistoricalSmsGiftExpenses();

        return FinancialLedgerEntry::query()
            ->where('entry_type', 'sms_free_credit_gift')
            ->where('direction', 'expense')
            ->orderByDesc('occurred_at')
            ->get();
    }

    public function syncHistoricalSmsGiftExpenses(): void
    {
        if (! $this->ledgerTableExists()) {
            return;
        }

        LandingOrder::query()
            ->whereNotNull('tenant_id')
            ->with('subscriptionPackage')
            ->get()
            ->each(function (LandingOrder $order): void {
                $meta = is_array($order->meta_json) ? $order->meta_json : [];
                $pricing = is_array($meta['pricing'] ?? null) ? $meta['pricing'] : [];
                $amount = max(
                    0,
                    (int) ($meta['smsCreditGiftAppliedAmount'] ?? $pricing['smsCreditGiftAmount'] ?? 0),
                );

                if ($amount <= 0) {
                    return;
                }

                $this->recordSmsGiftExpense($amount, [
                    'source_type' => 'landing_order_sms_gift',
                    'source_id' => (string) $order->id,
                    'tenant_id' => $order->tenant_id,
                    'title' => 'هزینه شارژ هدیه پیامک هنگام نصب سامانه',
                    'occurred_at' => $meta['smsCreditGiftAppliedAt']
                        ?? $order->provisioned_at
                        ?? $order->approved_at
                        ?? $order->created_at
                        ?? now(),
                    'meta' => [
                        'order_number' => $order->order_number,
                        'package_id' => $order->subscription_package_id,
                        'package_name' => $order->subscriptionPackage?->name,
                        'backfilled' => true,
                    ],
                ]);
            });

        Tenant::query()
            ->with(['subscriptionPackage', 'landingOrders:id,tenant_id'])
            ->get()
            ->filter(function (Tenant $tenant): bool {
                return $tenant->landingOrders->isEmpty();
            })
            ->each(function (Tenant $tenant): void {
                $package = $tenant->subscriptionPackage;
                $amount = max(0, (int) ($package?->sms_credit_gift_amount ?? 0));

                if ($amount <= 0) {
                    return;
                }

                $this->recordSmsGiftExpense($amount, [
                    'source_type' => 'manual_tenant_sms_gift',
                    'source_id' => (string) $tenant->id,
                    'tenant_id' => (string) $tenant->id,
                    'title' => 'هزینه شارژ هدیه پیامک برای ایجاد دستی سامانه',
                    'occurred_at' => $tenant->created_at ?? now(),
                    'meta' => [
                        'package_id' => $package?->id,
                        'package_name' => $package?->name,
                        'backfilled' => true,
                        'best_effort' => true,
                    ],
                ]);
            });
    }

    private function ledgerTableExists(): bool
    {
        return Schema::connection('central')->hasTable('financial_ledger_entries');
    }
}
