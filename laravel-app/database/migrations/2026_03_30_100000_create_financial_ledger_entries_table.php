<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('financial_ledger_entries', function (Blueprint $table): void {
            $table->id();
            $table->string('entry_type', 64)->index();
            $table->string('direction', 16)->default('expense')->index();
            $table->string('source_type', 64)->nullable()->index();
            $table->string('source_id', 100)->nullable();
            $table->string('tenant_id')->nullable()->index();
            $table->string('title')->nullable();
            $table->unsignedBigInteger('amount')->default(0);
            $table->timestamp('occurred_at')->nullable()->index();
            $table->json('meta_json')->nullable();
            $table->timestamps();

            $table->unique(['entry_type', 'source_type', 'source_id'], 'financial_entries_source_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('financial_ledger_entries');
    }
};
