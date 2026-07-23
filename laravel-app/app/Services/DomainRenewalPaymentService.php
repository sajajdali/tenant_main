<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Landing\Models\DomainTldPrice;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantSubscriptionPayment;
use App\Models\SystemSetting;
use App\Services\Payments\MaliartTenantPaymentService;
use App\Support\DomainTldCatalog;
use App\Support\TenantManagedDomain;
use App\Support\TenantPaymentGateways;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Shetabit\Multipay\Exceptions\InvalidPaymentException;
use Shetabit\Multipay\Invoice;
use Shetabit\Payment\Facade\Payment;

class DomainRenewalPaymentService
{
    public function __construct(private readonly MaliartTenantPaymentService $maliart)
    {
    }

    public function settings(?Tenant $tenant = null): array
    {
        $raw = array_merge([
            'enabled' => false,
            'sandbox_enabled' => true,
            'provider' => 'zarinpal',
        ], SystemSetting::getValue('support_payment'));

        $gateways = TenantPaymentGateways::normalized($raw['gateways'] ?? []);

        if (($raw['zarinpal_merchant_id'] ?? '') !== '' && blank($gateways['zarinpal']['merchantId'] ?? '')) {
            $gateways['zarinpal']['merchantId'] = (string) $raw['zarinpal_merchant_id'];
            $gateways['zarinpal']['enabled'] = true;
        }

        $enabledGateways = TenantPaymentGateways::configuredEnabled($gateways);
        $maliartEnabled = $this->maliart->enabled();
        $provider = (string) ($raw['provider'] ?? ($enabledGateways[0] ?? 'zarinpal'));
        if (! in_array($provider, TenantPaymentGateways::supportedKeys(), true)) {
            $provider = $enabledGateways[0] ?? 'zarinpal';
        }

        return [
            'enabled' => $maliartEnabled || (bool) ($raw['enabled'] ?? false),
            'sandbox_enabled' => $maliartEnabled ? false : (bool) ($raw['sandbox_enabled'] ?? false),
            'provider' => $maliartEnabled ? 'maliart' : $provider,
            'gateways' => $gateways,
            'enabled_gateways' => $maliartEnabled ? [] : $enabledGateways,
            'maliart_enabled' => $maliartEnabled,
        ];
    }

    public function overview(Tenant $tenant): array
    {
        DomainTldCatalog::ensureSeeded();
        $summary = TenantManagedDomain::summary($tenant);
        $settings = $this->settings($tenant);

        return [
            'settings' => [
                'enabled' => (bool) $settings['enabled'],
                'sandboxEnabled' => (bool) $settings['sandbox_enabled'],
                'provider' => $settings['provider'] ?? 'zarinpal',
                'enabledGateways' => $settings['enabled_gateways'] ?? [],
                'maliartEnabled' => (bool) ($settings['maliart_enabled'] ?? false),
                'gatewayOptions' => collect(TenantPaymentGateways::definitions())
                    ->map(fn (array $item, string $key): array => [
                        'key' => $key,
                        'label' => (string) ($item['label'] ?? $key),
                    ])
                    ->values()
                    ->all(),
            ],
            'domain' => $summary,
            'availableTlds' => DomainTldPrice::query()
                ->where('is_active', true)
                ->orderByRaw("CASE WHEN tld = '.ir' THEN 0 ELSE 1 END")
                ->orderBy('tld')
                ->get()
                ->map(fn (DomainTldPrice $item): array => [
                    'tld' => (string) $item->tld,
                    'label' => trim((string) ($item->meta_json['label'] ?? '')) ?: (string) $item->tld,
                    'registerAmount' => (int) $item->register_price_amount,
                    'renewAmount' => (int) $item->renew_price_amount,
                ])
                ->values()
                ->all(),
        ];
    }

