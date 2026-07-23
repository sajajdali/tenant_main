<?php

declare(strict_types=1);

namespace App\Http\Controllers\Landing;

use App\Domain\Landing\Models\LandingCustomer;
use App\Domain\Landing\Models\LandingSiteDomain;
use App\Http\Controllers\Controller;
use App\Services\Auth\OtpLoginService;
use App\Services\Landing\LandingCustomerService;
use App\Support\SmsGatewaySettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LandingCustomerAuthController extends Controller
{
    private const SESSION_KEY = 'landing_customer_id';

    public function __construct(
        private readonly OtpLoginService $otpLoginService,
        private readonly LandingCustomerService $customerService,
    ) {
    }

    public function send(Request $request): JsonResponse
    {
        $this->resolveLandingSiteId($request);

        $validated = $request->validate([
            'mobile' => ['required', 'string', 'max:20'],
        ]);

        $result = $this->otpLoginService->sendForLandingCustomer((string) $validated['mobile']);

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
                'code_hint' => SmsGatewaySettings::sandboxEnabled() ? ($result['code'] ?? null) : null,
            ],
        ]);
    }

    public function verify(Request $request): JsonResponse
    {
        $this->resolveLandingSiteId($request);

        $validated = $request->validate([
            'mobile' => ['required', 'string', 'max:20'],
            'code' => ['required', 'string', 'size:4'],
        ]);

        $customer = $this->otpLoginService->verifyForLandingCustomer(
            (string) $validated['mobile'],
            (string) $validated['code'],
        );

        if (! $customer) {
            return response()->json([
                'success' => false,
                'message' => __('api.auth.otp_invalid'),
            ], 422);
        }

        $customer = $this->customerService->markLogin($customer);
        $request->session()->put(self::SESSION_KEY, $customer->id);
        $request->session()->regenerate();

        return response()->json([
            'success' => true,
            'message' => __('api.auth.login_success'),
            'data' => [
                'customer' => $this->serializeCustomer($customer),
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $this->resolveLandingSiteId($request);

        return response()->json([
            'success' => true,
            'data' => [
                'customer' => $this->serializeCustomer($this->resolveCustomer($request)),
            ],
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $this->resolveLandingSiteId($request);
        $customer = $this->resolveCustomerOrFail($request);

        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:120'],
            'last_name' => ['required', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:255', 'unique:central.landing_customers,email,'.$customer->id],
            'gender' => ['nullable', 'in:male,female'],
            'national_code' => ['nullable', 'digits:10', 'unique:central.landing_customers,national_code,'.$customer->id],
            'birth_date' => ['nullable', 'date'],
            'province_id' => ['nullable', 'integer'],
            'province_name' => ['nullable', 'string', 'max:120'],
            'city_id' => ['nullable', 'integer'],
            'city_name' => ['nullable', 'string', 'max:120'],
            'address_line' => ['nullable', 'string', 'max:4000'],
            'postal_code' => ['nullable', 'string', 'max:20'],
        ]);

        $customer = $this->customerService->updateProfile($customer, $validated);

        return response()->json([
            'success' => true,
            'message' => __('api.auth.profile_updated'),
            'data' => [
                'customer' => $this->serializeCustomer($customer),
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->session()->forget(self::SESSION_KEY);

        return response()->json([
            'success' => true,
            'data' => true,
        ]);
    }

    public static function sessionKey(): string
    {
        return self::SESSION_KEY;
    }

    private function resolveCustomer(Request $request): ?LandingCustomer
    {
        $id = $request->session()->get(self::SESSION_KEY);

        if (! $id) {
            return null;
        }

        return LandingCustomer::query()->find($id);
    }

    private function resolveCustomerOrFail(Request $request): LandingCustomer
    {
        $customer = $this->resolveCustomer($request);
        abort_unless($customer, 401, __('api.auth.login_required'));

        return $customer;
    }

    private function serializeCustomer(?LandingCustomer $customer): ?array
    {
        if (! $customer) {
            return null;
        }

        return [
            'id' => (string) $customer->id,
            'mobile' => $customer->mobile,
            'firstName' => $customer->first_name,
            'lastName' => $customer->last_name,
            'fullName' => $customer->full_name,
            'email' => $customer->email,
            'gender' => $customer->gender,
            'nationalCode' => $customer->national_code,
            'birthDate' => $customer->birth_date?->toDateString(),
            'provinceId' => $customer->province_id,
            'provinceName' => $customer->province_name,
            'cityId' => $customer->city_id,
            'cityName' => $customer->city_name,
            'addressLine' => $customer->address_line,
            'postalCode' => $customer->postal_code,
            'lastLoginAt' => $customer->last_login_at?->toIso8601String(),
        ];
    }

    private function resolveLandingSiteId(Request $request): int
    {
        $domain = LandingSiteDomain::query()
            ->where('domain', $request->getHost())
            ->where('status', 'active')
            ->first();

        abort_unless($domain !== null, 404);

        return (int) $domain->landing_site_id;
    }
}
