<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use Illuminate\View\View;

class TenantDashboardController extends Controller
{
    public function __invoke(): View
    {
        return view('tenant.admin.dashboard', [
            'tenant' => tenant(),
        ]);
    }
}
