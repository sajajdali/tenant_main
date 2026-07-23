<?php

declare(strict_types=1);

namespace App\Domain\Booking\Models;

use App\Domain\Tenant\Models\TenantUser;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Professional extends Model
{
    protected $table = 'professionals';

    protected $fillable = [
        'user_id',
        'name',
        'slug',
        'api_code',
        'sort_order',
        'is_active',
        'can_access_panel',
        'settings',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'can_access_panel' => 'boolean',
        'sort_order' => 'integer',
        'settings' => 'array',
    ];

    public function services(): HasMany
    {
        return $this->hasMany(Service::class, 'professional_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'user_id');
    }
}
