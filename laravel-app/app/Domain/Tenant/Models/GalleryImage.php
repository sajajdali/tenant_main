<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GalleryImage extends Model
{
    protected $fillable = [
        'title',
        'description',
        'disk',
        'path',
        'mime_type',
        'size',
        'sort_order',
        'is_active',
        'uploaded_by_user_id',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    protected $appends = [
        'image_url',
    ];

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'uploaded_by_user_id');
    }

    public function getImageUrlAttribute(): string
    {
        $relativePath = ltrim((string) $this->path, '/');

        if ($relativePath === '') {
            return '';
        }

        return tenant() ? tenant_asset($relativePath) : '/storage/' . $relativePath;
    }
}
