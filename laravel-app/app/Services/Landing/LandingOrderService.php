<?php

declare(strict_types=1);

namespace App\Services\Landing;

use App\Domain\Landing\Models\DomainTldPrice;
use App\Domain\Landing\Models\LandingCustomer;
use App\Domain\Landing\Models\LandingOrder;
use App\Domain\Landing\Models\LandingSite;
use App\Domain\Tenant\Models\AudienceType;
use App\Domain\Tenant\Models\SubscriptionPackage;
use App\Domain\Tenant\Models\Tenant;
use App\Models\User;
use App\Services\TenantProvisioningService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LandingOrderService
{
    public function __construct(
        private readonly LandingCheckoutPricingService $pricingService,
        private readonly LandingDomainAvailabilityService $domainAvailabilityService,
        private readonly TenantProvisioningService $tenantProvisioningService,
    ) {
    }

    public function createAwaitingApprovalOrder(
        LandingCustomer $customer,
        AudienceType $audienceType,
        SubscriptionPackage $subscriptionPackage,
        array $payload,
        ?LandingSite $landingSite = null,
    ): LandingOrder {
        $order = $this->createPendingPaymentOrder($customer, $audienceType, $subscriptionPackage, $payload, $landingSite);

        return $this->markPaid($order);
    }

    public function createPendingPaymentOrder(
        LandingCustomer $customer,
        AudienceType $audienceType,
        SubscriptionPackage $subscriptionPackage,
        array $payload,
        ?LandingSite $landingSite = null,
    ): LandingOrder {
        [$requestedDomain, $domainInspection, $pricing, $notes, $usesOwnDomain] = $this->resolveDraftContext(
            $audienceType,
            $subscriptionPackage,
            $payload,
            $landingSite,
        );

        /** @var LandingOrder $order */
        $order = DB::transaction(function () use (
            $customer,
            $audienceType,
            $subscriptionPackage,
            $requestedDomain,
            $domainInspection,
            $pricing,
            $notes,
            $payload,
            $usesOwnDomain
        ): LandingOrder {
            $discountMeta = is_array($payload['discount'] ?? null) ? $payload['discount'] : null;
            $order = LandingOrder::query()->create([
                'order_number' => $this->makeOrderNumber(),
                'landing_customer_id' => $customer->id,
                'landing_site_id' => $payload['landing_site_id'] ?? null,
                'audience_type_id' => $audienceType->id,
                'subscription_package_id' => $subscriptionPackage->id,
                'requested_domain' => $requestedDomain,
                'requested_domain_tld' => $pricing['domainTld'],
                'requested_domain_whois_status' => (string) ($domainInspection['status'] ?? ($usesOwnDomain ? 'self_provided' : 'pending')),
                'requested_domain_checked_at' => $domainInspection !== null ? now() : null,
                'requested_domain_whois_payload' => $domainInspection['payload'] ?? null,
                'duration_days' => (int) $pricing['durationDays'],
                'requested_user_limit' => $pricing['userLimit'],
                'package_price_amount' => (int) $pricing['packageAmount'],
                'setup_fee_amount' => (int) $pricing['setupAmount'],
                'domain_price_amount' => (int) $pricing['domainAmount'],
                'discount_amount' => (int) $pricing['discountAmount'] + (int) ($discountMeta['discountAmount'] ?? 0),
                'subtotal_amount' => (int) $pricing['subtotalAmount'],
                'total_amount' => max(0, (int) $pricing['totalAmount'] - (int) ($discountMeta['discountAmount'] ?? 0)),
                'currency' => (string) $pricing['currency'],
                'status' => LandingOrder::STATUS_PENDING_PAYMENT,
                'customer_full_name' => $customer->full_name ?: trim(implode(' ', array_filter([$customer->first_name, $customer->last_name]))),
                'customer_mobile' => $customer->mobile,
                'customer_email' => $customer->email,
                'customer_gender' => $customer->gender,
                'customer_national_code' => $customer->national_code,
                'customer_birth_date' => $customer->birth_date,
                'customer_province_name' => $customer->province_name,
                'customer_city_name' => $customer->city_name,
                'customer_address_line' => $customer->address_line,
                'notes' => $notes !== '' ? $notes : null,
                'meta_json' => [
                    'pricing' => $pricing,
                    'customer_profile' => [
                        'firstName' => $customer->first_name,
                        'lastName' => $customer->last_name,
                        'postalCode' => $customer->postal_code,
                    ],
                    'requested_payload' => $payload,
                    'usesOwnDomain' => $usesOwnDomain,
                    'discount' => $discountMeta,
                ],
            ]);

            foreach ($this->makeLineItems($audienceType, $subscriptionPackage, $pricing, $requestedDomain, $usesOwnDomain) as $item) {
                $order->items()->create($item);
            }

            $order->provisionRequest()->create([
                'landing_customer_id' => $customer->id,
                'status' => 'pending',
                'requested_domain' => $requestedDomain,
                'requested_domain_tld' => $pricing['domainTld'],
                'requested_package_name' => $subscriptionPackage->name,
                'requested_duration_days' => (int) $pricing['durationDays'],
                'requested_user_limit' => $pricing['userLimit'],
                'customer_note' => $notes !== '' ? $notes : null,
                'requested_payload' => [
                    'customer' => [
                        'id' => $customer->id,
                        'fullName' => $customer->full_name,
                        'mobile' => $customer->mobile,
                        'email' => $customer->email,
                        'nationalCode' => $customer->national_code,
                    ],
                    'audience' => [
                        'id' => $audienceType->id,
                        'name' => $audienceType->name,
                    ],
                    'package' => [
                        'id' => $subscriptionPackage->id,
                        'name' => $subscriptionPackage->name,
                        'durationDays' => $subscriptionPackage->duration_days,
                        'userLimit' => $subscriptionPackage->user_limit,
                    ],
                    'pricing' => $pricing,
                    'usesOwnDomain' => $usesOwnDomain,
                    'discount' => $discountMeta,
                ],
            ]);

            return $order->fresh(['items', 'provisionRequest', 'customer', 'audienceType', 'subscriptionPackage']);
        });

        return $order;
    }

    public function markPaid(LandingOrder $order, array $paymentMeta = []): LandingOrder
    {
        $order->loadMissing(['provisionRequest', 'customer', 'audienceType', 'subscriptionPackage', 'items']);
        $meta = (array) ($order->meta_json ?? []);
        $meta['payment'] = array_merge((array) ($meta['payment'] ?? []), $paymentMeta);

        $order->update([
            'status' => LandingOrder::STATUS_AWAITING_APPROVAL,
            'provision_requested_at' => $order->provision_requested_at ?: now(),
            'meta_json' => $meta,
        ]);

        if ($order->provisionRequest) {
            $requestedPayload = is_array($order->provisionRequest->requested_payload)
                ? $order->provisionRequest->requested_payload
                : [];
            $requestedPayload['payment'] = $paymentMeta;

            $order->provisionRequest->update([
                'status' => 'pending',
                'requested_payload' => $requestedPayload,
            ]);
        }

        return $order->fresh(['items', 'provisionRequest', 'customer', 'audienceType', 'subscriptionPackage', 'payments']);
    }

    public function attachProvisionedTenant(LandingOrder $order, int|string $tenantId, ?User $approvedBy = null): LandingOrder
    {
        $order->loadMissing('tenant');

        $order->update([
            'tenant_id' => $tenantId,
            'approved_by_user_id' => $approvedBy?->id,
            'approved_at' => $approvedBy ? now() : $order->approved_at,
            'provisioned_at' => now(),
            'status' => LandingOrder::STATUS_PROVISIONED,
        ]);

        if ($order->provisionRequest()->exists()) {
            $order->provisionRequest()->update([
                'tenant_id' => $tenantId,
                'assigned_to_user_id' => $approvedBy?->id,
                'approved_at' => $approvedBy ? now() : null,
                'completed_at' => now(),
                'status' => 'completed',
            ]);
        }

        $this->applySmsCreditGiftIfNeeded($order, $tenantId);
        $this->syncManagedDomainRenewalIfNeeded($order, $tenantId);

        return $order->fresh(['provisionRequest', 'tenant']);
    }

    public function completeOrder(
        LandingOrder $order,
        LandingCustomer $customer,
        array $payload,
    ): LandingOrder {
        $usesOwnDomain = (bool) ($payload['use_own_domain'] ?? data_get($order->meta_json, 'usesOwnDomain', false));
        $requestedDomain = $this->domainAvailabilityService->normalizeDomain((string) ($payload['requested_domain'] ?? ''));
        $domainInspection = null;
        $domainStatus = $usesOwnDomain ? 'self_provided' : $order->requested_domain_whois_status;

        if ($requestedDomain !== '' && ! $usesOwnDomain) {
            $domainInspection = $this->domainAvailabilityService->inspect($requestedDomain);
            $domainStatus = (string) ($domainInspection['status'] ?? 'pending');
        }

        return DB::transaction(function () use ($order, $customer, $requestedDomain, $domainInspection, $domainStatus, $usesOwnDomain): LandingOrder {
            $meta = (array) ($order->meta_json ?? []);
            $meta['completionSubmittedAt'] = now()->toIso8601String();
            $meta['usesOwnDomain'] = $usesOwnDomain;

            $order->update([
                'requested_domain' => $requestedDomain !== '' ? $requestedDomain : null,
                'requested_domain_tld' => $requestedDomain !== '' ? $this->domainAvailabilityService->extractTld($requestedDomain) : $order->requested_domain_tld,
                'requested_domain_whois_status' => $requestedDomain !== '' ? $domainStatus : $order->requested_domain_whois_status,
                'requested_domain_checked_at' => $domainInspection !== null ? now() : $order->requested_domain_checked_at,
                'requested_domain_whois_payload' => $domainInspection['payload'] ?? $order->requested_domain_whois_payload,
                'customer_full_name' => $customer->full_name ?: trim(implode(' ', array_filter([$customer->first_name, $customer->last_name]))),
                'customer_mobile' => $customer->mobile,
                'customer_email' => $customer->email,
                'customer_gender' => $customer->gender,
                'customer_national_code' => $customer->national_code,
                'customer_birth_date' => $customer->birth_date,
                'customer_province_name' => $customer->province_name,
                'customer_city_name' => $customer->city_name,
                'customer_address_line' => $customer->address_line,
                'meta_json' => $meta,
            ]);

            $provisionRequest = $order->provisionRequest()->first();

            if ($provisionRequest) {
                $requestedPayload = is_array($provisionRequest->requested_payload) ? $provisionRequest->requested_payload : [];
                $requestedPayload['customer'] = array_merge((array) ($requestedPayload['customer'] ?? []), [
                    'id' => $customer->id,
                    'fullName' => $customer->full_name,
                    'mobile' => $customer->mobile,
                    'email' => $customer->email,
                    'nationalCode' => $customer->national_code,
                    'gender' => $customer->gender,
                    'provinceName' => $customer->province_name,
                    'cityName' => $customer->city_name,
                    'addressLine' => $customer->address_line,
                ]);
                $requestedPayload['usesOwnDomain'] = $usesOwnDomain;
                $requestedPayload['requestedDomain'] = $requestedDomain !== '' ? $requestedDomain : null;

                $provisionRequest->update([
                    'requested_domain' => $requestedDomain !== '' ? $requestedDomain : null,
                    'requested_domain_tld' => $requestedDomain !== '' ? $this->domainAvailabilityService->extractTld($requestedDomain) : $provisionRequest->requested_domain_tld,
                    'requested_payload' => $requestedPayload,
                ]);
            }

            return $order->fresh(['items', 'payments', 'subscriptionPackage', 'provisionRequest']);
        });
    }

    private function makeOrderNumber(): string
    {
        do {
            $number = 'LD-'.now()->format('Ymd').'-'.Str::upper(Str::random(6));
        } while (LandingOrder::query()->where('order_number', $number)->exists());

        return $number;
    }

    /**
     * @return array{0:?string,1:?array,2:array,3:string,4:bool}
     */
    private function resolveDraftContext(
        AudienceType $audienceType,
        SubscriptionPackage $subscriptionPackage,
        array $payload,
        ?LandingSite $landingSite = null,
    ): array {
        $notes = trim((string) ($payload['notes'] ?? ''));
        $usesOwnDomain = (bool) ($payload['use_own_domain'] ?? false);
        $requestedDomain = $this->domainAvailabilityService->normalizeDomain((string) ($payload['requested_domain'] ?? ''));
        $quotedDomain = $usesOwnDomain ? null : ($requestedDomain !== '' ? $requestedDomain : null);
        $domainInspection = null;

        if ($usesOwnDomain) {
            $requestedDomain = $requestedDomain !== '' ? $requestedDomain : null;
        } else {
            if ($requestedDomain !== '') {
                $domainInspection = $this->domainAvailabilityService->inspect($requestedDomain);

                if (! $domainInspection['available']) {
                    throw ValidationException::withMessages([
                        'requested_domain' => (string) ($domainInspection['message'] ?? 'امکان ثبت این دامنه وجود ندارد.'),
                    ]);
                }
            }

            $requestedDomain = $requestedDomain !== '' ? $requestedDomain : null;
        }

        $pricing = $this->pricingService->quote($audienceType, $subscriptionPackage, $quotedDomain, $landingSite);

        if ($usesOwnDomain) {
            $pricing['domainAmount'] = 0;
            $pricing['subtotalAmount'] = (int) $pricing['packageAmount'] + (int) $pricing['setupAmount'];
            $pricing['totalAmount'] = max(0, (int) $pricing['subtotalAmount']);
            $pricing['domainTld'] = $requestedDomain !== null
                ? $this->domainAvailabilityService->extractTld($requestedDomain)
                : null;
        }

        return [$requestedDomain, $domainInspection, $pricing, $notes, $usesOwnDomain];
    }

    private function makeLineItems(
        AudienceType $audienceType,
        SubscriptionPackage $subscriptionPackage,
        array $pricing,
        ?string $requestedDomain,
        bool $usesOwnDomain,
    ): array {
        $items = [
            [
                'type' => 'subscription',
                'code' => $subscriptionPackage->slug ?: (string) $subscriptionPackage->id,
                'title' => 'اشتراک '.$subscriptionPackage->name,
                'description' => "{$pricing['durationDays']} روزه".($pricing['userLimit'] !== null ? ' - '.$pricing['userLimit'].' کاربر' : ' - نامحدود'),
                'quantity' => 1,
                'unit_amount' => (int) $pricing['packageAmount'],
                'total_amount' => (int) $pricing['packageAmount'],
                'sort_order' => 10,
            ],
            [
                'type' => 'setup_fee',
                'code' => 'setup_fee',
                'title' => (string) $pricing['setupLabel'],
                'description' => "راه‌اندازی اولیه برای {$audienceType->name}",
                'quantity' => 1,
                'unit_amount' => (int) $pricing['setupAmount'],
                'total_amount' => (int) $pricing['setupAmount'],
                'sort_order' => 20,
            ],
        ];

        if ($usesOwnDomain) {
            $items[] = [
                'type' => 'own_domain',
                'code' => 'own_domain',
                'title' => 'استفاده از دامنه شخصی',
                'description' => $requestedDomain ? "دامنه معرفی‌شده: {$requestedDomain}" : 'بدون هزینه ثبت دامنه جدید',
                'quantity' => 1,
                'unit_amount' => 0,
                'total_amount' => 0,
                'sort_order' => 25,
            ];
        } elseif ((int) $pricing['domainAmount'] > 0) {
            $items[] = [
                'type' => 'domain_registration',
                'code' => (string) ($pricing['domainTld'] ?? 'domain'),
                'title' => $requestedDomain ? 'ثبت دامنه '.$requestedDomain : 'هزینه ثبت دامنه '.((string) ($pricing['domainTld'] ?? '.ir')),
                'description' => $requestedDomain ? 'هزینه ثبت اولیه دامنه' : 'هزینه ثبت دامنه که بعد از سفارش انتخاب می‌شود.',
                'quantity' => 1,
                'unit_amount' => (int) $pricing['domainAmount'],
                'total_amount' => (int) $pricing['domainAmount'],
                'sort_order' => 30,
            ];
        }

        return $items;
    }

    private function applySmsCreditGiftIfNeeded(LandingOrder $order, int|string $tenantId): void
    {
        $meta = is_array($order->meta_json) ? $order->meta_json : [];
        $pricing = is_array($meta['pricing'] ?? null) ? $meta['pricing'] : [];
        $giftAmount = max(0, (int) ($pricing['smsCreditGiftAmount'] ?? 0));

        if ($giftAmount <= 0 || ! empty($meta['smsCreditGiftAppliedAt'])) {
            return;
        }

        /** @var Tenant|null $tenant */
        $tenant = Tenant::query()->find($tenantId);

        if (! $tenant) {
            return;
        }
        $this->tenantProvisioningService->applyPackageSmsCreditGift(
            $tenant,
            $tenant->subscriptionPackage()->first() ?? $order->subscriptionPackage()->first(),
            [
                'source_type' => 'landing_order_sms_gift',
                'source_id' => (string) $order->id,
                'tenant_id' => (string) $tenant->id,
                'title' => 'هزینه شارژ هدیه پیامک هنگام نصب سامانه',
                'occurred_at' => $order->provisioned_at ?? now(),
                'meta' => [
                    'order_number' => $order->order_number,
                ],
            ],
        );

        $meta['smsCreditGiftAppliedAt'] = now()->toIso8601String();
        $meta['smsCreditGiftAppliedAmount'] = $giftAmount;
        $order->update([
            'meta_json' => $meta,
        ]);
    }

    private function syncManagedDomainRenewalIfNeeded(LandingOrder $order, int|string $tenantId): void
    {
        $usesOwnDomain = (bool) data_get($order->meta_json, 'usesOwnDomain', false);
        $requestedTld = trim((string) ($order->requested_domain_tld ?? ''));

        /** @var Tenant|null $tenant */
        $tenant = Tenant::query()->find($tenantId);

        if (! $tenant) {
            return;
        }

        if ($usesOwnDomain) {
            $tenant->update([
                'domain_management_mode' => 'self_managed',
                'managed_domain_tld' => $requestedTld !== '' ? $requestedTld : ($tenant->managed_domain_tld ?: '.ir'),
                'managed_domain_registered' => false,
                'managed_domain_registered_at' => null,
                'managed_domain_last_paid_at' => null,
                'managed_domain_renews_at' => null,
                'managed_domain_amount' => null,
                'ir_domain_registered' => false,
                'ir_domain_registered_at' => null,
                'ir_domain_last_paid_at' => null,
                'ir_domain_renews_at' => null,
                'ir_domain_amount' => null,
            ]);

            return;
        }

        if ($requestedTld === '' || (int) $order->domain_price_amount <= 0) {
            return;
        }

        $renewAmount = (int) ($order->domain_price_amount ?: (DomainTldPrice::query()
            ->where('tld', $requestedTld)
            ->where('is_active', true)
            ->value('renew_price_amount') ?? 0));

        $payload = [
            'domain_management_mode' => 'platform_managed',
            'managed_domain_tld' => $requestedTld,
            'managed_domain_registered' => true,
            'managed_domain_registered_at' => $tenant->managed_domain_registered_at?->toDateString() ?? now()->toDateString(),
            'managed_domain_last_paid_at' => now()->toDateString(),
            'managed_domain_renews_at' => $tenant->managed_domain_renews_at?->toDateString() ?? now()->addYear()->toDateString(),
            'managed_domain_amount' => $tenant->managed_domain_amount ?? $renewAmount,
        ];

        if ($requestedTld === '.ir') {
            $payload = array_merge($payload, [
                'ir_domain_registered' => true,
                'ir_domain_registered_at' => $tenant->ir_domain_registered_at?->toDateString() ?? now()->toDateString(),
                'ir_domain_last_paid_at' => now()->toDateString(),
                'ir_domain_renews_at' => $tenant->ir_domain_renews_at?->toDateString() ?? now()->addYear()->toDateString(),
                'ir_domain_amount' => $tenant->ir_domain_amount ?? $renewAmount,
            ]);
        } else {
            $payload = array_merge($payload, [
                'ir_domain_registered' => false,
                'ir_domain_registered_at' => null,
                'ir_domain_last_paid_at' => null,
                'ir_domain_renews_at' => null,
                'ir_domain_amount' => null,
            ]);
        }

        $tenant->update($payload);
    }
}
