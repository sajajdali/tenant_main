<?php

declare(strict_types=1);

namespace App\Services;

use App\Domain\Landing\Models\LandingCustomer;
use App\Domain\Landing\Models\LandingOrder;
use App\Domain\Landing\Models\LandingOrderPayment;
use App\Domain\Landing\Models\AudienceCheckoutSetting;
use App\Domain\Tenant\Models\DiscountCode;
use App\Domain\Tenant\Models\DiscountCodeRedemption;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantSubscriptionPayment;
use App\Models\SalesCommissionLedger;
use App\Models\SalesCustomerAssignment;
use App\Models\User;
use App\Support\InputNormalizer;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

class SalesTrackingService
{
    public function __construct(
        private readonly SalesWalletService $wallets,
    ) {
    }

    public function trackLandingSale(
        DiscountCode $discountCode,
        DiscountCodeRedemption $redemption,
        LandingCustomer $customer,
        LandingOrder $order,
        LandingOrderPayment $payment,
    ): void {
        $participants = $this->resolveParticipantsForTrackedPurchase(
            $discountCode->salesUser,
            $customer->mobile,
            $order->tenant_id,
            $customer->id,
        );
        $occurredAt = $payment->paid_at ?? now();
        $supportEndsAt = Carbon::instance($occurredAt)->copy()->addDays((int) $order->duration_days)->toDateString();

        $assignment = $this->upsertAssignment([
            'sales_expert_user_id' => $participants['salesExpertId'],
            'sales_manager_user_id' => $participants['salesManagerId'],
            'assigned_by_user_id' => $discountCode->sales_user_id,
            'audience_type_id' => $order->audience_type_id,
            'landing_customer_id' => $customer->id,
            'tenant_id' => $order->tenant_id,
            'customer_name' => $order->customer_full_name ?: ($customer->full_name ?: null),
            'customer_mobile' => $customer->mobile,
            'status' => 'won',
            'source_type' => 'landing_order',
            'source_id' => $order->id,
            'latest_source_type' => 'landing_order',
            'latest_source_id' => $order->id,
            'sales_expert_percent' => $participants['salesExpertPercent'],
            'sales_manager_percent' => $participants['salesManagerPercent'],
            'first_purchased_at' => $occurredAt,
            'last_purchased_at' => $occurredAt,
            'support_expires_at' => $supportEndsAt,
            'meta_json' => [
                'last_discount_code_id' => $discountCode->id,
                'last_discount_code' => $discountCode->code,
                'last_context' => 'initial_purchase',
            ],
        ]);

        $ledger = SalesCommissionLedger::query()->updateOrCreate(
            [
                'source_type' => 'landing_order',
                'source_id' => $order->id,
            ],
            [
                'sales_customer_assignment_id' => $assignment->id,
                'sales_expert_user_id' => $participants['salesExpertId'],
                'sales_manager_user_id' => $participants['salesManagerId'],
                'source_label' => 'خرید اولیه '.$order->order_number,
                'landing_order_id' => $order->id,
                'tenant_id' => $order->tenant_id,
                'customer_name' => $assignment->customer_name,
                'customer_mobile' => $assignment->customer_mobile,
                'gross_amount' => (int) $redemption->base_amount,
                'discount_amount' => (int) $redemption->discount_amount,
                'net_amount' => (int) $redemption->payable_amount,
                'sales_expert_percent' => $participants['salesExpertPercent'],
                'sales_expert_amount' => $this->commissionAmount((int) $redemption->payable_amount, $participants['salesExpertPercent']),
                'sales_manager_percent' => $participants['salesManagerPercent'],
                'sales_manager_amount' => $this->commissionAmount((int) $redemption->payable_amount, $participants['salesManagerPercent']),
                'status' => 'recorded',
                'occurred_at' => $occurredAt,
                'meta_json' => [
                    'discount_code_id' => $discountCode->id,
                    'discount_code' => $discountCode->code,
                    'payment_id' => $payment->id,
                ],
            ],
        );

        $this->wallets->ensureCommissionCredits($ledger);
    }

