<?php

declare(strict_types=1);

namespace App\Models;

use App\Domain\Landing\Models\LandingOrderPayment;
use App\Domain\Tenant\Models\Tenant;
use App\Domain\Tenant\Models\TenantSubscriptionPayment;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Schema;

class AdminActionLog extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'action_type',
        'actor_user_id',
        'tenant_id',
        'tenant_subscription_payment_id',
        'landing_order_payment_id',
        'title',
        'reason',
        'meta_json',
        'occurred_at',
    ];

    protected $casts = [
        'meta_json' => 'array',
        'occurred_at' => 'datetime',
    ];

    public static function tableExists(): bool
    {
        static $exists = null;

        if ($exists !== null) {
            return $exists;
        }

        return $exists = Schema::connection('central')->hasTable('admin_action_logs');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id', 'id');
    }

    public function tenantSubscriptionPayment(): BelongsTo
    {
        return $this->belongsTo(TenantSubscriptionPayment::class, 'tenant_subscription_payment_id');
    }

    public function landingOrderPayment(): BelongsTo
    {
        return $this->belongsTo(LandingOrderPayment::class, 'landing_order_payment_id');
    }
}
