<?php

declare(strict_types=1);

namespace App\Domain\Booking\Models;

use App\Domain\Tenant\Models\TenantUser;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Barber extends Professional
{
    public function services(): HasMany
    {
        return $this->hasMany(Service::class, 'professional_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'user_id');
    }
}
