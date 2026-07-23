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
        if (! Schema::hasTable('appointment_booking_closures')) {
            Schema::create('appointment_booking_closures', function (Blueprint $table): void {
                $table->id();
                $table->text('closed_message');
                $table->boolean('notify_opt_in_enabled')->default(false)->index();
                $table->foreignId('sms_campaign_id')->nullable()->constrained('sms_campaigns')->nullOnDelete();
                $table->unsignedBigInteger('closed_by_user_id')->nullable()->index();
                $table->unsignedBigInteger('opened_by_user_id')->nullable()->index();
                $table->timestamp('closed_at')->nullable()->index();
                $table->timestamp('opened_at')->nullable()->index();
                $table->timestamps();
            });
        } else {
            Schema::table('appointment_booking_closures', function (Blueprint $table): void {
                if (! Schema::hasColumn('appointment_booking_closures', 'closed_message')) {
                    $table->text('closed_message')->nullable();
                }

                if (! Schema::hasColumn('appointment_booking_closures', 'notify_opt_in_enabled')) {
                    $table->boolean('notify_opt_in_enabled')->default(false);
                }

                if (! Schema::hasColumn('appointment_booking_closures', 'sms_campaign_id')) {
                    $table->unsignedBigInteger('sms_campaign_id')->nullable();
                }

                if (! Schema::hasColumn('appointment_booking_closures', 'closed_by_user_id')) {
                    $table->unsignedBigInteger('closed_by_user_id')->nullable();
                }

                if (! Schema::hasColumn('appointment_booking_closures', 'opened_by_user_id')) {
                    $table->unsignedBigInteger('opened_by_user_id')->nullable();
                }

                if (! Schema::hasColumn('appointment_booking_closures', 'closed_at')) {
                    $table->timestamp('closed_at')->nullable();
                }

                if (! Schema::hasColumn('appointment_booking_closures', 'opened_at')) {
                    $table->timestamp('opened_at')->nullable();
                }

                if (! Schema::hasColumn('appointment_booking_closures', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }

                if (! Schema::hasColumn('appointment_booking_closures', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }

        if (! Schema::hasTable('appointment_reopen_notification_requests')) {
            Schema::create('appointment_reopen_notification_requests', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('closure_id')->constrained('appointment_booking_closures')->cascadeOnDelete();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('mobile', 20)->index('app_reopen_mobile_idx');
                $table->string('name')->nullable();
                $table->foreignId('sms_campaign_id')->nullable()->constrained('sms_campaigns')->nullOnDelete();
                $table->foreignId('sms_outbound_id')->nullable()->constrained('sms_outbounds')->nullOnDelete();
                $table->string('status', 32)->default('pending')->index('app_reopen_status_idx');
                $table->text('error_message')->nullable();
                $table->timestamp('notified_at')->nullable();
                $table->timestamps();

                $table->unique(['closure_id', 'mobile'], 'app_reopen_closure_mobile_unique');
                $table->index(['closure_id', 'status'], 'app_reopen_closure_status_idx');
            });
        } else {
            Schema::table('appointment_reopen_notification_requests', function (Blueprint $table): void {
                if (! Schema::hasColumn('appointment_reopen_notification_requests', 'closure_id')) {
                    $table->unsignedBigInteger('closure_id');
                }

                if (! Schema::hasColumn('appointment_reopen_notification_requests', 'user_id')) {
                    $table->unsignedBigInteger('user_id')->nullable();
                }

                if (! Schema::hasColumn('appointment_reopen_notification_requests', 'mobile')) {
                    $table->string('mobile', 20);
                }

                if (! Schema::hasColumn('appointment_reopen_notification_requests', 'name')) {
                    $table->string('name')->nullable();
                }

                if (! Schema::hasColumn('appointment_reopen_notification_requests', 'sms_campaign_id')) {
                    $table->unsignedBigInteger('sms_campaign_id')->nullable();
                }

                if (! Schema::hasColumn('appointment_reopen_notification_requests', 'sms_outbound_id')) {
                    $table->unsignedBigInteger('sms_outbound_id')->nullable();
                }

                if (! Schema::hasColumn('appointment_reopen_notification_requests', 'status')) {
                    $table->string('status', 32)->default('pending');
                }

                if (! Schema::hasColumn('appointment_reopen_notification_requests', 'error_message')) {
                    $table->text('error_message')->nullable();
                }

                if (! Schema::hasColumn('appointment_reopen_notification_requests', 'notified_at')) {
                    $table->timestamp('notified_at')->nullable();
                }

                if (! Schema::hasColumn('appointment_reopen_notification_requests', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }

                if (! Schema::hasColumn('appointment_reopen_notification_requests', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }

        if (
            Schema::hasTable('appointment_reopen_notification_requests')
            && Schema::hasColumn('appointment_reopen_notification_requests', 'closure_id')
            && Schema::hasColumn('appointment_reopen_notification_requests', 'mobile')
            && ! $this->indexExists('appointment_reopen_notification_requests', 'app_reopen_closure_mobile_unique')
        ) {
            Schema::table('appointment_reopen_notification_requests', function (Blueprint $table): void {
                $table->unique(['closure_id', 'mobile'], 'app_reopen_closure_mobile_unique');
            });
        }

        if (
            Schema::hasTable('appointment_reopen_notification_requests')
            && Schema::hasColumn('appointment_reopen_notification_requests', 'closure_id')
            && Schema::hasColumn('appointment_reopen_notification_requests', 'status')
            && ! $this->indexExists('appointment_reopen_notification_requests', 'app_reopen_closure_status_idx')
        ) {
            Schema::table('appointment_reopen_notification_requests', function (Blueprint $table): void {
                $table->index(['closure_id', 'status'], 'app_reopen_closure_status_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('appointment_reopen_notification_requests');
        Schema::dropIfExists('appointment_booking_closures');
    }

    private function indexExists(string $table, string $index): bool
    {
        $database = DB::connection()->getDatabaseName();

        return DB::table('information_schema.statistics')
            ->where('TABLE_SCHEMA', $database)
            ->where('TABLE_NAME', $table)
            ->where('INDEX_NAME', $index)
            ->exists();
    }
};
