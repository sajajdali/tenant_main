<?php

declare(strict_types=1);

namespace App\Models;

use App\Domain\Landing\Models\LandingCustomer;
use App\Domain\Tenant\Models\AudienceType;
use App\Domain\Tenant\Models\Tenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SalesCustomerAssignment extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'sales_expert_user_id',
        'sales_manager_user_id',
        'assigned_by_user_id',
        'audience_type_id',
        'landing_customer_id',
        'tenant_id',
        'customer_name',
        'customer_mobile',
        'status',
        'source_type',
        'source_id',
        'latest_source_type',
        'latest_source_id',
        'sales_expert_percent',
        'sales_manager_percent',
        'first_purchased_at',
        'last_purchased_at',
        'last_followed_up_at',
        'next_follow_up_at',
        'support_expires_at',
        'last_renewed_at',
        'meta_json',
    ];

    protected $casts = [
        'sales_expert_percent' => 'decimal:2',
        'sales_manager_percent' => 'decimal:2',
        'first_purchased_at' => 'datetime',
        'last_purchased_at' => 'datetime',
        'last_followed_up_at' => 'datetime',
        'next_follow_up_at' => 'datetime',
        'support_expires_at' => 'date',
        'last_renewed_at' => 'date',
        'meta_json' => 'array',
    ];

    public function salesExpert(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sales_expert_user_id');
    }

    public function salesManager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sales_manager_user_id');
    }

    public function assignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by_user_id');
    }

    public function audienceType(): BelongsTo
    {
        return $this->belongsTo(AudienceType::class, 'audience_type_id');
    }

    public function landingCustomer(): BelongsTo
    {
        return $this->belongsTo(LandingCustomer::class, 'landing_customer_id');
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id', 'id');
    }

    public function followUps(): HasMany
    {
        return $this->hasMany(SalesFollowUp::class)->latest('followed_at');
    }

    public function commissionLedgers(): HasMany
    {
        return $this->hasMany(SalesCommissionLedger::class)->latest('occurred_at');
    }
}
