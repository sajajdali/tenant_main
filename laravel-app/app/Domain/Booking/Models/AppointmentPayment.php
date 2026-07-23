<?php

declare(strict_types=1);

namespace App\Domain\Booking\Models;

use App\Domain\Tenant\Models\TenantUser;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppointmentPayment extends Model
{
    protected $fillable = [
        'created_by_user_id',
        'appointment_id',
        'professional_id',
        'service_id',
        'invoice_number',
        'gateway',
        'status',
        'sandbox_mode',
        'amount',
        'appointment_date',
        'start_time',
        'end_time',
        'transaction_id',
        'reference_id',
        'customer_name_snapshot',
        'customer_phone_snapshot',
        'booked_by_name_snapshot',
        'booked_by_phone_snapshot',
        'notes',
        'failure_reason',
        'expires_at',
        'paid_at',
        'meta',
    ];

    protected $casts = [
        'sandbox_mode' => 'boolean',
        'amount' => 'integer',
        'appointment_date' => 'date:Y-m-d',
        'expires_at' => 'datetime',
        'paid_at' => 'datetime',
        'meta' => 'array',
    ];

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'created_by_user_id');
    }

    public function barber(): BelongsTo
    {
        return $this->belongsTo(Barber::class, 'professional_id');
    }

    public function professional(): BelongsTo
    {
        return $this->belongsTo(Professional::class, 'professional_id');
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class)->withTrashed();
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
