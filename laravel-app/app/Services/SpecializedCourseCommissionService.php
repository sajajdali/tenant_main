<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\SalesCommissionLedger;
use App\Models\SpecializedCourseOrder;

class SpecializedCourseCommissionService
{
    private const SNAPSHOT_VERSION = 2;

    public function __construct(
        private readonly SalesTrackingService $salesTracking,
        private readonly SalesWalletService $wallets,
    ) {
    }

    public function syncOrder(SpecializedCourseOrder $order): SpecializedCourseOrder
    {
        $order->loadMissing([
            'course.teacher.teacherProfile',
            'teacher.teacherProfile',
            'salesAssignment.salesExpert',
            'salesAssignment.salesManager',
        ]);

        if ($order->status !== 'paid') {
            return $order;
        }

        $meta = is_array($order->meta_json) ? $order->meta_json : [];
        $existingBreakdown = is_array($meta['commission_breakdown'] ?? null) ? $meta['commission_breakdown'] : [];

        if ((int) ($existingBreakdown['snapshot_version'] ?? 0) >= self::SNAPSHOT_VERSION) {
            $this->wallets->ensureTeacherCourseCommissionCredit($order);
            $this->syncSalesLedger(
                $order,
                $order->sales_customer_assignment_id,
                (int) ($existingBreakdown['sales_commission_base_amount'] ?? 0),
                (int) ($existingBreakdown['teacher_commission_amount'] ?? 0),
                (int) ($existingBreakdown['platform_amount'] ?? max(0, (int) $order->payable_amount - (int) $order->teacher_commission_amount - (int) $order->sales_expert_amount - (int) $order->sales_manager_amount)),
                is_array($existingBreakdown['suppressed_duplicate_roles'] ?? null) ? $existingBreakdown['suppressed_duplicate_roles'] : [],
            );

            return $order;
        }

        $teacher = $order->teacher ?? $order->course?->teacher;
        $teacherId = $teacher?->id ? (int) $teacher->id : ((int) $order->teacher_user_id ?: null);
        $teacherName = trim((string) ($teacher?->name ?? $order->teacher_name_snapshot ?? '')) ?: null;
        $assignment = $this->salesTracking->findAssignmentForTrackedPurchase(
            customerMobile: $order->buyer_mobile,
            tenantId: $order->tenant_id,
        );

        $teacherDirectPercent = (float) ($teacher?->sales_commission_percent ?? 0);
        $teacherIndirectPercent = (float) ($teacher?->teacherProfile?->commission_percent ?? $order->teacher_commission_percent ?? 0);
        $isTeacherDirectReferral = $teacherId !== null
            && $assignment
            && (
                (int) $assignment->sales_expert_user_id === $teacherId
                || (int) $assignment->sales_manager_user_id === $teacherId
                || (int) $assignment->assigned_by_user_id === $teacherId
            );

        $teacherPercentMode = $isTeacherDirectReferral ? 'teacher_direct_referral' : 'teacher_indirect_share';
        $teacherPercentLabel = $isTeacherDirectReferral
            ? 'معرفی مستقیم مشتری توسط مدرس'
            : 'فروش دوره بدون معرفی مستقیم توسط مدرس';
        $teacherPercent = $isTeacherDirectReferral ? $teacherDirectPercent : $teacherIndirectPercent;
        $teacherAmount = $teacherId ? $this->commissionAmount((int) $order->payable_amount, $teacherPercent) : 0;
        $salesBaseAmount = max(0, (int) $order->payable_amount - $teacherAmount);

        $salesExpertId = $assignment?->sales_expert_user_id ? (int) $assignment->sales_expert_user_id : null;
        $salesManagerId = $assignment?->sales_manager_user_id ? (int) $assignment->sales_manager_user_id : null;
        $salesExpertPercent = $assignment?->sales_expert_percent !== null ? (float) $assignment->sales_expert_percent : null;
        $salesManagerPercent = $assignment?->sales_manager_percent !== null ? (float) $assignment->sales_manager_percent : null;

        $suppressedRoles = [];

        if ($teacherId !== null && $salesExpertId === $teacherId) {
            $salesExpertId = null;
            $salesExpertPercent = null;
            $suppressedRoles[] = 'sales_expert';
        }

        if ($teacherId !== null && $salesManagerId === $teacherId) {
            $salesManagerId = null;
            $salesManagerPercent = null;
            $suppressedRoles[] = 'sales_manager';
        }

        $salesExpertAmount = $salesExpertId && $salesExpertPercent !== null
            ? $this->commissionAmount($salesBaseAmount, $salesExpertPercent)
            : 0;
        $salesManagerAmount = $salesManagerId && $salesManagerPercent !== null
            ? $this->commissionAmount($salesBaseAmount, $salesManagerPercent)
            : 0;
        $platformAmount = max(0, (int) $order->payable_amount - $teacherAmount - $salesExpertAmount - $salesManagerAmount);

        $order->update([
            'teacher_user_id' => $teacherId,
            'teacher_name_snapshot' => $teacherName,
            'teacher_commission_percent' => $teacherPercent,
            'teacher_commission_amount' => $teacherAmount,
            'sales_customer_assignment_id' => $assignment?->id,
            'sales_expert_user_id' => $salesExpertId,
            'sales_manager_user_id' => $salesManagerId,
            'sales_expert_percent' => $salesExpertPercent,
            'sales_expert_amount' => $salesExpertAmount,
            'sales_manager_percent' => $salesManagerPercent,
            'sales_manager_amount' => $salesManagerAmount,
            'meta_json' => array_merge($meta, [
                'commission_breakdown' => [
                    'snapshot_version' => self::SNAPSHOT_VERSION,
                    'order_payable_amount' => (int) $order->payable_amount,
                    'teacher_commission_mode' => $teacherPercentMode,
                    'teacher_commission_label' => $teacherPercentLabel,
                    'teacher_direct_referral_detected' => $isTeacherDirectReferral,
                    'teacher_direct_referral_percent' => $teacherDirectPercent,
                    'teacher_indirect_percent' => $teacherIndirectPercent,
                    'teacher_commission_percent' => $teacherPercent,
                    'teacher_commission_amount' => $teacherAmount,
                    'remaining_after_teacher_amount' => $salesBaseAmount,
                    'sales_commission_base_amount' => $salesBaseAmount,
                    'sales_expert_percent' => $salesExpertPercent,
                    'sales_expert_amount' => $salesExpertAmount,
                    'sales_manager_percent' => $salesManagerPercent,
                    'sales_manager_amount' => $salesManagerAmount,
                    'platform_amount' => $platformAmount,
                    'suppressed_duplicate_roles' => $suppressedRoles,
                ],
            ]),
        ]);

        $order->refresh();

        $this->wallets->ensureTeacherCourseCommissionCredit($order);
        $this->syncSalesLedger($order, $assignment?->id, $salesBaseAmount, $teacherAmount, $platformAmount, $suppressedRoles);

        return $order;
    }

