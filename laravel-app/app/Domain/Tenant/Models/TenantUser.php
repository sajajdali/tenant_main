<?php

declare(strict_types=1);

namespace App\Domain\Tenant\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class TenantUser extends Authenticatable
{
    use HasApiTokens;
    use HasFactory;
    use HasRoles;
    use Notifiable;

    protected $table = 'users';

    protected string $guard_name = 'tenant_web';

    protected $fillable = [
        'central_user_id',
        'name',
        'mobile',
        'gender',
        'national_code',
        'birth_date',
        'province_id',
        'province_name',
        'city_id',
        'city_name',
        'job_title',
        'nutrition_profile_fixed_message',
        'email',
        'password',
        'role',
        'is_active',
        'can_book',
        'is_vip',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'birth_date' => 'date',
            'is_active' => 'boolean',
            'can_book' => 'boolean',
            'is_vip' => 'boolean',
            'password' => 'hashed',
        ];
    }

    public function nutritionProfile(): HasOne
    {
        return $this->hasOne(NutritionProfile::class, 'user_id');
    }
}
