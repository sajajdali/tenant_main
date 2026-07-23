<?php

declare(strict_types=1);

use App\Models\SystemSetting;
use App\Support\SmsPricing;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => SmsPricing::SYSTEM_KEY],
            ['value' => SmsPricing::defaults()],
        );
    }

    public function down(): void
    {
        SystemSetting::query()
            ->where('key', SmsPricing::SYSTEM_KEY)
            ->delete();
    }
};
