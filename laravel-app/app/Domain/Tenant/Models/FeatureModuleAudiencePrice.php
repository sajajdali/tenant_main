<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeatureModuleAudiencePrice extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'feature_module_id',
        'audience_type_id',
        'monthly_price_amount',
    ];

    protected $casts = [
        'feature_module_id' => 'integer',
        'audience_type_id' => 'integer',
        'monthly_price_amount' => 'integer',
    ];

    public function featureModule(): BelongsTo
    {
        return $this->belongsTo(FeatureModule::class, 'feature_module_id');
    }

    public function audienceType(): BelongsTo
    {
        return $this->belongsTo(AudienceType::class, 'audience_type_id');
    }
}
