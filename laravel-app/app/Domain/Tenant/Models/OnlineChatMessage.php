<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OnlineChatMessage extends Model
{
    protected $fillable = [
        'conversation_id',
        'sender_user_id',
        'sender_type',
        'sender_name',
        'sender_role',
        'body',
        'attachments_count',
    ];

    protected function casts(): array
    {
        return [
            'attachments_count' => 'integer',
        ];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(OnlineChatConversation::class, 'conversation_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'sender_user_id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(OnlineChatAttachment::class, 'message_id');
    }
}
