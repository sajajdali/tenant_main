<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\CustomLandingPartner;
use App\Domain\Tenant\Models\CustomLandingAttribution;
use App\Domain\Tenant\Models\CustomLandingCommission;
use App\Domain\Tenant\Models\CustomLandingSettlement;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Services\CustomLandingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CustomLandingController extends Controller
{
    public function __construct(private readonly CustomLandingService $service) {}

    public function overview(Request $request): JsonResponse
    {
        $this->admin($request);
        return response()->json(['success' => true, 'data' => $this->service->overview()]);
    }

    public function storePartner(Request $request): JsonResponse
    {
        $partner = $this->service->createPartner($this->partnerPayload($request), $this->admin($request));
        return response()->json(['success' => true, 'data' => $this->service->partnerData($partner), 'message' => 'همکار و لینک اختصاصی ایجاد شد.'], 201);
    }

    public function updatePartner(Request $request, CustomLandingPartner $partner): JsonResponse
    {
        $this->admin($request);
        $partner = $this->service->updatePartner($partner, $this->partnerPayload($request));
        return response()->json(['success' => true, 'data' => $this->service->partnerData($partner), 'message' => 'اطلاعات همکار به روز شد.']);
    }

    public function showPartner(Request $request, CustomLandingPartner $partner): JsonResponse
    {
        $this->admin($request);
        return response()->json(['success' => true, 'data' => $this->service->partnerDashboard($partner, (string) $request->query('search', ''))]);
    }

    public function settle(Request $request, CustomLandingPartner $partner): JsonResponse
    {
        $actor = $this->admin($request);
        $payload = $request->validate(['amount' => ['required', 'integer', 'min:1'], 'payment_method' => ['nullable', 'string', 'max:32'], 'payment_reference' => ['nullable', 'string', 'max:120'], 'paid_at' => ['required', 'date'], 'note' => ['nullable', 'string', 'max:3000']]);
        $settlement = $this->service->settle($partner, $payload, $actor);
        return response()->json(['success' => true, 'data' => $settlement, 'message' => 'تسویه با موفقیت ثبت شد.'], 201);
    }

    public function reverseCommission(Request $request, CustomLandingCommission $commission): JsonResponse
    {
        $this->admin($request);
        $payload = $request->validate(['note' => ['nullable', 'string', 'max:1000']]);
        $this->service->reverseCommission($commission, $payload['note'] ?? null);
        return response()->json(['success' => true, 'message' => 'تراکنش از موجودی همکار حذف شد.']);
    }

    public function destroySettlement(Request $request, CustomLandingSettlement $settlement): JsonResponse
    {
        $this->admin($request);
        $settlement->delete();
        return response()->json(['success' => true, 'message' => 'واریز ثبت شده حذف شد.']);
    }

    public function destroyAttribution(Request $request, CustomLandingAttribution $attribution): JsonResponse
    {
        $this->admin($request);
        $this->service->destroyAttribution($attribution);
        return response()->json(['success' => true, 'message' => 'کاربر از لیست معرفی شده‌ها حذف شد.']);
    }

    private function partnerPayload(Request $request): array
    {
        return $request->validate(['name' => ['required', 'string', 'max:255'], 'mobile' => ['required', 'string', 'max:20'], 'status' => ['required', Rule::in(['active', 'inactive'])], 'first_payment_percent' => ['required', 'numeric', 'min:0', 'max:100'], 'recurring_payment_percent' => ['required', 'numeric', 'min:0', 'max:100'], 'bank_card_number' => ['nullable', 'string', 'max:32'], 'iban' => ['nullable', 'string', 'max:64'], 'notes' => ['nullable', 'string', 'max:3000']]);
    }

    private function admin(Request $request): TenantUser
    {
        $user = $request->user('tenant_web');
        abort_unless($user?->role === 'admin', 403, 'این بخش فقط برای مدیر سامانه است.');
        return $user;
    }
}
