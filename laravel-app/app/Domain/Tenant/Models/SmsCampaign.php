<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SmsCampaign extends Model
{
    protected $fillable = [
        'name',
        'preset_key',
        'status',
        'message',
        'message_encoding',
        'message_characters_count',
        'message_parts_count',
        'unit_price',
        'estimated_total_price',
        'spent_total_price',
        'filters',
        'created_by_user_id',
        'recipients_count',
        'sent_count',
        'success_count',
        'failed_count',
        'cancelled_count',
        'started_at',
        'finished_at',
        'cancelled_at',
        'last_error',
    ];

    protected $casts = [
        'filters' => 'array',
        'message_characters_count' => 'integer',
        'message_parts_count' => 'integer',
        'unit_price' => 'integer',
        'estimated_total_price' => 'integer',
        'spent_total_price' => 'integer',
        'recipients_count' => 'integer',
        'sent_count' => 'integer',
        'success_count' => 'integer',
        'failed_count' => 'integer',
        'cancelled_count' => 'integer',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    public function recipients(): HasMany
    {
        return $this->hasMany(SmsCampaignRecipient::class, 'campaign_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'created_by_user_id');
    }

    public function outbounds(): HasMany
    {
        return $this->hasMany(SmsOutbound::class, 'campaign_id');
    }
}
