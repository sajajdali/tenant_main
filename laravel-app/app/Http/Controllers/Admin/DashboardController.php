<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Landing\Models\LandingOrder;
use App\Domain\Landing\Models\SiteProvisionRequest;
use App\Domain\Support\Models\SupportTicket;
use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\SmsSetting;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantSubscriptionPayment;
use App\Http\Controllers\Controller;
use App\Services\SmsRevenueService;
use App\Services\FinancialReportService;
use App\Models\SalesWithdrawalRequest;
use App\Models\User;
use App\Support\JalaliDate;
use App\Support\SmsTemplateRegistry;
use App\Support\StoreSmsTemplateRegistry;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class DashboardController extends Controller
{
    public function __invoke(): View|RedirectResponse
    {
        $user = auth()->user();

        if ($user && in_array($user->role, ['sales_expert', 'sales_manager'], true)) {
            return redirect()->route('admin.sales-team.show', $user);
        }

        if ($user?->role === 'teacher') {
            return redirect()->route('admin.teacher.dashboard');
        }

        $pendingSmsTemplateApprovals = $this->pendingSmsTemplateApprovalsCount();
        $smsRevenue = app(SmsRevenueService::class)->summary();
        $finance = app(FinancialReportService::class)->report();

        return view('admin.dashboard', [
            'todayLabel' => JalaliDate::format(now()),
            'stats' => [
                'users_total' => User::query()->count(),
                'users_active' => User::query()->where('is_active', true)->count(),
                'users_inactive' => User::query()->where('is_active', false)->count(),
                'support_waiting_admin' => SupportTicket::query()->where('status', 'waiting_admin')->count(),
                'landing_orders_waiting_approval' => LandingOrder::query()->where('status', LandingOrder::STATUS_AWAITING_APPROVAL)->count(),
                'provision_requests_pending' => SiteProvisionRequest::query()->where('status', SiteProvisionRequest::STATUS_PENDING)->count(),
                'sales_withdrawals_pending' => SalesWithdrawalRequest::query()->where('status', 'pending')->count(),
                'domain_renewal_requests_pending' => TenantSubscriptionPayment::query()
                    ->where('payment_type', 'domain_renewal')
                    ->where('status', 'pending')
                    ->count(),
                'sms_templates_pending_review' => $pendingSmsTemplateApprovals,
                'sms_campaigns_pending_review' => $this->pendingSmsCampaignApprovalsCount(),
                'sms_revenue_available' => (int) $smsRevenue['availableToWithdraw'],
                'finance_net_current_month' => (int) ($finance['periods']['current_month']['netRevenue'] ?? 0),
            ],
            'latestLandingOrders' => LandingOrder::query()
                ->with(['landingSite', 'subscriptionPackage', 'customer'])
                ->latest('id')
                ->limit(8)
                ->get(),
            'latestDomainRenewalRequests' => TenantSubscriptionPayment::query()
                ->with('tenant:id,name')
                ->where('payment_type', 'domain_renewal')
                ->latest('id')
                ->limit(8)
                ->get(),
        ]);
    }

    private function pendingSmsTemplateApprovalsCount(): int
    {
        $count = 0;

        Tenant::query()
            ->latest('id')
            ->get()
            ->each(function (Tenant $tenant) use (&$count): void {
                $count += $tenant->run(function (): int {
                    $smsSetting = SmsSetting::query()->first();
                    $bookingTemplates = SmsTemplateRegistry::normalizeCollection(
                        is_array($smsSetting?->templates['v2'] ?? null) ? $smsSetting->templates['v2'] : [],
                    );

                    $general = GeneralSetting::query()->first();
                    $rules = $general?->booking_rules ?? [];
                    $storePage = is_array($rules['store_page'] ?? null) ? $rules['store_page'] : [];
                    $storeSms = is_array($storePage['sms'] ?? null) ? $storePage['sms'] : [];
                    $storeTemplates = StoreSmsTemplateRegistry::normalizeCollection(
                        is_array($storeSms['templates_v2'] ?? null) ? $storeSms['templates_v2'] : [],
                    );

                    return collect([...array_values($bookingTemplates), ...array_values($storeTemplates)])
                        ->where('approval_status', 'pending_review')
                        ->count();
                });
            });

        return $count;
    }

    private function pendingSmsCampaignApprovalsCount(): int
    {
        $count = 0;

        Tenant::query()
            ->latest('id')
            ->get()
            ->each(function (Tenant $tenant) use (&$count): void {
                $count += $tenant->run(function (): int {
                    return \App\Domain\Tenant\Models\SmsCampaign::query()
                        ->where('status', 'pending_review')
                        ->count();
                });
            });

        return $count;
    }
}
