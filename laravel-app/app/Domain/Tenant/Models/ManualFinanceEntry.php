<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use App\Domain\Booking\Models\Appointment;
use App\Domain\Booking\Models\Professional;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ManualFinanceEntry extends Model
{
    protected $fillable = [
        'appointment_id',
        'professional_id',
        'created_by_user_id',
        'customer_user_id',
        'customer_name_snapshot',
        'customer_phone_snapshot',
        'entry_date',
        'total_amount',
        'paid_amount',
        'balance_amount',
        'material_cost_amount',
        'professional_share_amount',
        'business_share_amount',
        'payment_method',
        'status',
        'items',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'entry_date' => 'date:Y-m-d',
            'total_amount' => 'integer',
            'paid_amount' => 'integer',
            'balance_amount' => 'integer',
            'material_cost_amount' => 'integer',
            'professional_share_amount' => 'integer',
            'business_share_amount' => 'integer',
            'items' => 'array',
        ];
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    public function professional(): BelongsTo
    {
        return $this->belongsTo(Professional::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'created_by_user_id');
    }

    public function customerUser(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'customer_user_id');
    }
}
