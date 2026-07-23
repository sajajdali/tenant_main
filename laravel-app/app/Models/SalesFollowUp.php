<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalesFollowUp extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'sales_customer_assignment_id',
        'actor_user_id',
        'actor_role',
        'follow_up_type',
        'result_status',
        'summary',
        'details',
        'scheduled_for',
        'followed_at',
        'next_follow_up_at',
        'meta_json',
    ];

    protected $casts = [
        'scheduled_for' => 'datetime',
        'followed_at' => 'datetime',
        'next_follow_up_at' => 'datetime',
        'meta_json' => 'array',
    ];

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(SalesCustomerAssignment::class, 'sales_customer_assignment_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
