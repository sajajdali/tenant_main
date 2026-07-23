<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\SalesCommissionLedger;
use App\Models\SalesCustomerAssignment;
use App\Models\SalesFollowUp;
use App\Models\User;
use App\Support\InputNormalizer;
use Illuminate\Support\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Morilog\Jalali\Jalalian;

class SalesTeamService
{
    public function __construct(
        private readonly SalesTrackingService $salesTracking,
        private readonly SalesWalletService $wallets,
    ) {
    }

    public function salesUsers(?string $role = null): Collection
    {
        $this->salesTracking->refreshAssignmentStatuses();

        return User::query()
            ->with(['salesManager:id,name,mobile', 'salesExperts:id,name,mobile,is_active'])
            ->whereIn('role', ['sales_expert', 'sales_manager', 'teacher'])
            ->when(in_array($role, ['sales_expert', 'sales_manager', 'teacher'], true), fn ($query) => $query->where('role', $role))
            ->orderBy('role')
            ->orderBy('name')
            ->get();
    }

    public function visibleSalesUsersFor(User $actor, ?string $role = null): Collection
    {
        $this->salesTracking->refreshAssignmentStatuses();

        if ($actor->role === 'admin') {
            return $this->salesUsers($role);
        }

        if ($actor->role === 'sales_manager') {
            return User::query()
                ->with(['salesManager:id,name,mobile', 'salesExperts:id,name,mobile,is_active'])
                ->where(function ($query) use ($actor): void {
                    $query->whereKey($actor->id)
                        ->orWhere(function ($inner) use ($actor): void {
                            $inner->where('role', 'sales_expert')
                                ->where('sales_manager_user_id', $actor->id);
                        });
                })
                ->when(in_array($role, ['sales_expert', 'sales_manager'], true), fn ($query) => $query->where('role', $role))
                ->orderByRaw("CASE WHEN id = {$actor->id} THEN 0 ELSE 1 END")
                ->orderBy('name')
                ->get();
        }

        if ($actor->role === 'sales_expert') {
            return User::query()
                ->with(['salesManager:id,name,mobile', 'salesExperts:id,name,mobile,is_active'])
                ->whereKey($actor->id)
                ->when(in_array($role, ['sales_expert', 'sales_manager', 'teacher'], true), fn ($query) => $query->where('role', $role))
                ->get();
        }

        if ($actor->role === 'teacher') {
            return User::query()
                ->with(['salesManager:id,name,mobile', 'salesExperts:id,name,mobile,is_active'])
                ->whereKey($actor->id)
                ->when(in_array($role, ['sales_expert', 'sales_manager', 'teacher'], true), fn ($query) => $query->where('role', $role))
                ->get();
        }

        return collect();
    }