    public function createPayment(Tenant $tenant, array $actor, string $callbackUrl, ?string $gateway = null): array
    {
        $summary = TenantManagedDomain::summary($tenant);

        if (($summary['selfManaged'] ?? false) === true) {
            throw new RuntimeException('این سامانه از دامنه شخصی استفاده می‌کند و پرداخت تمدید دامنه برای آن غیرفعال است.');
        }

        if (($summary['enabled'] ?? false) !== true) {
            throw new RuntimeException('برای این سامانه هنوز دامنه قابل تمدید ثبت نشده است.');
        }

        if (($summary['renewalAvailable'] ?? false) !== true) {
            throw new RuntimeException((string) ($summary['renewalBlockedReason'] ?? 'هنوز زمان تمدید دامنه فرا نرسیده است.'));
        }

        $settings = $this->settings($tenant);

        if (! $settings['enabled'] && ! $settings['sandbox_enabled']) {
            throw new RuntimeException('پرداخت تمدید دامنه در حال حاضر فعال نیست.');
        }

        $tld = (string) ($summary['tld'] ?? '.ir');
        $amount = $this->renewAmountFor($tenant, $tld);
        $previousRenewsAt = $summary['renewsAt'] ?? null;
        $nextRenewDate = $this->nextRenewDate($previousRenewsAt);
        $primaryDomain = $tenant->domains()->first()?->domain;

        $payment = TenantSubscriptionPayment::query()->create([
            'tenant_id' => $tenant->id,
            'payment_type' => 'domain_renewal',
            'subscription_package_id' => null,
            'status' => 'pending',
            'gateway' => $settings['sandbox_enabled'] ? 'sandbox' : $this->resolveGatewaySelection($settings, $gateway),
            'invoice_number' => $this->makeInvoiceNumber(),
            'amount' => $amount,
            'discount_amount' => 0,
            'payable_amount' => $amount,
            'sandbox_mode' => (bool) $settings['sandbox_enabled'],
            'initiated_by_tenant_user_id' => (string) ($actor['id'] ?? ''),
            'initiated_by_name' => $actor['name'] ?? null,
            'initiated_by_mobile' => $actor['mobile'] ?? null,
            'initiated_by_role' => $actor['role'] ?? null,
            'previous_support_ends_at' => null,
            'new_support_ends_at' => null,
            'expires_at' => now()->addMinutes(30),
            'metadata' => [
                'domain_tld' => $tld,
                'domain_name' => $primaryDomain,
                'domain_label' => $summary['label'] ?? "دامنه {$tld}",
                'previous_domain_renews_at' => $previousRenewsAt,
                'new_domain_renews_at' => $nextRenewDate,
                'counts_as_revenue' => true,
            ],
        ]);

        $payment->items()->create([
            'item_type' => 'domain_renewal',
            'title' => 'تمدید دامنه '.$tld,
            'description' => $primaryDomain ? "تمدید دامنه {$primaryDomain}" : "تمدید دامنه {$tld}",
            'quantity' => 1,
            'unit_amount' => $amount,
            'amount' => $amount,
            'discount_amount' => 0,
            'payable_amount' => $amount,
            'metadata' => [
                'domain_tld' => $tld,
                'domain_name' => $primaryDomain,
            ],
        ]);

        if ($settings['sandbox_enabled']) {
            $this->markPaymentSuccessful($payment, 'sandbox-'.Str::upper(Str::random(10)));

            return [
                'mode' => 'sandbox',
                'payment' => $payment->fresh(['items']),
            ];
        }

        return array_merge(
            ['payment' => $payment->fresh(['items'])],
            $this->startGatewayPayment(
                payment: $payment,
                settings: $settings,
                callbackUrlTemplate: $callbackUrl,
                description: 'تمدید دامنه '.$tld.' برای '.$tenant->name,
                mobile: (string) ($actor['mobile'] ?? ''),
            ),
        );
    }

