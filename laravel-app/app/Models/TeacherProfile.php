<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TeacherProfile extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'user_id',
        'commission_percent',
        'meta_json',
    ];

    protected $casts = [
        'commission_percent' => 'decimal:2',
        'meta_json' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
