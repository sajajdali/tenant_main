<?php

declare(strict_types=1);

namespace App\Domain\Store\Models;

use App\Domain\Tenant\Models\TenantUser;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StoreProductReview extends Model
{
    protected $fillable = [
        'store_product_id',
        'tenant_user_id',
        'reviewer_name',
        'rating',
        'body',
        'admin_reply',
        'is_approved',
        'approved_at',
    ];

    protected $casts = [
        'rating' => 'integer',
        'is_approved' => 'boolean',
        'approved_at' => 'datetime',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(StoreProduct::class, 'store_product_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'tenant_user_id');
    }
}
