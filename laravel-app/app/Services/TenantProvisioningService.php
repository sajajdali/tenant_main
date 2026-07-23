<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Booking\Models\Appointment;
use App\Domain\Booking\Models\AppointmentPayment;
use App\Domain\Booking\Models\Customer;
use App\Domain\Tenant\Models\GeneralSetting;
use App\Domain\Tenant\Models\SmsSetting;
use App\Domain\Tenant\Models\SubscriptionPackage;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantSetting;
use App\Domain\Tenant\Models\TenantUser;
use App\Services\Sms\SmsCreditService;
use App\Support\SmsSenderRegistry;
use App\Support\SmsTemplateRegistry;
use App\Support\StoreSmsTemplateRegistry;
use App\Support\TenantMembershipProfile;
use App\Support\TenantStorageSettings;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;

class TenantProvisioningService
{
    public function __construct(
        private readonly SmsCreditService $smsCreditService,
        private readonly FinancialLedgerService $financialLedgerService,
    ) {}

    public function provisionUsersAndRoles(Tenant $tenant): void
    {
        $owner = $tenant->owner;

        if (! $owner) {
            return;
        }

        $tenant->run(function () use ($owner): void {
            foreach (['admin', 'barber', 'customer'] as $roleName) {
                Role::findOrCreate($roleName, 'tenant_web');
            }

            $tenantUser = TenantUser::query()->updateOrCreate(
                ['mobile' => $owner->mobile],
                [
                    'central_user_id' => $owner->id,
                    'name' => $owner->name,
                    'email' => $owner->email,
                    'password' => $owner->password,
                    'role' => 'admin',
                    'is_active' => $owner->is_active,
                    'can_book' => true,
                ],
            );

            $tenantUser->syncRoles(['admin']);
        });
    }

    public function provisionDefaultSmsSettings(Tenant $tenant): void
    {
        $tenant->run(function (): void {
            $smsSetting = SmsSetting::query()->firstOrCreate([], [
                'enabled' => true,
                'provider' => 'kavenegar',
                'credentials' => [
                    'sender' => SmsSenderRegistry::defaultSender() ?? '',
                ],
                'templates' => [],
            ]);

            $templates = is_array($smsSetting->templates) ? $smsSetting->templates : [];
            $templatesV2 = SmsTemplateRegistry::normalizeCollection(
                is_array($templates['v2'] ?? null) ? $templates['v2'] : [],
            );

            $defaultLoginOtpBody = (string) SmsTemplateRegistry::definitions()['loginOtp']['default_body'];
            foreach (SmsTemplateRegistry::definitions() as $templateKey => $definition) {
                if ($templateKey === 'loginOtp') {
                    continue;
                }

                $templatesV2[$templateKey] = [
                    ...$templatesV2[$templateKey],
                    'enabled' => (bool) $definition['default_enabled'],
                    'body' => (string) $definition['default_body'],
                    'approval_status' => 'approved',
                    'approved_body' => (string) $definition['default_body'],
                    'approved_enabled' => (bool) $definition['default_enabled'],
                    'rejection_reason' => null,
                    'submitted_at' => $templatesV2[$templateKey]['submitted_at'] ?? now()->toISOString(),
                    'reviewed_at' => now()->toISOString(),
                ];
            }

            $templatesV2['loginOtp'] = [
                ...$templatesV2['loginOtp'],
                'enabled' => true,
                'body' => $defaultLoginOtpBody,
                'approval_status' => 'approved',
                'approved_body' => $defaultLoginOtpBody,
                'approved_enabled' => true,
                'rejection_reason' => null,
                'submitted_at' => $templatesV2['loginOtp']['submitted_at'] ?? now()->toISOString(),
                'reviewed_at' => now()->toISOString(),
            ];

            $smsSetting->update([
                'enabled' => true,
                'provider' => 'kavenegar',
                'credentials' => [
                    'sender' => ($smsSetting->credentials['sender'] ?? '') ?: (SmsSenderRegistry::defaultSender() ?? ''),
                ],
                'templates' => [
                    ...$templates,
                    'v2' => $templatesV2,
                ],
            ]);
        });

        $this->provisionDefaultStoreSmsSettings($tenant, false);
    }

    public function provisionStorageSettings(Tenant $tenant, int $baseQuotaGb): void
    {
        $baseQuotaGb = TenantStorageSettings::normalizeQuotaGb($baseQuotaGb);
        $baseQuotaBytes = TenantStorageSettings::gbToBytes($baseQuotaGb);

        $tenant->run(function () use ($baseQuotaBytes): void {
            if (! Schema::hasTable('tenant_settings')) {
                return;
            }

            TenantSetting::query()->firstOrCreate(
                ['key' => TenantStorageSettings::KEY_USED_BYTES],
                [
                    'value' => 0,
                    'type' => 'integer',
                    'group' => 'storage',
                ],
            );

            TenantSetting::putValue(
                TenantStorageSettings::KEY_BASE_QUOTA_BYTES,
                $baseQuotaBytes,
                'integer',
                'storage',
            );

            TenantSetting::query()->firstOrCreate(
                ['key' => TenantStorageSettings::KEY_EXTRA_QUOTA_BYTES],
                [
                    'value' => 0,
                    'type' => 'integer',
                    'group' => 'storage',
                ],
            );
        });
    }

