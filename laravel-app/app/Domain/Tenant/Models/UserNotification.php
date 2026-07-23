<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserNotification extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_user_id',
        'recipient_mobile',
        'recipient_name',
        'recipient_role',
        'title',
        'message',
        'sender_central_user_id',
        'sender_name',
        'target_type',
        'meta',
        'is_read',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
            'is_read' => 'boolean',
            'read_at' => 'datetime',
        ];
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'tenant_user_id');
    }
}

