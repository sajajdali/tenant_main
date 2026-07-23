<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Landing\Models\LandingOrderPayment;
use App\Domain\Tenant\Models\TenantSubscriptionPayment;
use App\Http\Controllers\Controller;
use App\Models\AdminActionLog;
use App\Services\AdminRevenueAdjustmentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\View\View;

class RevenueAdjustmentController extends Controller
{
    public function __construct(
        private readonly AdminRevenueAdjustmentService $service,
    ) {
    }

    public function index(Request $request): View
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $rows = $this->revenueRows();
        $perPage = 15;
        $page = max(1, (int) $request->integer('page', 1));
        $payments = new LengthAwarePaginator(
            $rows->slice(($page - 1) * $perPage, $perPage)->values(),
            $rows->count(),
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()],
        );

        $history = AdminActionLog::tableExists()
            ? AdminActionLog::query()
                ->with(['actor', 'tenantSubscriptionPayment', 'landingOrderPayment'])
                ->whereIn('action_type', [
                    'payment_revenue_voided',
                    'payment_refunded',
                    'landing_payment_revenue_voided',
                    'landing_payment_refunded',
                ])
                ->latest('occurred_at')
                ->limit(50)
                ->get()
            : new EloquentCollection();

        return view('admin.revenue-adjustments.index', [
            'payments' => $payments,
            'history' => $history,
            'historyLoggingAvailable' => AdminActionLog::tableExists(),
        ]);
    }

    public function storeTenant(Request $request, TenantSubscriptionPayment $payment): RedirectResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $validated = $request->validate([
            'mode' => ['required', 'in:void,refund'],
            'reason' => ['required', 'string', 'min:5', 'max:2000'],
        ]);

        $this->service->reverseTenantPayment($payment, $validated['mode'], $validated['reason'], $request->user());

        return redirect()
            ->route('admin.revenue-adjustments.index')
            ->with('success', 'درآمد این پرداخت با موفقیت از گزارش‌های مالی خارج شد و پورسانت‌های وابسته هم برگشت داده شدند.');
    }

    public function storeLanding(Request $request, LandingOrderPayment $payment): RedirectResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $validated = $request->validate([
            'mode' => ['required', 'in:void,refund'],
            'reason' => ['required', 'string', 'min:5', 'max:2000'],
        ]);

        $this->service->reverseLandingPayment($payment, $validated['mode'], $validated['reason'], $request->user());

        return redirect()
            ->route('admin.revenue-adjustments.index')
            ->with('success', 'درآمد این خرید اولیه با موفقیت از گزارش‌های مالی خارج شد و پورسانت‌های وابسته هم برگشت داده شدند.');
    }

    private function revenueRows(): Collection
    {
        $tenantPayments = TenantSubscriptionPayment::query()
            ->with(['tenant:id,name', 'subscriptionPackage:id,name'])
            ->where('status', 'paid')
            ->where('sandbox_mode', false)
            ->get()
            ->filter(fn (TenantSubscriptionPayment $payment): bool => (bool) ($payment->metadata['counts_as_revenue'] ?? true))
            ->map(fn (TenantSubscriptionPayment $payment): array => [
                'kind' => 'tenant',
                'id' => (int) $payment->id,
                'invoice_number' => $payment->invoice_number,
                'tenant_name' => $payment->tenant?->name ?? '—',
                'title' => $payment->subscriptionPackage?->name ?? $payment->payment_type,
                'payment_type' => $payment->payment_type,
                'amount' => (int) $payment->payable_amount,
                'paid_at' => $payment->paid_at,
                'actor_name' => $payment->initiated_by_name,
            ]);

        $landingPayments = LandingOrderPayment::query()
            ->with(['order.tenant:id,name'])
            ->where('status', 'paid')
            ->where('sandbox_mode', false)
            ->get()
            ->filter(fn (LandingOrderPayment $payment): bool => (bool) ($payment->meta_json['counts_as_revenue'] ?? true))
            ->map(fn (LandingOrderPayment $payment): array => [
                'kind' => 'landing',
                'id' => (int) $payment->id,
                'invoice_number' => $payment->invoice_number,
                'tenant_name' => $payment->order?->tenant?->name ?? ($payment->order?->customer_full_name ?? '—'),
                'title' => $payment->order?->order_number ? 'خرید اولیه '.$payment->order->order_number : 'خرید اولیه',
                'payment_type' => 'initial_purchase',
                'amount' => (int) ($payment->order?->total_amount ?? $payment->amount),
                'paid_at' => $payment->paid_at,
                'actor_name' => $payment->order?->customer_full_name,
            ]);

        return $tenantPayments
            ->concat($landingPayments)
            ->sortByDesc(fn (array $row) => $row['paid_at']?->getTimestamp() ?? 0)
            ->values();
    }
}
