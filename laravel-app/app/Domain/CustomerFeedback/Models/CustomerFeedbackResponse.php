<?php

declare(strict_types=1);

namespace App\Domain\CustomerFeedback\Models;

use App\Domain\Booking\Models\Appointment;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerFeedbackResponse extends Model
{
    protected $fillable = [
        'invitation_id',
        'appointment_id',
        'rating_type',
        'rating_value',
        'emoji_key',
        'comment',
        'answers',
    ];

    protected $casts = [
        'rating_value' => 'integer',
        'answers' => 'array',
    ];

    public function invitation(): BelongsTo
    {
        return $this->belongsTo(CustomerFeedbackInvitation::class, 'invitation_id');
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class, 'appointment_id');
    }
}
