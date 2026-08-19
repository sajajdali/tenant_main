<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\PaymentSetting;
use App\Domain\Tenant\Models\SmsOutbound;
use App\Domain\Tenant\Models\SmsSetting;
use App\Http\Controllers\Controller;
use App\Services\Payments\MaliartPaymentClient;
use App\Services\Payments\TenantMaliartGateway;
use App\Support\SmsCreditAlertState;
use App\Support\SmsGatewaySettings;
use App\Support\SmsPricing;
use App\Support\SmsSenderRegistry;
use App\Support\SmsTemplateRegistry;
use App\Support\TenantMembershipProfile;
use App\Support\TenantLocale;
use App\Support\TenantPaymentGateways;
use App\Support\TenantSandboxMode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

class GeneralSettingsController extends Controller
{
    public function __construct(
        private readonly MaliartPaymentClient $maliart,
        private readonly TenantMaliartGateway $tenantMaliart,
    ) {
    }

    public function show(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->payload(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));

        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'locale' => ['nullable', 'in:'.implode(',', TenantLocale::selectableLocales())],
            'country' => ['nullable', 'in:'.implode(',', TenantLocale::selectableCountries())],
            // Maliart is a tenant-level override and is returned by this API as
            // the active provider, even though it is not one of the editable
            // standard gateway definitions.
            'provider' => ['nullable', 'in:'.implode(',', [...TenantPaymentGateways::supportedKeys(), 'maliart'])],
            'sandboxEnabled' => ['nullable', 'boolean'],
            'cafebazaarEnabled' => ['nullable', 'boolean'],
            'cafebazaarPackageName' => ['nullable', 'string', 'max:191'],
            'cafebazaarClientId' => ['nullable', 'string', 'max:500'],
            'cafebazaarClientSecret' => ['nullable', 'string', 'max:1000'],
            'customAppSettingsEnabled' => ['nullable', 'boolean'],
            'androidAppSettingsEnabled' => ['nullable', 'boolean'],
            'androidAppVersion' => ['nullable', 'string', 'max:64'],
            'androidWebAppUrl' => ['nullable', 'string', 'max:2048'],
            'androidPaymentReturnUrl' => ['nullable', 'string', 'max:2048'],
            'enamadCode' => ['nullable', 'string'],
            'managementPanelNote' => ['nullable', 'string'],
            'siteAnnouncementEnabled' => ['nullable', 'boolean'],
            'siteAnnouncementText' => ['nullable', 'string'],
            'bookingClosedEnabled' => ['nullable', 'boolean'],
            'bookingClosedText' => ['nullable', 'string'],
            'appointmentBookingDisabled' => ['nullable', 'boolean'],
            'offQueueBookingEnabled' => ['nullable', 'boolean'],
            'serviceFirstBookingEnabled' => ['nullable', 'boolean'],
            'customerMobileConfirmationEnabled' => ['nullable', 'boolean'],
            'showCountryPrefixInAuthenticationForm' => ['nullable', 'boolean'],
            'hourlyBookingLimit' => ['nullable', 'integer', 'min:1', 'max:100'],
            'customerCancellationCutoffHours' => ['nullable', 'integer', 'min:1', 'max:720'],
            'appointmentAlertSound' => ['nullable', 'in:silent,classic,bright,soft,glass,alert,warm'],
            'apiCodeEnabled' => ['nullable', 'boolean'],
            'registrationRequirements' => ['nullable', 'array'],
            'registrationRequirements.email.enabled' => ['nullable', 'boolean'],
            'registrationRequirements.email.required' => ['nullable', 'boolean'],
            'registrationRequirements.gender.enabled' => ['nullable', 'boolean'],
            'registrationRequirements.gender.required' => ['nullable', 'boolean'],
            'registrationRequirements.nationalCode.enabled' => ['nullable', 'boolean'],
            'registrationRequirements.nationalCode.required' => ['nullable', 'boolean'],
            'registrationRequirements.birthDate.enabled' => ['nullable', 'boolean'],
            'registrationRequirements.birthDate.required' => ['nullable', 'boolean'],
            'registrationRequirements.location.enabled' => ['nullable', 'boolean'],
            'registrationRequirements.location.required' => ['nullable', 'boolean'],
            'registrationRequirements.jobTitle.enabled' => ['nullable', 'boolean'],
            'registrationRequirements.jobTitle.required' => ['nullable', 'boolean'],
            'galleryEnabled' => ['nullable', 'boolean'],
            'smsEnabled' => ['nullable', 'boolean'],
            'smsSender' => ['nullable', 'string', 'max:50'],
            'smsTemplateAdminBooking' => ['nullable', 'string', 'max:255'],
            'smsTemplateUserBooking' => ['nullable', 'string', 'max:255'],
            'smsTemplateCancellation' => ['nullable', 'string', 'max:255'],
            'smsTemplateReminder' => ['nullable', 'string', 'max:255'],
            'smsTemplatesV2' => ['nullable', 'array'],
            'smsTemplatesV2.adminBooking.enabled' => ['nullable', 'boolean'],
            'smsTemplatesV2.adminBooking.body' => ['nullable', 'string', 'max:2000'],
            'smsTemplatesV2.userBooking.enabled' => ['nullable', 'boolean'],
            'smsTemplatesV2.userBooking.body' => ['nullable', 'string', 'max:2000'],
            'smsTemplatesV2.cancellation.enabled' => ['nullable', 'boolean'],
            'smsTemplatesV2.cancellation.body' => ['nullable', 'string', 'max:2000'],
            'smsTemplatesV2.appointmentChange.enabled' => ['nullable', 'boolean'],
            'smsTemplatesV2.appointmentChange.body' => ['nullable', 'string', 'max:2000'],
            'smsTemplatesV2.reminder.enabled' => ['nullable', 'boolean'],
            'smsTemplatesV2.reminder.body' => ['nullable', 'string', 'max:2000'],
            'smsTemplatesV2.reminderThreeHours.enabled' => ['nullable', 'boolean'],
            'smsTemplatesV2.reminderThreeHours.body' => ['nullable', 'string', 'max:2000'],
            'smsTemplatesV2.loginOtp.enabled' => ['nullable', 'boolean'],
            'smsTemplatesV2.loginOtp.body' => ['nullable', 'string', 'max:2000'],
            'smsTemplatesV2.customerFeedback.enabled' => ['nullable', 'boolean'],
            'smsTemplatesV2.customerFeedback.body' => ['nullable', 'string', 'max:2000'],
            'smsTemplatesV2.appointmentReopened.enabled' => ['nullable', 'boolean'],
            'smsTemplatesV2.appointmentReopened.body' => ['nullable', 'string', 'max:2000'],
            'nutritionSmsEnabled' => ['nullable', 'boolean'],
            'nutritionSmsTemplatesV2' => ['nullable', 'array'],
            'nutritionSmsTemplatesV2.afterAiPrescription.enabled' => ['nullable', 'boolean'],
            'nutritionSmsTemplatesV2.afterAiPrescription.body' => ['nullable', 'string', 'max:2000'],
            'nutritionSmsTemplatesV2.afterAiApproval.enabled' => ['nullable', 'boolean'],
            'nutritionSmsTemplatesV2.afterAiApproval.body' => ['nullable', 'string', 'max:2000'],
            'nutritionSmsTemplatesV2.expertAfterDietRequest.enabled' => ['nullable', 'boolean'],
            'nutritionSmsTemplatesV2.expertAfterDietRequest.body' => ['nullable', 'string', 'max:2000'],
            'nutritionSmsTemplatesV2.dietEndingTomorrow.enabled' => ['nullable', 'boolean'],
            'nutritionSmsTemplatesV2.dietEndingTomorrow.body' => ['nullable', 'string', 'max:2000'],
            'nutritionSmsTemplatesV2.dietEndsToday.enabled' => ['nullable', 'boolean'],
            'nutritionSmsTemplatesV2.dietEndsToday.body' => ['nullable', 'string', 'max:2000'],
            'nutritionSmsTemplatesV2.mealLogInactiveThreeDaysFirst.enabled' => ['nullable', 'boolean'],
            'nutritionSmsTemplatesV2.mealLogInactiveThreeDaysFirst.body' => ['nullable', 'string', 'max:2000'],
            'nutritionSmsTemplatesV2.mealLogInactiveThreeDaysSecond.enabled' => ['nullable', 'boolean'],
            'nutritionSmsTemplatesV2.mealLogInactiveThreeDaysSecond.body' => ['nullable', 'string', 'max:2000'],
            'nutritionSmsTemplatesV2.dietExpiredNoRequestDay1.enabled' => ['nullable', 'boolean'],
            'nutritionSmsTemplatesV2.dietExpiredNoRequestDay1.body' => ['nullable', 'string', 'max:2000'],
            'nutritionSmsTemplatesV2.packageFinished.enabled' => ['nullable', 'boolean'],
            'nutritionSmsTemplatesV2.packageFinished.body' => ['nullable', 'string', 'max:2000'],
            'nutritionSmsTemplatesV2.packageFinishedWeek1.enabled' => ['nullable', 'boolean'],
            'nutritionSmsTemplatesV2.packageFinishedWeek1.body' => ['nullable', 'string', 'max:2000'],
            'nutritionSmsTemplatesV2.packageFinishedDay15.enabled' => ['nullable', 'boolean'],
            'nutritionSmsTemplatesV2.packageFinishedDay15.body' => ['nullable', 'string', 'max:2000'],
            'nutritionSmsTemplatesV2.afterPackagePurchase.enabled' => ['nullable', 'boolean'],
            'nutritionSmsTemplatesV2.afterPackagePurchase.body' => ['nullable', 'string', 'max:2000'],
            'smsStats' => ['nullable', 'array'],
            'smsStats.totalSent' => ['nullable', 'integer', 'min:0'],
            'smsStats.sentToday' => ['nullable', 'integer', 'min:0'],
            'smsStats.creditBalance' => ['nullable', 'integer', 'min:0'],
            'preferNutritionLandingAsDefault' => ['nullable', 'boolean'],
            'activeNutritionLandingVariant' => ['nullable', 'in:classic,diet,all_features,diet_priority'],
        ] + TenantPaymentGateways::validationRules());

        $allowedSenders = SmsSenderRegistry::numbers()->all();
        $requestedSmsSender = trim((string) ($validated['smsSender'] ?? ''));
        $resolvedSmsSender = $requestedSmsSender;

        if (
            ($validated['smsEnabled'] ?? false)
            && $requestedSmsSender !== ''
            && ! in_array($requestedSmsSender, $allowedSenders, true)
        ) {
            return response()->json([
                'success' => false,
                'message' => __('tenant.general_settings.sender_invalid'),
                'data' => $this->payload(),
            ], 422);
        }

        $payment = PaymentSetting::query()->firstOrCreate([], [
            'enabled' => false,
            'provider' => null,
            'credentials' => [],
            'meta' => [],
        ]);

        $payment->update([
            'enabled' => (bool) $validated['enabled'],
            'provider' => $validated['enabled'] ? ($validated['provider'] ?? null) : null,
            'credentials' => [
                'gateways' => $validated['enabled']
                    ? TenantPaymentGateways::normalized($validated['gateways'] ?? [])
                    : TenantPaymentGateways::defaultSettings(),
            ],
            'meta' => [
                'enamad_code' => $validated['enamadCode'] ?? '',
                'enamad_verification_file_name' => $payment->meta['enamad_verification_file_name'] ?? '',
                'sandbox_enabled' => (bool) ($validated['sandboxEnabled'] ?? false),
                'cafebazaar_iap' => [
                    'enabled' => (bool) ($validated['cafebazaarEnabled'] ?? false),
                    'package_name' => trim((string) ($validated['cafebazaarPackageName'] ?? data_get($payment->meta, 'cafebazaar_iap.package_name', ''))),
                    'client_id' => trim((string) ($validated['cafebazaarClientId'] ?? data_get($payment->meta, 'cafebazaar_iap.client_id', ''))),
                    'client_secret' => filled($validated['cafebazaarClientSecret'] ?? null)
                        ? trim((string) $validated['cafebazaarClientSecret'])
                        : (string) data_get($payment->meta, 'cafebazaar_iap.client_secret', ''),
                ],
            ],
        ]);

        $general = GeneralSetting::query()->firstOrCreate([], [
            'timezone' => 'Asia/Tehran',
            'currency' => 'IRR',
            'booking_rules' => [],
        ]);

        $bookingRules = $general->booking_rules ?? [];
        $bookingRules['management_panel_note'] = (string) ($validated['managementPanelNote'] ?? '');
        $localization = is_array($bookingRules['localization'] ?? null) ? $bookingRules['localization'] : [];
        $localization['locale'] = TenantLocale::normalize($validated['locale'] ?? null)
            ?? TenantLocale::fromRules($bookingRules)
            ?? TenantLocale::default();
        $localization['country'] = TenantLocale::normalizeCountry($validated['country'] ?? null)
            ?? TenantLocale::countryFromRules($bookingRules)
            ?? TenantLocale::defaultCountry();
        $bookingRules['localization'] = $localization;
        $bookingRules['site_announcement_enabled'] = (bool) ($validated['siteAnnouncementEnabled'] ?? false);
        $bookingRules['site_announcement_text'] = (string) ($validated['siteAnnouncementText'] ?? '');
        $bookingRules['booking_closed_enabled'] = (bool) ($validated['bookingClosedEnabled'] ?? false);
        $bookingRules['booking_closed_text'] = (string) ($validated['bookingClosedText'] ?? '');
        $bookingRules['appointment_booking_disabled'] = $this->isNutritionAudience()
            ? (bool) ($validated['appointmentBookingDisabled'] ?? false)
            : false;
        $bookingRules['off_queue_booking_enabled'] = array_key_exists('offQueueBookingEnabled', $validated)
            ? (bool) $validated['offQueueBookingEnabled']
            : (bool) ($bookingRules['off_queue_booking_enabled'] ?? true);
        $bookingRules['service_first_booking_enabled'] = (bool) ($validated['serviceFirstBookingEnabled'] ?? false);
        $bookingRules['customer_mobile_confirmation_enabled'] = (bool) ($validated['customerMobileConfirmationEnabled'] ?? false);
        $bookingRules['show_country_prefix_in_authentication_form'] = (bool) ($validated['showCountryPrefixInAuthenticationForm'] ?? false);
        $bookingRules['hourly_booking_limit'] = (int) ($validated['hourlyBookingLimit'] ?? ($bookingRules['hourly_booking_limit'] ?? 4));
        $bookingRules['customer_cancellation_cutoff_hours'] = (int) ($validated['customerCancellationCutoffHours'] ?? ($bookingRules['customer_cancellation_cutoff_hours'] ?? 2));
        $bookingRules['appointment_alert_sound'] = (string) ($validated['appointmentAlertSound'] ?? ($bookingRules['appointment_alert_sound'] ?? 'classic'));
        $bookingRules['api_code_enabled'] = (bool) ($validated['apiCodeEnabled'] ?? false);
        $androidApp = is_array($bookingRules['android_app'] ?? null) ? $bookingRules['android_app'] : [];
        $androidApp['settings_enabled'] = array_key_exists('customAppSettingsEnabled', $validated)
            ? (bool) $validated['customAppSettingsEnabled']
            : (bool) ($androidApp['settings_enabled'] ?? false);
        $androidApp['enabled'] = array_key_exists('androidAppSettingsEnabled', $validated)
            ? (bool) $validated['androidAppSettingsEnabled']
            : (bool) ($androidApp['enabled'] ?? false);
        $androidApp['version'] = array_key_exists('androidAppVersion', $validated)
            ? trim((string) $validated['androidAppVersion'])
            : (string) ($androidApp['version'] ?? '');
        $androidApp['web_app_url'] = array_key_exists('androidWebAppUrl', $validated)
            ? $this->normalizeAndroidAppUrl((string) $validated['androidWebAppUrl'])
            : (string) ($androidApp['web_app_url'] ?? '');
        $androidApp['payment_return_url'] = array_key_exists('androidPaymentReturnUrl', $validated)
            ? trim((string) $validated['androidPaymentReturnUrl'])
            : (string) ($androidApp['payment_return_url'] ?? '');
        $bookingRules['android_app'] = $androidApp;
        $bookingRules['registration_requirements'] = TenantMembershipProfile::normalizeRequirements($validated['registrationRequirements'] ?? []);
        $bookingRules['gallery_enabled'] = (bool) ($validated['galleryEnabled'] ?? false);
        if ($this->isNutritionAudience()) {
            $nutritionLanding = is_array($bookingRules['nutrition_landing'] ?? null) ? $bookingRules['nutrition_landing'] : [];
            $nutritionLanding['prefer_as_default'] = (bool) ($validated['preferNutritionLandingAsDefault'] ?? ($nutritionLanding['prefer_as_default'] ?? false));
            $nutritionLanding['active_variant'] = (string) ($validated['activeNutritionLandingVariant'] ?? ($nutritionLanding['active_variant'] ?? 'classic'));
            $bookingRules['nutrition_landing'] = $nutritionLanding;
        }

        $general->update([
            'booking_rules' => $bookingRules,
        ]);

        $sms = SmsSetting::query()->firstOrCreate([], [
            'enabled' => false,
            'provider' => null,
            'credentials' => [],
            'templates' => [],
        ]);

        $existingSmsTemplates = is_array($sms->templates['v2'] ?? null) ? $sms->templates['v2'] : [];
        $existingNutritionSmsTemplates = is_array($sms->templates['nutrition_v2'] ?? null) ? $sms->templates['nutrition_v2'] : [];
        $existingSmsStats = is_array($sms->templates['stats'] ?? null) ? $sms->templates['stats'] : [];
        $existingAlertState = is_array($sms->templates['credit_alert_state'] ?? null) ? $sms->templates['credit_alert_state'] : [];
        $loginOtpBody = trim((string) data_get($validated, 'smsTemplatesV2.loginOtp.body', data_get($existingSmsTemplates, 'loginOtp.body', '')));

        if ($loginOtpBody === '' || ! str_contains($loginOtpBody, '{{code}}')) {
            throw ValidationException::withMessages([
                'smsTemplatesV2.loginOtp.body' => __('tenant.general_settings.login_otp_code_required'),
            ]);
        }

        if (! str_contains($loginOtpBody, '{{web_otp}}')) {
            data_set($validated, 'smsTemplatesV2.loginOtp.body', rtrim($loginOtpBody).PHP_EOL.'{{web_otp}}');
        }

        $nextSmsTemplates = SmsTemplateRegistry::buildForPersistence(
            is_array($validated['smsTemplatesV2'] ?? null) ? $validated['smsTemplatesV2'] : [],
            $existingSmsTemplates,
        );
        $nextNutritionSmsTemplates = SmsTemplateRegistry::buildNutritionForPersistence(
            is_array($validated['nutritionSmsTemplatesV2'] ?? null) ? $validated['nutritionSmsTemplatesV2'] : [],
            $existingNutritionSmsTemplates,
        );

        $nextCreditBalance = (int) data_get($validated, 'smsStats.creditBalance', data_get($existingSmsStats, 'creditBalance', 0));

        $sms->update([
            'enabled' => (bool) ($validated['smsEnabled'] ?? false),
            'provider' => ($validated['smsEnabled'] ?? false) ? 'kavenegar' : null,
            'credentials' => [
                'sender' => ($validated['smsEnabled'] ?? false) ? $resolvedSmsSender : '',
            ],
            'templates' => [
                'admin_booking' => $validated['smsTemplateAdminBooking'] ?? '',
                'user_booking' => $validated['smsTemplateUserBooking'] ?? '',
                'cancellation' => $validated['smsTemplateCancellation'] ?? '',
                'reminder' => $validated['smsTemplateReminder'] ?? '',
                'v2' => $nextSmsTemplates,
                'nutrition_enabled' => $this->isNutritionAudience() ? (bool) ($validated['nutritionSmsEnabled'] ?? false) : false,
                'nutrition_v2' => $this->isNutritionAudience() ? $nextNutritionSmsTemplates : [],
                'stats' => [
                    'totalSent' => (int) data_get($validated, 'smsStats.totalSent', data_get($existingSmsStats, 'totalSent', 0)),
                    'sentToday' => (int) data_get($validated, 'smsStats.sentToday', data_get($existingSmsStats, 'sentToday', 0)),
                    'creditBalance' => $nextCreditBalance,
                ],
                'credit_alert_state' => SmsCreditAlertState::resetForBalance($existingAlertState, $nextCreditBalance),
            ],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->payload(),
            'message' => __('tenant.general_settings.saved'),
        ]);
    }

    public function createEnamadVerificationFile(Request $request): JsonResponse
    {
        abort_unless($request->user('tenant_web')?->role === 'admin', 403, __('authorization.admin_section'));

        $validated = $request->validate([
            'filename' => ['required', 'string', 'max:100', 'regex:/^[A-Za-z0-9_-]+$/'],
        ], [
            'filename.required' => __('tenant.general_settings.enamad_filename_required'),
            'filename.regex' => __('tenant.general_settings.enamad_filename_format'),
        ]);

        $payment = PaymentSetting::query()->firstOrCreate([], [
            'enabled' => false,
            'provider' => null,
            'credentials' => [],
            'meta' => [],
        ]);

        $meta = $payment->meta ?? [];
        $meta['enamad_verification_file_name'] = $validated['filename'];

        $payment->update([
            'meta' => $meta,
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->payload(),
            'message' => __('tenant.general_settings.enamad_file_created'),
        ]);
    }

    public function serveEnamadVerificationFile(string $verificationFile): Response
    {
        $payment = PaymentSetting::query()->first();
        $meta = $payment?->meta ?? [];
        $expected = (string) ($meta['enamad_verification_file_name'] ?? '');

        abort_if($expected === '' || $expected !== $verificationFile, 404);

        return response($verificationFile, 200, [
            'Content-Type' => 'text/plain; charset=UTF-8',
        ]);
    }

    private function payload(): array
    {
        $payment = PaymentSetting::query()->first();
        $general = GeneralSetting::query()->first();
        $sms = SmsSetting::query()->first();

        $paymentCredentials = $payment?->credentials ?? [];
        $paymentMeta = $payment?->meta ?? [];
        $bookingRules = $general?->booking_rules ?? [];
        $smsCredentials = $sms?->credentials ?? [];
        $smsTemplates = $sms?->templates ?? [];
        $smsTemplatesV2 = SmsTemplateRegistry::normalizeCollection(is_array($smsTemplates['v2'] ?? null) ? $smsTemplates['v2'] : []);
        $nutritionSmsTemplatesV2 = SmsTemplateRegistry::normalizeNutritionCollection(is_array($smsTemplates['nutrition_v2'] ?? null) ? $smsTemplates['nutrition_v2'] : []);
        $smsStats = is_array($smsTemplates['stats'] ?? null) ? $smsTemplates['stats'] : [];
        $sentToday = SmsOutbound::query()
            ->whereNotNull('sent_at')
            ->whereBetween('sent_at', [now()->startOfDay(), now()->endOfDay()])
            ->count();
        $smsPricing = SmsPricing::get();
        $senderRegistry = SmsSenderRegistry::get();
        $gatewaySettings = SmsGatewaySettings::get();
        $gateways = TenantPaymentGateways::normalized($paymentCredentials['gateways'] ?? []);
        $enabledGateways = TenantPaymentGateways::configuredEnabled($gateways);
        $tenantMaliartEnabled = $this->tenantMaliart->enabled();

        return [
            'enabled' => $tenantMaliartEnabled || (bool) ($payment?->enabled ?? false),
            'locale' => TenantLocale::fromRules($bookingRules) ?? TenantLocale::default(),
            'country' => TenantLocale::countryFromRules($bookingRules) ?? TenantLocale::defaultCountry(),
            'localization' => TenantLocale::meta($general, request()),
            'provider' => $tenantMaliartEnabled ? 'maliart' : ($payment?->provider ?: ($enabledGateways[0] ?? null)),
            'sandboxEnabled' => TenantSandboxMode::paymentEnabled(null, (bool) ($paymentMeta['sandbox_enabled'] ?? false)),
            'cafebazaarEnabled' => (bool) data_get($paymentMeta, 'cafebazaar_iap.enabled', false),
            'cafebazaarPackageName' => (string) data_get($paymentMeta, 'cafebazaar_iap.package_name', ''),
            'cafebazaarClientId' => (string) data_get($paymentMeta, 'cafebazaar_iap.client_id', ''),
            // A secret is never returned to the browser. The boolean lets the UI
            // show whether a value has already been saved.
            'cafebazaarClientSecretConfigured' => filled(data_get($paymentMeta, 'cafebazaar_iap.client_secret', '')),
            'maliartEnabled' => $this->maliart->enabled(),
            'tenantMaliartEnabled' => $tenantMaliartEnabled,
            'enabledGateways' => $tenantMaliartEnabled ? ['maliart'] : $enabledGateways,
            'gateways' => $gateways,
            'enamadCode' => $paymentMeta['enamad_code'] ?? '',
            'enamadVerificationFileName' => $paymentMeta['enamad_verification_file_name'] ?? '',
            'managementPanelNote' => $bookingRules['management_panel_note'] ?? '',
            'siteAnnouncementEnabled' => (bool) ($bookingRules['site_announcement_enabled'] ?? false),
            'siteAnnouncementText' => $bookingRules['site_announcement_text'] ?? '',
            'bookingClosedEnabled' => (bool) ($bookingRules['booking_closed_enabled'] ?? false),
            'bookingClosedText' => $bookingRules['booking_closed_text'] ?? '',
            'appointmentBookingDisabled' => $this->isNutritionAudience()
                ? (bool) ($bookingRules['appointment_booking_disabled'] ?? false)
                : false,
            'offQueueBookingEnabled' => (bool) ($bookingRules['off_queue_booking_enabled'] ?? true),
            'serviceFirstBookingEnabled' => (bool) ($bookingRules['service_first_booking_enabled'] ?? false),
            'customerMobileConfirmationEnabled' => (bool) ($bookingRules['customer_mobile_confirmation_enabled'] ?? false),
            'showCountryPrefixInAuthenticationForm' => (bool) ($bookingRules['show_country_prefix_in_authentication_form'] ?? false),
            'hourlyBookingLimit' => max(1, (int) ($bookingRules['hourly_booking_limit'] ?? 4)),
            'customerCancellationCutoffHours' => max(1, (int) ($bookingRules['customer_cancellation_cutoff_hours'] ?? 2)),
            'appointmentAlertSound' => (string) ($bookingRules['appointment_alert_sound'] ?? 'classic'),
            'apiCodeEnabled' => (bool) ($bookingRules['api_code_enabled'] ?? false),
            'customAppSettingsEnabled' => (bool) (($bookingRules['android_app']['settings_enabled'] ?? false)),
            'androidAppSettingsEnabled' => (bool) (($bookingRules['android_app']['enabled'] ?? false)),
            'androidAppVersion' => (string) (($bookingRules['android_app']['version'] ?? '')),
            'androidWebAppUrl' => (string) (($bookingRules['android_app']['web_app_url'] ?? '')),
            'androidPaymentReturnUrl' => (string) (($bookingRules['android_app']['payment_return_url'] ?? '')),
            'registrationRequirements' => TenantMembershipProfile::normalizeRequirements($bookingRules['registration_requirements'] ?? []),
            'galleryEnabled' => (bool) ($bookingRules['gallery_enabled'] ?? false),
            'smsEnabled' => (bool) ($sms?->enabled ?? false),
            'smsProvider' => $sms?->provider,
            'smsApiKey' => '',
            'smsApiKeyConfigured' => filled($gatewaySettings['kavenegar_api_key'] ?? ''),
            'smsSender' => ($smsCredentials['sender'] ?? '') ?: ($senderRegistry['default_sender'] ?? ''),
            'smsAvailableSenders' => $senderRegistry['senders'] ?? [],
            'smsTemplateAdminBooking' => $smsTemplates['admin_booking'] ?? '',
            'smsTemplateUserBooking' => $smsTemplates['user_booking'] ?? '',
            'smsTemplateCancellation' => $smsTemplates['cancellation'] ?? '',
            'smsTemplateReminder' => $smsTemplates['reminder'] ?? '',
            'smsTemplatesV2' => $smsTemplatesV2,
            'nutritionSmsEnabled' => $this->isNutritionAudience()
                ? (bool) ($smsTemplates['nutrition_enabled'] ?? false)
                : false,
            'nutritionSmsTemplatesV2' => $this->isNutritionAudience() ? $nutritionSmsTemplatesV2 : [],
            'smsStats' => [
                'totalSent' => (int) data_get($smsStats, 'totalSent', 0),
                'sentToday' => $sentToday,
                'creditBalance' => (int) data_get($smsStats, 'creditBalance', 0),
            ],
            'smsPricing' => [
                'persianPrice' => (int) ($smsPricing['persian_price'] ?? 0),
                'englishPrice' => (int) ($smsPricing['english_price'] ?? 0),
            ],
            'preferNutritionLandingAsDefault' => $this->isNutritionAudience()
                ? (bool) (($bookingRules['nutrition_landing']['prefer_as_default'] ?? false))
                : false,
            'activeNutritionLandingVariant' => $this->isNutritionAudience()
                ? (string) (($bookingRules['nutrition_landing']['active_variant'] ?? 'classic'))
                : null,
        ];
    }

    private function isNutritionAudience(): bool
    {
        $tenant = tenant()->loadMissing('audienceType:id,slug');
        $slug = $tenant?->audienceType?->slug;

        return in_array($slug, ['nutritionists', 'nutrition-doctors'], true);
    }

    private function normalizeAndroidAppUrl(string $value): string
    {
        $value = trim($value);

        if ($value !== '' && ! str_contains($value, '://')) {
            $value = 'https://'.$value;
        }

        return filter_var($value, FILTER_VALIDATE_URL) !== false ? rtrim($value, '/') : '';
    }
}
