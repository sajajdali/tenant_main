<?php

declare(strict_types=1);

namespace App\Services\Auth;

use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\SmsSetting;
use App\Domain\Tenant\Models\TenantUser;
use App\Domain\Landing\Models\LandingCustomer;
use App\Models\User as CentralUser;
use App\Services\Landing\LandingCustomerService;
use App\Services\Sms\SmsDispatchService;
use App\Services\TenantProvisioningService;
use App\Support\SmsGatewaySettings;
use App\Support\SmsQueue;
use App\Support\SmsSenderRegistry;
use App\Support\SmsTemplateRegistry;
use App\Support\TenantSandboxMode;
use Illuminate\Support\Facades\Cache;

class OtpLoginService
{
    private const TTL_SECONDS = 120;
    private const RESEND_SECONDS = 60;

    public function __construct(
        private readonly TenantProvisioningService $tenantProvisioningService,
        private readonly LandingCustomerService $landingCustomerService,
        private readonly SmsDispatchService $smsDispatchService,
    ) {
    }

    public function sendForCentral(string $mobile): array
    {
        $user = CentralUser::query()
            ->where('mobile', $mobile)
            ->where('is_active', true)
            ->where('role', 'admin')
            ->first();

        if (! $user) {
            return ['ok' => false, 'message' => __('api.auth.central_user_not_found')];
        }

        return $this->issueCode('central', $mobile);
    }

    public function sendForTenant(string $mobile, ?Tenant $tenant): array
    {
        if (! $tenant) {
            return ['ok' => false, 'message' => __('api.auth.tenant_not_found')];
        }

        $user = $this->tenantProvisioningService->findTenantUser($tenant, $mobile);

        if (! $user) {
            $user = $this->tenantProvisioningService->ensureCustomerExists($tenant, $mobile);
        }

        if (! $user->is_active) {
            return ['ok' => false, 'message' => __('api.auth.user_inactive')];
        }

        $fixedCode = $tenant->demoFixedLoginCode();
        $otp = $this->issueCode('tenant:' . $tenant->id, $mobile, $fixedCode);

        if (! $otp['ok']) {
            return $otp;
        }

        $smsResult = $this->sendTenantOtpMessage($tenant, $mobile, (string) ($otp['code'] ?? ''), $user->role === 'admin');

        if (! $smsResult['ok']) {
            Cache::forget($this->otpKey('tenant:' . $tenant->id, $mobile));
            Cache::forget($this->cooldownKey('tenant:' . $tenant->id, $mobile));

            return $smsResult;
        }

        if ($fixedCode !== null) {
            return $otp + [
                'demo_fixed_code' => $fixedCode,
            ];
        }

        return $otp;
    }

    public function verifyForCentral(string $mobile, string $code): ?CentralUser
    {
        if (! $this->hasValidCode('central', $mobile, $code)) {
            return null;
        }

        return CentralUser::query()
            ->where('mobile', $mobile)
            ->where('is_active', true)
            ->where('role', 'admin')
            ->first();
    }

    public function verifyForTenant(string $mobile, string $code, ?Tenant $tenant): ?TenantUser
    {
        if (! $tenant || ! $this->hasValidCode('tenant:' . $tenant->id, $mobile, $code)) {
            return null;
        }

        $user = $this->tenantProvisioningService->findTenantUser($tenant, $mobile);

        if (! $user) {
            $user = $this->tenantProvisioningService->ensureCustomerExists($tenant, $mobile);
        }

        return $user->is_active ? $user : null;
    }

    public function sendForLandingCustomer(string $mobile): array
    {
        return $this->issueCode('landing_customer', $mobile);
    }

    public function verifyForLandingCustomer(string $mobile, string $code): ?LandingCustomer
    {
        if (! $this->hasValidCode('landing_customer', $mobile, $code)) {
            return null;
        }

        return $this->landingCustomerService->findOrCreateByMobile($mobile, [
            'status' => 'active',
        ]);
    }

    private function issueCode(string $scope, string $mobile, ?string $forcedCode = null): array
    {
        $otpKey = $this->otpKey($scope, $mobile);
        $cooldownKey = $this->cooldownKey($scope, $mobile);

        if (Cache::has($cooldownKey)) {
            $remaining = max((int) Cache::get($cooldownKey), 1);

            return [
                'ok' => false,
                'message' => __('api.auth.retry_after_seconds', ['seconds' => $remaining]),
            ];
        }

        $code = $forcedCode !== null && preg_match('/^\d{4}$/', $forcedCode)
            ? $forcedCode
            : $this->generateCode();

        Cache::put($otpKey, $code, now()->addSeconds(self::TTL_SECONDS));
        Cache::put($cooldownKey, self::RESEND_SECONDS, now()->addSeconds(self::RESEND_SECONDS));

        return [
            'ok' => true,
            'code' => $code,
            'expires_in' => self::TTL_SECONDS,
            'remaining_seconds' => self::RESEND_SECONDS,
        ];
    }

