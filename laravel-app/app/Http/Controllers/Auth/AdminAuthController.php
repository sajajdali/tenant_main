<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Support\InputNormalizer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;

class AdminAuthController extends Controller
{
    public function create(): View
    {
        return view('auth.admin-login', [
            'panelTitle' => __('auth.admin_login.central_panel_title'),
            'panelDescription' => __('auth.admin_login.central_panel_description'),
            'authMode' => 'password',
            'formRoute' => route('admin.login.store'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $request->merge([
            'mobile' => InputNormalizer::mobile($request->input('mobile')),
        ]);

        $credentials = $request->validate([
            'mobile' => ['required', 'regex:/^09\d{9}$/'],
            'password' => ['required', 'string', 'max:255'],
        ]);

        if (! Auth::attempt([
            'mobile' => $credentials['mobile'],
            'password' => $credentials['password'],
            'is_active' => true,
        ], $request->boolean('remember'))) {
            return back()
                ->withInput($request->except('password'))
                ->withErrors([
                    'mobile' => __('auth.admin_login.invalid_credentials'),
                ]);
        }

        $request->session()->regenerate();

        return redirect()->intended(
            in_array($request->user()->role, ['sales_expert', 'sales_manager'], true)
                ? route('admin.sales-team.show', $request->user())
                : route('admin.dashboard')
        );
    }

    public function destroy(Request $request): RedirectResponse
    {
        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('admin.login');
    }
}
