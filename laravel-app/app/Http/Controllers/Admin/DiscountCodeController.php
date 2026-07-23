<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Domain\Tenant\Models\AudienceType;
use App\Domain\Tenant\Models\DiscountCode;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class DiscountCodeController extends Controller
{
    public function index(Request $request): View
    {
        $filters = [
            'status' => (string) $request->query('status', ''),
            'applies_to' => (string) $request->query('applies_to', ''),
            'code' => trim((string) $request->query('code', '')),
        ];

        $codes = DiscountCode::query()
            ->with(['audienceType', 'salesUser'])
            ->withCount('redemptions')
            ->when($filters['status'] !== '', function ($query) use ($filters): void {
                $query->where('is_active', $filters['status'] === 'active');
            })
            ->when($filters['applies_to'] !== '', function ($query) use ($filters): void {
                $query->where('applies_to', $filters['applies_to']);
            })
            ->when($filters['code'] !== '', function ($query) use ($filters): void {
                $query->where('code', 'like', '%'.$filters['code'].'%');
            })
            ->latest('id')
            ->paginate(15)
            ->withQueryString();

        return view('admin.discount-codes.index', [
            'codes' => $codes,
            'filters' => $filters,
        ]);
    }

    public function create(): View
    {
        return view('admin.discount-codes.form', [
            'discountCode' => new DiscountCode([
                'is_active' => true,
                'applies_to' => 'both',
                'discount_type' => 'fixed',
            ]),
            'audiences' => AudienceType::query()->where('is_active', true)->orderBy('sort_order')->orderBy('name')->get(),
            'salesUsers' => $this->salesUsers(),
            'isEdit' => false,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        DiscountCode::query()->create($this->validatePayload($request));

        return redirect()->route('admin.discount-codes.index')->with('success', 'کد تخفیف با موفقیت ایجاد شد.');
    }

    public function edit(DiscountCode $discountCode): View
    {
        return view('admin.discount-codes.form', [
            'discountCode' => $discountCode->load(['audienceType', 'salesUser']),
            'audiences' => AudienceType::query()->where('is_active', true)->orderBy('sort_order')->orderBy('name')->get(),
            'salesUsers' => $this->salesUsers(),
            'isEdit' => true,
        ]);
    }

    public function update(Request $request, DiscountCode $discountCode): RedirectResponse
    {
        $discountCode->update($this->validatePayload($request, $discountCode));

        return redirect()->route('admin.discount-codes.index')->with('success', 'کد تخفیف به‌روزرسانی شد.');
    }

    public function destroy(DiscountCode $discountCode): RedirectResponse
    {
        $discountCode->delete();

        return redirect()->route('admin.discount-codes.index')->with('success', 'کد تخفیف حذف شد.');
    }

    private function validatePayload(Request $request, ?DiscountCode $discountCode = null): array
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:80', Rule::unique('discount_codes', 'code')->ignore($discountCode?->id)],
            'title' => ['nullable', 'string', 'max:255'],
            'audience_type_id' => ['nullable', 'integer', 'exists:audience_types,id'],
            'sales_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'restrict_to_teacher_courses' => ['nullable', 'boolean'],
            'applies_to' => ['required', Rule::in(['both', 'initial_purchase', 'renewal'])],
            'discount_type' => ['required', Rule::in(['fixed', 'percent'])],
            'discount_value' => ['required', 'integer', 'min:0'],
            'maximum_discount_amount' => ['nullable', 'integer', 'min:0'],
            'minimum_amount' => ['nullable', 'integer', 'min:0'],
            'maximum_amount' => ['nullable', 'integer', 'min:0'],
            'max_uses' => ['nullable', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $salesUser = isset($validated['sales_user_id']) && $validated['sales_user_id']
            ? User::query()->find((int) $validated['sales_user_id'])
            : null;

        $restrictToTeacherCourses = (bool) ($validated['restrict_to_teacher_courses'] ?? false);
        if ($restrictToTeacherCourses && $salesUser?->role !== 'teacher') {
            throw ValidationException::withMessages([
                'restrict_to_teacher_courses' => 'این گزینه فقط وقتی قابل استفاده است که کد تخفیف به مدرس متصل شده باشد.',
            ]);
        }

        $discountType = (string) $validated['discount_type'];
        $discountValue = (int) $validated['discount_value'];

        if ($discountType === 'percent' && $discountValue > 100) {
            throw ValidationException::withMessages([
                'discount_value' => 'برای درصد، مقدار تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.',
            ]);
        }

        return [
            'code' => mb_strtoupper(trim((string) $validated['code'])),
            'title' => filled($validated['title'] ?? null) ? trim((string) $validated['title']) : null,
            'audience_type_id' => $validated['audience_type_id'] ?? null,
            'sales_user_id' => $validated['sales_user_id'] ?? null,
            'applies_to' => $validated['applies_to'],
            'discount_type' => $discountType,
            'discount_value' => $discountValue,
            'maximum_discount_amount' => $validated['maximum_discount_amount'] !== null && $validated['maximum_discount_amount'] !== ''
                ? (int) $validated['maximum_discount_amount']
                : null,
            'minimum_amount' => $validated['minimum_amount'] !== null && $validated['minimum_amount'] !== ''
                ? (int) $validated['minimum_amount']
                : null,
            'maximum_amount' => $validated['maximum_amount'] !== null && $validated['maximum_amount'] !== ''
                ? (int) $validated['maximum_amount']
                : null,
            'max_uses' => $validated['max_uses'] !== null && $validated['max_uses'] !== ''
                ? (int) $validated['max_uses']
                : null,
            'starts_at' => filled($validated['starts_at'] ?? null) ? Carbon::parse((string) $validated['starts_at']) : null,
            'ends_at' => filled($validated['ends_at'] ?? null) ? Carbon::parse((string) $validated['ends_at']) : null,
            'is_active' => (bool) ($validated['is_active'] ?? false),
            'meta_json' => [
                'description' => filled($validated['description'] ?? null) ? trim((string) $validated['description']) : null,
                'restrict_to_teacher_courses' => $restrictToTeacherCourses,
                'connected_user_role' => $salesUser?->role,
                'connected_teacher_user_id' => $salesUser?->role === 'teacher' ? $salesUser->id : null,
            ],
        ];
    }

    private function salesUsers()
    {
        return User::query()
            ->where('is_active', true)
            ->whereIn('role', ['sales_expert', 'sales_manager', 'teacher'])
            ->orderBy('role')
            ->orderBy('name')
            ->get();
    }
}
