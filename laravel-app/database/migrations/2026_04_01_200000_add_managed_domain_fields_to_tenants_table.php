<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table): void {
            $table->string('domain_management_mode', 30)->default('platform_managed')->after('support_ends_at');
            $table->string('managed_domain_tld', 20)->nullable()->after('domain_management_mode');
            $table->boolean('managed_domain_registered')->default(false)->after('managed_domain_tld');
            $table->date('managed_domain_registered_at')->nullable()->after('managed_domain_registered');
            $table->date('managed_domain_last_paid_at')->nullable()->after('managed_domain_registered_at');
            $table->date('managed_domain_renews_at')->nullable()->after('managed_domain_last_paid_at');
            $table->unsignedInteger('managed_domain_amount')->nullable()->after('managed_domain_renews_at');
        });

        DB::connection('central')->table('tenants')
            ->where('ir_domain_registered', true)
            ->update([
                'managed_domain_tld' => DB::raw("COALESCE(managed_domain_tld, '.ir')"),
                'managed_domain_registered' => DB::raw('COALESCE(managed_domain_registered, 0) | ir_domain_registered'),
                'managed_domain_registered_at' => DB::raw('COALESCE(managed_domain_registered_at, ir_domain_registered_at)'),
                'managed_domain_last_paid_at' => DB::raw('COALESCE(managed_domain_last_paid_at, ir_domain_last_paid_at)'),
                'managed_domain_renews_at' => DB::raw('COALESCE(managed_domain_renews_at, ir_domain_renews_at)'),
                'managed_domain_amount' => DB::raw('COALESCE(managed_domain_amount, ir_domain_amount)'),
            ]);
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table): void {
            $table->dropColumn([
                'domain_management_mode',
                'managed_domain_tld',
                'managed_domain_registered',
                'managed_domain_registered_at',
                'managed_domain_last_paid_at',
                'managed_domain_renews_at',
                'managed_domain_amount',
            ]);
        });
    }
};
