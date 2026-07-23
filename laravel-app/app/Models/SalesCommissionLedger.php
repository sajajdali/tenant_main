<?php

declare(strict_types=1);

namespace App\Models;

use App\Domain\Landing\Models\LandingOrder;
use App\Domain\Tenant\Models\TenantSubscriptionPayment;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SalesCommissionLedger extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'sales_customer_assignment_id',
        'sales_expert_user_id',
        'sales_manager_user_id',
        'source_type',
        'source_id',
        'source_label',
        'landing_order_id',
        'tenant_subscription_payment_id',
        'tenant_id',
        'customer_name',
        'customer_mobile',
        'gross_amount',
        'discount_amount',
        'net_amount',
        'sales_expert_percent',
        'sales_expert_amount',
        'sales_manager_percent',
        'sales_manager_amount',
        'status',
        'occurred_at',
        'meta_json',
    ];

    protected $casts = [
        'gross_amount' => 'integer',
        'discount_amount' => 'integer',
        'net_amount' => 'integer',
        'sales_expert_percent' => 'decimal:2',
        'sales_expert_amount' => 'integer',
        'sales_manager_percent' => 'decimal:2',
        'sales_manager_amount' => 'integer',
        'occurred_at' => 'datetime',
        'meta_json' => 'array',
    ];

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(SalesCustomerAssignment::class, 'sales_customer_assignment_id');
    }

    public function salesExpert(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sales_expert_user_id');
    }

    public function salesManager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sales_manager_user_id');
    }

    public function landingOrder(): BelongsTo
    {
        return $this->belongsTo(LandingOrder::class, 'landing_order_id');
    }

    public function tenantSubscriptionPayment(): BelongsTo
    {
        return $this->belongsTo(TenantSubscriptionPayment::class, 'tenant_subscription_payment_id');
    }

    public function walletTransactions(): HasMany
    {
        return $this->hasMany(SalesWalletTransaction::class, 'sales_commission_ledger_id');
    }
}
