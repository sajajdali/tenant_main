<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReferralLead extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'referrer_tenant_id',
        'referrer_tenant_user_id',
        'referrer_name',
        'referrer_mobile',
        'referred_mobile',
        'status',
        'converted_tenant_id',
        'subscription_package_id',
        'purchased_duration_days',
        'reward_duration_days',
        'reward_previous_support_ends_at',
        'reward_new_support_ends_at',
        'converted_at',
        'rewarded_at',
    ];

    protected $casts = [
        'converted_at' => 'datetime',
        'rewarded_at' => 'datetime',
        'reward_previous_support_ends_at' => 'date',
        'reward_new_support_ends_at' => 'date',
    ];

    public function referrerTenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'referrer_tenant_id');
    }

    public function convertedTenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'converted_tenant_id');
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPackage::class, 'subscription_package_id');
    }

    public function referrerCentralUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'referrer_tenant_user_id');
    }
}
