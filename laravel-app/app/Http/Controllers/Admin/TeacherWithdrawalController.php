<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\SalesTeamService;
use App\Services\SalesWalletService;
use App\Services\SpecializedCourseRevenueService;
use Illuminate\View\View;

class TeacherWithdrawalController extends Controller
{
    public function __construct(
        private readonly SalesWalletService $wallets,
        private readonly SalesTeamService $salesTeam,
        private readonly SpecializedCourseRevenueService $revenues,
    ) {
    }

    public function __invoke(): View
    {
        $teacher = auth()->user();
        abort_unless($teacher?->role === 'teacher', 403);

        $this->revenues->syncWalletCreditsForTeacher($teacher);
        $summary = $this->salesTeam->summaryForUser($teacher);

        return view('admin.sales-team.withdrawals', [
            'salesUser' => $teacher->load(['salesBankAccounts' => fn ($query) => $query->latest()]),
            'summary' => array_merge($summary, [
                'totalSales' => $summary['totalSales'] + (int) $teacher->specializedCourseOrders()->where('status', 'paid')->sum('payable_amount'),
                'availableBalance' => $this->wallets->availableBalance($teacher),
                'pendingWithdrawalAmount' => $this->wallets->pendingWithdrawalAmount($teacher),
                'paidWithdrawalAmount' => (int) $teacher->salesWithdrawalRequests()->where('status', 'paid')->sum('paid_amount'),
            ]),
            'withdrawalRequests' => $teacher->salesWithdrawalRequests()
                ->with(['bankAccount', 'processedBy', 'logs.actor'])
                ->latest('requested_at')
                ->paginate(12),
            'walletTransactions' => $teacher->salesWalletTransactions()
                ->with(['commissionLedger', 'withdrawalRequest'])
                ->latest('occurred_at')
                ->paginate(15, ['*'], 'transactions_page'),
            'salesTeamService' => $this->salesTeam,
        ]);
    }
}