    public function trackLandingSaleFromAssignment(
        LandingCustomer $customer,
        LandingOrder $order,
        LandingOrderPayment $payment,
    ): void {
        $participants = $this->resolveParticipantsForTrackedPurchase(
            null,
            $customer->mobile,
            $order->tenant_id,
            $customer->id,
        );

        if ($participants['salesExpertId'] === null && $participants['salesManagerId'] === null) {
            return;
        }

        $occurredAt = $payment->paid_at ?? now();
        $supportEndsAt = Carbon::instance($occurredAt)->copy()->addDays((int) $order->duration_days)->toDateString();

        $assignment = $this->upsertAssignment([
            'sales_expert_user_id' => $participants['salesExpertId'],
            'sales_manager_user_id' => $participants['salesManagerId'],
            'assigned_by_user_id' => $participants['assignedByUserId'],
            'audience_type_id' => $order->audience_type_id,
            'landing_customer_id' => $customer->id,
            'tenant_id' => $order->tenant_id,
            'customer_name' => $order->customer_full_name ?: ($customer->full_name ?: null),
            'customer_mobile' => $customer->mobile,
            'status' => 'won',
            'source_type' => 'manual_assignment',
            'source_id' => $order->id,
            'latest_source_type' => 'landing_order',
            'latest_source_id' => $order->id,
            'sales_expert_percent' => $participants['salesExpertPercent'],
            'sales_manager_percent' => $participants['salesManagerPercent'],
            'first_purchased_at' => $occurredAt,
            'last_purchased_at' => $occurredAt,
            'support_expires_at' => $supportEndsAt,
            'meta_json' => [
                'last_context' => 'initial_purchase_without_discount',
                'tracked_from_manual_assignment' => true,
                'landing_order_id' => $order->id,
                'landing_order_payment_id' => $payment->id,
            ],
        ]);

        $ledger = SalesCommissionLedger::query()->updateOrCreate(
            [
                'source_type' => 'landing_order_manual_assignment',
                'source_id' => $order->id,
            ],
            [
                'sales_customer_assignment_id' => $assignment->id,
                'sales_expert_user_id' => $participants['salesExpertId'],
                'sales_manager_user_id' => $participants['salesManagerId'],
                'source_label' => 'خرید اولیه '.$order->order_number.' (ثبت دستی فروش)',
                'landing_order_id' => $order->id,
                'tenant_id' => $order->tenant_id,
                'customer_name' => $assignment->customer_name,
                'customer_mobile' => $assignment->customer_mobile,
                'gross_amount' => (int) $order->subtotal_amount,
                'discount_amount' => (int) $order->discount_amount,
                'net_amount' => (int) $order->total_amount,
                'sales_expert_percent' => $participants['salesExpertPercent'],
                'sales_expert_amount' => $this->commissionAmount((int) $order->total_amount, $participants['salesExpertPercent']),
                'sales_manager_percent' => $participants['salesManagerPercent'],
                'sales_manager_amount' => $this->commissionAmount((int) $order->total_amount, $participants['salesManagerPercent']),
                'status' => 'recorded',
                'occurred_at' => $occurredAt,
                'meta_json' => [
                    'payment_id' => $payment->id,
                    'tracking_mode' => 'manual_assignment',
                ],
            ],
        );

        $this->wallets->ensureCommissionCredits($ledger);
    }

    public function backfillFromRedemption(DiscountCodeRedemption $redemption): void
    {
        $redemption->loadMissing([
            'discountCode.salesUser',
            'landingCustomer',
            'landingOrder',
            'landingOrderPayment',
            'tenantSubscriptionPayment',
            'tenantSubscriptionPayment.tenant',
        ]);

        $discountCode = $redemption->discountCode;
        if (! $discountCode) {
            return;
        }

        if ($redemption->context_type === 'landing_order' && $redemption->landingCustomer && $redemption->landingOrder && $redemption->landingOrderPayment) {
            $this->trackLandingSale(
                $discountCode,
                $redemption,
                $redemption->landingCustomer,
                $redemption->landingOrder,
                $redemption->landingOrderPayment,
            );

            return;
        }

        $payment = $redemption->tenantSubscriptionPayment;
        if ($redemption->context_type === 'support_renewal' && $payment && $payment->tenant) {
            $this->trackRenewalSale(
                $discountCode,
                $redemption,
                $payment->tenant,
                $payment,
            );
        }
    }

