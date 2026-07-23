<?php

declare(strict_types=1);

namespace App\Domain\CustomerFeedback\Models;

use App\Domain\Booking\Models\Appointment;
use App\Domain\Booking\Models\Customer;
use App\Domain\Booking\Models\Professional;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class CustomerFeedbackInvitation extends Model
{
    protected $fillable = [
        'appointment_id',
        'customer_id',
        'professional_id',
        'token',
        'status',
        'customer_name',
        'customer_mobile',
        'send_attempts',
        'first_sent_at',
        'last_sent_at',
        'next_send_at',
        'responded_at',
        'meta',
    ];

    protected $casts = [
        'send_attempts' => 'integer',
        'first_sent_at' => 'datetime',
        'last_sent_at' => 'datetime',
        'next_send_at' => 'datetime',
        'responded_at' => 'datetime',
        'meta' => 'array',
    ];

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class, 'appointment_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function professional(): BelongsTo
    {
        return $this->belongsTo(Professional::class, 'professional_id');
    }

    public function response(): HasOne
    {
        return $this->hasOne(CustomerFeedbackResponse::class, 'invitation_id');
    }
}
