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
        if (! $this->isNutritionAudience() || ! Schema::hasTable('nutrition_diet_requests')) {
            return;
        }

        Schema::table('nutrition_diet_requests', function (Blueprint $table): void {
            if (! Schema::hasColumn('nutrition_diet_requests', 'ai_requested_by_user_id')) {
                $table->foreignId('ai_requested_by_user_id')->nullable()->constrained('users')->nullOnDelete()->after('ends_at');
            }

            if (! Schema::hasColumn('nutrition_diet_requests', 'ai_generation_status')) {
                $table->enum('ai_generation_status', ['not_requested', 'queued', 'processing', 'generated', 'failed'])->default('not_requested')->after('ai_requested_by_user_id');
            }

            if (! Schema::hasColumn('nutrition_diet_requests', 'expert_notes')) {
                $table->text('expert_notes')->nullable()->after('ai_generation_status');
            }

            if (! Schema::hasColumn('nutrition_diet_requests', 'clinical_notes')) {
                $table->text('clinical_notes')->nullable()->after('expert_notes');
            }

            if (! Schema::hasColumn('nutrition_diet_requests', 'generation_instructions')) {
                $table->longText('generation_instructions')->nullable()->after('clinical_notes');
            }

            if (! Schema::hasColumn('nutrition_diet_requests', 'must_include')) {
                $table->text('must_include')->nullable()->after('generation_instructions');
            }

            if (! Schema::hasColumn('nutrition_diet_requests', 'must_avoid')) {
                $table->text('must_avoid')->nullable()->after('must_include');
            }

            if (! Schema::hasColumn('nutrition_diet_requests', 'ai_job_dispatched_at')) {
                $table->timestamp('ai_job_dispatched_at')->nullable()->after('must_avoid');
            }

            if (! Schema::hasColumn('nutrition_diet_requests', 'ai_generated_at')) {
                $table->timestamp('ai_generated_at')->nullable()->after('ai_job_dispatched_at');
            }

            if (! Schema::hasColumn('nutrition_diet_requests', 'ai_generation_error')) {
                $table->text('ai_generation_error')->nullable()->after('ai_generated_at');
            }

            if (! Schema::hasColumn('nutrition_diet_requests', 'profile_snapshot')) {
                $table->json('profile_snapshot')->nullable()->after('ai_generation_error');
            }

            if (! Schema::hasColumn('nutrition_diet_requests', 'template_snapshot')) {
                $table->json('template_snapshot')->nullable()->after('profile_snapshot');
            }

            if (! Schema::hasColumn('nutrition_diet_requests', 'request_payload_snapshot')) {
                $table->json('request_payload_snapshot')->nullable()->after('template_snapshot');
            }

            if (! Schema::hasColumn('nutrition_diet_requests', 'ai_prompt_snapshot')) {
                $table->json('ai_prompt_snapshot')->nullable()->after('request_payload_snapshot');
            }

            if (! Schema::hasColumn('nutrition_diet_requests', 'ai_response_snapshot')) {
                $table->json('ai_response_snapshot')->nullable()->after('ai_prompt_snapshot');
            }
        });
    }

    public function down(): void
    {
        if (! $this->isNutritionAudience() || ! Schema::hasTable('nutrition_diet_requests')) {
            return;
        }

        Schema::table('nutrition_diet_requests', function (Blueprint $table): void {
            if (Schema::hasColumn('nutrition_diet_requests', 'ai_requested_by_user_id')) {
                $table->dropConstrainedForeignId('ai_requested_by_user_id');
            }

            $columns = [
                'ai_generation_status',
                'expert_notes',
                'clinical_notes',
                'generation_instructions',
                'must_include',
                'must_avoid',
                'ai_job_dispatched_at',
                'ai_generated_at',
                'ai_generation_error',
                'profile_snapshot',
                'template_snapshot',
                'request_payload_snapshot',
                'ai_prompt_snapshot',
                'ai_response_snapshot',
            ];

            $existing = array_values(array_filter($columns, fn (string $column): bool => Schema::hasColumn('nutrition_diet_requests', $column)));

            if ($existing !== []) {
                $table->dropColumn($existing);
            }
        });
    }
};