    public function provisionDefaultStoreSmsSettings(Tenant $tenant, bool $enableStoreSms = true): void
    {
        $tenant->run(function () use ($enableStoreSms): void {
            $general = GeneralSetting::query()->firstOrCreate([], [
                'timezone' => 'Asia/Tehran',
                'currency' => 'IRR',
                'booking_rules' => [],
            ]);

            $rules = $general->booking_rules ?? [];
            $rules['customer_mobile_confirmation_enabled'] = array_key_exists('customer_mobile_confirmation_enabled', $rules)
                ? (bool) $rules['customer_mobile_confirmation_enabled']
                : true;
            $rules['off_queue_booking_enabled'] = array_key_exists('off_queue_booking_enabled', $rules)
                ? (bool) $rules['off_queue_booking_enabled']
                : true;
            $storePage = is_array($rules['store_page'] ?? null) ? $rules['store_page'] : [];
            $storeSms = is_array($storePage['sms'] ?? null) ? $storePage['sms'] : [];
            $templates = StoreSmsTemplateRegistry::normalizeCollection(
                is_array($storeSms['templates_v2'] ?? null) ? $storeSms['templates_v2'] : [],
            );

            foreach (StoreSmsTemplateRegistry::definitions() as $templateKey => $definition) {
                $templates[$templateKey] = [
                    ...$templates[$templateKey],
                    'enabled' => (bool) $definition['default_enabled'],
                    'body' => (string) $definition['default_body'],
                    'approval_status' => (string) ($definition['default_body'] !== '' ? 'approved' : 'draft'),
                    'approved_body' => (string) $definition['default_body'],
                    'approved_enabled' => (bool) $definition['default_enabled'],
                    'rejection_reason' => null,
                    'submitted_at' => $definition['default_body'] !== ''
                        ? ($templates[$templateKey]['submitted_at'] ?? now()->toISOString())
                        : null,
                    'reviewed_at' => $definition['default_body'] !== '' ? now()->toISOString() : null,
                ];
            }

            $storeSms['enabled'] = $enableStoreSms ? true : (bool) ($storeSms['enabled'] ?? false);
            $storeSms['templates_v2'] = $templates;

            $legacyMap = [
                'template_after_order' => 'afterOrder',
                'template_after_approval' => 'afterApproval',
                'template_after_shipping_code' => 'afterShippingCode',
                'template_after_rejection' => 'afterRejection',
            ];

            foreach ($legacyMap as $legacyKey => $templateKey) {
                $storeSms[$legacyKey] = (string) ($templates[$templateKey]['body'] ?? '');
            }

            $storePage['sms'] = $storeSms;
            $rules['store_page'] = $storePage;

            $general->update([
                'booking_rules' => $rules,
            ]);
        });
    }

    public function applyPackageSmsCreditGift(Tenant $tenant, ?SubscriptionPackage $package, array $context = []): int
    {
        $giftAmount = max(0, (int) ($package?->sms_credit_gift_amount ?? 0));

        if ($giftAmount === 0) {
            return 0;
        }

        $tenant->run(function () use ($giftAmount): void {
            $smsSetting = SmsSetting::query()->firstOrCreate([], [
                'enabled' => true,
                'provider' => 'kavenegar',
                'credentials' => [
                    'sender' => SmsSenderRegistry::defaultSender() ?? '',
                ],
                'templates' => [],
            ]);

            $this->smsCreditService->addCredit($smsSetting, $giftAmount);
        });

        $this->financialLedgerService->recordSmsGiftExpense($giftAmount, [
            'source_type' => (string) ($context['source_type'] ?? 'tenant_sms_gift'),
            'source_id' => (string) ($context['source_id'] ?? $tenant->id),
            'tenant_id' => (string) ($context['tenant_id'] ?? $tenant->id),
            'title' => (string) ($context['title'] ?? 'هزینه شارژ هدیه پیامک'),
            'occurred_at' => $context['occurred_at'] ?? now(),
            'meta' => array_merge([
                'package_id' => $package?->id,
                'package_name' => $package?->name,
            ], is_array($context['meta'] ?? null) ? $context['meta'] : []),
        ]);

        return $giftAmount;
    }

    public function ensureCustomerExists(Tenant $tenant, string $mobile, ?string $name = null): TenantUser
    {
        return $tenant->run(function () use ($mobile, $name): TenantUser {
            Role::findOrCreate('customer', 'tenant_web');

            $tenantUser = TenantUser::query()->firstOrCreate(
                ['mobile' => $mobile],
                [
                    'name' => $name,
                    'role' => 'customer',
                    'is_active' => true,
                    'can_book' => true,
                ],
            );

            if ($tenantUser->role !== 'customer') {
                return $tenantUser;
            }

            $updates = [];

            if (! $tenantUser->name && $name) {
                $updates['name'] = $name;
            }

            if ($updates !== []) {
                $tenantUser->update($updates);
            }

            $tenantUser->syncRoles(['customer']);

            return $tenantUser->fresh() ?? $tenantUser;
        });
    }

