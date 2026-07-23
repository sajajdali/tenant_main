<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppointmentReopenNotificationRequest extends Model
{
    protected $fillable = [
        'closure_id',
        'user_id',
        'mobile',
        'name',
        'sms_campaign_id',
        'sms_outbound_id',
        'status',
        'error_message',
        'notified_at',
    ];

    protected $casts = [
        'notified_at' => 'datetime',
    ];

    public function closure(): BelongsTo
    {
        return $this->belongsTo(AppointmentBookingClosure::class, 'closure_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'user_id');
    }

    public function smsCampaign(): BelongsTo
    {
        return $this->belongsTo(SmsCampaign::class, 'sms_campaign_id');
    }

    public function smsOutbound(): BelongsTo
    {
        return $this->belongsTo(SmsOutbound::class, 'sms_outbound_id');
    }
}
