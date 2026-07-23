<?php

declare(strict_types=1);

namespace App\Domain\Landing\Models;

use App\Domain\Tenant\Models\AudienceType;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class LandingSite extends Model
{
    use SoftDeletes;

    protected $connection = 'central';

    protected $fillable = [
        'audience_type_id',
        'created_by_user_id',
        'updated_by_user_id',
        'name',
        'slug',
        'status',
        'theme_mode',
        'is_active',
        'is_default',
        'appearance_json',
        'seo_json',
        'settings_json',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_default' => 'boolean',
        'appearance_json' => 'array',
        'seo_json' => 'array',
        'settings_json' => 'array',
    ];

    public function audienceType(): BelongsTo
    {
        return $this->belongsTo(AudienceType::class, 'audience_type_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_user_id');
    }

    public function domains(): HasMany
    {
        return $this->hasMany(LandingSiteDomain::class, 'landing_site_id');
    }

    public function pages(): HasMany
    {
        return $this->hasMany(LandingPage::class, 'landing_site_id')->orderBy('sort_order');
    }

    public function features(): HasMany
    {
        return $this->hasMany(LandingFeature::class, 'landing_site_id')->orderBy('sort_order');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(LandingOrder::class, 'landing_site_id');
    }

    public function contactSubmissions(): HasMany
    {
        return $this->hasMany(LandingContactSubmission::class, 'landing_site_id');
    }
}