    public function findTenantUser(Tenant $tenant, string $mobile): ?TenantUser
    {
        return $tenant->run(function () use ($mobile): ?TenantUser {
            return TenantUser::query()
                ->where('mobile', $mobile)
                ->where('is_active', true)
                ->first();
        });
    }

    public function updateTenantUserProfile(Tenant $tenant, TenantUser $tenantUser, array $attributes): TenantUser
    {
        return $tenant->run(function () use ($tenantUser, $attributes): TenantUser {
            $record = TenantUser::query()->findOrFail($tenantUser->id);
            $record->update($this->sanitizeProfileAttributes($attributes));

            return $record->fresh() ?? $record;
        });
    }

    public function syncCustomerIdentity(
        Tenant $tenant,
        string $currentMobile,
        string $nextMobile,
        string $name,
        array $profileAttributes = [],
    ): TenantUser {
        return $tenant->run(function () use ($currentMobile, $nextMobile, $name, $profileAttributes): TenantUser {
            return DB::transaction(function () use ($currentMobile, $nextMobile, $name, $profileAttributes): TenantUser {
                $currentTenantUser = TenantUser::query()
                    ->where('mobile', $currentMobile)
                    ->lockForUpdate()
                    ->first();

                if ($currentTenantUser && in_array($currentTenantUser->role, ['admin', 'barber'], true)) {
                    throw ValidationException::withMessages([
                        'userPhone' => 'امکان ویرایش شماره این نوع کاربر از این بخش وجود ندارد.',
                    ]);
                }

                $conflictTenantUser = TenantUser::query()
                    ->where('mobile', $nextMobile)
                    ->lockForUpdate()
                    ->first();

                if (
                    $conflictTenantUser
                    && (! $currentTenantUser || (int) $conflictTenantUser->id !== (int) $currentTenantUser->id)
                ) {
                    $conflictName = trim((string) ($conflictTenantUser->name ?: 'بدون نام'));

                    throw ValidationException::withMessages([
                        'userPhone' => "این شماره برای کاربر دیگر با نام {$conflictName} ثبت شده و امکان تغییر به این شماره وجود ندارد.",
                    ]);
                }

                $targetTenantUser = $currentTenantUser;
                $nextAttributes = array_merge([
                    'mobile' => $nextMobile,
                    'name' => $name,
                ], $this->sanitizeProfileAttributes($profileAttributes));

                if ($targetTenantUser) {
                    $targetTenantUser->update($nextAttributes);
                } else {
                    Role::findOrCreate('customer', 'tenant_web');

                    $targetTenantUser = TenantUser::query()->firstOrCreate(
                        ['mobile' => $nextMobile],
                        array_merge($nextAttributes, [
                            'role' => 'customer',
                            'is_active' => true,
                            'can_book' => true,
                        ]),
                    );

                    $targetTenantUser->update($nextAttributes);
                    $targetTenantUser->syncRoles(['customer']);
                }

                $targetCustomer = Customer::query()
                    ->where('phone', $nextMobile)
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->first();

                if (! $targetCustomer) {
                    $targetCustomer = Customer::query()->create([
                        'name' => $name,
                        'phone' => $nextMobile,
                    ]);
                } else {
                    $targetCustomer->update([
                        'name' => $name,
                    ]);
                }

                Appointment::query()
                    ->where('customer_phone_snapshot', $currentMobile)
                    ->update([
                        'customer_id' => $targetCustomer->id,
                        'customer_phone_snapshot' => $nextMobile,
                        'customer_name_snapshot' => $name,
                    ]);

                AppointmentPayment::query()
                    ->where('customer_phone_snapshot', $currentMobile)
                    ->update([
                        'customer_phone_snapshot' => $nextMobile,
                        'customer_name_snapshot' => $name,
                    ]);

                Customer::query()
                    ->where('phone', $currentMobile)
                    ->whereKeyNot($targetCustomer->id)
                    ->delete();

                $targetCustomer->update([
                    'name' => $name,
                    'phone' => $nextMobile,
                ]);

                return $targetTenantUser->fresh() ?? $targetTenantUser;
            });
        });
    }

    public function getRegistrationRequirements(Tenant $tenant): array
    {
        return $tenant->run(function (): array {
            $general = GeneralSetting::query()->first();
            $bookingRules = $general?->booking_rules ?? [];

            return TenantMembershipProfile::normalizeRequirements($bookingRules['registration_requirements'] ?? []);
        });
    }

    private function sanitizeProfileAttributes(array $attributes): array
    {
        return array_filter($attributes, static fn (string $key) => in_array($key, [
            'name',
            'mobile',
            'email',
            'gender',
            'national_code',
            'birth_date',
            'province_id',
            'province_name',
            'city_id',
            'city_name',
            'job_title',
        ], true), ARRAY_FILTER_USE_KEY);
    }
}