    public function trackRenewalSale(
        DiscountCode $discountCode,
        DiscountCodeRedemption $redemption,
        Tenant $tenant,
        TenantSubscriptionPayment $payment,
    ): void {
        $participants = $this->resolveParticipantsForTrackedPurchase(
            $discountCode->salesUser,
            $payment->initiated_by_mobile,
            (string) $tenant->id,
            null,
        );
        $occurredAt = $payment->paid_at ?? now();

        $assignment = $this->upsertAssignment([
            'sales_expert_user_id' => $participants['salesExpertId'],
            'sales_manager_user_id' => $participants['salesManagerId'],
            'assigned_by_user_id' => $discountCode->sales_user_id,
            'audience_type_id' => $tenant->audience_type_id,
            'tenant_id' => (string) $tenant->id,
            'customer_name' => $tenant->name,
            'customer_mobile' => $payment->initiated_by_mobile,
            'status' => 'renewed',
            'source_type' => 'support_renewal',
            'source_id' => $payment->id,
            'latest_source_type' => 'support_renewal',
            'latest_source_id' => $payment->id,
            'sales_expert_percent' => $participants['salesExpertPercent'],
            'sales_manager_percent' => $participants['salesManagerPercent'],
            'first_purchased_at' => $occurredAt,
            'last_purchased_at' => $occurredAt,
            'support_expires_at' => $payment->new_support_ends_at,
            'last_renewed_at' => $payment->new_support_ends_at,
            'meta_json' => [
                'last_discount_code_id' => $discountCode->id,
                'last_discount_code' => $discountCode->code,
                'last_context' => 'renewal',
            ],
        ]);

        $ledger = SalesCommissionLedger::query()->updateOrCreate(
            [
                'source_type' => 'support_renewal',
                'source_id' => $payment->id,
            ],
            [
                'sales_customer_assignment_id' => $assignment->id,
                'sales_expert_user_id' => $participants['salesExpertId'],
                'sales_manager_user_id' => $participants['salesManagerId'],
                'source_label' => 'تمدید پشتیبانی '.$payment->invoice_number,
                'tenant_subscription_payment_id' => $payment->id,
                'tenant_id' => (string) $tenant->id,
                'customer_name' => $assignment->customer_name,
                'customer_mobile' => $assignment->customer_mobile,
                'gross_amount' => (int) $redemption->base_amount,
                'discount_amount' => (int) $redemption->discount_amount,
                'net_amount' => (int) $redemption->payable_amount,
                'sales_expert_percent' => $participants['salesExpertPercent'],
                'sales_expert_amount' => $this->commissionAmount((int) $redemption->payable_amount, $participants['salesExpertPercent']),
                'sales_manager_percent' => $participants['salesManagerPercent'],
                'sales_manager_amount' => $this->commissionAmount((int) $redemption->payable_amount, $participants['salesManagerPercent']),
                'status' => 'recorded',
                'occurred_at' => $occurredAt,
                'meta_json' => [
                    'discount_code_id' => $discountCode->id,
                    'discount_code' => $discountCode->code,
                    'payment_type' => $payment->payment_type,
                ],
            ],
        );

        $this->wallets->ensureCommissionCredits($ledger);
    }

