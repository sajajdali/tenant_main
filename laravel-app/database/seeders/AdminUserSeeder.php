<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        User::query()->updateOrCreate(
            ['mobile' => '09122978167'],
            [
                'name' => 'مدیر سیستم',
                'email' => 'admin@barber.local',
                'password' => '1234',
                'role' => 'admin',
                'is_active' => true,
            ],
        );
    }
}