    public function summaryForUser(User $user): array
    {
        $currentMonth = $this->jalaliMonthRange();
        $monthStart = $currentMonth['start'];
        $monthEnd = $currentMonth['end'];

        $salesQuery = $this->ledgerQueryForUser($user);
        $assignmentsQuery = $this->assignmentQueryForUser($user);
        $followUpsActorQuery = SalesFollowUp::query()->where('actor_user_id', $user->id);

        $totalSales = (int) (clone $salesQuery)->sum('net_amount');
        $monthlySales = (int) (clone $salesQuery)->whereBetween('occurred_at', [$monthStart, $monthEnd])->sum('net_amount');
        $totalCustomers = (int) (clone $assignmentsQuery)->count();
        $monthlyCustomers = (int) (clone $assignmentsQuery)->whereBetween('first_purchased_at', [$monthStart, $monthEnd])->count();
        $missedRenewals = (int) (clone $assignmentsQuery)
            ->where('status', 'renewal_missed')
            ->count();
        $followUpsCount = (int) (clone $followUpsActorQuery)->count();
        $monthlyFollowUps = (int) (clone $followUpsActorQuery)->whereBetween('followed_at', [$monthStart, $monthEnd])->count();
        $commissionAmount = $user->role === 'sales_manager'
            ? (int) (clone $salesQuery)->sum('sales_manager_amount')
            : (int) (clone $salesQuery)->sum('sales_expert_amount');
        $monthlyCommission = $user->role === 'sales_manager'
            ? (int) (clone $salesQuery)->whereBetween('occurred_at', [$monthStart, $monthEnd])->sum('sales_manager_amount')
            : (int) (clone $salesQuery)->whereBetween('occurred_at', [$monthStart, $monthEnd])->sum('sales_expert_amount');

        $teamSales = $user->role === 'sales_manager'
            ? (int) SalesCommissionLedger::query()
                ->where('sales_manager_user_id', $user->id)
                ->sum('net_amount')
            : 0;

        $directSales = $user->role === 'sales_manager'
            ? (int) SalesCommissionLedger::query()
                ->where('sales_manager_user_id', $user->id)
                ->whereNull('sales_expert_user_id')
                ->sum('net_amount')
            : $totalSales;

        $activeAssignments = (int) (clone $assignmentsQuery)
            ->whereIn('status', ['won', 'contacted', 'renewed', 'renewal_due'])
            ->count();

        $pipeline = [
            'new' => (int) (clone $assignmentsQuery)->where('status', 'new')->count(),
            'contacted' => (int) (clone $assignmentsQuery)->where('status', 'contacted')->count(),
            'won' => (int) (clone $assignmentsQuery)->where('status', 'won')->count(),
            'renewed' => (int) (clone $assignmentsQuery)->where('status', 'renewed')->count(),
            'renewal_missed' => $missedRenewals,
            'lost' => (int) (clone $assignmentsQuery)->where('status', 'lost')->count(),
        ];

        return [
            'totalSales' => $totalSales,
            'monthlySales' => $monthlySales,
            'totalCustomers' => $totalCustomers,
            'monthlyCustomers' => $monthlyCustomers,
            'missedRenewals' => $missedRenewals,
            'followUpsCount' => $followUpsCount,
            'monthlyFollowUps' => $monthlyFollowUps,
            'commissionAmount' => $commissionAmount,
            'monthlyCommission' => $monthlyCommission,
            'teamSales' => $teamSales,
            'directSales' => $directSales,
            'activeAssignments' => $activeAssignments,
            'pipeline' => $pipeline,
            'managedExpertsCount' => $user->role === 'sales_manager' ? $user->salesExperts()->count() : 0,
            'availableBalance' => $this->wallets->availableBalance($user),
            'pendingWithdrawalAmount' => $this->wallets->pendingWithdrawalAmount($user),
            'withdrawalRequestsCount' => $user->salesWithdrawalRequests()->count(),
            'pendingWithdrawalRequestsCount' => $user->salesWithdrawalRequests()->where('status', 'pending')->count(),
            'paidWithdrawalAmount' => (int) $user->salesWithdrawalRequests()->where('status', 'paid')->sum('paid_amount'),
        ];
    }

    public function detailForUser(User $user): array
    {
        $this->salesTracking->refreshAssignmentStatuses();
        $summary = $this->summaryForUser($user);
        $salesQuery = $this->ledgerQueryForUser($user);
        $assignmentsQuery = $this->assignmentQueryForUser($user);

        $monthlyTrend = collect(range(0, 5))
            ->map(function (int $offset) use ($salesQuery): array {
                $range = $this->jalaliMonthRange(5 - $offset);

                return [
                    'label' => $range['label'],
                    'amount' => (int) (clone $salesQuery)
                        ->whereBetween('occurred_at', [$range['start'], $range['end']])
                        ->sum('net_amount'),
                ];
            });

        return [
            'summary' => $summary,
            'monthlyTrend' => $monthlyTrend,
            'assignments' => (clone $assignmentsQuery)
                ->with(['landingCustomer', 'salesManager', 'salesExpert'])
                ->latest('last_purchased_at')
                ->paginate(12, ['*'], 'assignments_page'),
            'recentFollowUps' => SalesFollowUp::query()
                ->with(['assignment', 'actor'])
                ->where(function ($query) use ($user): void {
                    $query->where('actor_user_id', $user->id)
                        ->orWhereHas('assignment', function ($inner) use ($user): void {
                            $this->applyAssignmentScope($inner, $user);
                        });
                })
                ->latest('followed_at')
                ->limit(10)
                ->get(),
            'recentCommissions' => (clone $salesQuery)
                ->latest('occurred_at')
                ->limit(10)
                ->get(),
            'withdrawalRequests' => $user->salesWithdrawalRequests()
                ->with(['bankAccount', 'processedBy'])
                ->latest('requested_at')
                ->paginate(10, ['*'], 'withdrawals_page'),
            'upcomingFollowUps' => (clone $assignmentsQuery)
                ->whereNotNull('next_follow_up_at')
                ->where('next_follow_up_at', '>=', now())
                ->orderBy('next_follow_up_at')
                ->limit(8)
                ->get(),
            'managedExperts' => $user->role === 'sales_manager'
                ? $user->salesExperts()->orderBy('name')->get()
                : collect(),
        ];
    }

