<?php

declare(strict_types=1);

namespace App\Domain\Booking\Models;

use App\Domain\CustomerFeedback\Models\CustomerFeedbackInvitation;
use App\Domain\Tenant\Models\TenantUser;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Appointment extends Model
{
    protected $fillable = [
        'customer_id',
        'created_by_user_id',
        'professional_id',
        'service_id',
        'appointment_date',
        'start_time',
        'end_time',
        'starts_at',
        'ends_at',
        'status',
        'notes',
        'booked_by_name_snapshot',
        'booked_by_phone_snapshot',
        'customer_name_snapshot',
        'customer_phone_snapshot',
        'professional_name_snapshot',
        'service_name_snapshot',
        'price_amount',
        'duration_minutes',
        'public_code',
        'cancelled_at',
        'completed_at',
        'reminder_due_at',
        'reminder_sent_at',
        'reminder_locked_at',
        'reminder_3h_due_at',
        'reminder_3h_sent_at',
        'reminder_3h_locked_at',
        'meta',
    ];

    protected $casts = [
        'appointment_date' => 'date:Y-m-d',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'price_amount' => 'integer',
        'duration_minutes' => 'integer',
        'cancelled_at' => 'datetime',
        'completed_at' => 'datetime',
        'reminder_due_at' => 'datetime',
        'reminder_sent_at' => 'datetime',
        'reminder_locked_at' => 'datetime',
        'reminder_3h_due_at' => 'datetime',
        'reminder_3h_sent_at' => 'datetime',
        'reminder_3h_locked_at' => 'datetime',
        'meta' => 'array',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function barber(): BelongsTo
    {
        return $this->belongsTo(Barber::class, 'professional_id');
    }

    public function professional(): BelongsTo
    {
        return $this->belongsTo(Professional::class, 'professional_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'created_by_user_id');
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class)->withTrashed();
    }

    public function customerFeedbackInvitation(): HasOne
    {
        return $this->hasOne(CustomerFeedbackInvitation::class, 'appointment_id');
    }

    public function getBarberIdAttribute(): ?int
    {
        return isset($this->attributes['professional_id']) ? (int) $this->attributes['professional_id'] : null;
    }

    public function setBarberIdAttribute(mixed $value): void
    {
        $this->attributes['professional_id'] = $value;
    }

    public function getBarberNameSnapshotAttribute(): ?string
    {
        return $this->attributes['professional_name_snapshot'] ?? null;
    }

    public function setBarberNameSnapshotAttribute(mixed $value): void
    {
        $this->attributes['professional_name_snapshot'] = $value;
    }
}
