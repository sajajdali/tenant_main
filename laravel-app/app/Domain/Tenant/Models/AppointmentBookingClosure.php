<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AppointmentBookingClosure extends Model
{
    protected $fillable = [
        'closed_message',
        'notify_opt_in_enabled',
        'sms_campaign_id',
        'closed_by_user_id',
        'opened_by_user_id',
        'closed_at',
        'opened_at',
    ];

    protected $casts = [
        'notify_opt_in_enabled' => 'boolean',
        'closed_at' => 'datetime',
        'opened_at' => 'datetime',
    ];

    public function notificationRequests(): HasMany
    {
        return $this->hasMany(AppointmentReopenNotificationRequest::class, 'closure_id');
    }

    public function smsCampaign(): BelongsTo
    {
        return $this->belongsTo(SmsCampaign::class, 'sms_campaign_id');
    }
}
