<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Domain\Landing\Models\LandingOrder;
use App\Domain\Landing\Models\LandingSite;
use App\Domain\Landing\Models\SiteProvisionRequest;
use App\Domain\Tenant\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, HasRoles, Notifiable;

    protected $connection = 'central';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'mobile',
        'email',
        'password',
        'role',
        'sales_commission_percent',
        'sales_manager_user_id',
        'sales_manager_commission_percent',
        'is_active',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'is_active' => 'boolean',
            'sales_commission_percent' => 'decimal:2',
            'sales_manager_commission_percent' => 'decimal:2',
            'password' => 'hashed',
        ];
    }

    public function salesManager(): BelongsTo
    {
        return $this->belongsTo(self::class, 'sales_manager_user_id');
    }

    public function salesExperts(): HasMany
    {
        return $this->hasMany(self::class, 'sales_manager_user_id');
    }

    public function salesAssignments(): HasMany
    {
        return $this->hasMany(SalesCustomerAssignment::class, 'sales_expert_user_id');
    }

    public function managedSalesAssignments(): HasMany
    {
        return $this->hasMany(SalesCustomerAssignment::class, 'sales_manager_user_id');
    }

    public function salesFollowUps(): HasMany
    {
        return $this->hasMany(SalesFollowUp::class, 'actor_user_id');
    }

    public function salesCommissionEntries(): HasMany
    {
        return $this->hasMany(SalesCommissionLedger::class, 'sales_expert_user_id');
    }

    public function managedCommissionEntries(): HasMany
    {
        return $this->hasMany(SalesCommissionLedger::class, 'sales_manager_user_id');
    }

    public function salesBankAccounts(): HasMany
    {
        return $this->hasMany(SalesBankAccount::class);
    }

    public function salesWalletTransactions(): HasMany
    {
        return $this->hasMany(SalesWalletTransaction::class);
    }

    public function salesWithdrawalRequests(): HasMany
    {
        return $this->hasMany(SalesWithdrawalRequest::class);
    }

    public function processedSalesWithdrawalRequests(): HasMany
    {
        return $this->hasMany(SalesWithdrawalRequest::class, 'processed_by_user_id');
    }

    public function ownedTenants(): HasMany
    {
        return $this->hasMany(Tenant::class, 'owner_user_id');
    }

    public function createdLandingSites(): HasMany
    {
        return $this->hasMany(LandingSite::class, 'created_by_user_id');
    }

    public function updatedLandingSites(): HasMany
    {
        return $this->hasMany(LandingSite::class, 'updated_by_user_id');
    }

    public function approvedLandingOrders(): HasMany
    {
        return $this->hasMany(LandingOrder::class, 'approved_by_user_id');
    }

    public function assignedSiteProvisionRequests(): HasMany
    {
        return $this->hasMany(SiteProvisionRequest::class, 'assigned_to_user_id');
    }

    public function specializedCourses(): HasMany
    {
        return $this->hasMany(SpecializedCourse::class, 'teacher_user_id');
    }

    public function specializedCourseOrders(): HasMany
    {
        return $this->hasMany(SpecializedCourseOrder::class, 'teacher_user_id');
    }

    public function teacherProfile(): HasOne
    {
        return $this->hasOne(TeacherProfile::class, 'user_id');
    }
}
