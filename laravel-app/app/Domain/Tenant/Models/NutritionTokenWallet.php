<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NutritionTokenWallet extends Model
{
    protected $fillable = [
        'balance_tokens',
        'purchased_tokens',
        'used_tokens',
        'settings_json',
    ];

    protected function casts(): array
    {
        return [
            'balance_tokens' => 'integer',
            'purchased_tokens' => 'integer',
            'used_tokens' => 'integer',
            'settings_json' => 'array',
        ];
    }

    public function ledgers(): HasMany
    {
        return $this->hasMany(NutritionTokenLedger::class, 'nutrition_token_wallet_id');
    }
}
