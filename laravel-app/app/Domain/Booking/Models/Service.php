<?php

declare(strict_types=1);

namespace App\Domain\Booking\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Service extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'professional_id',
        'name',
        'slug',
        'api_code',
        'sort_order',
        'price',
        'duration_minutes',
        'duration_display_text',
        'buffer_minutes',
        'is_active',
        'settings',
    ];

    protected $casts = [
        'price' => 'integer',
        'sort_order' => 'integer',
        'duration_minutes' => 'integer',
        'buffer_minutes' => 'integer',
        'is_active' => 'boolean',
        'settings' => 'array',
    ];

    public function barber(): BelongsTo
    {
        return $this->belongsTo(Barber::class, 'professional_id');
    }

    public function professional(): BelongsTo
    {
        return $this->belongsTo(Professional::class, 'professional_id');
    }

    public function getBarberIdAttribute(): ?int
    {
        return isset($this->attributes['professional_id']) ? (int) $this->attributes['professional_id'] : null;
    }

    public function setBarberIdAttribute(mixed $value): void
    {
        $this->attributes['professional_id'] = $value;
    }
}