    public function trackRenewalSaleFromAssignment(
        Tenant $tenant,
        TenantSubscriptionPayment $payment,
    ): void {
        $participants = $this->resolveParticipantsForTrackedPurchase(
            null,
            $payment->initiated_by_mobile,
            (string) $tenant->id,
            null,
        );

        if ($participants['salesExpertId'] === null && $participants['salesManagerId'] === null) {
            return;
        }

        $occurredAt = $payment->paid_at ?? now();

        $assignment = $this->upsertAssignment([
            'sales_expert_user_id' => $participants['salesExpertId'],
            'sales_manager_user_id' => $participants['salesManagerId'],
            'assigned_by_user_id' => $participants['assignedByUserId'],
            'audience_type_id' => $tenant->audience_type_id,
            'tenant_id' => (string) $tenant->id,
            'customer_name' => $tenant->name,
            'customer_mobile' => $payment->initiated_by_mobile,
            'status' => 'renewed',
            'source_type' => 'manual_assignment',
            'source_id' => $payment->id,
            'latest_source_type' => 'support_renewal',
            'latest_source_id' => $payment->id,
            'sales_expert_percent' => $participants['salesExpertPercent'],
            'sales_manager_percent' => $participants['salesManagerPercent'],
            'first_purchased_at' => $occurredAt,
            'last_purchased_at' => $occurredAt,
            'support_expires_at' => $payment->new_support_ends_at,
            'last_renewed_at' => $payment->new_support_ends_at,
            'meta_json' => [
                'last_context' => 'renewal_without_discount',
                'tracked_from_manual_assignment' => true,
                'tenant_subscription_payment_id' => $payment->id,
            ],
        ]);

        $ledger = SalesCommissionLedger::query()->updateOrCreate(
            [
                'source_type' => 'support_renewal_manual_assignment',
                'source_id' => $payment->id,
            ],
            [
                'sales_customer_assignment_id' => $assignment->id,
                'sales_expert_user_id' => $participants['salesExpertId'],
                'sales_manager_user_id' => $participants['salesManagerId'],
                'source_label' => 'تمدید پشتیبانی '.$payment->invoice_number.' (ثبت دستی فروش)',
                'tenant_subscription_payment_id' => $payment->id,
                'tenant_id' => (string) $tenant->id,
                'customer_name' => $assignment->customer_name,
                'customer_mobile' => $assignment->customer_mobile,
                'gross_amount' => (int) $payment->amount,
                'discount_amount' => (int) ($payment->discount_amount ?? 0),
                'net_amount' => (int) $payment->payable_amount,
                'sales_expert_percent' => $participants['salesExpertPercent'],
                'sales_expert_amount' => $this->commissionAmount((int) $payment->payable_amount, $participants['salesExpertPercent']),
                'sales_manager_percent' => $participants['salesManagerPercent'],
                'sales_manager_amount' => $this->commissionAmount((int) $payment->payable_amount, $participants['salesManagerPercent']),
                'status' => 'recorded',
                'occurred_at' => $occurredAt,
                'meta_json' => [
                    'payment_type' => $payment->payment_type,
                    'tracking_mode' => 'manual_assignment',
                ],
            ],
        );

        $this->wallets->ensureCommissionCredits($ledger);
    }

    public function trackFeatureModuleSaleFromAssignment(
        Tenant $tenant,
        TenantSubscriptionPayment $payment,
    ): void {
        $participants = $this->resolveParticipantsForTrackedPurchase(
            null,
            $payment->initiated_by_mobile,
            (string) $tenant->id,
            null,
        );

        if ($participants['salesExpertId'] === null && $participants['salesManagerId'] === null) {
            return;
        }

        $moduleItem = $payment->items->firstWhere('item_type', 'feature_module_activation');
        $moduleName = (string) ($moduleItem?->featureModule?->name
            ?? $moduleItem?->title
            ?? $payment->metadata['feature_module_name']
            ?? 'ماژول');
        $occurredAt = $payment->paid_at ?? now();

        $assignment = $this->upsertAssignment([
            'sales_expert_user_id' => $participants['salesExpertId'],
            'sales_manager_user_id' => $participants['salesManagerId'],
            'assigned_by_user_id' => $participants['assignedByUserId'],
            'audience_type_id' => $tenant->audience_type_id,
            'tenant_id' => (string) $tenant->id,
            'customer_name' => $tenant->name,
            'customer_mobile' => $payment->initiated_by_mobile,
            'status' => 'renewed',
            'source_type' => 'manual_assignment',
            'source_id' => $payment->id,
            'latest_source_type' => 'feature_module_activation',
            'latest_source_id' => $payment->id,
            'sales_expert_percent' => $participants['salesExpertPercent'],
            'sales_manager_percent' => $participants['salesManagerPercent'],
            'first_purchased_at' => $occurredAt,
            'last_purchased_at' => $occurredAt,
            'support_expires_at' => $tenant->support_ends_at,
            'last_renewed_at' => $payment->new_support_ends_at ?? $tenant->support_ends_at,
            'meta_json' => [
                'last_context' => 'feature_module_activation',
                'tracked_from_manual_assignment' => true,
                'tenant_subscription_payment_id' => $payment->id,
                'feature_module_name' => $moduleName,
            ],
        ]);

        $ledger = SalesCommissionLedger::query()->updateOrCreate(
            [
                'source_type' => 'feature_module_activation',
                'source_id' => $payment->id,
            ],
            [
                'sales_customer_assignment_id' => $assignment->id,
                'sales_expert_user_id' => $participants['salesExpertId'],
                'sales_manager_user_id' => $participants['salesManagerId'],
                'source_label' => 'خرید پلاگین '.$moduleName.' - '.$payment->invoice_number,
                'tenant_subscription_payment_id' => $payment->id,
                'tenant_id' => (string) $tenant->id,
                'customer_name' => $assignment->customer_name,
                'customer_mobile' => $assignment->customer_mobile,
                'gross_amount' => (int) $payment->amount,
                'discount_amount' => (int) ($payment->discount_amount ?? 0),
                'net_amount' => (int) $payment->payable_amount,
                'sales_expert_percent' => $participants['salesExpertPercent'],
                'sales_expert_amount' => $this->commissionAmount((int) $payment->payable_amount, $participants['salesExpertPercent']),
                'sales_manager_percent' => $participants['salesManagerPercent'],
                'sales_manager_amount' => $this->commissionAmount((int) $payment->payable_amount, $participants['salesManagerPercent']),
                'status' => 'recorded',
                'occurred_at' => $occurredAt,
                'meta_json' => [
                    'payment_type' => $payment->payment_type,
                    'tracking_mode' => 'manual_assignment',
                    'feature_module_name' => $moduleName,
                    'feature_module_slug' => $payment->metadata['feature_module_slug'] ?? null,
                ],
            ],
        );

        $this->wallets->ensureCommissionCredits($ledger);
    }

