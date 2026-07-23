<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Support\SmsGatewaySettings;
use App\Support\SmsPricing;
use App\Support\SmsSenderRegistry;
use Illuminate\Database\Seeder;

class SystemSettingsSeeder extends Seeder
{
    public function run(): void
    {
        SmsGatewaySettings::put(SmsGatewaySettings::defaults());
        SmsPricing::put(SmsPricing::defaults());
        SmsSenderRegistry::put(SmsSenderRegistry::defaults());
    }
}
