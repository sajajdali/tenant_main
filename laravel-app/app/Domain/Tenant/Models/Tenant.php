<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use App\Domain\Landing\Models\LandingOrder;
use App\Domain\Landing\Models\SiteProvisionRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Arr;
use Stancl\Tenancy\Contracts\TenantWithDatabase;
use Stancl\Tenancy\Database\Concerns\HasDatabase;
use Stancl\Tenancy\Database\Concerns\HasDomains;
use Stancl\Tenancy\Database\Models\Tenant as BaseTenant;

class Tenant extends BaseTenant implements TenantWithDatabase
{
    use HasDatabase;
    use HasDomains;

    protected $fillable = [
        'id',
        'name',
        'slug',
        'database',
        'status',
        'owner_user_id',
        'subscription_package_id',
        'audience_type_id',
        'support_ends_at',
        'domain_management_mode',
        'managed_domain_tld',
        'managed_domain_registered',
        'managed_domain_registered_at',
        'managed_domain_last_paid_at',
        'managed_domain_renews_at',
        'managed_domain_amount',
        'ir_domain_registered',
        'ir_domain_registered_at',
        'ir_domain_last_paid_at',
        'ir_domain_renews_at',
        'ir_domain_amount',
        'payment_overrides',
        'demo_bar',
        'data',
    ];

    protected $casts = [
        'data' => 'array',
        'support_ends_at' => 'date',
        'managed_domain_registered' => 'boolean',
        'managed_domain_registered_at' => 'date',
        'managed_domain_last_paid_at' => 'date',
        'managed_domain_renews_at' => 'date',
        'managed_domain_amount' => 'integer',
        'ir_domain_registered' => 'boolean',
        'ir_domain_registered_at' => 'date',
        'ir_domain_last_paid_at' => 'date',
        'ir_domain_renews_at' => 'date',
        'ir_domain_amount' => 'integer',
    ];

    protected static function booted(): void
    {
        static::saving(function (self $tenant): void {
            $tenant->setInternal('db_name', $tenant->database);
            $tenant->setInternal('db_connection', 'tenant_template');
        });
    }

    public static function getCustomColumns(): array
    {
        return [
            'id',
            'name',
            'slug',
            'database',
            'status',
            'owner_user_id',
            'subscription_package_id',
            'audience_type_id',
            'support_ends_at',
            'domain_management_mode',
            'managed_domain_tld',
            'managed_domain_registered',
            'managed_domain_registered_at',
            'managed_domain_last_paid_at',
            'managed_domain_renews_at',
            'managed_domain_amount',
            'ir_domain_registered',
            'ir_domain_registered_at',
            'ir_domain_last_paid_at',
            'ir_domain_renews_at',
            'ir_domain_amount',
            'data',
            'created_at',
            'updated_at',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function subscriptionPackage(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPackage::class, 'subscription_package_id');
    }

    public function audienceType(): BelongsTo
    {
        return $this->belongsTo(AudienceType::class, 'audience_type_id');
    }

    public function subscriptionRenewals(): HasMany
    {
        return $this->hasMany(TenantSubscriptionRenewal::class, 'tenant_id')->latest();
    }

    public function featureModules(): HasMany
    {
        return $this->hasMany(TenantFeatureModule::class, 'tenant_id');
    }

    public function landingOrders(): HasMany
    {
        return $this->hasMany(LandingOrder::class, 'tenant_id');
    }

    public function siteProvisionRequests(): HasMany
    {
        return $this->hasMany(SiteProvisionRequest::class, 'tenant_id');
    }

    public function isPanelAccessLocked(): bool
    {
        return (bool) $this->tenantMetaValue('panel_access_locked', false);
    }

    public function panelAccessMessage(): string
    {
        $message = trim((string) $this->tenantMetaValue('panel_access_message', ''));

        return $message !== '' ? $message : self::defaultPanelAccessLockMessage();
    }

    public static function defaultPanelAccessLockMessage(): string
    {
        return __('auth.admin_login.access_locked_message');
    }

    public function paymentSandboxOverride(): ?bool
    {
        if (! $this->tenantMetaHas('sandbox_overrides.payment_enabled')) {
            return null;
        }

        $value = $this->tenantMetaValue('sandbox_overrides.payment_enabled');

        if ($value === null || $value === false || $value === 0 || $value === '0') {
            return null;
        }

        return true;
    }

    public function smsSandboxOverride(): ?bool
    {
        if (! $this->tenantMetaHas('sandbox_overrides.sms_enabled')) {
            return null;
        }

        $value = $this->tenantMetaValue('sandbox_overrides.sms_enabled');

        if ($value === null || $value === false || $value === 0 || $value === '0') {
            return null;
        }

        return true;
    }

    public function sandboxOverrideNote(): ?string
    {
        $note = trim((string) $this->tenantMetaValue('sandbox_overrides.note', ''));

        return $note !== '' ? $note : null;
    }

    public function usesCentralMaliartGateway(): bool
    {
        return (bool) $this->tenantMetaValue('payment_overrides.maliart_enabled', false);
    }

    public function demoFixedLoginCode(): ?string
    {
        $code = trim((string) $this->tenantMetaValue('demo_auth.fixed_login_code', ''));

        return preg_match('/^\d{4}$/', $code) ? $code : null;
    }

    public function demoBarSettings(): array
    {
        $settings = $this->tenantMetaValue('demo_bar', []);

        return is_array($settings) ? $settings : [];
    }

    private function tenantMetaValue(string $key, mixed $default = null): mixed
    {
        $data = $this->tenantMetaPayload();

        return data_get($data, $key, $default);
    }

    private function tenantMetaHas(string $key): bool
    {
        return Arr::has($this->tenantMetaPayload(), $key);
    }

    private function tenantMetaPayload(): array
    {
        $attributes = $this->getAttributes();
        $payload = [];

        foreach ([
            'panel_access_locked',
            'panel_access_message',
            'panel_access_locked_at',
            'panel_access_locked_by_user_id',
            'panel_access_last_changed_at',
            'panel_access_last_changed_by_user_id',
            'sandbox_overrides',
            'payment_overrides',
            'demo_bar',
        ] as $key) {
            if (array_key_exists($key, $attributes)) {
                $payload[$key] = $this->getAttribute($key);
            }
        }

        $rawData = $this->getRawOriginal('data');

        if (is_string($rawData) && $rawData !== '') {
            $decoded = json_decode($rawData, true);

            if (is_array($decoded)) {
                $payload = array_replace_recursive($decoded, $payload);
            }
        } elseif (is_array($rawData)) {
            $payload = array_replace_recursive($rawData, $payload);
        } elseif (is_array($this->data)) {
            $payload = array_replace_recursive($this->data, $payload);
        }

        return $payload;
    }
}
