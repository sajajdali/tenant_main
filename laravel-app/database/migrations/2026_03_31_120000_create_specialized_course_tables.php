<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('specialized_courses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('audience_type_id')->nullable()->constrained('audience_types')->nullOnDelete();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('subtitle')->nullable();
            $table->text('excerpt')->nullable();
            $table->longText('description')->nullable();
            $table->longText('about')->nullable();
            $table->json('learning_points')->nullable();
            $table->json('requirements')->nullable();
            $table->json('faq_items')->nullable();
            $table->string('cover_image_path')->nullable();
            $table->string('hero_image_path')->nullable();
            $table->string('preview_video_path')->nullable();
            $table->unsignedInteger('preview_duration_seconds')->nullable();
            $table->unsignedInteger('price_amount')->default(0);
            $table->unsignedInteger('sale_price_amount')->nullable();
            $table->dateTime('discount_ends_at')->nullable();
            $table->unsignedInteger('manual_students_count')->default(0);
            $table->unsignedInteger('purchased_students_count')->default(0);
            $table->unsignedInteger('reviews_count')->default(0);
            $table->decimal('rating_average', 3, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_published')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->dateTime('published_at')->nullable();
            $table->json('meta_json')->nullable();
            $table->timestamps();
        });

        Schema::create('specialized_course_sections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('specialized_course_id')->constrained('specialized_courses')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('specialized_course_lessons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('specialized_course_section_id')->constrained('specialized_course_sections')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('video_path')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->string('duration_label')->nullable();
            $table->boolean('is_free')->default(false);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->json('meta_json')->nullable();
            $table->timestamps();
        });

        Schema::create('specialized_course_orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number')->unique();
            $table->foreignId('specialized_course_id')->nullable()->constrained('specialized_courses')->nullOnDelete();
            $table->foreignId('teacher_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('sales_customer_assignment_id')->nullable()->constrained('sales_customer_assignments')->nullOnDelete();
            $table->foreignId('sales_expert_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('sales_manager_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('tenant_id')->nullable()->index();
            $table->unsignedBigInteger('tenant_user_id')->nullable();
            $table->string('buyer_name')->nullable();
            $table->string('buyer_mobile', 20)->nullable();
            $table->string('buyer_role', 50)->nullable();
            $table->string('course_title_snapshot')->nullable();
            $table->string('teacher_name_snapshot')->nullable();
            $table->string('status', 50)->default('pending');
            $table->unsignedInteger('subtotal_amount')->default(0);
            $table->unsignedInteger('course_discount_amount')->default(0);
            $table->unsignedInteger('coupon_discount_amount')->default(0);
            $table->unsignedInteger('payable_amount')->default(0);
            $table->decimal('teacher_commission_percent', 5, 2)->nullable();
            $table->unsignedInteger('teacher_commission_amount')->default(0);
            $table->decimal('sales_expert_percent', 5, 2)->nullable();
            $table->unsignedInteger('sales_expert_amount')->default(0);
            $table->decimal('sales_manager_percent', 5, 2)->nullable();
            $table->unsignedInteger('sales_manager_amount')->default(0);
            $table->string('discount_code')->nullable();
            $table->dateTime('paid_at')->nullable();
            $table->json('meta_json')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('specialized_course_orders');
        Schema::dropIfExists('specialized_course_lessons');
        Schema::dropIfExists('specialized_course_sections');
        Schema::dropIfExists('specialized_courses');
    }
};
