<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SmsCampaignRecipient extends Model
{
    protected $fillable = [
        'campaign_id',
        'customer_phone',
        'customer_name',
        'last_barber_id',
        'last_barber_name',
        'last_service_id',
        'last_service_name',
        'last_appointment_at',
        'first_appointment_at',
        'appointments_count',
        'message_encoding',
        'message_parts_count',
        'unit_price',
        'status',
        'provider_message_id',
        'error_message',
        'sent_at',
    ];

    protected $casts = [
        'last_appointment_at' => 'date:Y-m-d',
        'first_appointment_at' => 'date:Y-m-d',
        'appointments_count' => 'integer',
        'message_parts_count' => 'integer',
        'unit_price' => 'integer',
        'sent_at' => 'datetime',
    ];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(SmsCampaign::class, 'campaign_id');
    }
}
