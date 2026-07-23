<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantSubscriptionRenewal extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'tenant_id',
        'subscription_package_id',
        'renewed_by_user_id',
        'duration_days',
        'previous_support_ends_at',
        'new_support_ends_at',
    ];

    protected $casts = [
        'previous_support_ends_at' => 'date',
        'new_support_ends_at' => 'date',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function subscriptionPackage(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPackage::class, 'subscription_package_id');
    }

    public function renewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'renewed_by_user_id');
    }
}
