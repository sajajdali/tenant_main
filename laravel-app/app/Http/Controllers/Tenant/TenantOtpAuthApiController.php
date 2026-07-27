<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Support\InputNormalizer;
use App\Support\SmsGatewaySettings;
use App\Support\TenantMembershipProfile;
use App\Support\TenantSandboxMode;
use App\Services\Auth\OtpLoginService;
use App\Services\CustomerClubService;
use App\Services\TenantProvisioningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class TenantOtpAuthApiController extends Controller
{
    public function __construct(
        private readonly OtpLoginService $otpLoginService,
        private readonly TenantProvisioningService $tenantProvisioningService,
        private readonly CustomerClubService $customerClubService,
    ) {
    }

    public function send(Request $request): JsonResponse
    {
        if (tenant()?->isPanelAccessLocked()) {
            return response()->json([
                'success' => false,
                'message' => tenant()->panelAccessMessage(),
            ], 423);
        }

        $request->merge([
            'mobile' => InputNormalizer::mobile($request->input('mobile')),
        ]);

        $validated = $request->validate([
            'mobile' => ['required', 'regex:/^(?:09\d{9}|[1-9]\d{7,14})$/'],
        ], [
            'mobile.required' => __('api.auth.mobile_required'),
            'mobile.regex' => __('api.auth.mobile_regex'),
        ]);

        $result = $this->otpLoginService->sendForTenant($validated['mobile'], tenant());

        if (! $result['ok']) {
            return response()->json([
                'success' => false,
                'message' => $result['message'],
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => __('api.auth.otp_sent'),
            'data' => [
                'remaining_seconds' => $result['remaining_seconds'],
                'code_hint' => tenant()?->demoFixedLoginCode()
                    ?? (TenantSandboxMode::smsEnabled(null, SmsGatewaySettings::sandboxEnabled()) ? ($result['code'] ?? null) : null),
            ],
        ]);
    }

    public function verify(Request $request): JsonResponse
    {
        if (tenant()?->isPanelAccessLocked()) {
            return response()->json([
                'success' => false,
                'message' => tenant()->panelAccessMessage(),
            ], 423);
        }

        $request->merge([
            'mobile' => InputNormalizer::mobile($request->input('mobile')),
            'code' => InputNormalizer::digitsOnly((string) $request->input('code')),
        ]);

        $validated = $request->validate([
            'mobile' => ['required', 'regex:/^(?:09\d{9}|[1-9]\d{7,14})$/'],
            'code' => ['required', 'digits:4'],
            'remember' => ['nullable', 'boolean'],
        ], [
            'mobile.required' => __('api.auth.mobile_required'),
            'mobile.regex' => __('api.auth.mobile_regex'),
            'code.required' => __('api.auth.code_required'),
            'code.digits' => __('api.auth.code_digits'),
        ]);

        $user = $this->otpLoginService->verifyForTenant($validated['mobile'], $validated['code'], tenant());

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => __('api.auth.otp_forbidden'),
            ], 422);
        }

        $remember = ! array_key_exists('remember', $validated) || (bool) $validated['remember'];

        Auth::guard('tenant_web')->login($user, $remember);
        $request->session()->regenerate();
        $this->customerClubService->applyWelcomeBonus($user);
        $this->customerClubService->applyBirthdayBonus($user);

        return response()->json([
            'success' => true,
            'message' => __('api.auth.login_success'),
            'data' => [
                'user' => $this->formatUser($user),
                'redirect' => route('tenant.admin.dashboard'),
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var TenantUser|null $user */
        $user = Auth::guard('tenant_web')->user();

        if (! $user) {
            return response()->json(['success' => false, 'message' => __('api.auth.unauthenticated')], 401);
        }

        $user = TenantUser::query()->find($user->id);

        if (! $user) {
            Auth::guard('tenant_web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return response()->json(['success' => false, 'message' => __('api.auth.unauthenticated')], 401);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'user' => $this->formatUser($user),
            ],
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        /** @var TenantUser|null $user */
        $user = Auth::guard('tenant_web')->user();

        if (! $user) {
            return response()->json(['success' => false, 'message' => __('api.auth.unauthenticated')], 401);
        }

        $request->merge([
            'nationalCode' => InputNormalizer::digits((string) $request->input('nationalCode')),
        ]);

        $validated = $request->validate(
            TenantMembershipProfile::validationRules(withName: true),
            TenantMembershipProfile::validationMessages(),
        );
        $request->validate([
            'email' => [
                'nullable',
                'email:rfc',
                'max:255',
                Rule::unique('users', 'email')->ignore($user->id),
            ],
        ], [
            'email.unique' => __('api.auth.email_unique'),
        ]);
        TenantMembershipProfile::assertRequirements(
            $validated,
            $this->tenantProvisioningService->getRegistrationRequirements(tenant()),
        );

        $user = $this->tenantProvisioningService->updateTenantUserProfile(tenant(), $user, [
            'name' => $validated['name'],
        ] + TenantMembershipProfile::prepareAttributes($validated));

        return response()->json([
            'success' => true,
            'data' => [
                'user' => $this->formatUser($user),
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('tenant_web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'success' => true,
            'data' => true,
        ]);
    }

    private function formatUser(TenantUser $user): array
    {
        $tenant = tenant();
        $ownerUserId = $tenant?->owner_user_id ? (int) $tenant->owner_user_id : null;

        return [
            'id' => (string) $user->id,
            'name' => $user->name,
            'phone' => $user->mobile,
            'email' => $user->email,
            'role' => $user->role,
            'gender' => $user->gender,
            'nationalCode' => $user->national_code,
            'birthDate' => optional($user->birth_date)->format('Y-m-d'),
            'provinceId' => $user->province_id,
            'provinceName' => $user->province_name,
            'cityId' => $user->city_id,
            'cityName' => $user->city_name,
            'jobTitle' => $user->job_title,
            'isVip' => (bool) $user->is_vip,
            'isPrimaryAdmin' => $user->role === 'admin'
                && $user->central_user_id !== null
                && $ownerUserId !== null
                && (int) $user->central_user_id === $ownerUserId,
            'canBook' => (bool) $user->can_book,
        ];
    }
}
