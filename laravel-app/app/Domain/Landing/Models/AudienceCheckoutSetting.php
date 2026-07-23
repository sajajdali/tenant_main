<?php

declare(strict_types=1);

namespace App\Domain\Landing\Models;

use App\Domain\Tenant\Models\AudienceType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AudienceCheckoutSetting extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'audience_type_id',
        'setup_fee_amount',
        'setup_fee_label',
        'currency',
        'is_active',
        'meta_json',
    ];

    protected $casts = [
        'setup_fee_amount' => 'integer',
        'is_active' => 'boolean',
        'meta_json' => 'array',
    ];

    public function audienceType(): BelongsTo
    {
        return $this->belongsTo(AudienceType::class, 'audience_type_id');
    }
}
