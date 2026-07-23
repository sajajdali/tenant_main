<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Tenant\Models\AudienceType;
use App\Http\Controllers\Controller;
use App\Models\SalesCustomerAssignment;
use App\Models\User;
use App\Services\SalesTeamService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SalesTeamController extends Controller
{
    public function __construct(
        private readonly SalesTeamService $salesTeam,
    ) {
    }

    public function index(Request $request): View
    {
        abort_unless($this->salesTeam->canAccessSalesArea($request->user()), 403);

        if (in_array($request->user()->role, ['sales_expert', 'teacher'], true)) {
            $selfSummary = $this->salesTeam->summaryForUser($request->user());

            return view('admin.sales-team.index', [
                'items' => collect([
                    [
                        'user' => $request->user(),
                        'summary' => $selfSummary,
                    ],
                ]),
                'overview' => [
                    'usersCount' => 1,
                    'expertsCount' => 1,
                    'managersCount' => 0,
                    'totalSales' => $selfSummary['totalSales'],
                    'monthlySales' => $selfSummary['monthlySales'],
                    'totalCustomers' => $selfSummary['totalCustomers'],
                    'missedRenewals' => $selfSummary['missedRenewals'],
                    'followUpsThisMonth' => $selfSummary['monthlyFollowUps'],
                    'availableBalance' => $selfSummary['availableBalance'],
                    'pendingWithdrawalRequests' => $selfSummary['pendingWithdrawalRequestsCount'],
                    'pendingWithdrawalAmount' => $selfSummary['pendingWithdrawalAmount'],
                ],
                'selectedRole' => $request->string('role')->toString(),
                'salesTeamService' => $this->salesTeam,
            ]);
        }

        $role = $request->string('role')->toString();
        $users = $this->salesTeam->visibleSalesUsersFor($request->user(), $role)
            ->map(fn (User $user) => [
                'user' => $user,
                'summary' => $this->salesTeam->summaryForUser($user),
            ]);

        $overview = [
            'usersCount' => $users->count(),
            'expertsCount' => $users->where(fn (array $item) => $item['user']->role === 'sales_expert')->count(),
            'managersCount' => $users->where(fn (array $item) => $item['user']->role === 'sales_manager')->count(),
            'totalSales' => $users->sum(fn (array $item) => $item['summary']['totalSales']),
            'monthlySales' => $users->sum(fn (array $item) => $item['summary']['monthlySales']),
            'totalCustomers' => $users->sum(fn (array $item) => $item['summary']['totalCustomers']),
            'missedRenewals' => $users->sum(fn (array $item) => $item['summary']['missedRenewals']),
            'followUpsThisMonth' => $users->sum(fn (array $item) => $item['summary']['monthlyFollowUps']),
            'availableBalance' => $users->sum(fn (array $item) => $item['summary']['availableBalance']),
            'pendingWithdrawalRequests' => $users->sum(fn (array $item) => $item['summary']['pendingWithdrawalRequestsCount']),
            'pendingWithdrawalAmount' => $users->sum(fn (array $item) => $item['summary']['pendingWithdrawalAmount']),
        ];

        return view('admin.sales-team.index', [
            'items' => $users,
            'overview' => $overview,
            'selectedRole' => $role,
            'salesTeamService' => $this->salesTeam,
        ]);
    }

    public function show(User $user): View
    {
        abort_unless($this->salesTeam->canViewSalesUser(auth()->user(), $user), 403);

        $detail = $this->salesTeam->detailForUser($user);

        return view('admin.sales-team.show', [
            'salesUser' => $user,
            'detail' => $detail,
            'assignmentOptions' => $this->salesTeam->assignmentOptionsForUser($user),
            'salesTeamService' => $this->salesTeam,
            'canEditCommissionConfig' => auth()->user()->role === 'admin',
            'canOpenWithdrawalArea' => $this->salesTeam->canManageWithdrawalFor(auth()->user(), $user),
        ]);
    }

    public function renewals(Request $request): View
    {
        abort_unless(in_array($request->user()->role, ['sales_manager', 'sales_expert'], true), 403);

        $filter = $request->string('filter')->toString() ?: 'next_7_days';

        return view('admin.sales-team.renewals', [
            'salesUser' => $request->user(),
            'isScopedToCurrentUser' => true,
            'summary' => $this->salesTeam->summaryForUser($request->user()),
            'renewalSummary' => $this->salesTeam->renewalOpportunitySummary(actor: $request->user()),
            'renewals' => $this->salesTeam->renewalOpportunities(actor: $request->user(), filter: $filter),
            'selectedFilter' => $filter,
            'salesTeamService' => $this->salesTeam,
        ]);
    }

    public function userRenewals(Request $request, User $user): View
    {
        abort_unless($this->salesTeam->canViewSalesUser($request->user(), $user), 403);

        $filter = $request->string('filter')->toString() ?: 'next_7_days';

        return view('admin.sales-team.renewals', [
            'salesUser' => $user,
            'isScopedToCurrentUser' => (int) $request->user()->id === (int) $user->id,
            'summary' => $this->salesTeam->summaryForUser($user),
            'renewalSummary' => $this->salesTeam->renewalOpportunitySummary(scopeUser: $user),
            'renewals' => $this->salesTeam->renewalOpportunities(scopeUser: $user, filter: $filter),
            'selectedFilter' => $filter,
            'salesTeamService' => $this->salesTeam,
        ]);
    }

    public function customers(Request $request): View
    {
        abort_unless($this->salesTeam->canAccessSalesArea($request->user()), 403);

        $status = $request->string('status')->toString() ?: 'all';
        $search = $request->string('search')->toString();

        return view('admin.sales-team.customers', [
            'assignments' => $this->salesTeam->customerAssignmentsForActor($request->user(), $status, $search),
            'overview' => $this->salesTeam->customerAssignmentOverviewForActor($request->user()),
            'selectedStatus' => $status,
            'search' => $search,
            'audienceTypes' => AudienceType::query()->orderBy('name')->get(['id', 'name']),
            'salesTeamService' => $this->salesTeam,
        ]);
    }

    public function storeCustomer(Request $request): RedirectResponse
    {
        abort_unless($this->salesTeam->canAccessSalesArea($request->user()), 403);

        $validated = $request->validate([
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_mobile' => ['required', 'string', 'max:20'],
            'audience_type_id' => ['nullable', 'integer', 'exists:audience_types,id'],
            'notes' => ['nullable', 'string'],
            'next_follow_up_at' => ['nullable', 'date'],
        ]);

        $this->salesTeam->createCustomerAssignment($request->user(), $validated);

        return redirect()
            ->route('admin.sales-team.customers')
            ->with('success', 'مشتری با موفقیت ثبت شد و از این به بعد وضعیت خرید او در همین صفحه قابل مشاهده است.');
    }

    public function storeFollowUp(Request $request, User $user): RedirectResponse
    {
        abort_unless($this->salesTeam->canViewSalesUser($request->user(), $user), 403);

        $validated = $request->validate([
            'sales_customer_assignment_id' => ['required', 'integer', 'exists:sales_customer_assignments,id'],
            'follow_up_type' => ['required', 'in:call,whatsapp,sms,meeting,note'],
            'result_status' => ['nullable', 'in:new,contacted,qualified,won,renewed,renewal_due,renewal_missed,lost'],
            'summary' => ['required', 'string', 'max:255'],
            'details' => ['nullable', 'string'],
            'followed_at' => ['nullable', 'date'],
            'next_follow_up_at' => ['nullable', 'date'],
            'scheduled_for' => ['nullable', 'date'],
        ]);

        $assignment = SalesCustomerAssignment::query()->findOrFail((int) $validated['sales_customer_assignment_id']);

        $allowed = $user->role === 'sales_manager'
            ? (int) $assignment->sales_manager_user_id === (int) $user->id
            : (int) $assignment->sales_expert_user_id === (int) $user->id;

        abort_unless($allowed, 403);

        $this->salesTeam->createFollowUp($user, $assignment, $validated);

        return redirect()
            ->route('admin.sales-team.show', $user)
            ->with('success', 'پیگیری با موفقیت ثبت شد.');
    }
}
