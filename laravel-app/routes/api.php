<?php

declare(strict_types=1);

use App\Http\Controllers\Central\TenantController;
use Illuminate\Support\Facades\Route;

foreach (config('tenancy.central_domains') as $domain) {
    Route::domain($domain)->prefix('v1')->group(function () {
        Route::get('/tenants', [TenantController::class, 'index']);
        Route::post('/tenants', [TenantController::class, 'store']);
        Route::get('/tenants/{tenant}', [TenantController::class, 'show']);
        Route::patch('/tenants/{tenant}', [TenantController::class, 'update']);
        Route::post('/tenants/{tenant}/domains', [TenantController::class, 'attachDomain']);
    });
}
