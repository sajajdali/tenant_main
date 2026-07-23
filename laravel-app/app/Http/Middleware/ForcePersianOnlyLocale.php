<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\Response;

class ForcePersianOnlyLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        if (
            $request->is('admin')
            || $request->is('admin/*')
            || $request->is('landing-api/*')
            || $request->is('landing/contact-submissions')
        ) {
            App::setLocale('fa');
        }

        return $next($request);
    }
}
