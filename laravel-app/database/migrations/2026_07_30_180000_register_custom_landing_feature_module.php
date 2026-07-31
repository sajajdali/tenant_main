<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        DB::connection('central')->table('feature_modules')->updateOrInsert(
            ['slug' => 'custom-landing'],
            [
                'name' => 'لندینگ اختصاصی',
                'description' => 'لینک اختصاصی برای جذب کاربران، ثبت سهم پرداخت و مدیریت تسویه همکاران همان سامانه.',
                'monthly_price_amount' => 0,
                'sort_order' => 70,
                'is_active' => true,
                'metadata' => json_encode([
                    'tenant_self_service' => false,
                    'admin_only_activation' => true,
                    'cta_note' => 'این ماژول فقط توسط مدیریت مرکزی برای سامانه های منتخب فعال می شود.',
                ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ],
        );
    }

    public function down(): void
    {
        DB::connection('central')->table('feature_modules')
            ->where('slug', 'custom-landing')
            ->delete();
    }
};