    public function assignmentOptionsForUser(User $user): Collection
    {
        return $this->assignmentQueryForUser($user)
            ->orderByRaw('COALESCE(next_follow_up_at, last_purchased_at, created_at) DESC')
            ->limit(200)
            ->get();
    }

    public function renewalOpportunitySummary(?User $scopeUser = null, ?User $actor = null): array
    {
        $query = $scopeUser
            ? $this->assignmentQueryForUser($scopeUser)
            : $this->renewalAssignmentQueryForActor($actor);

        $today = now()->startOfDay();
        $tomorrow = $today->copy()->addDay();
        $inTwoDays = $today->copy()->addDays(2);
        $inSevenDays = $today->copy()->addDays(7);
        $sevenDaysAgo = $today->copy()->subDays(7);
        $yesterday = $today->copy()->subDay();

        $baseQuery = (clone $query)->whereNotNull('support_expires_at');

        return [
            'next_7_days' => (int) (clone $baseQuery)->whereBetween('support_expires_at', [$today->toDateString(), $inSevenDays->toDateString()])->count(),
            'next_2_days' => (int) (clone $baseQuery)->whereBetween('support_expires_at', [$today->toDateString(), $inTwoDays->toDateString()])->count(),
            'tomorrow' => (int) (clone $baseQuery)->whereDate('support_expires_at', $tomorrow->toDateString())->count(),
            'expired_last_7_days' => (int) (clone $baseQuery)->whereBetween('support_expires_at', [$sevenDaysAgo->toDateString(), $yesterday->toDateString()])->count(),
            'expired_over_7_days' => (int) (clone $baseQuery)->whereDate('support_expires_at', '<', $sevenDaysAgo->toDateString())->count(),
        ];
    }

    public function renewalOpportunities(?User $scopeUser = null, ?User $actor = null, string $filter = 'next_7_days'): LengthAwarePaginator
    {
        $query = $scopeUser
            ? $this->assignmentQueryForUser($scopeUser)
            : $this->renewalAssignmentQueryForActor($actor);

        $today = now()->startOfDay();
        $tomorrow = $today->copy()->addDay();
        $inTwoDays = $today->copy()->addDays(2);
        $inSevenDays = $today->copy()->addDays(7);
        $sevenDaysAgo = $today->copy()->subDays(7);
        $yesterday = $today->copy()->subDay();

        $query = $query
            ->with(['salesExpert:id,name,mobile', 'salesManager:id,name,mobile', 'audienceType:id,name'])
            ->whereNotNull('support_expires_at');

        match ($filter) {
            'next_2_days' => $query->whereBetween('support_expires_at', [$today->toDateString(), $inTwoDays->toDateString()]),
            'tomorrow' => $query->whereDate('support_expires_at', $tomorrow->toDateString()),
            'expired_last_7_days' => $query->whereBetween('support_expires_at', [$sevenDaysAgo->toDateString(), $yesterday->toDateString()]),
            'expired_over_7_days' => $query->whereDate('support_expires_at', '<', $sevenDaysAgo->toDateString()),
            default => $query->whereBetween('support_expires_at', [$today->toDateString(), $inSevenDays->toDateString()]),
        };

        return $query
            ->orderByRaw('CASE WHEN support_expires_at >= CURRENT_DATE THEN 0 ELSE 1 END')
            ->orderBy('support_expires_at')
            ->paginate(20)
            ->withQueryString();
    }

