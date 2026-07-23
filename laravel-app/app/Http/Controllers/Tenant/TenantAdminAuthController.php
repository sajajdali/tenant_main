<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Domain\Tenant\Models\TenantUser;
use App\Domain\Tenant\Models\Tenant;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\View\View;

class TenantAdminAuthController extends Controller
{
    public function create(): View
    {
        /** @var Tenant|null $tenant */
        $tenant = tenant();

        return view('auth.admin-login', [
            'panelTitle' => __('auth.admin_login.tenant_panel_title'),
            'panelDescription' => __('auth.admin_login.tenant_panel_description'),
            'authMode' => 'otp',
            'sendOtpUrl' => route('tenant.api.auth.otp.send'),
            'verifyOtpUrl' => route('tenant.api.auth.otp.verify'),
            'redirectUrl' => route('tenant.admin.dashboard'),
            'isAccessLocked' => $tenant?->isPanelAccessLocked() ?? false,
            'accessLockedMessage' => $tenant?->panelAccessMessage(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort(404);
    }

    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('tenant_web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('tenant.admin.login');
    }

    public function impersonate(Request $request): RedirectResponse
    {
        abort_unless($request->hasValidSignature(false), 403);

        /** @var Tenant|null $tenant */
        $tenant = tenant();
        abort_unless((string) $request->string('tenant') === (string) $tenant->id, 403);
        abort_if($tenant?->isPanelAccessLocked(), 423, $tenant?->panelAccessMessage());

        $tenantUser = TenantUser::query()
            ->where('central_user_id', (int) $request->integer('central_user'))
            ->where('role', 'admin')
            ->where('is_active', true)
            ->first();

        if (! $tenantUser) {
            $centralUser = User::query()->find((int) $request->integer('central_user'));
            $tenantUser = TenantUser::query()
                ->where('mobile', (string) ($centralUser?->mobile ?? ''))
                ->where('role', 'admin')
                ->where('is_active', true)
                ->first();
        }

        abort_unless($tenantUser !== null, 404, __('auth.admin_login.tenant_admin_not_found'));

        Auth::guard('tenant_web')->login($tenantUser, true);
        $request->session()->regenerate();

        $requestedRedirect = (string) $request->query('redirect', '/settings');
        $redirectTo = Str::startsWith($requestedRedirect, '/') && ! Str::startsWith($requestedRedirect, '//')
            ? $requestedRedirect
            : '/settings';

        return redirect($redirectTo !== '' ? $redirectTo : '/settings');
    }
}
