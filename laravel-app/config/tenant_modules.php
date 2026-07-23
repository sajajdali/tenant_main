<?php

declare(strict_types=1);

use Database\Seeders\Tenant\Modules\CookingRecipesSeeder;

return [
    'modules' => [
        'online-chat' => [
            'label' => 'چت آنلاین',
            'meta_key' => 'onlineChat',
            'route_prefix' => 'online-chat',
            'migration_path' => null,
            'seeder' => null,
        ],
        'customer-club' => [
            'label' => 'باشگاه مشتریان',
            'meta_key' => 'customerClub',
            'route_prefix' => 'customer-club',
            'migration_path' => null,
            'seeder' => null,
        ],
        'vip-customers' => [
            'label' => 'مشتریان VIP',
            'meta_key' => 'vipCustomers',
            'route_prefix' => 'vip-customers',
            'migration_path' => null,
            'seeder' => null,
        ],
        'cooking-recipes' => [
            'label' => 'دستور آشپزی',
            'meta_key' => 'cookingRecipes',
            'route_prefix' => 'cooking-recipes',
            // This nested path is intentionally excluded from tenants:migrate.
            // TenantFeatureModuleManager runs it only when this module is activated.
            'migration_path' => database_path('migrations/tenant/modules/cooking-recipes'),
            'seeder' => CookingRecipesSeeder::class,
        ],
    ],
];