    public function customerAssignmentsForActor(User $actor, string $status = 'all', ?string $search = null): LengthAwarePaginator
    {
        $query = $actor->role === 'admin'
            ? SalesCustomerAssignment::query()
            : $this->assignmentQueryForUser($actor);

        $search = trim((string) $search);
        $normalizedSearchMobile = InputNormalizer::mobile($search);

        $query
            ->with(['salesExpert:id,name,mobile', 'salesManager:id,name,mobile', 'audienceType:id,name'])
            ->withSum('commissionLedgers as sales_expert_commission_total', 'sales_expert_amount')
            ->withSum('commissionLedgers as sales_manager_commission_total', 'sales_manager_amount')
            ->when($status === 'purchased', function ($builder): void {
                $builder->whereNotNull('first_purchased_at');
            })
            ->when($status === 'pending', function ($builder): void {
                $builder->whereNull('first_purchased_at');
            })
            ->when($status === 'renewal_due', function ($builder): void {
                $builder->where('status', 'renewal_due');
            })
            ->when($status === 'renewal_missed', function ($builder): void {
                $builder->where('status', 'renewal_missed');
            })
            ->when($search !== '', function ($builder) use ($search, $normalizedSearchMobile): void {
                $builder->where(function ($inner) use ($search, $normalizedSearchMobile): void {
                    $inner->where('customer_name', 'like', '%'.$search.'%');

                    if ($normalizedSearchMobile !== '') {
                        $inner->orWhere('customer_mobile', 'like', '%'.$normalizedSearchMobile.'%');
                    }

                    $inner->orWhere('tenant_id', 'like', '%'.$search.'%');
                });
            });

        return $query
            ->orderByRaw('CASE WHEN first_purchased_at IS NULL THEN 0 ELSE 1 END')
            ->orderByRaw('COALESCE(next_follow_up_at, created_at) DESC')
            ->paginate(20)
            ->withQueryString();
    }

    public function customerAssignmentOverviewForActor(User $actor): array
    {
        $query = $actor->role === 'admin'
            ? SalesCustomerAssignment::query()
            : $this->assignmentQueryForUser($actor);

        return [
            'total' => (int) (clone $query)->count(),
            'pending' => (int) (clone $query)->whereNull('first_purchased_at')->count(),
            'purchased' => (int) (clone $query)->whereNotNull('first_purchased_at')->count(),
            'renewalDue' => (int) (clone $query)->where('status', 'renewal_due')->count(),
            'renewalMissed' => (int) (clone $query)->where('status', 'renewal_missed')->count(),
        ];
    }

    public function createCustomerAssignment(User $actor, array $data): SalesCustomerAssignment
    {
        $mobile = InputNormalizer::mobile((string) ($data['customer_mobile'] ?? ''));
        $participants = $this->salesTracking->resolveParticipants($actor);
        $customerName = trim((string) ($data['customer_name'] ?? '')) ?: 'مدیر سامانه نوبت‌دهی';
        /** @var SalesCustomerAssignment|null $duplicateAssignment */
        $duplicateAssignment = SalesCustomerAssignment::query()
            ->with(['salesExpert:id,name', 'salesManager:id,name'])
            ->where('customer_mobile', $mobile)
            ->latest('id')
            ->first();

        if ($duplicateAssignment) {
            $ownerLabel = $this->customerOwnershipLabel($duplicateAssignment);
            $assignedName = $duplicateAssignment->customer_name ?: 'این مشتری';
            $message = sprintf(
                '%s با شماره %s قبلاً در سیستم ثبت شده است%s.',
                $assignedName,
                $mobile,
                $ownerLabel !== '—' ? ' و به '.$ownerLabel.' اختصاص دارد' : ''
            );

            throw ValidationException::withMessages([
                'customer_mobile' => $message,
            ]);
        }

        $this->ensureCentralBarberUserForLead($mobile, $customerName);

        $payload = [
            'sales_expert_user_id' => $participants['salesExpertId'],
            'sales_manager_user_id' => $participants['salesManagerId'],
            'assigned_by_user_id' => $actor->id,
            'audience_type_id' => $data['audience_type_id'] ?: null,
            'customer_name' => trim((string) ($data['customer_name'] ?? '')) ?: null,
            'customer_mobile' => $mobile,
            'status' => 'new',
            'source_type' => 'manual_assignment',
            'source_id' => null,
            'latest_source_type' => 'manual_assignment',
            'latest_source_id' => null,
            'sales_expert_percent' => $participants['salesExpertPercent'],
            'sales_manager_percent' => $participants['salesManagerPercent'],
            'next_follow_up_at' => $data['next_follow_up_at'] ?: null,
            'meta_json' => [
                'manual_assignment_notes' => trim((string) ($data['notes'] ?? '')) ?: null,
                'manual_assignment_created_by' => $actor->id,
            ],
        ];
        $assignment = SalesCustomerAssignment::query()->create($payload);

        if (trim((string) ($data['notes'] ?? '')) !== '') {
            $this->createFollowUp($actor, $assignment, [
                'follow_up_type' => 'note',
                'result_status' => $assignment->status,
                'summary' => 'ثبت اولیه مشتری در پنل فروش',
                'details' => trim((string) $data['notes']),
                'scheduled_for' => null,
                'followed_at' => now(),
                'next_follow_up_at' => $data['next_follow_up_at'] ?: null,
            ]);
        }

        return $assignment->fresh(['salesExpert', 'salesManager', 'audienceType']);
    }

