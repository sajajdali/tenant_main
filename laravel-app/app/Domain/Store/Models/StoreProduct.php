<?php

declare(strict_types=1);

namespace App\Domain\Store\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StoreProduct extends Model
{
    protected $fillable = [
        'store_category_id',
        'title',
        'slug',
        'subtitle',
        'description',
        'image_path',
        'price_amount',
        'discounted_price_amount',
        'stock_quantity',
        'sort_order',
        'is_active',
        'is_featured',
        'is_bestseller',
        'is_popular',
        'metadata',
    ];

    protected $casts = [
        'price_amount' => 'integer',
        'discounted_price_amount' => 'integer',
        'stock_quantity' => 'integer',
        'sort_order' => 'integer',
        'is_active' => 'boolean',
        'is_featured' => 'boolean',
        'is_bestseller' => 'boolean',
        'is_popular' => 'boolean',
        'metadata' => 'array',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(StoreCategory::class, 'store_category_id');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(StoreProductReview::class);
    }
}
