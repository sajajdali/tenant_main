<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\CustomLandingPartner;
use App\Domain\Tenant\Models\CustomLandingAttribution;
use App\Domain\Tenant\Models\CustomLandingAppToken;
use App\Domain\Tenant\Models\CustomLandingCommission;
use App\Domain\Tenant\Models\CustomLandingSettlement;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Services\CustomLandingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class CustomLandingController extends Controller
{
    public function __construct(private readonly CustomLandingService $service) {}

    public function overview(Request $request): JsonResponse
    {
        $this->admin($request);
        return response()->json(['success' => true, 'data' => $this->service->overview()]);
    }

    public function settings(Request $request): JsonResponse
    {
        $this->admin($request);
        return response()->json(['success' => true, 'data' => $this->service->settings()]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $this->admin($request);
        $payload = $request->validate([
            'title' => ['nullable', 'string', 'max:120'],
            'headline' => ['nullable', 'string', 'max:180'],
            'description' => ['nullable', 'string', 'max:1000'],
            'button_label' => ['nullable', 'string', 'max:80'],
            'auto_token_enabled' => ['nullable', 'boolean'],
            'redirect_home_enabled' => ['nullable', 'boolean'],
            'app_view_url' => ['nullable', 'url', 'max:500'],
            'web_app_url' => ['nullable', 'url', 'max:500'],
            'android_url' => ['nullable', 'url', 'max:500'],
            'ios_url' => ['nullable', 'url', 'max:500'],
        ]);

        return response()->json(['success' => true, 'data' => $this->service->updateSettings($payload), 'message' => 'تنظیمات لندینگ ذخیره شد.']);
    }

    public function issueAppToken(Request $request): JsonResponse
    {
        /** @var TenantUser|null $user */
        $user = Auth::guard('tenant_web')->user();
        abort_unless($user, 401, 'برای ساخت توکن ابتدا وارد شوید.');
        abort_unless((bool) ($this->service->settings()['autoTokenEnabled'] ?? false), 422, 'ایجاد توکن اتوماتیک برای لندینگ فعال نیست.');

        $existing = CustomLandingAppToken::query()
            ->where('tenant_user_id', $user->id)
            ->first();

        if ($existing && $existing->plain_text_token !== '' && $existing->accessToken()->exists()) {
            $existing->update(['last_used_at' => now()]);

            return response()->json([
                'success' => true,
                'data' => [
                    'accessToken' => $existing->plain_text_token,
                    'tokenType' => 'Bearer',
                    'expiresAt' => null,
                ],
            ]);
        }

        $token = $user->createToken('custom-landing-app', ['customer-app']);

        CustomLandingAppToken::query()->updateOrCreate(
            ['tenant_user_id' => $user->id],
            [
                'personal_access_token_id' => $token->accessToken->id,
                'plain_text_token' => $token->plainTextToken,
                'issued_at' => now(),
                'last_used_at' => now(),
            ],
        );

        return response()->json([
            'success' => true,
            'data' => [
                'accessToken' => $token->plainTextToken,
                'tokenType' => 'Bearer',
                'expiresAt' => null,
            ],
        ]);
    }

    public function updateLogo(Request $request): JsonResponse
    {
        $this->admin($request);
        $validated = $request->validate([
            'logo' => ['nullable', 'file', 'mimes:jpg,jpeg,png,gif,webp,avif,svg', 'max:8192'],
            'remove_logo' => ['nullable', 'boolean'],
        ]);

        $currentPath = $this->service->currentLogoPath();

        if ((bool) ($validated['remove_logo'] ?? false)) {
            $this->deleteTenantMediaFile($currentPath);
            return response()->json(['success' => true, 'data' => $this->service->updateLogoPath(null), 'message' => 'لوگو حذف شد.']);
        }

        /** @var UploadedFile|null $logo */
        $logo = $request->file('logo');
        if ($logo instanceof UploadedFile) {
            $this->deleteTenantMediaFile($currentPath);
            $path = $logo->store('custom-landing/logos', 'media_public');
            $this->recordTenantMediaFile($path, (int) $logo->getSize());

            return response()->json(['success' => true, 'data' => $this->service->updateLogoPath($path), 'message' => 'لوگو به روز شد.']);
        }

        return response()->json(['success' => true, 'data' => $this->service->settings(), 'message' => 'تغییری برای لوگو ثبت نشد.']);
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

    public function destroyPartner(Request $request, CustomLandingPartner $partner): JsonResponse
    {
        $this->admin($request);
        $payload = $request->validate([
            'confirm_partner_id' => ['required', 'string'],
            'confirm_name' => ['required', 'string'],
            'confirm_phrase' => ['required', 'string'],
        ]);

        abort_unless((string) $partner->id === (string) $payload['confirm_partner_id'], 422, 'شناسه همکار برای حذف تایید نشد.');
        abort_unless(trim($partner->name) === trim((string) $payload['confirm_name']), 422, 'نام همکار برای حذف تایید نشد.');
        abort_unless(trim((string) $payload['confirm_phrase']) === 'حذف کامل', 422, 'عبارت تایید حذف درست نیست.');

        $this->service->deletePartnerWithData($partner);

        return response()->json(['success' => true, 'message' => 'همکار و تمام داده‌های وابسته حذف شد.']);
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
