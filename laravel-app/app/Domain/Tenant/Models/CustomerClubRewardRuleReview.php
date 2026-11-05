<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerClubRewardRuleReview extends Model
{
    protected $fillable = ['award_id', 'status', 'reviewed_by_user_id', 'note', 'reviewed_at'];

    protected $casts = ['reviewed_at' => 'datetime'];

    public function award(): BelongsTo
    {
        return $this->belongsTo(CustomerClubRewardRuleAward::class, 'award_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'reviewed_by_user_id');
    }
}