    public function verifyPayment(Tenant $tenant, TenantSubscriptionPayment $payment): TenantSubscriptionPayment
    {
        abort_if((string) $payment->tenant_id !== (string) $tenant->id, 404);

        if ($payment->status === 'paid') {
            return $payment;
        }

        if ((string) $payment->gateway === 'maliart') {
            return $this->markPaymentSuccessful($payment, $this->maliart->verifiedReference($payment));
        }

        $settings = $this->settings($tenant);
        $gateway = (string) ($payment->gateway ?: $settings['provider']);
        $gatewaySettings = $settings['gateways'][$gateway] ?? null;
        $transactionId = (string) ($payment->authority ?? '');

        if (! $gatewaySettings || blank($transactionId)) {
            throw new RuntimeException('اطلاعات پرداخت برای تایید کافی نیست.');
        }

        try {
            $receipt = Payment::via($gateway)
                ->config(TenantPaymentGateways::driverConfig($gateway, $gatewaySettings, ''))
                ->amount((int) $payment->payable_amount)
                ->transactionId($transactionId)
                ->verify();
        } catch (InvalidPaymentException $exception) {
            $payment->update([
                'status' => 'failed',
                'failure_reason' => $exception->getMessage(),
            ]);

            throw $exception;
        }

        return $this->markPaymentSuccessful($payment, (string) $receipt->getReferenceId());
    }

    public function markPaymentCancelled(TenantSubscriptionPayment $payment, ?string $reason = null): void
    {
        if ($payment->status === 'paid') {
            return;
        }

        $payment->update([
            'status' => 'cancelled',
            'failure_reason' => $reason,
        ]);
    }

    public function serializePayment(TenantSubscriptionPayment $payment): array
    {
        $meta = is_array($payment->metadata) ? $payment->metadata : [];

        return [
            'id' => (string) $payment->id,
            'invoiceNumber' => $payment->invoice_number,
            'paymentType' => $payment->payment_type,
            'status' => $payment->status,
            'gateway' => $payment->gateway,
            'amount' => (int) $payment->amount,
            'discountAmount' => (int) $payment->discount_amount,
            'payableAmount' => (int) $payment->payable_amount,
            'sandboxMode' => (bool) $payment->sandbox_mode,
            'referenceId' => $payment->reference_id,
            'domainTld' => $meta['domain_tld'] ?? null,
            'domainName' => $meta['domain_name'] ?? null,
            'domainLabel' => $meta['domain_label'] ?? null,
            'previousRenewsAt' => $meta['previous_domain_renews_at'] ?? null,
            'newRenewsAt' => $meta['new_domain_renews_at'] ?? null,
            'paidAt' => $payment->paid_at?->toIso8601String(),
            'createdAt' => $payment->created_at?->toIso8601String(),
            'initiatedByName' => $payment->initiated_by_name,
            'initiatedByMobile' => $payment->initiated_by_mobile,
            'failureReason' => $payment->failure_reason,
        ];
    }

    private function renewAmountFor(Tenant $tenant, string $tld): int
    {
        $stored = (int) ($tenant->managed_domain_amount ?? 0);
        if ($stored > 0) {
            return $stored;
        }

        return (int) (DomainTldPrice::query()
            ->where('tld', $tld)
            ->where('is_active', true)
            ->value('renew_price_amount') ?? 0);
    }

    private function nextRenewDate(?string $currentDate): string
    {
        $baseDate = $currentDate && now()->parse($currentDate)->isFuture()
            ? now()->parse($currentDate)
            : now();

        return $baseDate->copy()->addYear()->toDateString();
    }

