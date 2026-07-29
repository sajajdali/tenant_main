<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Customer\Auth;

use App\Domain\Tenant\Models\NutritionProfile;
use App\Domain\Tenant\Models\TenantUser;
use App\Http\Controllers\Controller;
use App\Services\Auth\OtpLoginService;
use App\Services\CustomerClubService;
use App\Support\InputNormalizer;
use App\Support\SmsGatewaySettings;
use App\Support\TenantSandboxMode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class OtpAuthController extends Controller
{
    public function __construct(
        private readonly OtpLoginService $otpLoginService,
        private readonly CustomerClubService $customerClubService,
    ) {}

    public function login(Request $request): JsonResponse
    {
        if (tenant()?->isPanelAccessLocked()) {
            return response()->json([
                'success' => false,
                'message' => tenant()->panelAccessMessage(),
                'errors' => [],
            ], 423);
        }

        $request->merge([
            'mobile' => InputNormalizer::mobile($request->input('mobile')),
        ]);

        $validated = $request->validate([
            'mobile' => ['required', InputNormalizer::mobileRule()],
        ], [
            'mobile.required' => __('api.auth.mobile_required'),
            'mobile.regex' => __('api.auth.mobile_regex'),
        ]);

        $wasExistingUser = TenantUser::query()
            ->where('mobile', $validated['mobile'])
            ->exists();

        $result = $this->otpLoginService->sendForTenant($validated['mobile'], tenant());

        if (! $result['ok']) {
            return response()->json([
                'success' => false,
                'message' => $result['message'],
                'errors' => [],
            ], 422);
        }

        $testCode = tenant()?->demoFixedLoginCode()
            ?? (TenantSandboxMode::smsEnabled(null, SmsGatewaySettings::sandboxEnabled()) ? ($result['code'] ?? null) : null);

        $data = [
            'remainingSeconds' => $result['remaining_seconds'],
            'expiresIn' => $result['expires_in'] ?? null,
            'testMode' => $testCode !== null,
            'code' => $testCode,
        ];

        Cache::put($this->newUserCacheKey($validated['mobile']), ! $wasExistingUser, now()->addMinutes(5));

        return response()->json([
            'success' => true,
            'message' => __('api.auth.otp_sent'),
            'data' => $data,
            'meta' => [],
        ]);
    }

    public function verify(Request $request): JsonResponse
    {
        if (tenant()?->isPanelAccessLocked()) {
            return response()->json([
                'success' => false,
                'message' => tenant()->panelAccessMessage(),
                'errors' => [],
            ], 423);
        }

        $request->merge([
            'mobile' => InputNormalizer::mobile($request->input('mobile')),
            'code' => InputNormalizer::digitsOnly((string) $request->input('code')),
        ]);

        $validated = $request->validate([
            'mobile' => ['required', InputNormalizer::mobileRule()],
            'code' => ['required', 'digits:4'],
            'deviceName' => ['nullable', 'string', 'max:120'],
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
                'errors' => [],
            ], 422);
        }

        $this->customerClubService->applyWelcomeBonus($user);
        $this->customerClubService->applyBirthdayBonus($user);

        $user->tokens()->delete();

        $token = $user->createToken(
            $validated['deviceName'] ?? 'customer-app',
            ['customer-app'],
        );

        return response()->json([
            'success' => true,
            'message' => __('api.auth.login_success'),
            'data' => [
                'accessToken' => $token->plainTextToken,
                'tokenType' => 'Bearer',
                'expiresAt' => null,
                'user' => $this->formatUser($user),
                'profileStatus' => $this->profileStatus(
                    $user,
                    (bool) Cache::pull($this->newUserCacheKey($validated['mobile']), false),
                ),
            ],
            'meta' => [],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var TenantUser|null $user */
        $user = $request->user();

        return response()->json([
            'success' => true,
            'message' => null,
            'data' => [
                'user' => $user ? $this->formatUser($user) : null,
                'profileStatus' => $user ? $this->profileStatus($user, false) : null,
            ],
            'meta' => [],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json([
            'success' => true,
            'message' => __('api.auth.logout_success'),
            'data' => true,
            'meta' => [],
        ]);
    }

    private function formatUser(TenantUser $user): array
    {
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
            'canBook' => (bool) $user->can_book,
        ];
    }

    private function profileStatus(TenantUser $user, bool $isNewUser): array
    {
        $hasFullName = trim((string) $user->name) !== '';
        $hasGender = in_array($user->gender, ['male', 'female'], true);
        $nextStep = $this->nextMembershipStep($user, $hasFullName, $hasGender);
        $membershipFlow = match (true) {
            $nextStep === '/home' => 'completed',
            $isNewUser && $nextStep === '/membership/profile' => 'start',
            default => 'continue',
        };
        $missingFields = [];

        if (! $hasFullName) {
            $missingFields[] = 'fullName';
        }

        if (! $hasGender) {
            $missingFields[] = 'gender';
        }

        return [
            'isNewUser' => $isNewUser,
            'hasFullName' => $hasFullName,
            'hasGender' => $hasGender,
            'membershipFlow' => $membershipFlow,
            'missingFields' => $missingFields,
            'nextStep' => $nextStep,
        ];
    }

    private function nextMembershipStep(TenantUser $user, bool $hasFullName, bool $hasGender): string
    {
        if (! $hasFullName || ! $hasGender) {
            return '/membership/profile';
        }

        $profile = NutritionProfile::query()->where('user_id', $user->id)->first();
        $draft = $this->membershipDraft($user);

        if (! ($profile?->diet_goal ?? $draft['dietGoal'] ?? null)) {
            return '/membership/goal';
        }

        if (! ($profile?->athlete_mode ?? $draft['athleteMode'] ?? null)
            || ! ($profile?->activity_level ?? $draft['activityLevel'] ?? null)) {
            return '/membership/activity';
        }

        if (! ($profile?->birth_date ?? $user->birth_date ?? $draft['birthDate'] ?? null)) {
            return '/membership/birth-date';
        }

        if (! ($profile?->height_cm ?? $draft['heightCm'] ?? null)) {
            return '/membership/height';
        }

        if (! ($profile?->weight_kg ?? $draft['weight'] ?? null)) {
            return '/membership/weight';
        }

        if (! $profile || $profile->target_weight_kg === null) {
            return '/membership/target-weight';
        }

        if ($profile->weekly_weight_change_kg === null) {
            return '/membership/result';
        }

        if (! $profile->preferences_completed_at) {
            return $profile->medical_conditions === null
                ? '/membership/medical-conditions'
                : '/membership/medications-and-supplements';
        }

        if (! $profile->selected_nutrition_package_id) {
            return '/membership/packages';
        }

        if (! $profile->mindset_completed_at) {
            return '/membership/mindset';
        }

        return '/home';
    }

    private function membershipDraft(TenantUser $user): array
    {
        return Cache::get('customer_app_membership:draft:'.tenant('id').':'.$user->id, []);
    }

    private function newUserCacheKey(string $mobile): string
    {
        return 'customer_app_login:new_user:'.tenant('id').':'.$mobile;
    }
}
