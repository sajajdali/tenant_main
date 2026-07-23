<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Tenant\Models\GeneralSetting;
use App\Support\TenantLocale;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class SetTenantLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        TenantLocale::apply($this->generalSetting(), $request);

        return $next($request);
    }

    private function generalSetting(): ?GeneralSetting
    {
        try {
            if (! function_exists('tenant') || tenant('id') === null) {
                return null;
            }

            return GeneralSetting::query()->first();
        } catch (Throwable) {
            return null;
        }
    }
}
