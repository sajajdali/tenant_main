<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class CustomLandingPartner extends Model
{
    use SoftDeletes;

    protected $fillable = ['name', 'mobile', 'status', 'public_token', 'first_payment_percent', 'recurring_payment_percent', 'bank_card_number', 'iban', 'notes', 'created_by_user_id'];

    protected function casts(): array
    {
        return ['first_payment_percent' => 'decimal:2', 'recurring_payment_percent' => 'decimal:2'];
    }

    public function attributions(): HasMany
    {
        return $this->hasMany(CustomLandingAttribution::class);
    }

    public function commissions(): HasMany
    {
        return $this->hasMany(CustomLandingCommission::class);
    }

    public function settlements(): HasMany
    {
        return $this->hasMany(CustomLandingSettlement::class);
    }
}
