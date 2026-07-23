<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\SpecializedCourseOrder;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class SpecializedCourseRevenueService
{
    public function __construct(
        private readonly SpecializedCourseCommissionService $commissions,
    ) {
    }

    public function syncWalletCreditsForTeacher(User $teacher): void
    {
        $this->syncPaidOrderCommissions($teacher);
    }

    public function syncPaidOrderCommissions(?User $teacher = null): void
    {
        SpecializedCourseOrder::query()
            ->when($teacher?->id, fn ($query) => $query->where('teacher_user_id', $teacher->id))
            ->where('status', 'paid')
            ->orderBy('id')
            ->chunk(200, function ($orders): void {
                $this->syncWalletCreditsForOrders($orders);
            });
    }

    public function syncWalletCreditsForOrders(iterable $orders): void
    {
        foreach ($orders as $order) {
            if ($order instanceof SpecializedCourseOrder) {
                $this->commissions->syncOrder($order);
            }
        }
    }

    public function ordersQueryForActor(User $actor, array $filters = []): Builder
    {
        $query = SpecializedCourseOrder::query()
            ->with([
                'course:id,title',
                'teacher:id,name,mobile',
                'salesExpert:id,name,mobile,role',
                'salesManager:id,name,mobile,role',
                'salesAssignment:id,sales_expert_user_id,sales_manager_user_id',
            ]);

        if ($actor->role === 'teacher') {
            $query->where('teacher_user_id', $actor->id);
        } elseif (! empty($filters['teacher_user_id'])) {
            $query->where('teacher_user_id', (int) $filters['teacher_user_id']);
        }

        if (! empty($filters['specialized_course_id'])) {
            $query->where('specialized_course_id', (int) $filters['specialized_course_id']);
        }

        if (! empty($filters['status'])) {
            $query->where('status', (string) $filters['status']);
        }

        if (! empty($filters['date_from'])) {
            $query->whereDate('paid_at', '>=', (string) $filters['date_from']);
        }

        if (! empty($filters['date_to'])) {
            $query->whereDate('paid_at', '<=', (string) $filters['date_to']);
        }

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $query->where(function ($inner) use ($search): void {
                $inner->where('order_number', 'like', '%'.$search.'%')
                    ->orWhere('buyer_name', 'like', '%'.$search.'%')
                    ->orWhere('buyer_mobile', 'like', '%'.$search.'%')
                    ->orWhere('course_title_snapshot', 'like', '%'.$search.'%')
                    ->orWhere('teacher_name_snapshot', 'like', '%'.$search.'%');
            });
        }

        return $query;
    }

    public function summaryForActor(User $actor, array $filters = []): array
    {
        $query = $this->ordersQueryForActor($actor, $filters);
        $paidQuery = (clone $query)->where('status', 'paid');

        return [
            'orders_total' => (int) (clone $query)->count(),
            'orders_paid' => (int) (clone $paidQuery)->count(),
            'gross_sales' => (int) (clone $paidQuery)->sum('payable_amount'),
            'teacher_commission_total' => (int) (clone $paidQuery)->sum('teacher_commission_amount'),
            'sales_expert_commission_total' => (int) (clone $paidQuery)->sum('sales_expert_amount'),
            'sales_manager_commission_total' => (int) (clone $paidQuery)->sum('sales_manager_amount'),
            'discount_total' => (int) (clone $paidQuery)->sum('course_discount_amount') + (int) (clone $paidQuery)->sum('coupon_discount_amount'),
        ];
    }

    public function breakdownByCourse(User $actor, array $filters = []): Collection
    {
        return $this->ordersQueryForActor($actor, $filters)
            ->where('status', 'paid')
            ->get()
            ->groupBy('specialized_course_id')
            ->map(function (Collection $items): array {
                /** @var \App\Models\SpecializedCourseOrder $first */
                $first = $items->first();

                return [
                    'course_id' => $first->specialized_course_id,
                    'course_title' => $first->course_title_snapshot ?: ($first->course?->title ?? 'دوره بدون عنوان'),
                    'teacher_name' => $first->teacher_name_snapshot ?: ($first->teacher?->name ?? '—'),
                    'orders_count' => $items->count(),
                    'gross_sales' => (int) $items->sum('payable_amount'),
                    'teacher_commission_total' => (int) $items->sum('teacher_commission_amount'),
                    'sales_expert_commission_total' => (int) $items->sum('sales_expert_amount'),
                    'sales_manager_commission_total' => (int) $items->sum('sales_manager_amount'),
                    'average_commission_percent' => round((float) $items->avg('teacher_commission_percent'), 2),
                ];
            })
            ->sortByDesc('gross_sales')
            ->values();
    }

    public function breakdownByTeacher(User $actor, array $filters = []): Collection
    {
        return $this->ordersQueryForActor($actor, $filters)
            ->where('status', 'paid')
            ->get()
            ->groupBy('teacher_user_id')
            ->map(function (Collection $items): array {
                /** @var \App\Models\SpecializedCourseOrder $first */
                $first = $items->first();

                return [
                    'teacher_user_id' => $first->teacher_user_id,
                    'teacher_name' => $first->teacher_name_snapshot ?: ($first->teacher?->name ?? '—'),
                    'orders_count' => $items->count(),
                    'gross_sales' => (int) $items->sum('payable_amount'),
                    'teacher_commission_total' => (int) $items->sum('teacher_commission_amount'),
                    'sales_expert_commission_total' => (int) $items->sum('sales_expert_amount'),
                    'sales_manager_commission_total' => (int) $items->sum('sales_manager_amount'),
                    'average_commission_percent' => round((float) $items->avg('teacher_commission_percent'), 2),
                ];
            })
            ->sortByDesc('gross_sales')
            ->values();
    }
}
