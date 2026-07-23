<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\SmsRevenueService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\View\View;

class SmsRevenueController extends Controller
{
    public function __construct(private readonly SmsRevenueService $service)
    {
    }

    public function index(Request $request): View
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $withdrawals = $this->service->withdrawals();
        $perPage = 20;
        $page = max(1, (int) $request->integer('page', 1));

        $paginator = new LengthAwarePaginator(
            $withdrawals->slice(($page - 1) * $perPage, $perPage)->values(),
            $withdrawals->count(),
            $perPage,
            $page,
            [
                'path' => $request->url(),
                'query' => $request->query(),
            ],
        );

        return view('admin.sms-revenue.index', [
            'summary' => $this->service->summary(),
            'withdrawals' => $paginator,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $validated = $request->validate([
            'amount' => ['required', 'integer', 'min:1'],
            'reference' => ['nullable', 'string', 'max:120'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $this->service->recordWithdrawal(
            (int) $validated['amount'],
            $validated['note'] ?? null,
            $validated['reference'] ?? null,
            $request->user(),
        );

        return redirect()
            ->route('admin.sms-revenue.index')
            ->with('success', 'برداشت درآمد پیامک ثبت شد و مانده قابل برداشت به‌روزرسانی شد.');
    }
}
