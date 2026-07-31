<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomLandingCommission extends Model
{
    protected $fillable = ['custom_landing_partner_id', 'tenant_user_id', 'source_type', 'source_id', 'payment_kind', 'gross_amount', 'commission_percent_snapshot', 'commission_amount', 'status', 'paid_at', 'reversed_at', 'reversal_note'];

    protected function casts(): array
    {
        return ['gross_amount' => 'integer', 'commission_percent_snapshot' => 'decimal:2', 'commission_amount' => 'integer', 'paid_at' => 'datetime', 'reversed_at' => 'datetime'];
    }

    public function partner(): BelongsTo { return $this->belongsTo(CustomLandingPartner::class, 'custom_landing_partner_id'); }
    public function user(): BelongsTo { return $this->belongsTo(TenantUser::class, 'tenant_user_id'); }
}
