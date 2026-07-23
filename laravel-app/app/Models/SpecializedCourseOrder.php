<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SpecializedCourseOrder extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'order_number',
        'specialized_course_id',
        'teacher_user_id',
        'sales_customer_assignment_id',
        'sales_expert_user_id',
        'sales_manager_user_id',
        'tenant_id',
        'tenant_user_id',
        'buyer_name',
        'buyer_mobile',
        'buyer_role',
        'course_title_snapshot',
        'teacher_name_snapshot',
        'status',
        'subtotal_amount',
        'course_discount_amount',
        'coupon_discount_amount',
        'payable_amount',
        'teacher_commission_percent',
        'teacher_commission_amount',
        'sales_expert_percent',
        'sales_expert_amount',
        'sales_manager_percent',
        'sales_manager_amount',
        'discount_code',
        'paid_at',
        'meta_json',
    ];

    protected $casts = [
        'sales_customer_assignment_id' => 'integer',
        'sales_expert_user_id' => 'integer',
        'sales_manager_user_id' => 'integer',
        'tenant_user_id' => 'integer',
        'subtotal_amount' => 'integer',
        'course_discount_amount' => 'integer',
        'coupon_discount_amount' => 'integer',
        'payable_amount' => 'integer',
        'teacher_commission_percent' => 'decimal:2',
        'teacher_commission_amount' => 'integer',
        'sales_expert_percent' => 'decimal:2',
        'sales_expert_amount' => 'integer',
        'sales_manager_percent' => 'decimal:2',
        'sales_manager_amount' => 'integer',
        'paid_at' => 'datetime',
        'meta_json' => 'array',
    ];

    public function course(): BelongsTo
    {
        return $this->belongsTo(SpecializedCourse::class, 'specialized_course_id');
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_user_id');
    }

    public function salesAssignment(): BelongsTo
    {
        return $this->belongsTo(SalesCustomerAssignment::class, 'sales_customer_assignment_id');
    }

    public function salesExpert(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sales_expert_user_id');
    }

    public function salesManager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sales_manager_user_id');
    }
}
