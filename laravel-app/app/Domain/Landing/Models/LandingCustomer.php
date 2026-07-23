<?php

declare(strict_types=1);

namespace App\Domain\Landing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LandingCustomer extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'mobile',
        'first_name',
        'last_name',
        'full_name',
        'email',
        'gender',
        'national_code',
        'birth_date',
        'province_id',
        'province_name',
        'city_id',
        'city_name',
        'address_line',
        'postal_code',
        'status',
        'last_login_at',
        'meta_json',
    ];

    protected $casts = [
        'birth_date' => 'date',
        'province_id' => 'integer',
        'city_id' => 'integer',
        'last_login_at' => 'datetime',
        'meta_json' => 'array',
    ];

    public function orders(): HasMany
    {
        return $this->hasMany(LandingOrder::class, 'landing_customer_id');
    }

    public function provisionRequests(): HasMany
    {
        return $this->hasMany(SiteProvisionRequest::class, 'landing_customer_id');
    }
}
