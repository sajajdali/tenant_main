<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SmsOutbound extends Model
{
    protected $fillable = [
        'campaign_id',
        'type',
        'template_key',
        'provider',
        'sender',
        'recipient_mobile',
        'recipient_name',
        'message',
        'message_encoding',
        'parts_count',
        'unit_price',
        'total_price',
        'status',
        'provider_message_id',
        'error_message',
        'sent_at',
    ];

    protected $casts = [
        'campaign_id' => 'integer',
        'parts_count' => 'integer',
        'unit_price' => 'integer',
        'total_price' => 'integer',
        'sent_at' => 'datetime',
    ];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(SmsCampaign::class, 'campaign_id');
    }
}
