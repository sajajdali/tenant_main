<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landing_customers', function (Blueprint $table) {
            $table->id();
            $table->string('mobile', 20)->unique();
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('full_name')->nullable();
            $table->string('email')->nullable()->unique();
            $table->string('gender', 20)->nullable();
            $table->string('national_code', 20)->nullable()->unique();
            $table->date('birth_date')->nullable();
            $table->unsignedInteger('province_id')->nullable();
            $table->string('province_name')->nullable();
            $table->unsignedInteger('city_id')->nullable();
            $table->string('city_name')->nullable();
            $table->text('address_line')->nullable();
            $table->string('postal_code', 20)->nullable();
            $table->string('status', 40)->default('active')->index();
            $table->timestamp('last_login_at')->nullable();
            $table->json('meta_json')->nullable();
            $table->timestamps();
        });

        Schema::create('audience_checkout_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('audience_type_id')->constrained('audience_types')->cascadeOnDelete();
            $table->unsignedBigInteger('setup_fee_amount')->default(0);
            $table->string('setup_fee_label')->nullable();
            $table->string('currency', 10)->default('IRR');
            $table->boolean('is_active')->default(true);
            $table->json('meta_json')->nullable();
            $table->timestamps();

            $table->unique('audience_type_id');
        });

        Schema::create('domain_tld_prices', function (Blueprint $table) {
            $table->id();
            $table->string('tld', 20)->unique();
            $table->unsignedBigInteger('register_price_amount')->default(0);
            $table->unsignedBigInteger('renew_price_amount')->default(0);
            $table->unsignedBigInteger('transfer_price_amount')->nullable();
            $table->string('currency', 10)->default('IRR');
            $table->boolean('is_active')->default(true);
            $table->json('meta_json')->nullable();
            $table->timestamps();
        });

        Schema::create('landing_orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number')->unique();
            $table->foreignId('landing_customer_id')->constrained('landing_customers')->cascadeOnDelete();
            $table->foreignId('landing_site_id')->nullable()->constrained('landing_sites')->nullOnDelete();
            $table->foreignId('audience_type_id')->constrained('audience_types')->cascadeOnDelete();
            $table->foreignId('subscription_package_id')->constrained('subscription_packages')->cascadeOnDelete();
            $table->foreignId('approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('tenant_id')->nullable();
            $table->string('requested_domain')->nullable()->index();
            $table->string('requested_domain_tld', 20)->nullable()->index();
            $table->string('requested_domain_whois_status', 40)->default('pending')->index();
            $table->timestamp('requested_domain_checked_at')->nullable();
            $table->json('requested_domain_whois_payload')->nullable();
            $table->unsignedInteger('duration_days');
            $table->unsignedInteger('requested_user_limit')->nullable();
            $table->unsignedBigInteger('package_price_amount')->default(0);
            $table->unsignedBigInteger('setup_fee_amount')->default(0);
            $table->unsignedBigInteger('domain_price_amount')->default(0);
            $table->unsignedBigInteger('discount_amount')->default(0);
            $table->unsignedBigInteger('subtotal_amount')->default(0);
            $table->unsignedBigInteger('total_amount')->default(0);
            $table->string('currency', 10)->default('IRR');
            $table->string('status', 40)->default('draft')->index();
            $table->string('customer_full_name');
            $table->string('customer_mobile', 20);
            $table->string('customer_email')->nullable();
            $table->string('customer_gender', 20)->nullable();
            $table->string('customer_national_code', 20)->nullable();
            $table->date('customer_birth_date')->nullable();
            $table->string('customer_province_name')->nullable();
            $table->string('customer_city_name')->nullable();
            $table->text('customer_address_line')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('provision_requested_at')->nullable();
            $table->timestamp('provisioned_at')->nullable();
            $table->json('meta_json')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->nullOnDelete();
        });

        Schema::create('landing_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landing_order_id')->constrained('landing_orders')->cascadeOnDelete();
            $table->string('type', 60)->index();
            $table->string('code', 80)->nullable()->index();
            $table->string('title');
            $table->text('description')->nullable();
            $table->unsignedInteger('quantity')->default(1);
            $table->unsignedBigInteger('unit_amount')->default(0);
            $table->unsignedBigInteger('total_amount')->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->json('meta_json')->nullable();
            $table->timestamps();
        });

        Schema::create('site_provision_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landing_order_id')->constrained('landing_orders')->cascadeOnDelete();
            $table->foreignId('landing_customer_id')->constrained('landing_customers')->cascadeOnDelete();
            $table->foreignId('assigned_to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('tenant_id')->nullable();
            $table->string('status', 40)->default('pending')->index();
            $table->string('requested_domain')->nullable()->index();
            $table->string('requested_domain_tld', 20)->nullable();
            $table->string('requested_package_name')->nullable();
            $table->unsignedInteger('requested_duration_days')->nullable();
            $table->unsignedInteger('requested_user_limit')->nullable();
            $table->text('customer_note')->nullable();
            $table->text('admin_note')->nullable();
            $table->json('requested_payload')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamps();

            $table->unique('landing_order_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_provision_requests');
        Schema::dropIfExists('landing_order_items');
        Schema::dropIfExists('landing_orders');
        Schema::dropIfExists('domain_tld_prices');
        Schema::dropIfExists('audience_checkout_settings');
        Schema::dropIfExists('landing_customers');
    }
};
