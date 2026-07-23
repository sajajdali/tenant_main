<?php

declare(strict_types=1);

namespace App\Domain\Support\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupportTicketAttachment extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'message_id',
        'disk',
        'path',
        'original_name',
        'mime_type',
        'size',
    ];

    protected $appends = [
        'url',
    ];

    public function message(): BelongsTo
    {
        return $this->belongsTo(SupportTicketMessage::class, 'message_id');
    }

    public function getUrlAttribute(): string
    {
        $relativePath = ltrim((string) $this->path, '/');

        if (in_array($this->disk, ['public', 'support_public'], true) && $relativePath !== '') {
            return '/storage/' . $relativePath;
        }

        return '/support-attachments/' . $this->getKey();
    }
}
