<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ArticlePost extends Model
{
    protected $table = 'articles_posts';

    protected $fillable = [
        'article_category_id',
        'title',
        'slug',
        'excerpt',
        'content',
        'key_points',
        'author_name',
        'image_path',
        'sort_order',
        'is_active',
        'is_featured',
        'show_in_featured_slider',
        'is_important',
        'published_at',
        'view_count',
    ];

    protected function casts(): array
    {
        return [
            'article_category_id' => 'integer',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
            'show_in_featured_slider' => 'boolean',
            'is_important' => 'boolean',
            'published_at' => 'datetime',
            'view_count' => 'integer',
            'key_points' => 'array',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ArticleCategory::class, 'article_category_id');
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(ArticleTag::class, 'articles_post_tag_assignments', 'article_post_id', 'article_tag_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(ArticleComment::class, 'article_post_id');
    }
}