    private function hasValidCode(string $scope, string $mobile, string $code): bool
    {
        $cachedCode = Cache::get($this->otpKey($scope, $mobile));

        if (! $cachedCode || trim($code) !== (string) $cachedCode) {
            return false;
        }

        Cache::forget($this->otpKey($scope, $mobile));
        Cache::forget($this->cooldownKey($scope, $mobile));

        return true;
    }

    private function otpKey(string $scope, string $mobile): string
    {
        return "otp_login:{$scope}:{$mobile}";
    }

    private function cooldownKey(string $scope, string $mobile): string
    {
        return "otp_login:cooldown:{$scope}:{$mobile}";
    }

    private function sendTenantOtpMessage(Tenant $tenant, string $mobile, string $code, bool $allowNegativeBalance): array
    {
        $smsSetting = SmsSetting::query()->first();
        $resolvedProvider = (string) ($smsSetting?->provider ?: 'kavenegar');
        $resolvedSender = trim((string) (($smsSetting?->credentials['sender'] ?? '') ?: (SmsSenderRegistry::defaultSender() ?? '')));

        if (! $smsSetting || $resolvedProvider === '') {
            return [
                'ok' => false,
                'message' => __('api.auth.sms_not_configured'),
            ];
        }

        $templates = is_array($smsSetting->templates['v2'] ?? null) ? $smsSetting->templates['v2'] : [];
        $template = SmsTemplateRegistry::approvedTemplate($templates, 'loginOtp');

        if (! $template && $allowNegativeBalance) {
            $normalizedTemplate = SmsTemplateRegistry::normalizeCollection($templates)['loginOtp'] ?? null;

            if ($normalizedTemplate && trim((string) ($normalizedTemplate['body'] ?? '')) !== '') {
                $template = [
                    ...$normalizedTemplate,
                    'body' => (string) $normalizedTemplate['body'],
                    'enabled' => (bool) $normalizedTemplate['enabled'],
                ];
            }
        }

        if (! $template) {
            return [
                'ok' => false,
                'message' => __('api.auth.sms_template_unapproved'),
            ];
        }

        if (! $allowNegativeBalance && ! (bool) $smsSetting->enabled) {
            return [
                'ok' => false,
                'message' => __('api.auth.sms_not_enabled'),
            ];
        }

        $body = (string) ($template['body'] ?? SmsTemplateRegistry::definitions()['loginOtp']['default_body']);
        $webOtpSignature = $this->webOtpSignature($code);
        $message = strtr($body, [
            '{{code}}' => $code,
            '{{business_name}}' => $this->businessName($tenant),
            '{{mobile}}' => $mobile,
            '{{web_otp}}' => $webOtpSignature,
        ]);

        if ($webOtpSignature !== '' && ! str_contains($body, '{{web_otp}}')) {
            $message = rtrim($message) . PHP_EOL . $webOtpSignature;
        }

        $smsSandboxEnabled = TenantSandboxMode::smsEnabled($tenant, SmsGatewaySettings::sandboxEnabled());

        if (! $smsSandboxEnabled && $resolvedProvider === 'kavenegar' && SmsGatewaySettings::kavenegarApiKey() === '') {
            return [
                'ok' => false,
                'message' => __('api.auth.sms_api_key_missing'),
            ];
        }

        $this->smsDispatchService->dispatchQueued($smsSetting, [
            'type' => 'otp',
            'template_key' => 'loginOtp',
            'recipient_mobile' => $mobile,
            'message' => $message,
            'provider' => $resolvedProvider,
            'sender' => $resolvedSender,
            'allow_negative_balance' => $allowNegativeBalance,
            'queue' => SmsQueue::OTP,
        ]);

        return [
            'ok' => true,
            'message' => __('api.auth.otp_queued'),
        ];
    }

    private function generateCode(): string
    {
        return str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
    }

    private function businessName(Tenant $tenant): string
    {
        $rules = GeneralSetting::query()->first()?->booking_rules ?? [];
        $appearance = is_array($rules['appearance'] ?? null) ? $rules['appearance'] : [];
        $storeName = trim((string) ($appearance['store_name'] ?? ''));

        return $storeName !== '' ? $storeName : ($tenant->name ?: __('api.auth.default_business_name'));
    }

    private function webOtpSignature(string $code): string
    {
        $host = $this->webOtpHost();

        if ($host === '' || ! preg_match('/^\d{4}$/', $code)) {
            return '';
        }

        return '@' . $host . ' #' . $code;
    }

    private function webOtpHost(): string
    {
        $host = request()?->getHost() ?? '';
        $host = strtolower(trim($host));

        if ($host === '' || filter_var($host, FILTER_VALIDATE_IP)) {
            return '';
        }

        return $host;
    }
}