    public function trackTenantSetupCommission(Tenant $tenant, ?User $owner = null): void
    {
        $tenant->loadMissing('audienceType.checkoutSetting');

        $ownerMobile = InputNormalizer::mobile((string) ($owner?->mobile ?? ''));
        if ($ownerMobile === '') {
            return;
        }

        $checkoutSetting = $tenant->audienceType?->checkoutSetting
            ?? new AudienceCheckoutSetting([
                'setup_fee_amount' => 0,
                'setup_fee_label' => 'هزینه نصب و راه‌اندازی',
            ]);

        $setupFeeAmount = (int) ($checkoutSetting->setup_fee_amount ?? 0);
        if ($setupFeeAmount <= 0) {
            return;
        }

        $participants = $this->resolveParticipantsForTrackedPurchase(
            null,
            $ownerMobile,
            (string) $tenant->id,
            null,
        );

        if ($participants['salesExpertId'] === null && $participants['salesManagerId'] === null) {
            return;
        }

        $occurredAt = $tenant->created_at ?? now();
        $setupFeeLabel = trim((string) ($checkoutSetting->setup_fee_label ?: 'هزینه نصب و راه‌اندازی'));
        $sourceType = 'tenant_setup:'.$tenant->id;

        $assignment = $this->upsertAssignment([
            'sales_expert_user_id' => $participants['salesExpertId'],
            'sales_manager_user_id' => $participants['salesManagerId'],
            'assigned_by_user_id' => $participants['assignedByUserId'],
            'audience_type_id' => $tenant->audience_type_id,
            'tenant_id' => (string) $tenant->id,
            'customer_name' => $tenant->name,
            'customer_mobile' => $ownerMobile,
            'status' => 'won',
            'source_type' => $sourceType,
            'source_id' => 1,
            'latest_source_type' => $sourceType,
            'latest_source_id' => 1,
            'sales_expert_percent' => $participants['salesExpertPercent'],
            'sales_manager_percent' => $participants['salesManagerPercent'],
            'first_purchased_at' => $occurredAt,
            'last_purchased_at' => $occurredAt,
            'support_expires_at' => $tenant->support_ends_at,
            'meta_json' => [
                'last_context' => 'tenant_setup',
                'setup_fee_amount' => $setupFeeAmount,
                'setup_fee_label' => $setupFeeLabel,
            ],
        ]);

        $ledger = SalesCommissionLedger::query()->updateOrCreate(
            [
                'source_type' => $sourceType,
                'source_id' => 1,
            ],
            [
                'sales_customer_assignment_id' => $assignment->id,
                'sales_expert_user_id' => $participants['salesExpertId'],
                'sales_manager_user_id' => $participants['salesManagerId'],
                'source_label' => $setupFeeLabel.' سامانه '.$tenant->name,
                'tenant_id' => (string) $tenant->id,
                'customer_name' => $tenant->name,
                'customer_mobile' => $ownerMobile,
                'gross_amount' => $setupFeeAmount,
                'discount_amount' => 0,
                'net_amount' => $setupFeeAmount,
                'sales_expert_percent' => $participants['salesExpertPercent'],
                'sales_expert_amount' => $this->commissionAmount($setupFeeAmount, $participants['salesExpertPercent']),
                'sales_manager_percent' => $participants['salesManagerPercent'],
                'sales_manager_amount' => $this->commissionAmount($setupFeeAmount, $participants['salesManagerPercent']),
                'status' => 'recorded',
                'occurred_at' => $occurredAt,
                'meta_json' => [
                    'tracking_mode' => 'tenant_setup',
                    'tenant_name' => $tenant->name,
                    'setup_fee_label' => $setupFeeLabel,
                ],
            ],
        );

        $this->wallets->ensureCommissionCredits($ledger);
    }