    public function syncOrders(iterable $orders): void
    {
        foreach ($orders as $order) {
            if ($order instanceof SpecializedCourseOrder) {
                $this->syncOrder($order);
            }
        }
    }

    private function syncSalesLedger(SpecializedCourseOrder $order, ?int $assignmentId, int $salesBaseAmount, int $teacherAmount, int $platformAmount, array $suppressedRoles): void
    {
        if ((int) $order->sales_expert_amount <= 0 && (int) $order->sales_manager_amount <= 0) {
            return;
        }

        $ledger = SalesCommissionLedger::query()->updateOrCreate(
            [
                'source_type' => 'specialized_course_order',
                'source_id' => $order->id,
            ],
            [
                'sales_customer_assignment_id' => $assignmentId,
                'sales_expert_user_id' => $order->sales_expert_user_id,
                'sales_manager_user_id' => $order->sales_manager_user_id,
                'source_label' => 'خرید دوره '.$order->order_number,
                'tenant_id' => $order->tenant_id,
                'customer_name' => $order->buyer_name,
                'customer_mobile' => $order->buyer_mobile,
                'gross_amount' => (int) $order->payable_amount,
                'discount_amount' => $teacherAmount,
                'net_amount' => $salesBaseAmount,
                'sales_expert_percent' => $order->sales_expert_percent,
                'sales_expert_amount' => (int) $order->sales_expert_amount,
                'sales_manager_percent' => $order->sales_manager_percent,
                'sales_manager_amount' => (int) $order->sales_manager_amount,
                'status' => 'recorded',
                'occurred_at' => $order->paid_at ?? $order->created_at ?? now(),
                'meta_json' => [
                    'specialized_course_order_id' => $order->id,
                    'specialized_course_id' => $order->specialized_course_id,
                    'course_title' => $order->course_title_snapshot ?: ($order->course?->title ?? 'دوره تخصصی'),
                    'teacher_user_id' => $order->teacher_user_id,
                    'teacher_name' => $order->teacher_name_snapshot ?: ($order->teacher?->name ?? null),
                    'teacher_commission_mode' => data_get($order->meta_json, 'commission_breakdown.teacher_commission_mode'),
                    'teacher_commission_label' => data_get($order->meta_json, 'commission_breakdown.teacher_commission_label'),
                    'teacher_direct_referral_detected' => (bool) data_get($order->meta_json, 'commission_breakdown.teacher_direct_referral_detected', false),
                    'teacher_direct_referral_percent' => (float) data_get($order->meta_json, 'commission_breakdown.teacher_direct_referral_percent', 0),
                    'teacher_indirect_percent' => (float) data_get($order->meta_json, 'commission_breakdown.teacher_indirect_percent', 0),
                    'teacher_commission_percent' => (float) $order->teacher_commission_percent,
                    'teacher_commission_amount' => (int) $order->teacher_commission_amount,
                    'sales_commission_base_amount' => $salesBaseAmount,
                    'platform_amount' => $platformAmount,
                    'order_payable_amount' => (int) $order->payable_amount,
                    'buyer_role' => $order->buyer_role,
                    'suppressed_duplicate_roles' => $suppressedRoles,
                ],
            ],
        );

        $this->wallets->ensureCommissionCredits($ledger);
    }

    private function commissionAmount(int $baseAmount, float|int|string|null $percent): int
    {
        if ($percent === null || $percent === '') {
            return 0;
        }

        return (int) floor(($baseAmount * (float) $percent) / 100);
    }
}
