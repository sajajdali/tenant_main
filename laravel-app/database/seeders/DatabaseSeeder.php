<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            SystemSettingsSeeder::class,
            AdminUserSeeder::class,
            RolesAndPermissionsSeeder::class,
            SubscriptionPackageSeeder::class,
            AudienceTypeSeeder::class,
            FeatureModuleSeeder::class,
            NutritionExerciseSeeder::class,
        ]);
    }
}
