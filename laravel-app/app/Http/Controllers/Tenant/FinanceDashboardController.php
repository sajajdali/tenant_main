<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Booking\Models\AppointmentPayment;
use App\Domain\Booking\Models\Barber;
use App\Domain\Tenant\Models\NutritionPackageOrder;
use App\Support\TenantAudienceScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;

class FinanceDashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $actor = $request->user('tenant_web');
        abort_unless($actor && in_array($actor->role, ['admin', 'barber'], true), 403);

        $validated = $request->validate([
            'barber_id' => ['nullable', 'integer', 'exists:professionals,id'],
        ]);

        $actorBarber = null;
        if ($actor->role === 'barber') {
            $actorBarber = Barber::query()->where('user_id', $actor->id)->first();
        }

        $barberId = $actorBarber?->id ?? ($validated['barber_id'] ?? null);

        $paymentsQuery = AppointmentPayment::query()
            ->with(['barber:id,name', 'service:id,name'])
            ->where('status', 'paid')
            ->when($barberId, fn ($query) => $query->where('professional_id', $barberId));

        $payments = $paymentsQuery
            ->latest('paid_at')
            ->latest('id')
            ->limit(20)
            ->get();

        $now = now();
        $todayStart = $now->copy()->startOfDay();
        $yesterdayStart = $now->copy()->subDay()->startOfDay();
        $yesterdayEnd = $yesterdayStart->copy()->endOfDay();
        $weekStart = $now->copy()->startOfWeek(Carbon::SATURDAY)->startOfDay();

        $baseStatsQuery = AppointmentPayment::query()
            ->where('status', 'paid')
            ->when($barberId, fn ($query) => $query->where('professional_id', $barberId));

        $data = [
            'filter' => [
                'barberId' => $barberId ? (string) $barberId : null,
                'barberName' => $barberId ? optional(Barber::query()->find($barberId))->name : null,
                'forcedToActorBarber' => $actor->role === 'barber',
            ],
            'stats' => [
                'overall' => $this->aggregateWindow(clone $baseStatsQuery),
                'today' => $this->aggregateWindow((clone $baseStatsQuery)->where('paid_at', '>=', $todayStart)),
                'yesterday' => $this->aggregateWindow((clone $baseStatsQuery)->whereBetween('paid_at', [$yesterdayStart, $yesterdayEnd])),
                'thisWeek' => $this->aggregateWindow((clone $baseStatsQuery)->where('paid_at', '>=', $weekStart)),
            ],
            'latestTransactions' => $payments->map(fn (AppointmentPayment $payment): array => $this->serializePayment($payment))->values()->all(),
        ];

        if (TenantAudienceScope::currentTenantUsesNutrition() && Schema::hasTable('nutrition_package_orders')) {
            $nutritionBaseQuery = NutritionPackageOrder::query()->where('status', 'paid');

            $data['nutritionStats'] = [
                'overall' => $this->aggregateNutritionWindow(clone $nutritionBaseQuery),
                'today' => $this->aggregateNutritionWindow((clone $nutritionBaseQuery)->where('paid_at', '>=', $todayStart)),
                'yesterday' => $this->aggregateNutritionWindow((clone $nutritionBaseQuery)->whereBetween('paid_at', [$yesterdayStart, $yesterdayEnd])),
                'thisWeek' => $this->aggregateNutritionWindow((clone $nutritionBaseQuery)->where('paid_at', '>=', $weekStart)),
            ];

            $data['latestNutritionTransactions'] = NutritionPackageOrder::query()
                ->with(['user:id,name,mobile', 'package:id,name'])
                ->where('status', 'paid')
                ->latest('paid_at')
                ->latest('id')
                ->limit(12)
                ->get()
                ->map(fn (NutritionPackageOrder $order): array => $this->serializeNutritionOrder($order))
                ->values()
                ->all();
        }

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    private function aggregateWindow($query): array
    {
        $rows = $query->get(['id', 'amount', 'sandbox_mode', 'gateway', 'meta']);

        $grossAmount = 0;
        $onlineAmount = 0;
        $walletAmount = 0;
        $sandboxCount = 0;
        $walletOnlyCount = 0;

        foreach ($rows as $payment) {
            $totalAmount = (int) ($payment->meta['total_amount'] ?? $payment->amount);
            $walletUsedAmount = (int) ($payment->meta['wallet_used_amount'] ?? 0);
            $onlinePaidAmount = (int) ($payment->meta['payable_amount'] ?? $payment->amount);

            $grossAmount += $totalAmount;
            $onlineAmount += $onlinePaidAmount;
            $walletAmount += $walletUsedAmount;

            if ((bool) $payment->sandbox_mode) {
                $sandboxCount += 1;
            }

            if ($onlinePaidAmount <= 0 && $walletUsedAmount > 0) {
                $walletOnlyCount += 1;
            }
        }

        return [
            'transactionsCount' => $rows->count(),
            'grossAmount' => $grossAmount,
            'onlineAmount' => $onlineAmount,
            'walletAmount' => $walletAmount,
            'sandboxCount' => $sandboxCount,
            'walletOnlyCount' => $walletOnlyCount,
        ];
    }

    private function aggregateNutritionWindow($query): array
    {
        $rows = $query->get(['id', 'payable_amount', 'sandbox_mode']);
        $paidAmount = (int) $rows->sum('payable_amount');

        return [
            'transactionsCount' => $rows->count(),
            'grossAmount' => $paidAmount,
            'onlineAmount' => $paidAmount,
            'walletAmount' => 0,
            'sandboxCount' => $rows->filter(fn (NutritionPackageOrder $order): bool => (bool) $order->sandbox_mode)->count(),
            'walletOnlyCount' => 0,
        ];
    }

    private function serializePayment(AppointmentPayment $payment): array
    {
        $walletUsedAmount = (int) ($payment->meta['wallet_used_amount'] ?? 0);
        $totalAmount = (int) ($payment->meta['total_amount'] ?? $payment->amount);
        $onlinePaidAmount = (int) ($payment->meta['payable_amount'] ?? $payment->amount);

        return [
            'id' => (string) $payment->id,
            'invoiceNumber' => $payment->invoice_number,
            'customerName' => $payment->customer_name_snapshot,
            'customerPhone' => $payment->customer_phone_snapshot,
            'barberId' => (string) $payment->professional_id,
            'barberName' => $payment->barber?->name,
            'serviceName' => $payment->service?->name,
            'appointmentDate' => $payment->appointment_date?->toDateString() ?? (string) $payment->getRawOriginal('appointment_date'),
            'startTime' => substr((string) $payment->start_time, 0, 5),
            'totalAmount' => $totalAmount,
            'onlineAmount' => $onlinePaidAmount,
            'walletAmount' => $walletUsedAmount,
            'gateway' => $payment->gateway,
            'gatewayLabel' => $this->gatewayLabel((string) $payment->gateway, $onlinePaidAmount, $walletUsedAmount, (bool) $payment->sandbox_mode),
            'referenceId' => $payment->reference_id,
            'sandboxMode' => (bool) $payment->sandbox_mode,
            'paidAt' => $payment->paid_at?->toIso8601String(),
        ];
    }

    private function serializeNutritionOrder(NutritionPackageOrder $order): array
    {
        return [
            'id' => (string) $order->id,
            'invoiceNumber' => $order->invoice_number,
            'customerName' => $order->user?->name ?: '—',
            'customerPhone' => $order->user?->mobile ?: '—',
            'packageName' => $order->package?->name,
            'totalAmount' => (int) $order->amount,
            'discountAmount' => (int) $order->discount_amount,
            'payableAmount' => (int) $order->payable_amount,
            'gateway' => (string) $order->gateway,
            'gatewayLabel' => $this->gatewayLabel((string) $order->gateway, (int) $order->payable_amount, 0, (bool) $order->sandbox_mode),
            'referenceId' => $order->reference_id,
            'sandboxMode' => (bool) $order->sandbox_mode,
            'paidAt' => $order->paid_at?->toIso8601String(),
        ];
    }

    private function gatewayLabel(string $gateway, int $onlinePaidAmount, int $walletUsedAmount, bool $sandboxMode): string
    {
        if ($onlinePaidAmount <= 0 && $walletUsedAmount > 0) {
            return 'کیف پول باشگاه مشتریان';
        }

        if ($sandboxMode && $walletUsedAmount > 0) {
            return 'سندباکس + کیف پول';
        }

        if ($sandboxMode) {
            return 'پرداخت سندباکس';
        }

        if ($walletUsedAmount > 0) {
            return 'آنلاین + کیف پول';
        }

        return match ($gateway) {
            'maliart' => __('payment.direct_gateway'),
            'saman' => 'سامان',
            'zibal' => 'زیبال',
            'digipay' => 'دیجی‌پی',
            'asanpardakht' => 'آسان پرداخت',
            'parsian' => 'پارسیان',
            'pasargad' => 'پاسارگاد',
            'zarinpal' => 'زرین‌پال',
            default => $gateway !== '' ? $gateway : 'پرداخت آنلاین',
        };
    }
}
