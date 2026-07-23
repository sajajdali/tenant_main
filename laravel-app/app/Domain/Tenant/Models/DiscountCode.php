<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DiscountCode extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'code',
        'title',
        'audience_type_id',
        'sales_user_id',
        'applies_to',
        'discount_type',
        'discount_value',
        'maximum_discount_amount',
        'minimum_amount',
        'maximum_amount',
        'max_uses',
        'starts_at',
        'ends_at',
        'is_active',
        'meta_json',
    ];

    protected $casts = [
        'audience_type_id' => 'integer',
        'sales_user_id' => 'integer',
        'discount_value' => 'integer',
        'maximum_discount_amount' => 'integer',
        'minimum_amount' => 'integer',
        'maximum_amount' => 'integer',
        'max_uses' => 'integer',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'is_active' => 'boolean',
        'meta_json' => 'array',
    ];

    public function audienceType(): BelongsTo
    {
        return $this->belongsTo(AudienceType::class, 'audience_type_id');
    }

    public function salesUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sales_user_id');
    }

    public function redemptions(): HasMany
    {
        return $this->hasMany(DiscountCodeRedemption::class, 'discount_code_id');
    }

    public function restrictToTeacherCourses(): bool
    {
        return (bool) ($this->meta_json['restrict_to_teacher_courses'] ?? false);
    }

    public function connectedTeacherId(): ?int
    {
        if ($this->salesUser?->role !== 'teacher') {
            return null;
        }

        return $this->sales_user_id ? (int) $this->sales_user_id : null;
    }
}
