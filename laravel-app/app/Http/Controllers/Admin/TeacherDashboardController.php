<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SpecializedCourse;
use App\Models\SpecializedCourseOrder;
use App\Services\SalesTeamService;
use App\Services\SalesWalletService;
use App\Services\SpecializedCourseRevenueService;
use Illuminate\View\View;

class TeacherDashboardController extends Controller
{
    public function __construct(
        private readonly SalesTeamService $salesTeam,
        private readonly SalesWalletService $wallets,
        private readonly SpecializedCourseRevenueService $revenues,
    ) {
    }

    public function __invoke(): View
    {
        $teacher = auth()->user();
        abort_unless($teacher?->role === 'teacher', 403);

        $this->revenues->syncWalletCreditsForTeacher($teacher);

        $coursesQuery = SpecializedCourse::query()->where('teacher_user_id', $teacher->id);
        $ordersQuery = SpecializedCourseOrder::query()->where('teacher_user_id', $teacher->id);
        $referralSummary = $this->salesTeam->summaryForUser($teacher);

        return view('admin.teachers.dashboard', [
            'teacher' => $teacher,
            'stats' => [
                'courses_total' => (clone $coursesQuery)->count(),
                'courses_published' => (clone $coursesQuery)->where('is_published', true)->count(),
                'orders_total' => (clone $ordersQuery)->count(),
                'orders_paid' => (clone $ordersQuery)->where('status', 'paid')->count(),
                'gross_sales' => (int) (clone $ordersQuery)->where('status', 'paid')->sum('payable_amount'),
                'course_commission_total' => (int) (clone $ordersQuery)->where('status', 'paid')->sum('teacher_commission_amount'),
                'referral_commission_total' => (int) ($referralSummary['commissionAmount'] ?? 0),
                'available_balance' => $this->wallets->availableBalance($teacher),
                'pending_withdrawal_amount' => $this->wallets->pendingWithdrawalAmount($teacher),
            ],
            'latestCourses' => (clone $coursesQuery)->latest('id')->limit(6)->get(),
            'latestOrders' => (clone $ordersQuery)->latest('id')->limit(10)->get(),
            'referralSummary' => $referralSummary,
        ]);
    }
}
