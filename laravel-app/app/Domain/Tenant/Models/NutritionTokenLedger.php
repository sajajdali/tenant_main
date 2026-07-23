<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NutritionTokenLedger extends Model
{
    protected $fillable = [
        'nutrition_token_wallet_id',
        'actor_user_id',
        'subject_user_id',
        'nutrition_diet_request_id',
        'tokens_amount',
        'direction',
        'event_type',
        'balance_after',
        'reason_title',
        'reason_code',
        'meta_json',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'tokens_amount' => 'integer',
            'balance_after' => 'integer',
            'meta_json' => 'array',
            'occurred_at' => 'datetime',
        ];
    }

    public function wallet(): BelongsTo
    {
        return $this->belongsTo(NutritionTokenWallet::class, 'nutrition_token_wallet_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'actor_user_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'subject_user_id');
    }

    public function dietRequest(): BelongsTo
    {
        return $this->belongsTo(NutritionDietRequest::class, 'nutrition_diet_request_id');
    }
}
