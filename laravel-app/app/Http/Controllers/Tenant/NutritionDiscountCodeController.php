<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\NutritionDiscountCode;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class NutritionDiscountCodeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $items = NutritionDiscountCode::query()
            ->latest('id')
            ->get()
            ->map(fn (NutritionDiscountCode $item) => $this->transform($item))
            ->values()
            ->all();

        return response()->json([
            'success' => true,
            'data' => ['items' => $items],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $validated = $this->validatePayload($request);

        $item = NutritionDiscountCode::query()->create([
            'code' => Str::upper(trim((string) $validated['code'])),
            'title' => trim((string) ($validated['title'] ?? '')) ?: null,
            'discount_type' => $validated['discount_type'],
            'discount_value' => (int) $validated['discount_value'],
            'max_uses' => $validated['max_uses'] !== null ? (int) $validated['max_uses'] : null,
            'is_active' => (bool) ($validated['is_active'] ?? true),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'کد تخفیف ذخیره شد.',
            'data' => ['item' => $this->transform($item)],
        ]);
    }

    public function update(Request $request, NutritionDiscountCode $nutritionDiscountCode): JsonResponse
    {
        $this->ensureAdmin($request);

        $validated = $this->validatePayload($request, $nutritionDiscountCode);

        $nutritionDiscountCode->update([
            'code' => Str::upper(trim((string) $validated['code'])),
            'title' => trim((string) ($validated['title'] ?? '')) ?: null,
            'discount_type' => $validated['discount_type'],
            'discount_value' => (int) $validated['discount_value'],
            'max_uses' => $validated['max_uses'] !== null ? (int) $validated['max_uses'] : null,
            'is_active' => (bool) $validated['is_active'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'کد تخفیف به‌روزرسانی شد.',
            'data' => ['item' => $this->transform($nutritionDiscountCode->fresh())],
        ]);
    }

    public function destroy(Request $request, NutritionDiscountCode $nutritionDiscountCode): JsonResponse
    {
        $this->ensureAdmin($request);
        $nutritionDiscountCode->delete();

        return response()->json([
            'success' => true,
            'message' => 'کد تخفیف حذف شد.',
        ]);
    }

    private function validatePayload(Request $request, ?NutritionDiscountCode $ignore = null): array
    {
        return $request->validate([
            'code' => ['required', 'string', 'max:80', 'unique:nutrition_discount_codes,code' . ($ignore ? ',' . $ignore->id : '')],
            'title' => ['nullable', 'string', 'max:255'],
            'discount_type' => ['required', 'in:percent,fixed'],
            'discount_value' => ['required', 'integer', 'min:1'],
            'max_uses' => ['nullable', 'integer', 'min:1'],
            'is_active' => [$ignore ? 'required' : 'nullable', 'boolean'],
        ], [
            'code.required' => 'کد تخفیف را وارد کنید.',
            'discount_type.required' => 'نوع تخفیف را مشخص کنید.',
            'discount_value.required' => 'مقدار تخفیف را وارد کنید.',
        ]);
    }

    private function transform(NutritionDiscountCode $item): array
    {
        $paidOrders = $item->orders()
            ->with(['user:id,name,mobile', 'package:id,name'])
            ->where('status', 'paid')
            ->latest('paid_at')
            ->latest('id')
            ->get();

        $usedCount = $paidOrders->count();
        $hasReachedLimit = $item->max_uses !== null && $usedCount >= (int) $item->max_uses;
        $status = ! $item->is_active
            ? 'manual_inactive'
            : ($hasReachedLimit ? 'exhausted' : 'active');
        $effectiveIsActive = $status === 'active';
        $statusReason = match ($status) {
            'manual_inactive' => 'این کد توسط مدیر غیرفعال شده است.',
            'exhausted' => 'ظرفیت استفاده این کد تکمیل شده و دیگر قابل استفاده نیست.',
            default => 'این کد در حال حاضر برای خرید پکیج قابل استفاده است.',
        };

        return [
            'id' => (string) $item->id,
            'code' => $item->code,
            'title' => $item->title,
            'discountType' => $item->discount_type,
            'discountValue' => (int) $item->discount_value,
            'maxUses' => $item->max_uses !== null ? (int) $item->max_uses : null,
            'usedCount' => $usedCount,
            'isActive' => (bool) $item->is_active,
            'effectiveIsActive' => $effectiveIsActive,
            'status' => $status,
            'statusReason' => $statusReason,
            'usedBy' => $paidOrders->map(fn ($order): array => [
                'orderId' => (string) $order->id,
                'invoiceNumber' => $order->invoice_number,
                'userId' => $order->user ? (string) $order->user->id : null,
                'name' => $order->user?->name,
                'mobile' => $order->user?->mobile,
                'packageName' => $order->package?->name,
                'payableAmount' => (int) $order->payable_amount,
                'paidAt' => $order->paid_at?->toIso8601String(),
            ])->values()->all(),
            'createdAt' => $item->created_at?->toIso8601String(),
        ];
    }

    private function ensureAdmin(Request $request): void
    {
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));
    }
}