    public function refreshAssignmentStatuses(): void
    {
        SalesCustomerAssignment::query()
            ->whereNotNull('support_expires_at')
            ->whereDate('support_expires_at', '<', now()->toDateString())
            ->whereNotIn('status', ['lost', 'renewal_missed'])
            ->update(['status' => 'renewal_missed']);
    }

    /**
     * @return array{salesExpertId:int|null,salesManagerId:int|null,salesExpertPercent:string|float|int|null,salesManagerPercent:string|float|int|null}
     */
    public function resolveParticipants(?User $salesUser): array
    {
        if (! $salesUser) {
            return [
                'salesExpertId' => null,
                'salesManagerId' => null,
                'salesExpertPercent' => null,
                'salesManagerPercent' => null,
                'assignedByUserId' => null,
            ];
        }

        if ($salesUser->role === 'sales_manager') {
            return [
                'salesExpertId' => null,
                'salesManagerId' => (int) $salesUser->id,
                'salesExpertPercent' => null,
                'salesManagerPercent' => $salesUser->sales_commission_percent,
                'assignedByUserId' => (int) $salesUser->id,
            ];
        }

        if ($salesUser->role === 'teacher') {
            return [
                'salesExpertId' => (int) $salesUser->id,
                'salesManagerId' => null,
                'salesExpertPercent' => $salesUser->sales_commission_percent,
                'salesManagerPercent' => null,
                'assignedByUserId' => (int) $salesUser->id,
            ];
        }

        return [
            'salesExpertId' => (int) $salesUser->id,
            'salesManagerId' => $salesUser->sales_manager_user_id ? (int) $salesUser->sales_manager_user_id : null,
            'salesExpertPercent' => $salesUser->sales_commission_percent,
            'salesManagerPercent' => $salesUser->sales_manager_user_id ? $salesUser->sales_manager_commission_percent : null,
            'assignedByUserId' => (int) $salesUser->id,
        ];
    }

    /**
     * @return array{salesExpertId:int|null,salesManagerId:int|null,salesExpertPercent:string|float|int|null,salesManagerPercent:string|float|int|null,assignedByUserId:int|null}
     */
    public function resolveParticipantsForTrackedPurchase(
        ?User $salesUser,
        ?string $customerMobile = null,
        int|string|null $tenantId = null,
        ?int $landingCustomerId = null,
    ): array {
        $existingAssignment = $this->findMatchingAssignment(
            customerMobile: $customerMobile,
            tenantId: $tenantId,
            landingCustomerId: $landingCustomerId,
        );

        if ($existingAssignment && ($existingAssignment->sales_expert_user_id || $existingAssignment->sales_manager_user_id)) {
            return [
                'salesExpertId' => $existingAssignment->sales_expert_user_id ? (int) $existingAssignment->sales_expert_user_id : null,
                'salesManagerId' => $existingAssignment->sales_manager_user_id ? (int) $existingAssignment->sales_manager_user_id : null,
                'salesExpertPercent' => $existingAssignment->sales_expert_percent,
                'salesManagerPercent' => $existingAssignment->sales_manager_percent,
                'assignedByUserId' => $existingAssignment->assigned_by_user_id ? (int) $existingAssignment->assigned_by_user_id : null,
            ];
        }

        return $this->resolveParticipants($salesUser);
    }

