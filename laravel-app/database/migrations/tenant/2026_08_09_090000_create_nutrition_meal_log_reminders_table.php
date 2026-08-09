<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('nutrition_diet_prescriptions')) {
            return;
        }

        Schema::create('nutrition_meal_log_reminders', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('nutrition_diet_prescription_id');
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('sms_outbound_id')->nullable()->constrained('sms_outbounds')->nullOnDelete();
            $table->string('template_key', 120);
            $table->unsignedTinyInteger('reminder_number');
            $table->date('reminder_due_date');
            $table->timestamp('queued_at')->nullable();
            $table->timestamps();

            $table->foreign('nutrition_diet_prescription_id', 'nutrition_meal_log_reminders_prescription_fk')
                ->references('id')
                ->on('nutrition_diet_prescriptions')
                ->cascadeOnDelete();
            $table->unique(['nutrition_diet_prescription_id', 'reminder_number'], 'nutrition_meal_log_reminders_once_unique');
            $table->index(['user_id', 'template_key'], 'nutrition_meal_log_reminders_user_template_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nutrition_meal_log_reminders');
    }
};
