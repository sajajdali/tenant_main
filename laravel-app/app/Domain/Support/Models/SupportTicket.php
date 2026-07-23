<?php

declare(strict_types=1);

namespace App\Domain\Support\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupportTicket extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'tenant_id',
        'tenant_name',
        'tenant_domain',
        'requester_tenant_user_id',
        'requester_name',
        'requester_mobile',
        'requester_role',
        'subject',
        'status',
        'messages_count',
        'requester_unread_count',
        'admin_unread_count',
        'last_message_at',
        'requester_last_seen_at',
        'admin_last_seen_at',
        'closed_at',
        'closed_by_central_user_id',
        'closed_by_requester_tenant_user_id',
    ];

    protected $casts = [
        'messages_count' => 'integer',
        'requester_unread_count' => 'integer',
        'admin_unread_count' => 'integer',
        'last_message_at' => 'datetime',
        'requester_last_seen_at' => 'datetime',
        'admin_last_seen_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    public function messages(): HasMany
    {
        return $this->hasMany(SupportTicketMessage::class, 'ticket_id');
    }
}
