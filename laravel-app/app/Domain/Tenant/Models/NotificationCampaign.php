<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NotificationCampaign extends Model
{
    protected $fillable = [
        'name',
        'preset_key',
        'status',
        'title',
        'message',
        'filters',
        'created_by_user_id',
        'recipients_count',
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
        'recipients_count' => 'integer',
        'success_count' => 'integer',
        'failed_count' => 'integer',
        'cancelled_count' => 'integer',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    public function recipients(): HasMany
    {
        return $this->hasMany(NotificationCampaignRecipient::class, 'campaign_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'created_by_user_id');
    }
}

