<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

$app = require __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$tenant = App\Domain\Tenant\Models\Tenant::query()->firstOrCreate(
    ['slug' => 'demo-barber'],
    [
        'name' => 'Demo Barber',
        'database' => 'tenant_demo_barber',
        'status' => 'active',
    ],
);

if (! $tenant->domains()->where('domain', 'demo.localhost')->exists()) {
    $tenant->createDomain('demo.localhost');
}

$tenant->setInternal('db_name', $tenant->database);
$tenant->setInternal('db_connection', 'tenant_template');
$tenant->save();

echo $tenant->id . PHP_EOL;
