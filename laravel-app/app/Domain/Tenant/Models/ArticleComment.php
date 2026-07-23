<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ArticleComment extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    protected $table = 'articles_comments';

    protected $fillable = [
        'article_post_id',
        'tenant_user_id',
        'author_name',
        'author_mobile',
        'body',
        'status',
        'approved_at',
    ];

    protected function casts(): array
    {
        return [
            'article_post_id' => 'integer',
            'tenant_user_id' => 'integer',
            'approved_at' => 'datetime',
        ];
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(ArticlePost::class, 'article_post_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'tenant_user_id');
    }
}
