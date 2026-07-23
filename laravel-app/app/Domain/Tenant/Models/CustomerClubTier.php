<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CustomerClubTier extends Model
{
    protected $fillable = [
        'title',
        'slug',
        'badge_color',
        'icon',
        'minimum_points',
        'minimum_wallet',
        'sort_order',
        'is_active',
        'benefits',
        'metadata',
    ];

    protected $casts = [
        'minimum_points' => 'integer',
        'minimum_wallet' => 'integer',
        'sort_order' => 'integer',
        'is_active' => 'boolean',
        'benefits' => 'array',
        'metadata' => 'array',
    ];

    public function memberAccounts(): HasMany
    {
        return $this->hasMany(CustomerClubMemberAccount::class, 'current_tier_id');
    }
}
