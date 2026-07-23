<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Services\TenantStorageService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantStorageAvailable
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->is('api/v1/files*') || $request->is('api/v1/support-renewal/storage*')) {
            return $next($request);
        }

        $usage = app(TenantStorageService::class)->usage(tenant());

        if (! ($usage['isFull'] ?? false)) {
            return $next($request);
        }

        return response()->json([
            'success' => false,
            'message' => 'فضای ذخیره‌سازی شما پر شده است. برای ادامه مدیریت سایت، فضای اضافه خریداری کنید.',
            'data' => [
                'storage' => $usage,
                'storage_full' => true,
            ],
        ], 423);
    }
}
