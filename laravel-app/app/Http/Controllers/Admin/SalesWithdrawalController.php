<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SalesBankAccount;
use App\Models\SalesWithdrawalRequest;
use App\Models\User;
use App\Services\SalesTeamService;
use App\Services\SalesWalletService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SalesWithdrawalController extends Controller
{
    public function __construct(
        private readonly SalesWalletService $wallets,
        private readonly SalesTeamService $salesTeam,
    ) {
    }

    public function create(User $user): View
    {
        abort_unless($this->salesTeam->canManageWithdrawalFor(auth()->user(), $user), 403);

        return view('admin.sales-team.withdrawals', [
            'salesUser' => $user->load(['salesBankAccounts' => fn ($query) => $query->latest()]),
            'summary' => $this->salesTeam->summaryForUser($user),
            'withdrawalRequests' => $user->salesWithdrawalRequests()
                ->with(['bankAccount', 'processedBy', 'logs.actor'])
                ->latest('requested_at')
                ->paginate(12),
            'walletTransactions' => $user->salesWalletTransactions()
                ->with(['commissionLedger', 'withdrawalRequest'])
                ->latest('occurred_at')
                ->paginate(15, ['*'], 'transactions_page'),
            'salesTeamService' => $this->salesTeam,
        ]);
    }

    public function storeBankAccount(Request $request, User $user): RedirectResponse
    {
        abort_unless($this->salesTeam->canManageWithdrawalFor($request->user(), $user), 403);

        $validated = $request->validate([
            'bank_name' => ['required', 'string', 'max:120'],
            'card_number' => ['required', 'string', 'max:32'],
            'iban' => ['required', 'string', 'max:64'],
            'account_holder_name' => ['required', 'string', 'max:255'],
            'is_default' => ['nullable', 'boolean'],
        ]);

        $this->wallets->createBankAccount($user, $validated);

        return redirect()
            ->route('admin.sales-team.withdrawals.create', $user)
            ->with('success', 'حساب بانکی با موفقیت ثبت شد.');
    }

    public function updateBankAccount(Request $request, User $user, SalesBankAccount $bankAccount): RedirectResponse
    {
        abort_unless($this->salesTeam->canManageWithdrawalFor($request->user(), $user), 403);

        $validated = $request->validate([
            'bank_name' => ['required', 'string', 'max:120'],
            'card_number' => ['required', 'string', 'max:32'],
            'iban' => ['required', 'string', 'max:64'],
            'account_holder_name' => ['required', 'string', 'max:255'],
            'is_default' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $this->wallets->updateBankAccount($user, $bankAccount, $validated);

        return redirect()
            ->route('admin.sales-team.withdrawals.create', $user)
            ->with('success', 'حساب بانکی با موفقیت ویرایش شد.');
    }

    public function destroyBankAccount(Request $request, User $user, SalesBankAccount $bankAccount): RedirectResponse
    {
        abort_unless($this->salesTeam->canManageWithdrawalFor($request->user(), $user), 403);

        $this->wallets->deleteBankAccount($user, $bankAccount);

        return redirect()
            ->route('admin.sales-team.withdrawals.create', $user)
            ->with('success', 'حساب بانکی با موفقیت حذف شد.');
    }

    public function storeRequest(Request $request, User $user): RedirectResponse
    {
        abort_unless($this->salesTeam->canManageWithdrawalFor($request->user(), $user), 403);

        $validated = $request->validate([
            'sales_bank_account_id' => ['required', 'integer'],
            'requested_amount' => ['required', 'integer', 'min:1'],
            'request_note' => ['nullable', 'string'],
        ]);

        $this->wallets->createWithdrawalRequest($user, $validated);

        return redirect()
            ->route('admin.sales-team.withdrawals.create', $user)
            ->with('success', 'درخواست برداشت ثبت شد و مبلغ از موجودی قابل برداشت کسر شد.');
    }

    public function index(Request $request): View
    {
        abort_unless(in_array($request->user()->role, ['admin', 'sales_manager'], true), 403);

        $status = $request->string('status')->toString();
        $role = $request->string('role')->toString();
        $userId = $request->string('user_id')->toString();

        $requests = SalesWithdrawalRequest::query()
            ->with(['user', 'bankAccount', 'processedBy', 'logs.actor'])
            ->when(
                $request->user()->role === 'sales_manager',
                fn ($query) => $query->where(function ($inner) use ($request): void {
                    $inner->where('user_id', $request->user()->id)
                        ->orWhereHas('user', fn ($userQuery) => $userQuery
                            ->where('role', 'sales_expert')
                            ->where('sales_manager_user_id', $request->user()->id));
                })
            )
            ->when($status !== '', fn ($query) => $query->where('status', $status))
            ->when($role !== '', fn ($query) => $query->whereHas('user', fn ($inner) => $inner->where('role', $role)))
            ->when($userId !== '', fn ($query) => $query->where('user_id', (int) $userId))
            ->latest('requested_at')
            ->paginate(20)
            ->withQueryString();

        return view('admin.sales-withdrawals.index', [
            'requests' => $requests,
            'status' => $status,
            'role' => $role,
            'userId' => $userId,
            'salesUsers' => $this->salesTeam->visibleSalesUsersFor($request->user()),
            'salesTeamService' => $this->salesTeam,
            'canProcessRequests' => $request->user()->role === 'admin',
        ]);
    }

    public function update(Request $request, SalesWithdrawalRequest $withdrawal): RedirectResponse
    {
        abort_unless($request->user()->role === 'admin', 403);

        $validated = $request->validate([
            'status' => ['required', 'in:paid,cancelled,returned'],
            'admin_note' => ['nullable', 'string'],
            'payment_reference' => ['nullable', 'string', 'max:120'],
            'paid_amount' => ['nullable', 'integer', 'min:1'],
        ]);

        $this->wallets->updateWithdrawalStatus($withdrawal, $validated['status'], $validated, $request->user());

        return redirect()
            ->route('admin.sales-withdrawals.index')
            ->with('success', 'وضعیت درخواست برداشت به‌روزرسانی شد.');
    }
}
