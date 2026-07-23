<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Landing\Models\LandingOrderPayment;
use App\Domain\Tenant\Models\TenantSubscriptionPayment;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\View\View;

class PaymentManagementController extends Controller
{
    public function index(Request $request): View
    {
        $status = trim((string) $request->query('status', ''));
        $type = trim((string) $request->query('type', ''));
        $gateway = trim((string) $request->query('gateway', ''));
        $sandbox = trim((string) $request->query('sandbox', ''));
        $search = trim((string) $request->query('q', ''));
        $perPage = 20;
        $page = max(1, (int) $request->integer('page', 1));

        $rows = $this->paymentRows();

        $filtered = $rows
            ->when($status !== '', fn (Collection $items) => $items->where('status', $status))
            ->when($type !== '', fn (Collection $items) => $items->where('payment_type', $type))
            ->when($gateway !== '', fn (Collection $items) => $items->where('gateway', $gateway))
            ->when(in_array($sandbox, ['0', '1'], true), fn (Collection $items) => $items->where('sandbox_mode', $sandbox === '1'))
            ->when($search !== '', function (Collection $items) use ($search): Collection {
                return $items->filter(function (array $row) use ($search): bool {
                    $haystacks = [
                        $row['invoice_number'],
                        $row['reference_id'],
                        $row['authority'],
                        $row['initiated_by_name'],
                        $row['initiated_by_mobile'],
                        $row['tenant_name'],
                        $row['payment_type_label'],
                        $row['source_label'],
                    ];

                    foreach ($haystacks as $value) {
                        if ($value !== null && mb_stripos((string) $value, $search) !== false) {
                            return true;
                        }
                    }

                    return false;
                })->values();
            });

        $payments = new LengthAwarePaginator(
            $filtered->slice(($page - 1) * $perPage, $perPage)->values(),
            $filtered->count(),
            $perPage,
            $page,
            [
                'path' => $request->url(),
                'query' => $request->query(),
            ],
        );

        $paidRows = $rows->where('status', 'paid');
        $breakdown = collect([
            'initial_purchase' => 'خرید اولیه',
            'support_renewal' => 'تمدید پشتیبانی',
            'domain_renewal' => 'تمدید دامنه',
            'feature_module_activation' => 'خرید پلاگین',
            'storage_addon' => 'خرید فضای ذخیره‌سازی',
            'nutrition_token_topup' => 'خرید توکن',
            'sms_credit_topup' => 'شارژ پیامک',
        ])->map(function (string $label, string $key) use ($paidRows): array {
            $items = $paidRows->where('payment_type', $key);

            return [
                'key' => $key,
                'label' => $label,
                'count' => $items->count(),
                'amount' => (int) $items->sum('payable_amount'),
            ];
        })->values();

        return view('admin.payments.index', [
            'payments' => $payments,
            'filters' => [
                'status' => $status,
                'type' => $type,
                'gateway' => $gateway,
                'sandbox' => $sandbox,
                'q' => $search,
            ],
            'stats' => [
                'total' => $rows->count(),
                'paid' => $rows->where('status', 'paid')->count(),
                'pending' => $rows->where('status', 'pending')->count(),
                'failed' => $rows->where('status', 'failed')->count(),
                'cancelled' => $rows->where('status', 'cancelled')->count(),
                'breakdown' => $breakdown,
            ],
            'statusOptions' => $rows->pluck('status')->filter()->unique()->sort()->values(),
            'typeOptions' => $rows->map(fn (array $row): array => [
                'key' => $row['payment_type'],
                'label' => $row['payment_type_label'],
            ])->unique('key')->sortBy('label')->values(),
            'gatewayOptions' => $rows->pluck('gateway')->filter()->unique()->sort()->values(),
        ]);
    }

