<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomLandingSettlement extends Model
{
    protected $fillable = ['custom_landing_partner_id', 'amount', 'payment_method', 'payment_reference', 'paid_at', 'note', 'recorded_by_user_id'];

    protected function casts(): array
    {
        return ['amount' => 'integer', 'paid_at' => 'datetime'];
    }

    public function partner(): BelongsTo { return $this->belongsTo(CustomLandingPartner::class, 'custom_landing_partner_id'); }
    public function recordedBy(): BelongsTo { return $this->belongsTo(TenantUser::class, 'recorded_by_user_id'); }
}