    public function findAssignmentForTrackedPurchase(
        ?string $customerMobile = null,
        int|string|null $tenantId = null,
        ?int $landingCustomerId = null,
    ): ?SalesCustomerAssignment {
        return $this->findMatchingAssignment(
            customerMobile: $customerMobile,
            tenantId: $tenantId,
            landingCustomerId: $landingCustomerId,
        );
    }

    private function upsertAssignment(array $payload): SalesCustomerAssignment
    {
        $assignment = $this->findMatchingAssignment(
            customerMobile: $payload['customer_mobile'] ?? null,
            tenantId: $payload['tenant_id'] ?? null,
            landingCustomerId: isset($payload['landing_customer_id']) ? (int) $payload['landing_customer_id'] : null,
        );

        if (! $assignment) {
            return SalesCustomerAssignment::query()->create($payload);
        }

        $meta = is_array($assignment->meta_json) ? $assignment->meta_json : [];
        $incomingMeta = is_array($payload['meta_json'] ?? null) ? $payload['meta_json'] : [];

        $assignment->fill([
            'sales_expert_user_id' => $payload['sales_expert_user_id'] ?? $assignment->sales_expert_user_id,
            'sales_manager_user_id' => $payload['sales_manager_user_id'] ?? $assignment->sales_manager_user_id,
            'assigned_by_user_id' => $payload['assigned_by_user_id'] ?? $assignment->assigned_by_user_id,
            'audience_type_id' => $payload['audience_type_id'] ?? $assignment->audience_type_id,
            'landing_customer_id' => $payload['landing_customer_id'] ?? $assignment->landing_customer_id,
            'tenant_id' => $payload['tenant_id'] ?? $assignment->tenant_id,
            'customer_name' => $payload['customer_name'] ?? $assignment->customer_name,
            'customer_mobile' => $payload['customer_mobile'] ?? $assignment->customer_mobile,
            'status' => $payload['status'] ?? $assignment->status,
            'source_type' => $assignment->source_type ?? ($payload['source_type'] ?? null),
            'source_id' => $assignment->source_id ?? ($payload['source_id'] ?? null),
            'latest_source_type' => $payload['latest_source_type'] ?? $assignment->latest_source_type,
            'latest_source_id' => $payload['latest_source_id'] ?? $assignment->latest_source_id,
            'sales_expert_percent' => $payload['sales_expert_percent'] ?? $assignment->sales_expert_percent,
            'sales_manager_percent' => $payload['sales_manager_percent'] ?? $assignment->sales_manager_percent,
            'first_purchased_at' => $assignment->first_purchased_at ?? ($payload['first_purchased_at'] ?? null),
            'last_purchased_at' => $payload['last_purchased_at'] ?? $assignment->last_purchased_at,
            'support_expires_at' => $payload['support_expires_at'] ?? $assignment->support_expires_at,
            'last_renewed_at' => $payload['last_renewed_at'] ?? $assignment->last_renewed_at,
            'meta_json' => array_merge($meta, $incomingMeta),
        ]);
        $assignment->save();

        return $assignment->fresh();
    }

    private function findMatchingAssignment(
        ?string $customerMobile = null,
        int|string|null $tenantId = null,
        ?int $landingCustomerId = null,
    ): ?SalesCustomerAssignment {
        $normalizedMobile = InputNormalizer::mobile($customerMobile);

        $candidateQueries = [];

        if ($tenantId !== null && $tenantId !== '') {
            $candidateQueries[] = SalesCustomerAssignment::query()
                ->where('tenant_id', (string) $tenantId);
        }

        if ($landingCustomerId) {
            $candidateQueries[] = SalesCustomerAssignment::query()
                ->where('landing_customer_id', $landingCustomerId);
        }

        if ($normalizedMobile !== '') {
            $candidateQueries[] = SalesCustomerAssignment::query()
                ->where('customer_mobile', $normalizedMobile);
        }

        foreach ($candidateQueries as $query) {
            /** @var SalesCustomerAssignment|null $assignment */
            $assignment = $query->latest('id')->first();
            if ($assignment) {
                return $assignment;
            }
        }

        return null;
    }

    private function commissionAmount(int $netAmount, string|float|int|null $percent): int
    {
        if ($percent === null || $percent === '') {
            return 0;
        }

        return (int) floor(($netAmount * (float) $percent) / 100);
    }
}
