<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\FinancialReportService;
use Illuminate\Http\Request;
use Illuminate\View\View;

class FinanceReportController extends Controller
{
    public function __construct(private readonly FinancialReportService $service)
    {
    }

    public function index(Request $request): View
    {
        abort_unless($request->user()?->role === 'admin', 403);

        return view('admin.finance.index', $this->service->report());
    }
}
