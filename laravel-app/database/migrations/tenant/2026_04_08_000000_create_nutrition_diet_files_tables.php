<?php

declare(strict_types=1);

use App\Support\Concerns\ChecksNutritionAudience;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    use ChecksNutritionAudience;

    public function up(): void
    {
        if (! $this->isNutritionAudience()) {
            return;
        }

        if (! Schema::hasTable('nutrition_diet_file_groups')) {
            Schema::create('nutrition_diet_file_groups', function (Blueprint $table): void {
                $table->id();
                $table->string('name');
                $table->unsignedInteger('sort_order')->default(0);
                $table->boolean('is_active')->default(true);
                $table->foreignId('created_by_user_id')->nullable();
                $table->timestamps();

                $table->foreign('created_by_user_id', 'nutrition_diet_file_groups_user_fk')
                    ->references('id')
                    ->on('users')
                    ->nullOnDelete();
                $table->index(['is_active', 'sort_order'], 'nutrition_diet_file_groups_active_idx');
            });
        }

        if (! Schema::hasTable('nutrition_diet_files')) {
            Schema::create('nutrition_diet_files', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('nutrition_diet_file_group_id')->nullable();
                $table->string('group_name_snapshot')->nullable();
                $table->string('title');
                $table->text('description')->nullable();
                $table->unsignedInteger('calories')->nullable();
                $table->string('file_name');
                $table->string('file_path');
                $table->string('mime_type', 120)->nullable();
                $table->unsignedBigInteger('file_size')->nullable();
                $table->boolean('is_active')->default(true);
                $table->foreignId('created_by_user_id')->nullable();
                $table->timestamps();

                $table->foreign('nutrition_diet_file_group_id', 'nutrition_diet_files_group_fk')
                    ->references('id')
                    ->on('nutrition_diet_file_groups')
                    ->nullOnDelete();
                $table->foreign('created_by_user_id', 'nutrition_diet_files_user_fk')
                    ->references('id')
                    ->on('users')
                    ->nullOnDelete();
                $table->index(['nutrition_diet_file_group_id', 'is_active'], 'nutrition_diet_files_group_active_idx');
                $table->index(['is_active', 'created_at'], 'nutrition_diet_files_active_created_idx');
            });
        }
    }

    public function down(): void
    {
        if (! $this->isNutritionAudience()) {
            return;
        }

        Schema::dropIfExists('nutrition_diet_files');
        Schema::dropIfExists('nutrition_diet_file_groups');
    }
};
