<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationCampaignRecipient extends Model
{
    protected $fillable = [
        'campaign_id',
        'tenant_user_id',
        'recipient_phone',
        'recipient_name',
        'recipient_role',
        'appointments_count',
        'last_appointment_at',
        'store_orders_count',
        'store_paid_orders_count',
        'store_total_amount',
        'status',
        'error_message',
        'sent_at',
    ];

    protected $casts = [
        'appointments_count' => 'integer',
        'last_appointment_at' => 'date',
        'store_orders_count' => 'integer',
        'store_paid_orders_count' => 'integer',
        'store_total_amount' => 'integer',
        'sent_at' => 'datetime',
    ];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(NotificationCampaign::class, 'campaign_id');
    }
}

