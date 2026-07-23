<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantFeatureModule extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'tenant_id',
        'feature_module_id',
        'status',
        'activated_at',
        'expires_at',
        'last_paid_at',
        'metadata',
    ];

    protected $casts = [
        'activated_at' => 'date',
        'expires_at' => 'date',
        'last_paid_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function featureModule(): BelongsTo
    {
        return $this->belongsTo(FeatureModule::class, 'feature_module_id');
    }
}
