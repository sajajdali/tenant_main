<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Tenant\Models\Tenant;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantPanelAccessOpen
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Tenant|null $tenant */
        $tenant = tenant();

        if (! $tenant || ! $tenant->isPanelAccessLocked()) {
            return $next($request);
        }

        if (Auth::guard('tenant_web')->check()) {
            Auth::guard('tenant_web')->logout();

            if ($request->hasSession()) {
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }
        }

        $message = $tenant->panelAccessMessage();

        if ($request->expectsJson() || $request->is('api/*')) {
            return response()->json([
                'success' => false,
                'message' => $message,
                'data' => [
                    'panel_access_locked' => true,
                ],
            ], 423);
        }

        return redirect()->route('tenant.admin.login');
    }
}
