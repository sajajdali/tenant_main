<?php

declare(strict_types=1);

namespace App\Domain\Landing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class LandingPageSection extends Model
{
    use SoftDeletes;

    protected $connection = 'central';

    protected $fillable = [
        'landing_page_id',
        'section_key',
        'section_type',
        'name',
        'status',
        'sort_order',
        'content_json',
        'settings_json',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'content_json' => 'array',
        'settings_json' => 'array',
    ];

    public function landingPage(): BelongsTo
    {
        return $this->belongsTo(LandingPage::class, 'landing_page_id');
    }
}
