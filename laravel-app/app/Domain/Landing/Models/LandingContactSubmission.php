<?php

declare(strict_types=1);

namespace App\Domain\Landing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LandingContactSubmission extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'landing_site_id',
        'landing_page_id',
        'full_name',
        'mobile',
        'email',
        'message',
        'status',
        'submitted_at',
        'reviewed_at',
        'meta_json',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'reviewed_at' => 'datetime',
        'meta_json' => 'array',
    ];

    public function landingSite(): BelongsTo
    {
        return $this->belongsTo(LandingSite::class, 'landing_site_id');
    }

    public function landingPage(): BelongsTo
    {
        return $this->belongsTo(LandingPage::class, 'landing_page_id');
    }
}