    private function markPaymentSuccessful(TenantSubscriptionPayment $payment, string $referenceId): TenantSubscriptionPayment
    {
        return DB::connection('central')->transaction(function () use ($payment, $referenceId): TenantSubscriptionPayment {
            $lockedPayment = TenantSubscriptionPayment::query()->lockForUpdate()->findOrFail($payment->id);

            if ($lockedPayment->status === 'paid') {
                return $lockedPayment;
            }

            /** @var Tenant $tenant */
            $tenant = Tenant::query()->findOrFail($lockedPayment->tenant_id);
            $meta = is_array($lockedPayment->metadata) ? $lockedPayment->metadata : [];
            $tld = (string) ($meta['domain_tld'] ?? ($tenant->managed_domain_tld ?: '.ir'));
            $newRenewsAt = (string) ($meta['new_domain_renews_at'] ?? $this->nextRenewDate($tenant->managed_domain_renews_at?->toDateString()));

            $tenant->update([
                'domain_management_mode' => 'platform_managed',
                'managed_domain_tld' => $tld,
                'managed_domain_registered' => true,
                'managed_domain_registered_at' => $tenant->managed_domain_registered_at?->toDateString() ?? now()->toDateString(),
                'managed_domain_last_paid_at' => now()->toDateString(),
                'managed_domain_renews_at' => $newRenewsAt,
                'managed_domain_amount' => (int) $lockedPayment->payable_amount,
            ]);

            if ($tld === '.ir') {
                $tenant->update([
                    'ir_domain_registered' => true,
                    'ir_domain_registered_at' => $tenant->ir_domain_registered_at?->toDateString() ?? now()->toDateString(),
                    'ir_domain_last_paid_at' => now()->toDateString(),
                    'ir_domain_renews_at' => $newRenewsAt,
                    'ir_domain_amount' => (int) $lockedPayment->payable_amount,
                ]);
            }

            $lockedPayment->update([
                'status' => 'paid',
                'reference_id' => $referenceId,
                'paid_at' => now(),
            ]);

            return $lockedPayment->fresh(['items']);
        });
    }

    private function makeInvoiceNumber(): string
    {
        return 'DOM-'.now()->format('YmdHis').'-'.Str::upper(Str::random(6));
    }

    private function resolveGatewaySelection(array $settings, ?string $gateway): string
    {
        if (($settings['maliart_enabled'] ?? false) === true) {
            return 'maliart';
        }

        $requested = trim((string) ($gateway ?? ''));
        $enabledGateways = $settings['enabled_gateways'] ?? [];
        $defaultProvider = (string) ($settings['provider'] ?? '');
        $selected = $requested !== '' ? $requested : $defaultProvider;

        if (! in_array($selected, $enabledGateways, true)) {
            throw new RuntimeException('درگاه انتخاب‌شده برای تمدید دامنه فعال یا کامل نیست.');
        }

        return $selected;
    }

    private function startGatewayPayment(
        TenantSubscriptionPayment $payment,
        array $settings,
        string $callbackUrlTemplate,
        string $description,
        string $mobile,
    ): array {
        $gateway = (string) ($payment->gateway ?? '');

        if ($gateway === 'maliart') {
            return $this->maliart->start($payment, tenant(), $callbackUrlTemplate, $description, $mobile);
        }

        $gatewaySettings = $settings['gateways'][$gateway] ?? null;

        if (! $gatewaySettings) {
            throw new RuntimeException('تنظیمات درگاه پرداخت دامنه کامل نیست.');
        }

        $callbackUrl = str_replace(['{payment}', '__PAYMENT__'], (string) $payment->id, $callbackUrlTemplate);
        $invoice = (new Invoice())
            ->amount((int) $payment->payable_amount)
            ->detail('description', $description)
            ->detail('mobile', $mobile);

        $paymentManager = Payment::via($gateway)
            ->config(TenantPaymentGateways::driverConfig($gateway, $gatewaySettings, $callbackUrl))
            ->callbackUrl($callbackUrl);

        $paymentManager->purchase($invoice, function ($driver, $transactionId) use ($payment): void {
            $payment->update([
                'authority' => (string) $transactionId,
            ]);
        });

        $redirectForm = $paymentManager->pay()->jsonSerialize();
        $paymentUrl = is_array($redirectForm) ? (string) ($redirectForm['action'] ?? '') : '';

        return [
            'mode' => 'gateway',
            'paymentUrl' => $paymentUrl !== '' ? $paymentUrl : null,
            'redirectForm' => $redirectForm,
        ];
    }
}
