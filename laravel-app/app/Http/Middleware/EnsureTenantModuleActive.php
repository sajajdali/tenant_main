<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Services\TenantFeatureModuleManager;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantModuleActive
{
    public function __construct(private readonly TenantFeatureModuleManager $modules)
    {
    }

    public function handle(Request $request, Closure $next, string $slug): Response
    {
        $tenant = tenant();

        abort_if(! $tenant || ! $this->modules->isActive($tenant, $slug), 403, 'این ماژول برای این سامانه فعال نیست.');

        return $next($request);
    }
}
