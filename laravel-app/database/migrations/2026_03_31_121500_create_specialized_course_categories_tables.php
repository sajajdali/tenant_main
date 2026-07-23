<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('specialized_course_category_assignments');
        Schema::dropIfExists('specialized_course_categories');

        Schema::create('specialized_course_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('audience_type_id')->nullable()->constrained('audience_types')->nullOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('specialized_course_category_assignments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('specialized_course_id');
            $table->unsignedBigInteger('specialized_course_category_id');
            $table->timestamps();

            $table->unique('specialized_course_id', 'sc_cat_assign_course_unique');
            $table->foreign('specialized_course_id', 'sc_cat_assign_course_fk')
                ->references('id')
                ->on('specialized_courses')
                ->cascadeOnDelete();
            $table->foreign('specialized_course_category_id', 'sc_cat_assign_category_fk')
                ->references('id')
                ->on('specialized_course_categories')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('specialized_course_category_assignments');
        Schema::dropIfExists('specialized_course_categories');
    }
};
