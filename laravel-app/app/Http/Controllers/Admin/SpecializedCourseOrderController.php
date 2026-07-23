<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Models\SpecializedCourse;
use App\Models\SpecializedCourseOrder;
use App\Models\User;
use App\Services\SpecializedCourseCommissionService;
use App\Services\SpecializedCourseRevenueService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class SpecializedCourseOrderController extends Controller
{
    public function __construct(
        private readonly SpecializedCourseRevenueService $revenues,
        private readonly SpecializedCourseCommissionService $commissions,
    ) {
    }

    public function index(Request $request): View
    {
        $actor = auth()->user();
        abort_unless($actor && in_array($actor->role, ['admin', 'teacher'], true), 403);

        $this->revenues->syncPaidOrderCommissions($actor->role === 'teacher' ? $actor : null);

        $filters = [
            'status' => $request->string('status')->toString(),
            'teacher_user_id' => $request->integer('teacher_user_id') ?: null,
            'specialized_course_id' => $request->integer('specialized_course_id') ?: null,
            'date_from' => $request->string('date_from')->toString(),
            'date_to' => $request->string('date_to')->toString(),
            'search' => $request->string('search')->toString(),
        ];

        $orders = $this->revenues
            ->ordersQueryForActor($actor, $filters)
            ->latest('id')
            ->paginate(15)
            ->withQueryString();

        return view('admin.specialized-courses.orders', [
            'orders' => $orders,
            'isTeacher' => $actor->role === 'teacher',
            'summary' => $this->revenues->summaryForActor($actor, $filters),
            'filters' => $filters,
            'tenants' => $actor->role === 'admin'
                ? Tenant::query()->with('audienceType:id,name')->orderBy('name')->get(['id', 'name', 'audience_type_id'])
                : collect(),
            'teachers' => $actor->role === 'admin'
                ? User::query()->where('role', 'teacher')->orderBy('name')->get(['id', 'name'])
                : collect([$actor]),
            'courses' => SpecializedCourse::query()
                ->with(['teacher:id,name', 'audienceType:id,name'])
                ->when($actor->role === 'teacher', fn ($query) => $query->where('teacher_user_id', $actor->id))
                ->orderBy('title')
                ->get(['id', 'title', 'teacher_user_id', 'audience_type_id', 'price_amount', 'sale_price_amount']),
        ]);
    }

    public function tenantUsers(Request $request): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor?->role === 'admin', 403);

        $validated = $request->validate([
            'tenant_id' => ['required', 'string', Rule::exists('tenants', 'id')],
        ]);

        $tenant = Tenant::query()->findOrFail($validated['tenant_id']);

        $users = $tenant->run(function (): array {
            return TenantUser::query()
                ->where('is_active', true)
                ->orderByRaw("CASE WHEN role IN ('admin','barber') THEN 0 ELSE 1 END")
                ->orderBy('name')
                ->get(['id', 'name', 'mobile', 'role'])
                ->map(fn (TenantUser $user): array => [
                    'id' => (string) $user->id,
                    'name' => trim((string) $user->name) !== '' ? (string) $user->name : 'کاربر بدون نام',
                    'mobile' => (string) $user->mobile,
                    'role' => (string) $user->role,
                ])
                ->all();
        });

        return response()->json([
            'success' => true,
            'data' => $users,
        ]);
    }

    public function storeManual(Request $request): RedirectResponse
    {
        $actor = $request->user();
        abort_unless($actor?->role === 'admin', 403);

        $validated = $request->validate([
            'tenant_id' => ['required', 'string', Rule::exists('tenants', 'id')],
            'tenant_user_id' => ['required', 'integer', 'min:1'],
            'specialized_course_id' => ['required', 'integer', Rule::exists('specialized_courses', 'id')],
            'apply_commissions' => ['nullable', 'boolean'],
            'commission_base_amount' => ['nullable', 'integer', 'min:0'],
        ], [
            'tenant_id.required' => 'سامانه را انتخاب کنید.',
            'tenant_user_id.required' => 'کاربر سامانه را انتخاب کنید.',
            'specialized_course_id.required' => 'دوره را انتخاب کنید.',
        ]);

        $tenant = Tenant::query()->with('audienceType:id,name')->findOrFail($validated['tenant_id']);
        $course = SpecializedCourse::query()
            ->with(['teacher:id,name', 'audienceType:id,name'])
            ->findOrFail((int) $validated['specialized_course_id']);

        if ((int) $course->audience_type_id > 0 && (int) $tenant->audience_type_id > 0 && (int) $course->audience_type_id !== (int) $tenant->audience_type_id) {
            return back()
                ->withInput()
                ->withErrors(['specialized_course_id' => 'این دوره با طیف سامانه انتخاب‌شده هم‌خوانی ندارد.']);
        }

        $tenantUser = $tenant->run(fn () => TenantUser::query()->where('is_active', true)->find((int) $validated['tenant_user_id']));

        if (! $tenantUser instanceof TenantUser) {
            return back()
                ->withInput()
                ->withErrors(['tenant_user_id' => 'کاربر انتخاب‌شده در این سامانه معتبر نیست.']);
        }

        $applyCommissions = (bool) ($validated['apply_commissions'] ?? false);
        $courseAmount = $course->payableAmount();
        $commissionBaseAmount = $applyCommissions
            ? (int) ($validated['commission_base_amount'] ?? $courseAmount)
            : 0;

        if ($applyCommissions && $commissionBaseAmount < 0) {
            return back()
                ->withInput()
                ->withErrors(['commission_base_amount' => 'مبلغ مبنای پورسانت نمی‌تواند منفی باشد.']);
        }

        DB::connection('central')->transaction(function () use ($tenant, $tenantUser, $course, $actor, $applyCommissions, $commissionBaseAmount, $courseAmount): void {
            $discountAmount = $applyCommissions ? max(0, $courseAmount - $commissionBaseAmount) : $courseAmount;
            $now = now();

            $order = SpecializedCourseOrder::query()->create([
                'order_number' => $this->makeOrderNumber(),
                'specialized_course_id' => $course->id,
                'teacher_user_id' => $course->teacher_user_id,
                'tenant_id' => (string) $tenant->id,
                'tenant_user_id' => (int) $tenantUser->id,
                'buyer_name' => $tenantUser->name,
                'buyer_mobile' => $tenantUser->mobile,
                'buyer_role' => $tenantUser->role,
                'course_title_snapshot' => $course->title,
                'teacher_name_snapshot' => $course->teacher?->name,
                'status' => 'paid',
                'subtotal_amount' => $courseAmount,
                'course_discount_amount' => $discountAmount,
                'coupon_discount_amount' => 0,
                'payable_amount' => $commissionBaseAmount,
                'teacher_commission_percent' => 0,
                'teacher_commission_amount' => 0,
                'sales_expert_percent' => 0,
                'sales_expert_amount' => 0,
                'sales_manager_percent' => 0,
                'sales_manager_amount' => 0,
                'paid_at' => $now,
                'meta_json' => [
                    'manual_grant' => true,
                    'manual_grant_by_user_id' => $actor?->id,
                    'manual_grant_by_name' => $actor?->name,
                    'manual_grant_at' => $now->toIso8601String(),
                    'original_course_amount' => $courseAmount,
                    'commission_enabled' => $applyCommissions,
                    'manual_grant_note' => $applyCommissions
                        ? 'اعطای دستی دوره با محاسبه پورسانت'
                        : 'اعطای دستی دوره بدون واریز پورسانت',
                    'commission_breakdown' => [
                        'snapshot_version' => 2,
                        'order_payable_amount' => $commissionBaseAmount,
                        'teacher_commission_mode' => $applyCommissions ? null : 'manual_grant_without_commission',
                        'teacher_commission_label' => $applyCommissions ? null : 'اعطای دستی بدون واریز پورسانت',
                        'teacher_direct_referral_detected' => false,
                        'teacher_direct_referral_percent' => 0,
                        'teacher_indirect_percent' => 0,
                        'teacher_commission_percent' => 0,
                        'teacher_commission_amount' => 0,
                        'remaining_after_teacher_amount' => $applyCommissions ? null : 0,
                        'sales_commission_base_amount' => $applyCommissions ? null : 0,
                        'sales_expert_percent' => 0,
                        'sales_expert_amount' => 0,
                        'sales_manager_percent' => 0,
                        'sales_manager_amount' => 0,
                        'platform_amount' => $applyCommissions ? null : 0,
                        'suppressed_duplicate_roles' => [],
                    ],
                ],
            ]);

            if ($applyCommissions && $commissionBaseAmount > 0) {
                $this->commissions->syncOrder($order);
            }
        });

        return redirect()
            ->route('admin.specialized-course-orders.index')
            ->with('success', $applyCommissions
                ? 'دوره با موفقیت به کاربر اختصاص داده شد و پورسانت‌ها بر اساس مبلغ انتخابی محاسبه شدند.'
                : 'دوره با موفقیت به کاربر اختصاص داده شد و هیچ پورسانتی برای این ثبت دستی واریز نشد.');
    }

    private function makeOrderNumber(): string
    {
        do {
            $number = 'SC'.now()->format('ymd').str_pad((string) random_int(0, 99999), 5, '0', STR_PAD_LEFT);
        } while (SpecializedCourseOrder::query()->where('order_number', $number)->exists());

        return $number;
    }
}