    public function createFollowUp(User $actor, SalesCustomerAssignment $assignment, array $data): SalesFollowUp
    {
        $followUp = SalesFollowUp::query()->create([
            'sales_customer_assignment_id' => $assignment->id,
            'actor_user_id' => $actor->id,
            'actor_role' => $actor->role,
            'follow_up_type' => $data['follow_up_type'],
            'result_status' => $data['result_status'] ?: null,
            'summary' => $data['summary'],
            'details' => $data['details'] ?: null,
            'scheduled_for' => $data['scheduled_for'] ?: null,
            'followed_at' => $data['followed_at'] ?: now(),
            'next_follow_up_at' => $data['next_follow_up_at'] ?: null,
        ]);

        $assignment->update([
            'status' => $data['result_status'] ?: $assignment->status,
            'last_followed_up_at' => $followUp->followed_at,
            'next_follow_up_at' => $followUp->next_follow_up_at,
        ]);

        return $followUp;
    }

    public function roleLabel(string $role): string
    {
        return match ($role) {
            'sales_expert' => 'کارشناس فروش',
            'sales_manager' => 'مدیر فروش',
            'teacher' => 'مدرس',
            default => $role,
        };
    }

    public function statusLabel(?string $status): string
    {
        return match ($status) {
            'new' => 'جدید',
            'contacted' => 'تماس گرفته شده',
            'qualified' => 'واجد شرایط',
            'won' => 'خرید اول انجام شده',
            'renewed' => 'تمدید کرده',
            'renewal_due' => 'نزدیک تمدید',
            'renewal_missed' => 'تمدید نکرده',
            'lost' => 'از دست رفته',
            default => $status ?: '—',
        };
    }

    public function followUpTypeLabel(string $type): string
    {
        return match ($type) {
            'call' => 'تماس',
            'whatsapp' => 'واتساپ',
            'sms' => 'پیامک',
            'meeting' => 'جلسه',
            'note' => 'یادداشت',
            default => $type,
        };
    }

    public function renewalFilterLabel(string $filter): string
    {
        return match ($filter) {
            'next_2_days' => 'تا ۲ روز آینده',
            'tomorrow' => 'فردا تمام می‌شود',
            'expired_last_7_days' => 'تا ۱ هفته گذشته',
            'expired_over_7_days' => 'بیشتر از ۱ هفته گذشته',
            default => 'تا ۷ روز آینده',
        };
    }

    public function renewalRelativeLabel($date): string
    {
        if (! $date) {
            return '—';
        }

        $today = now()->startOfDay();
        $target = Carbon::parse($date)->startOfDay();
        $diff = $today->diffInDays($target, false);

        if ($diff === 0) {
            return 'امروز پایان می‌یابد';
        }

        if ($diff === 1) {
            return 'فردا پایان می‌یابد';
        }

        if ($diff > 1) {
            return number_format($diff).' روز دیگر';
        }

        if ($diff === -1) {
            return 'دیروز تمام شده';
        }

        return number_format(abs($diff)).' روز از پایان گذشته';
    }

    public function withdrawalStatusLabel(string $status): string
    {
        return match ($status) {
            'pending' => 'در صف واریز',
            'paid' => 'واریز شده',
            'cancelled' => 'کنسل شده',
            'returned' => 'برگشت خورده',
            default => $status,
        };
    }

    public function withdrawalStatusBadgeClass(string $status): string
    {
        return match ($status) {
            'pending' => 'bg-light-warning text-warning',
            'paid' => 'bg-light-success text-success',
            'cancelled' => 'bg-light-secondary text-secondary',
            'returned' => 'bg-light-danger text-danger',
            default => 'bg-light text-dark',
        };
    }

    public function canAccessSalesArea(User $actor): bool
    {
        return in_array($actor->role, ['admin', 'sales_manager', 'sales_expert', 'teacher'], true);
    }

