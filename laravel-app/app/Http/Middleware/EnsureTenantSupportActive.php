<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Support\TenantSupport;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantSupportActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $support = TenantSupport::summary();

        if (! $support['supportExpired']) {
            return $next($request);
        }

        return response()->json([
            'success' => false,
            'message' => 'پشتیبانی این آرایشگاه به پایان رسیده است. برای فعال شدن دوباره، پشتیبانی را تمدید کنید.',
            'data' => $support,
        ], 423);
    }
}
