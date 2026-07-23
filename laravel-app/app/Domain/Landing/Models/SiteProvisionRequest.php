<?php

declare(strict_types=1);

namespace App\Domain\Landing\Models;

use App\Domain\Tenant\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SiteProvisionRequest extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_IN_REVIEW = 'in_review';
    public const STATUS_BUILDING = 'building';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_REJECTED = 'rejected';

    protected $connection = 'central';

    protected $fillable = [
        'landing_order_id',
        'landing_customer_id',
        'assigned_to_user_id',
        'tenant_id',
        'status',
        'requested_domain',
        'requested_domain_tld',
        'requested_package_name',
        'requested_duration_days',
        'requested_user_limit',
        'customer_note',
        'admin_note',
        'requested_payload',
        'approved_at',
        'started_at',
        'completed_at',
        'rejected_at',
    ];

    protected $casts = [
        'requested_duration_days' => 'integer',
        'requested_user_limit' => 'integer',
        'requested_payload' => 'array',
        'approved_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'rejected_at' => 'datetime',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(LandingOrder::class, 'landing_order_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(LandingCustomer::class, 'landing_customer_id');
    }

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to_user_id');
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }
}