    private function paymentRows(): Collection
    {
        $tenantPayments = TenantSubscriptionPayment::query()
            ->with(['tenant:id,name', 'subscriptionPackage:id,name,duration_days,user_limit', 'items.featureModule'])
            ->latest('id')
            ->get()
            ->map(function (TenantSubscriptionPayment $payment): array {
                $discount = is_array($payment->metadata['discount_code'] ?? null) ? $payment->metadata['discount_code'] : null;
                $moduleName = $payment->items->firstWhere('item_type', 'feature_module_activation')?->featureModule?->name
                    ?? $payment->items->firstWhere('item_type', 'feature_module_activation')?->title;

                return [
                    'source_kind' => 'tenant_subscription',
                    'row_key' => 'tenant-'.$payment->id,
                    'invoice_number' => $payment->invoice_number,
                    'tenant_name' => $payment->tenant?->name ?? '—',
                    'payment_type' => $payment->payment_type,
                    'payment_type_label' => $this->paymentTypeLabel($payment->payment_type),
                    'source_label' => match ($payment->payment_type) {
                        'domain_renewal' => trim((string) ($payment->metadata['domain_name'] ?? '')) !== ''
                            ? 'تمدید '.(string) $payment->metadata['domain_name']
                            : ((string) ($payment->metadata['domain_label'] ?? 'تمدید دامنه')),
                        'feature_module_activation' => $moduleName ? 'پلاگین '.$moduleName : 'خرید پلاگین',
                        'sms_credit_topup' => 'شارژ پرتال پیامک',
                        default => $payment->subscriptionPackage?->name ?? $this->paymentTypeLabel($payment->payment_type),
                    },
                    'status' => $payment->status,
                    'gateway' => $payment->gateway,
                    'gateway_label' => $this->gatewayLabel($payment->gateway),
                    'payable_amount' => (int) $payment->payable_amount,
                    'discount_amount' => (int) $payment->discount_amount,
                    'reference_id' => $payment->reference_id,
                    'authority' => $payment->authority,
                    'initiated_by_name' => $payment->initiated_by_name,
                    'initiated_by_mobile' => $payment->initiated_by_mobile,
                    'created_at' => $payment->created_at,
                    'paid_at' => $payment->paid_at,
                    'sandbox_mode' => (bool) $payment->sandbox_mode,
                    'discount' => $discount,
                    'revenue_effective' => (bool) ($payment->metadata['counts_as_revenue'] ?? true),
                    'admin_manual' => (bool) ($payment->metadata['admin_manual'] ?? false),
                ];
            });

        $landingPayments = LandingOrderPayment::query()
            ->with(['order.tenant:id,name'])
            ->latest('id')
            ->get()
            ->map(function (LandingOrderPayment $payment): array {
                $order = $payment->order;
                $discount = is_array($payment->meta_json['discount'] ?? null)
                    ? $payment->meta_json['discount']
                    : (is_array($order?->meta_json['discount'] ?? null) ? $order->meta_json['discount'] : null);

                return [
                    'source_kind' => 'landing_order',
                    'row_key' => 'landing-'.$payment->id,
                    'invoice_number' => $payment->invoice_number,
                    'tenant_name' => $order?->tenant?->name ?? ($order?->customer_full_name ?: 'خرید اولیه'),
                    'payment_type' => 'initial_purchase',
                    'payment_type_label' => $this->paymentTypeLabel('initial_purchase'),
                    'source_label' => $order?->order_number ? 'سفارش '.$order->order_number : 'خرید اولیه',
                    'status' => $payment->status,
                    'gateway' => $payment->gateway,
                    'gateway_label' => $this->gatewayLabel($payment->gateway),
                    'payable_amount' => (int) ($order?->total_amount ?? $payment->amount),
                    'discount_amount' => (int) ($order?->discount_amount ?? 0),
                    'reference_id' => $payment->reference_id,
                    'authority' => $payment->authority,
                    'initiated_by_name' => $order?->customer_full_name,
                    'initiated_by_mobile' => $order?->customer_mobile,
                    'created_at' => $payment->created_at,
                    'paid_at' => $payment->paid_at,
                    'sandbox_mode' => (bool) $payment->sandbox_mode,
                    'discount' => $discount,
                    'revenue_effective' => (bool) ($payment->meta_json['counts_as_revenue'] ?? true),
                    'admin_manual' => false,
                ];
            });

        return $tenantPayments
            ->concat($landingPayments)
            ->sortByDesc(fn (array $row) => $row['created_at']?->getTimestamp() ?? 0)
            ->values();
    }

    private function paymentTypeLabel(string $type): string
    {
        return match ($type) {
            'initial_purchase' => 'خرید اولیه',
            'support_renewal' => 'تمدید پشتیبانی',
            'domain_renewal' => 'تمدید دامنه',
            'feature_module_activation' => 'خرید پلاگین',
            'sms_credit_topup' => 'شارژ پیامک',
            default => $type,
        };
    }

    private function gatewayLabel(?string $gateway): string
    {
        return match ((string) $gateway) {
            'maliart' => 'درگاه مستقیم',
            'manual_card_to_card' => 'کارت به کارت',
            'manual_online' => 'پرداخت آنلاین',
            'manual_no_charge' => 'بدون واریز مبلغ',
            '' => '—',
            default => (string) $gateway,
        };
    }
}
