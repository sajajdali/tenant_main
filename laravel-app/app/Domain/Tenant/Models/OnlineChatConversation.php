<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OnlineChatConversation extends Model
{
    protected $fillable = [
        'customer_user_id',
        'assigned_to_user_id',
        'status',
        'last_message_preview',
        'last_message_sender_role',
        'last_message_at',
        'customer_unread_count',
        'admin_unread_count',
        'customer_last_seen_at',
        'admin_last_seen_at',
        'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'last_message_at' => 'datetime',
            'customer_unread_count' => 'integer',
            'admin_unread_count' => 'integer',
            'customer_last_seen_at' => 'datetime',
            'admin_last_seen_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'customer_user_id');
    }

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'assigned_to_user_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(OnlineChatMessage::class, 'conversation_id');
    }
}