    public function canViewSalesUser(User $actor, User $subject): bool
    {
        if (! in_array($subject->role, ['sales_expert', 'sales_manager', 'teacher'], true)) {
            return false;
        }

        if ($actor->role === 'admin') {
            return true;
        }

        if ($actor->role === 'sales_manager') {
            return (int) $actor->id === (int) $subject->id
                || ($subject->role === 'sales_expert' && (int) $subject->sales_manager_user_id === (int) $actor->id);
        }

        if ($actor->role === 'sales_expert') {
            return (int) $actor->id === (int) $subject->id;
        }

        if ($actor->role === 'teacher') {
            return (int) $actor->id === (int) $subject->id;
        }

        return false;
    }

    public function canManageWithdrawalFor(User $actor, User $subject): bool
    {
        if (! in_array($subject->role, ['sales_expert', 'sales_manager', 'teacher'], true)) {
            return false;
        }

        return $actor->role === 'admin' || (int) $actor->id === (int) $subject->id;
    }

    public function customerOwnershipLabel(SalesCustomerAssignment $assignment): string
    {
        if ($assignment->salesExpert?->name) {
            return $assignment->salesExpert->name;
        }

        if ($assignment->salesManager?->name) {
            return $assignment->salesManager->name;
        }

        return '—';
    }

    private function ensureCentralBarberUserForLead(string $mobile, string $name): User
    {
        $user = User::query()->where('mobile', $mobile)->first();

        if ($user && $user->role !== 'barber') {
            throw ValidationException::withMessages([
                'customer_mobile' => 'این شماره موبایل قبلاً برای یک کاربر با نقش دیگر ثبت شده است و قابل تبدیل به مدیر سامانه نیست.',
            ]);
        }

        if (! $user) {
            $user = User::query()->create([
                'name' => $name,
                'mobile' => $mobile,
                'password' => Hash::make($mobile),
                'role' => 'barber',
                'is_active' => true,
            ]);

            $user->syncRoles(['barber']);

            return $user;
        }

        $user->update([
            'name' => trim((string) ($user->name ?: $name)),
            'password' => Hash::make($mobile),
            'is_active' => true,
        ]);

        $user->syncRoles(['barber']);

        return $user;
    }

    private function renewalAssignmentQueryForActor(?User $actor)
    {
        if (! $actor) {
            return SalesCustomerAssignment::query()->whereRaw('1 = 0');
        }

        if ($actor->role === 'admin') {
            return SalesCustomerAssignment::query();
        }

        return $this->assignmentQueryForUser($actor);
    }

    private function ledgerQueryForUser(User $user)
    {
        return SalesCommissionLedger::query()
            ->when(
                $user->role === 'sales_manager',
                fn ($query) => $query->where('sales_manager_user_id', $user->id),
                fn ($query) => $query->where('sales_expert_user_id', $user->id),
            );
    }

    private function assignmentQueryForUser(User $user)
    {
        return SalesCustomerAssignment::query()
            ->when(
                $user->role === 'sales_manager',
                fn ($query) => $query->where('sales_manager_user_id', $user->id),
                fn ($query) => $query->where('sales_expert_user_id', $user->id),
            );
    }

    private function applyAssignmentScope($query, User $user): void
    {
        if ($user->role === 'sales_manager') {
            $query->where('sales_manager_user_id', $user->id);

            return;
        }

        $query->where('sales_expert_user_id', $user->id);
    }

    /**
     * @return array{start: Carbon, end: Carbon, label: string}
     */
    private function jalaliMonthRange(int $monthsAgo = 0): array
    {
        $jalali = Jalalian::fromCarbon(now());
        $year = $jalali->getYear();
        $month = $jalali->getMonth();

        for ($i = 0; $i < $monthsAgo; $i++) {
            $month -= 1;

            if ($month < 1) {
                $month = 12;
                $year -= 1;
            }
        }

        $startJalali = new Jalalian($year, $month, 1);
        $endJalali = $startJalali->addMonths(1)->subDays(1);

        return [
            'start' => $startJalali->toCarbon()->startOfDay(),
            'end' => $endJalali->toCarbon()->endOfDay(),
            'label' => $this->jalaliMonthLabel($year, $month),
        ];
    }

    private function jalaliMonthLabel(int $year, int $month): string
    {
        $monthNames = [
            1 => 'فروردین',
            2 => 'اردیبهشت',
            3 => 'خرداد',
            4 => 'تیر',
            5 => 'مرداد',
            6 => 'شهریور',
            7 => 'مهر',
            8 => 'آبان',
            9 => 'آذر',
            10 => 'دی',
            11 => 'بهمن',
            12 => 'اسفند',
        ];

        return ($monthNames[$month] ?? (string) $month).' '.$year;
    }
}
