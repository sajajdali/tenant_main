<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Booking\Models\Appointment;
use App\Domain\Booking\Models\Barber;
use App\Domain\Tenant\Models\ManualFinanceCategory;
use App\Domain\Tenant\Models\ManualFinanceEntry;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Support\InputNormalizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class ManualFinanceController extends Controller
{
    public function dashboard(Request $request): JsonResponse
    {
        $actorBarber = $this->ensureStaff($request);
        $this->ensureDefaultCategories();

        $validated = $request->validate([
            'mobile' => ['nullable', 'string', 'max:40'],
            'appointment_id' => ['nullable', 'integer', 'exists:appointments,id'],
            'professional_id' => ['nullable', 'integer', 'exists:professionals,id'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $mobile = InputNormalizer::mobile((string) ($validated['mobile'] ?? ''));
        $appointment = isset($validated['appointment_id'])
            ? Appointment::query()->with(['barber:id,name', 'service:id,name'])->find($validated['appointment_id'])
            : null;

        if ($actorBarber && $appointment && (int) $appointment->professional_id !== (int) $actorBarber->id) {
            abort(403, __('payment.manual_finance.customer_file_self_only'));
        }

        if ($appointment && ! $mobile) {
            $mobile = (string) $appointment->customer_phone_snapshot;
        }

        $professionalId = $actorBarber?->id ?? ($validated['professional_id'] ?? $appointment?->professional_id);
        $perPage = (int) ($validated['per_page'] ?? 15);
        $appointmentId = $appointment?->id;

        $entriesQuery = ManualFinanceEntry::query()
            ->with(['professional:id,name', 'appointment:id,appointment_date,start_time,service_id,service_name_snapshot,professional_name_snapshot', 'appointment.service:id,name'])
            ->when($actorBarber, fn ($query) => $query->where('professional_id', $actorBarber->id))
            ->when($appointmentId, fn ($query) => $query->where('appointment_id', $appointmentId))
            ->when($mobile, fn ($query) => $query->where('customer_phone_snapshot', $mobile))
            ->latest('entry_date')
            ->latest('id');

        $page = $entriesQuery->paginate($perPage);

        $balanceQuery = ManualFinanceEntry::query()
            ->when($actorBarber, fn ($query) => $query->where('professional_id', $actorBarber->id))
            ->when($appointmentId, fn ($query) => $query->where('appointment_id', $appointmentId))
            ->when($mobile, fn ($query) => $query->where('customer_phone_snapshot', $mobile));

        $debtorRows = ManualFinanceEntry::query()
            ->when($actorBarber, fn ($query) => $query->where('professional_id', $actorBarber->id))
            ->selectRaw('customer_phone_snapshot, MAX(customer_name_snapshot) as customer_name, SUM(balance_amount) as balance_amount, MAX(entry_date) as last_entry_date, COUNT(*) as entries_count')
            ->groupBy('customer_phone_snapshot')
            ->havingRaw('SUM(balance_amount) > 0')
            ->orderByDesc('balance_amount')
            ->limit(50)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'categories' => ManualFinanceCategory::query()
                    ->where('is_active', true)
                    ->orderBy('sort_order')
                    ->orderBy('id')
                    ->get()
                    ->map(fn (ManualFinanceCategory $category): array => $this->serializeCategory($category))
                    ->values(),
                'appointment' => $appointment ? $this->serializeAppointment($appointment) : null,
                'customer' => $this->resolveCustomer($mobile, $appointment),
                'selectedProfessionalId' => $professionalId ? (string) $professionalId : null,
                'forcedToActorProfessional' => $actorBarber !== null,
                'summary' => [
                    'totalAmount' => (int) (clone $balanceQuery)->sum('total_amount'),
                    'paidAmount' => (int) (clone $balanceQuery)->sum('paid_amount'),
                    'balanceAmount' => (int) (clone $balanceQuery)->sum('balance_amount'),
                    'materialCostAmount' => (int) (clone $balanceQuery)->sum('material_cost_amount'),
                    'netRevenueAmount' => max(
                        0,
                        (int) (clone $balanceQuery)->sum('total_amount')
                            - (int) (clone $balanceQuery)->sum('material_cost_amount')
                    ),
                ],
                'entries' => [
                    'items' => $page->getCollection()->map(fn (ManualFinanceEntry $entry): array => $this->serializeEntry($entry))->values(),
                    'currentPage' => $page->currentPage(),
                    'lastPage' => $page->lastPage(),
                    'perPage' => $page->perPage(),
                    'total' => $page->total(),
                ],
                'debtors' => $debtorRows->map(fn ($row): array => [
                    'customerName' => (string) $row->customer_name,
                    'customerPhone' => (string) $row->customer_phone_snapshot,
                    'balanceAmount' => (int) $row->balance_amount,
                    'entriesCount' => (int) $row->entries_count,
                    'lastEntryDate' => $row->last_entry_date,
                ])->values(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $actorBarber = $this->ensureStaff($request);
        $this->ensureDefaultCategories();

        $request->merge([
            'customer_phone' => InputNormalizer::mobile($request->input('customer_phone')),
        ]);

        $validated = $request->validate([
            'appointment_id' => ['nullable', 'integer', 'exists:appointments,id'],
            'professional_id' => ['nullable', 'integer', 'exists:professionals,id'],
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_phone' => ['required', InputNormalizer::mobileRule()],
            'entry_date' => ['required', 'date_format:Y-m-d'],
            'paid_amount' => ['required', 'integer', 'min:0'],
            'payment_method' => ['required', Rule::in(['cash', 'card', 'online', 'transfer', 'other'])],
            'items' => ['required', 'array', 'min:1'],
            'items.*.categoryId' => ['required', 'integer', 'exists:manual_finance_categories,id'],
            'items.*.amount' => ['required', 'integer', 'min:0'],
            'items.*.materialCost' => ['nullable', 'integer', 'min:0'],
            'items.*.description' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $appointment = isset($validated['appointment_id'])
            ? Appointment::query()->find($validated['appointment_id'])
            : null;

        foreach ($validated['items'] as $item) {
            abort_if(
                (int) ($item['materialCost'] ?? 0) > (int) $item['amount'],
                422,
                __('payment.manual_finance.material_cost_exceeds')
            );
        }

        $professionalId = $actorBarber?->id ?? ($validated['professional_id'] ?? $appointment?->professional_id);
        abort_unless($professionalId, 422, __('payment.manual_finance.professional_required'));

        if ($actorBarber) {
            abort_if((int) $professionalId !== (int) $actorBarber->id, 403, __('payment.manual_finance.barber_self_only'));
            abort_if($appointment && (int) $appointment->professional_id !== (int) $actorBarber->id, 403, __('payment.manual_finance.appointment_not_owned'));
        }

        $categoryMap = ManualFinanceCategory::query()
            ->whereIn('id', collect($validated['items'])->pluck('categoryId')->all())
            ->get()
            ->keyBy('id');

        $items = [];
        $totalAmount = 0;
        $materialCostAmount = 0;
        $professionalShareAmount = 0;

        foreach ($validated['items'] as $item) {
            $category = $categoryMap->get((int) $item['categoryId']);
            $amount = (int) $item['amount'];
            $itemMaterialCost = min($amount, (int) ($item['materialCost'] ?? 0));
            $sharePercent = 0;
            $shareAmount = 0;
            $totalAmount += $amount;
            $materialCostAmount += $itemMaterialCost;
            $professionalShareAmount += $shareAmount;

            $items[] = [
                'categoryId' => (string) $category?->id,
                'categoryName' => (string) $category?->name,
                'amount' => $amount,
                'materialCost' => $itemMaterialCost,
                'netAmount' => max(0, $amount - $itemMaterialCost),
                'sharePercent' => $sharePercent,
                'professionalShareAmount' => $shareAmount,
                'description' => trim((string) ($item['description'] ?? '')) ?: null,
            ];
        }

        abort_if($totalAmount <= 0, 422, __('payment.manual_finance.positive_amount_required'));

        $paidAmount = min((int) $validated['paid_amount'], $totalAmount);
        $balanceAmount = $totalAmount - $paidAmount;

        $tenantUser = TenantUser::query()->firstOrCreate(
            ['mobile' => $validated['customer_phone']],
            [
                'name' => trim($validated['customer_name']),
                'role' => 'customer',
                'is_active' => true,
                'can_book' => true,
                'is_vip' => false,
            ],
        );

        if (! $tenantUser->name) {
            $tenantUser->forceFill(['name' => trim($validated['customer_name'])])->save();
        }

        $entry = ManualFinanceEntry::query()->create([
            'appointment_id' => $appointment?->id,
            'professional_id' => $professionalId,
            'created_by_user_id' => $request->user('tenant_web')?->id,
            'customer_user_id' => $tenantUser->id,
            'customer_name_snapshot' => trim($validated['customer_name']),
            'customer_phone_snapshot' => $validated['customer_phone'],
            'entry_date' => $validated['entry_date'],
            'total_amount' => $totalAmount,
            'paid_amount' => $paidAmount,
            'balance_amount' => $balanceAmount,
            'material_cost_amount' => $materialCostAmount,
            'professional_share_amount' => $professionalShareAmount,
            'business_share_amount' => max(0, $totalAmount - $materialCostAmount - $professionalShareAmount),
            'payment_method' => $validated['payment_method'],
            'status' => $balanceAmount <= 0 ? 'paid' : ($paidAmount > 0 ? 'partial' : 'debt'),
            'items' => $items,
            'notes' => trim((string) ($validated['notes'] ?? '')) ?: null,
        ]);

        return response()->json([
            'success' => true,
            'message' => $balanceAmount > 0 ? __('payment.manual_finance.created_with_debt') : __('payment.manual_finance.created_paid'),
            'data' => $this->serializeEntry($entry->load(['professional:id,name', 'appointment:id,appointment_date,start_time,service_id,service_name_snapshot,professional_name_snapshot', 'appointment.service:id,name'])),
        ], 201);
    }

    public function customerSummaries(Request $request): JsonResponse
    {
        $actorBarber = $this->ensureStaff($request);

        $validated = $request->validate([
            'mobiles' => ['required', 'array', 'min:1', 'max:50'],
            'mobiles.*' => ['required', 'string', 'max:40'],
            'professional_id' => ['nullable', 'integer', 'exists:professionals,id'],
        ]);

        $mobiles = collect($validated['mobiles'])
            ->map(fn ($mobile) => InputNormalizer::mobile((string) $mobile))
            ->filter()
            ->unique()
            ->values();

        $professionalId = $actorBarber?->id ?? ($validated['professional_id'] ?? null);

        $rows = ManualFinanceEntry::query()
            ->selectRaw('customer_phone_snapshot, SUM(total_amount) as total_amount, SUM(paid_amount) as paid_amount, SUM(balance_amount) as balance_amount, MAX(entry_date) as last_entry_date, COUNT(*) as entries_count')
            ->whereIn('customer_phone_snapshot', $mobiles->all())
            ->when($professionalId, fn ($query) => $query->where('professional_id', $professionalId))
            ->groupBy('customer_phone_snapshot')
            ->get()
            ->keyBy('customer_phone_snapshot');

        $appointmentIdsByMobile = ManualFinanceEntry::query()
            ->select(['customer_phone_snapshot', 'appointment_id'])
            ->whereIn('customer_phone_snapshot', $mobiles->all())
            ->whereNotNull('appointment_id')
            ->when($professionalId, fn ($query) => $query->where('professional_id', $professionalId))
            ->get()
            ->groupBy('customer_phone_snapshot')
            ->map(fn ($entries) => $entries
                ->pluck('appointment_id')
                ->filter()
                ->map(fn ($appointmentId) => (string) $appointmentId)
                ->unique()
                ->values()
                ->all());

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $mobiles->map(function (string $mobile) use ($rows, $appointmentIdsByMobile): array {
                    $row = $rows->get($mobile);

                    return [
                        'customerPhone' => $mobile,
                        'totalAmount' => (int) ($row?->total_amount ?? 0),
                        'paidAmount' => (int) ($row?->paid_amount ?? 0),
                        'balanceAmount' => (int) ($row?->balance_amount ?? 0),
                        'entriesCount' => (int) ($row?->entries_count ?? 0),
                        'lastEntryDate' => $row?->last_entry_date,
                        'appointmentIds' => $appointmentIdsByMobile->get($mobile, []),
                    ];
                })->values(),
            ],
        ]);
    }

    public function destroy(Request $request, int $entryId): JsonResponse
    {
        $actorBarber = $this->ensureStaff($request);

        $entry = ManualFinanceEntry::query()->findOrFail($entryId);

        if ($actorBarber) {
            abort_if((int) $entry->professional_id !== (int) $actorBarber->id, 403, __('payment.manual_finance.delete_self_only'));
        }

        $entry->delete();

        return response()->json([
            'success' => true,
            'message' => __('payment.manual_finance.deleted'),
            'data' => true,
        ]);
    }

    public function debtors(Request $request): JsonResponse
    {
        $actorBarber = $this->ensureStaff($request);

        $validated = $request->validate([
            'professional_id' => ['nullable', 'integer', 'exists:professionals,id'],
            'search' => ['nullable', 'string', 'max:80'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $professionalId = $actorBarber?->id ?? ($validated['professional_id'] ?? null);
        $search = trim((string) ($validated['search'] ?? ''));
        $normalizedSearch = InputNormalizer::mobile($search);
        $perPage = (int) ($validated['per_page'] ?? 15);

        $rowsQuery = ManualFinanceEntry::query()
            ->selectRaw('customer_phone_snapshot, MAX(customer_name_snapshot) as customer_name, SUM(total_amount) as total_amount, SUM(paid_amount) as paid_amount, SUM(balance_amount) as balance_amount, MAX(entry_date) as last_entry_date, COUNT(*) as entries_count')
            ->when($professionalId, fn ($query) => $query->where('professional_id', $professionalId))
            ->when($search !== '', function ($query) use ($search, $normalizedSearch): void {
                $query->where(function ($inner) use ($search, $normalizedSearch): void {
                    $inner->where('customer_name_snapshot', 'like', "%{$search}%");

                    if ($normalizedSearch !== '') {
                        $inner->orWhere('customer_phone_snapshot', 'like', "%{$normalizedSearch}%");
                    }
                });
            })
            ->groupBy('customer_phone_snapshot')
            ->havingRaw('SUM(balance_amount) > 0')
            ->orderByDesc('balance_amount')
            ->orderByDesc('last_entry_date');

        $page = $rowsQuery->paginate($perPage);

        $summaryQuery = DB::query()
            ->fromSub(
                ManualFinanceEntry::query()
                    ->selectRaw('customer_phone_snapshot, SUM(total_amount) as total_amount, SUM(paid_amount) as paid_amount, SUM(balance_amount) as balance_amount')
                    ->when($professionalId, fn ($query) => $query->where('professional_id', $professionalId))
                    ->when($search !== '', function ($query) use ($search, $normalizedSearch): void {
                        $query->where(function ($inner) use ($search, $normalizedSearch): void {
                            $inner->where('customer_name_snapshot', 'like', "%{$search}%");

                            if ($normalizedSearch !== '') {
                                $inner->orWhere('customer_phone_snapshot', 'like', "%{$normalizedSearch}%");
                            }
                        });
                    })
                    ->groupBy('customer_phone_snapshot')
                    ->havingRaw('SUM(balance_amount) > 0'),
                'debtors',
            );

        return response()->json([
            'success' => true,
            'data' => [
                'summary' => [
                    'debtorsCount' => (int) (clone $summaryQuery)->count(),
                    'totalAmount' => (int) (clone $summaryQuery)->sum('total_amount'),
                    'paidAmount' => (int) (clone $summaryQuery)->sum('paid_amount'),
                    'balanceAmount' => (int) (clone $summaryQuery)->sum('balance_amount'),
                ],
                'items' => $page->getCollection()->map(fn ($row): array => [
                    'customerName' => (string) $row->customer_name,
                    'customerPhone' => (string) $row->customer_phone_snapshot,
                    'totalAmount' => (int) $row->total_amount,
                    'paidAmount' => (int) $row->paid_amount,
                    'balanceAmount' => (int) $row->balance_amount,
                    'entriesCount' => (int) $row->entries_count,
                    'lastEntryDate' => $row->last_entry_date,
                ])->values(),
                'currentPage' => $page->currentPage(),
                'lastPage' => $page->lastPage(),
                'perPage' => $page->perPage(),
                'total' => $page->total(),
                'selectedProfessionalId' => $professionalId ? (string) $professionalId : null,
                'forcedToActorProfessional' => $actorBarber !== null,
            ],
        ]);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $this->ensurePrimaryAdmin($request);
        $this->ensureDefaultCategories();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'default_share_percent' => ['nullable', 'integer', 'min:0', 'max:100'],
            'default_amount' => ['nullable', 'integer', 'min:0'],
        ]);

        $category = ManualFinanceCategory::query()->create([
            'name' => trim($validated['name']),
            'audience_slug' => $this->audienceSlug(),
            'default_share_percent' => $validated['default_share_percent'] ?? null,
            'default_amount' => $validated['default_amount'] ?? null,
            'is_default' => false,
            'is_active' => true,
            'sort_order' => (int) ManualFinanceCategory::query()->max('sort_order') + 10,
        ]);

        return response()->json([
            'success' => true,
            'message' => __('payment.manual_finance.category_created'),
            'data' => $this->serializeCategory($category),
        ], 201);
    }

    public function updateCategory(Request $request, int $categoryId): JsonResponse
    {
        $this->ensurePrimaryAdmin($request);
        $this->ensureDefaultCategories();

        $category = ManualFinanceCategory::query()->findOrFail($categoryId);

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:120',
                Rule::unique('manual_finance_categories', 'name')
                    ->where(fn ($query) => $query->where('audience_slug', $category->audience_slug))
                    ->ignore($category->id),
            ],
            'default_share_percent' => ['nullable', 'integer', 'min:0', 'max:100'],
            'default_amount' => ['nullable', 'integer', 'min:0'],
        ]);

        $category->forceFill([
            'name' => trim($validated['name']),
            'default_share_percent' => $validated['default_share_percent'] ?? null,
            'default_amount' => $validated['default_amount'] ?? null,
        ])->save();

        return response()->json([
            'success' => true,
            'message' => __('payment.manual_finance.category_updated'),
            'data' => $this->serializeCategory($category->refresh()),
        ]);
    }

    public function destroyCategory(Request $request, int $categoryId): JsonResponse
    {
        $this->ensurePrimaryAdmin($request);
        $this->ensureDefaultCategories();

        $category = ManualFinanceCategory::query()->where('is_active', true)->findOrFail($categoryId);
        $activeCount = ManualFinanceCategory::query()->where('is_active', true)->count();

        abort_if($activeCount <= 1, 422, __('payment.manual_finance.category_minimum'));

        $category->forceFill(['is_active' => false])->save();

        return response()->json([
            'success' => true,
            'message' => __('payment.manual_finance.category_deleted'),
            'data' => ['id' => (string) $category->id],
        ]);
    }

    public function commissionReport(Request $request): JsonResponse
    {
        $this->ensurePrimaryAdmin($request);
        $this->ensureDefaultCategories();

        $validated = $request->validate([
            'professional_id' => ['required', 'integer', 'exists:professionals,id'],
            'date_from' => ['required', 'date_format:Y-m-d'],
            'date_to' => ['required', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'default_percent' => ['required', 'integer', 'min:0', 'max:100'],
            'category_percents' => ['nullable', 'array'],
            'category_percents.*' => ['nullable', 'integer', 'min:0', 'max:100'],
        ], [
            'date_to.after_or_equal' => __('payment.manual_finance.date_to_after_or_equal'),
        ], [
            'date_from' => __('payment.manual_finance.date_from_attribute'),
            'date_to' => __('payment.manual_finance.date_to_attribute'),
        ]);

        $professionalId = (int) $validated['professional_id'];

        $categories = ManualFinanceCategory::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $categoryNames = $categories->mapWithKeys(fn (ManualFinanceCategory $category) => [(string) $category->id => $category->name]);
        $categoryPercents = collect($validated['category_percents'] ?? [])
            ->mapWithKeys(fn ($percent, $categoryId) => [(string) $categoryId => $percent === null || $percent === '' ? (int) $validated['default_percent'] : (int) $percent]);

        $entries = ManualFinanceEntry::query()
            ->with(['professional:id,name', 'appointment:id,appointment_date,start_time,service_id,service_name_snapshot,professional_name_snapshot', 'appointment.service:id,name'])
            ->where('professional_id', $professionalId)
            ->whereBetween('entry_date', [$validated['date_from'], $validated['date_to']])
            ->orderBy('entry_date')
            ->orderBy('id')
            ->get();

        $summary = [
            'entriesCount' => $entries->count(),
            'totalAmount' => 0,
            'paidAmount' => 0,
            'balanceAmount' => 0,
            'materialCostAmount' => 0,
            'netRevenueAmount' => 0,
            'netPaidAmount' => 0,
            'commissionOnTotal' => 0,
            'commissionPayable' => 0,
            'businessShareAfterPayable' => 0,
        ];
        $categoryRows = [];
        $entryRows = [];

        foreach ($entries as $entry) {
            $entryCommissionOnTotal = 0;
            $entryCommissionPayable = 0;
            $items = collect($entry->items ?? []);

            foreach ($items as $item) {
                $categoryId = (string) ($item['categoryId'] ?? 'other');
                $categoryName = (string) ($item['categoryName'] ?? $categoryNames->get($categoryId, 'سایر'));
                $amount = (int) ($item['amount'] ?? 0);
                if ($amount <= 0) {
                    continue;
                }

                $paidRatio = (int) $entry->total_amount > 0 ? min(1, max(0, (int) $entry->paid_amount / (int) $entry->total_amount)) : 0;
                $paidPortion = (int) round($amount * $paidRatio);
                $materialCost = min($amount, max(0, (int) ($item['materialCost'] ?? 0)));
                $netAmount = max(0, $amount - $materialCost);
                $netPaidPortion = max(0, $paidPortion - $materialCost);
                $percent = (int) ($categoryPercents->get($categoryId, $validated['default_percent']));
                $commissionOnTotal = (int) round($netAmount * $percent / 100);
                $commissionPayable = (int) round($netPaidPortion * $percent / 100);

                if (! isset($categoryRows[$categoryId])) {
                    $categoryRows[$categoryId] = [
                        'categoryId' => $categoryId,
                        'categoryName' => $categoryName,
                        'percent' => $percent,
                        'itemsCount' => 0,
                        'totalAmount' => 0,
                        'paidAmount' => 0,
                        'balanceAmount' => 0,
                        'materialCostAmount' => 0,
                        'netRevenueAmount' => 0,
                        'netPaidAmount' => 0,
                        'commissionOnTotal' => 0,
                        'commissionPayable' => 0,
                    ];
                }

                $categoryRows[$categoryId]['itemsCount']++;
                $categoryRows[$categoryId]['totalAmount'] += $amount;
                $categoryRows[$categoryId]['paidAmount'] += $paidPortion;
                $categoryRows[$categoryId]['balanceAmount'] += max(0, $amount - $paidPortion);
                $categoryRows[$categoryId]['materialCostAmount'] += $materialCost;
                $categoryRows[$categoryId]['netRevenueAmount'] += $netAmount;
                $categoryRows[$categoryId]['netPaidAmount'] += $netPaidPortion;
                $categoryRows[$categoryId]['commissionOnTotal'] += $commissionOnTotal;
                $categoryRows[$categoryId]['commissionPayable'] += $commissionPayable;

                $entryCommissionOnTotal += $commissionOnTotal;
                $entryCommissionPayable += $commissionPayable;
            }

            $summary['totalAmount'] += (int) $entry->total_amount;
            $summary['paidAmount'] += (int) $entry->paid_amount;
            $summary['balanceAmount'] += (int) $entry->balance_amount;
            $summary['materialCostAmount'] += (int) $entry->material_cost_amount;
            $summary['netRevenueAmount'] += max(0, (int) $entry->total_amount - (int) $entry->material_cost_amount);
            $summary['netPaidAmount'] += max(0, (int) $entry->paid_amount - (int) $entry->material_cost_amount);
            $summary['commissionOnTotal'] += $entryCommissionOnTotal;
            $summary['commissionPayable'] += $entryCommissionPayable;

            $entryRows[] = [
                ...$this->serializeEntry($entry),
                'commissionOnTotal' => $entryCommissionOnTotal,
                'commissionPayable' => $entryCommissionPayable,
            ];
        }

        $summary['businessShareAfterPayable'] = max(0, $summary['netPaidAmount'] - $summary['commissionPayable']);

        return response()->json([
            'success' => true,
            'data' => [
                'filter' => [
                    'professionalId' => (string) $professionalId,
                    'professionalName' => $entries->first()?->professional?->name ?: Barber::query()->find($professionalId)?->name,
                    'dateFrom' => $validated['date_from'],
                    'dateTo' => $validated['date_to'],
                    'defaultPercent' => (int) $validated['default_percent'],
                ],
                'categories' => $categories->map(fn (ManualFinanceCategory $category): array => $this->serializeCategory($category))->values(),
                'summary' => $summary,
                'byCategory' => array_values($categoryRows),
                'entries' => $entryRows,
            ],
        ]);
    }

    private function ensureStaff(Request $request): ?Barber
    {
        $actor = $request->user('tenant_web');
        abort_unless($actor && in_array($actor->role, ['admin', 'barber'], true), 403, __('authorization.admin_or_specialist_allowed'));

        if ($actor->role !== 'barber') {
            return null;
        }

        $barber = Barber::query()->where('user_id', $actor->id)->first();
        abort_unless($barber && $barber->can_access_panel, 403, __('payment.manual_finance.barber_panel_blocked'));

        return $barber;
    }

    private function ensureAdmin(Request $request): void
    {
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_only'));
    }

    private function ensurePrimaryAdmin(Request $request): void
    {
        $actor = $request->user('tenant_web');
        $tenant = tenant();
        $ownerUserId = $tenant?->owner_user_id ? (int) $tenant->owner_user_id : null;

        abort_unless(
            $actor
                && $actor->role === 'admin'
                && $actor->central_user_id !== null
                && $ownerUserId !== null
                && (int) $actor->central_user_id === $ownerUserId,
            403,
            __('authorization.super_admin_only')
        );
    }

    private function ensureDefaultCategories(): void
    {
        if (! Schema::hasTable('manual_finance_categories')) {
            return;
        }

        $audienceSlug = $this->audienceSlug();
        if (ManualFinanceCategory::query()->where('audience_slug', $audienceSlug)->exists()) {
            return;
        }

        $defaults = match ($audienceSlug) {
            'nutritionists', 'nutrition-doctors' => ['مشاوره حضوری', 'مشاوره آنلاین', 'رژیم اختصاصی', 'پیگیری ماهانه', 'آنالیز بدن', 'پکیج تغذیه', 'سایر'],
            'doctors', 'clinics' => ['ویزیت', 'مشاوره', 'تزریق', 'خدمات درمانی', 'چکاپ', 'سایر'],
            default => ['اصلاح مو', 'ریش', 'پاکسازی پوست', 'رنگ و لایت', 'کراتین', 'خدمات ناخن', 'سایر'],
        };

        foreach ($defaults as $index => $name) {
            ManualFinanceCategory::query()->firstOrCreate(
                ['name' => $name, 'audience_slug' => $audienceSlug],
                [
                    'default_share_percent' => null,
                    'default_amount' => null,
                    'is_default' => true,
                    'is_active' => true,
                    'sort_order' => ($index + 1) * 10,
                ],
            );
        }
    }

    private function audienceSlug(): ?string
    {
        $tenant = tenant();
        $tenant?->loadMissing('audienceType');

        return $tenant?->audienceType?->slug ?: null;
    }

    private function resolveCustomer(?string $mobile, ?Appointment $appointment): ?array
    {
        if (! $mobile && ! $appointment) {
            return null;
        }

        $tenantUser = $mobile ? TenantUser::query()->where('mobile', $mobile)->first() : null;

        return [
            'id' => $tenantUser?->id ? (string) $tenantUser->id : null,
            'name' => $tenantUser?->name ?: $appointment?->customer_name_snapshot,
            'phone' => $tenantUser?->mobile ?: $mobile ?: $appointment?->customer_phone_snapshot,
        ];
    }

    private function serializeAppointment(Appointment $appointment): array
    {
        return [
            'id' => (string) $appointment->id,
            'customerName' => (string) $appointment->customer_name_snapshot,
            'customerPhone' => (string) $appointment->customer_phone_snapshot,
            'professionalId' => (string) $appointment->professional_id,
            'professionalName' => $appointment->professional_name_snapshot ?: $appointment->barber?->name,
            'sectionName' => $appointment->service_name_snapshot ?: $appointment->service?->name,
            'date' => $appointment->appointment_date?->toDateString() ?? (string) $appointment->getRawOriginal('appointment_date'),
            'startTime' => substr((string) $appointment->start_time, 0, 5),
        ];
    }

    private function serializeCategory(ManualFinanceCategory $category): array
    {
        return [
            'id' => (string) $category->id,
            'name' => $category->name,
            'defaultSharePercent' => $category->default_share_percent,
            'defaultAmount' => $category->default_amount,
            'isDefault' => (bool) $category->is_default,
        ];
    }

    private function serializeEntry(ManualFinanceEntry $entry): array
    {
        return [
            'id' => (string) $entry->id,
            'appointmentId' => $entry->appointment_id ? (string) $entry->appointment_id : null,
            'professionalId' => $entry->professional_id ? (string) $entry->professional_id : null,
            'professionalName' => $entry->professional?->name,
            'customerName' => $entry->customer_name_snapshot,
            'customerPhone' => $entry->customer_phone_snapshot,
            'entryDate' => $entry->entry_date?->toDateString() ?? (string) $entry->getRawOriginal('entry_date'),
            'totalAmount' => (int) $entry->total_amount,
            'paidAmount' => (int) $entry->paid_amount,
            'balanceAmount' => (int) $entry->balance_amount,
            'professionalShareAmount' => (int) $entry->professional_share_amount,
            'businessShareAmount' => (int) $entry->business_share_amount,
            'materialCostAmount' => (int) $entry->material_cost_amount,
            'netRevenueAmount' => max(0, (int) $entry->total_amount - (int) $entry->material_cost_amount),
            'paymentMethod' => $entry->payment_method,
            'status' => $entry->status,
            'appointment' => $entry->appointment ? [
                'id' => (string) $entry->appointment->id,
                'date' => $entry->appointment->appointment_date?->toDateString() ?? (string) $entry->appointment->getRawOriginal('appointment_date'),
                'startTime' => substr((string) $entry->appointment->start_time, 0, 5),
                'sectionName' => $entry->appointment->service?->name ?: $entry->appointment->service_name_snapshot,
                'professionalName' => $entry->appointment->professional_name_snapshot,
            ] : null,
            'items' => $entry->items ?? [],
            'notes' => $entry->notes,
            'createdAt' => $entry->created_at?->toISOString(),
        ];
    }
}
