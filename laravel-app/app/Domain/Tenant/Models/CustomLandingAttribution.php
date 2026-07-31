<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomLandingAttribution extends Model
{
    protected $fillable = ['custom_landing_partner_id', 'tenant_user_id', 'public_token_snapshot', 'landed_at', 'registered_at', 'first_paid_at'];

    protected function casts(): array
    {
        return ['landed_at' => 'datetime', 'registered_at' => 'datetime', 'first_paid_at' => 'datetime'];
    }

    public function partner(): BelongsTo { return $this->belongsTo(CustomLandingPartner::class, 'custom_landing_partner_id'); }
    public function user(): BelongsTo { return $this->belongsTo(TenantUser::class, 'tenant_user_id'); }
}
