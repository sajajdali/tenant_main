<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\SalesBankAccount;
use App\Models\SalesCommissionLedger;
use App\Models\SalesWalletTransaction;
use App\Models\SalesWithdrawalLog;
use App\Models\SalesWithdrawalRequest;
use App\Models\SpecializedCourseOrder;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SalesWalletService
{
    public function ensureTeacherCourseCommissionCredit(SpecializedCourseOrder $order): void
    {
        if ($order->status !== 'paid' || (int) $order->teacher_user_id <= 0 || (int) $order->teacher_commission_amount <= 0) {
            return;
        }

        $user = User::query()->find($order->teacher_user_id);
        if (! $user) {
            return;
        }

        $transaction = SalesWalletTransaction::query()->firstOrNew([
            'user_id' => $user->id,
            'type' => 'teacher_course_commission_credit',
            'reference_type' => 'specialized_course_order',
            'reference_id' => $order->id,
        ]);

        $oldAmount = $transaction->exists ? (int) $transaction->amount : 0;
        $balanceBefore = $this->availableBalance($user) - $oldAmount;

        $transaction->fill([
            'amount' => (int) $order->teacher_commission_amount,
            'balance_after' => $balanceBefore + (int) $order->teacher_commission_amount,
            'description' => 'شارژ کیف پول از سهم فروش دوره',
            'occurred_at' => $order->paid_at ?? $order->created_at ?? now(),
            'meta_json' => [
                'source_label' => $order->course_title_snapshot ?: $order->course_title_snapshot ?: 'فروش دوره',
                'teacher_commission_percent' => (float) $order->teacher_commission_percent,
                'teacher_commission_label' => data_get($order->meta_json, 'commission_breakdown.teacher_commission_label'),
                'teacher_commission_mode' => data_get($order->meta_json, 'commission_breakdown.teacher_commission_mode'),
                'order_number' => $order->order_number,
            ],
        ]);
        $transaction->save();
    }

    public function ensureCommissionCredits(SalesCommissionLedger $ledger): void
    {
        if ((int) $ledger->sales_expert_user_id > 0 && (int) $ledger->sales_expert_amount > 0) {
            $this->createOrRefreshCommissionCredit(
                userId: (int) $ledger->sales_expert_user_id,
                amount: (int) $ledger->sales_expert_amount,
                ledger: $ledger,
                beneficiaryRole: 'sales_expert',
            );
        }

        if ((int) $ledger->sales_manager_user_id > 0 && (int) $ledger->sales_manager_amount > 0) {
            $this->createOrRefreshCommissionCredit(
                userId: (int) $ledger->sales_manager_user_id,
                amount: (int) $ledger->sales_manager_amount,
                ledger: $ledger,
                beneficiaryRole: 'sales_manager',
            );
        }
    }

    public function reverseCommissionCredits(SalesCommissionLedger $ledger, User $actor, string $reason): void
    {
        if ($ledger->status === 'reversed') {
            return;
        }

        DB::connection('central')->transaction(function () use ($ledger, $actor, $reason): void {
            $lockedLedger = SalesCommissionLedger::query()
                ->with('walletTransactions')
                ->lockForUpdate()
                ->findOrFail($ledger->id);

            if ($lockedLedger->status === 'reversed') {
                return;
            }

            $this->appendCommissionReversal($lockedLedger, $actor, $reason, 'sales_expert', (int) $lockedLedger->sales_expert_user_id);
            $this->appendCommissionReversal($lockedLedger, $actor, $reason, 'sales_manager', (int) $lockedLedger->sales_manager_user_id);

            $lockedLedger->update([
                'status' => 'reversed',
                'meta_json' => array_merge($lockedLedger->meta_json ?? [], [
                    'reversed_by_user_id' => $actor->id,
                    'reversed_by_name' => $actor->name,
                    'reversed_reason' => $reason,
                    'reversed_at' => now()->toIso8601String(),
                ]),
            ]);
        });
    }

    public function availableBalance(User $user): int
    {
        return (int) SalesWalletTransaction::query()
            ->where('user_id', $user->id)
            ->sum('amount');
    }

    public function pendingWithdrawalAmount(User $user): int
    {
        return (int) SalesWithdrawalRequest::query()
            ->where('user_id', $user->id)
            ->where('status', 'pending')
            ->sum('requested_amount');
    }

    public function createBankAccount(User $user, array $payload): SalesBankAccount
    {
        return DB::connection('central')->transaction(function () use ($user, $payload): SalesBankAccount {
            $isDefault = (bool) ($payload['is_default'] ?? false);
            if ($isDefault) {
                SalesBankAccount::query()
                    ->where('user_id', $user->id)
                    ->update(['is_default' => false]);
            }

            return SalesBankAccount::query()->create([
                'user_id' => $user->id,
                'bank_name' => $payload['bank_name'],
                'card_number' => $this->normalizeDigits($payload['card_number']),
                'iban' => strtoupper($this->normalizeDigits($payload['iban'])),
                'account_holder_name' => $payload['account_holder_name'],
                'is_default' => $isDefault,
                'is_active' => true,
            ]);
        });
    }

    public function updateBankAccount(User $user, SalesBankAccount $bankAccount, array $payload): SalesBankAccount
    {
        return DB::connection('central')->transaction(function () use ($user, $bankAccount, $payload): SalesBankAccount {
            $account = SalesBankAccount::query()
                ->where('user_id', $user->id)
                ->whereKey($bankAccount->id)
                ->first();

            if (! $account) {
                throw ValidationException::withMessages([
                    'sales_bank_account_id' => 'حساب بانکی انتخاب‌شده معتبر نیست.',
                ]);
            }

            $isDefault = (bool) ($payload['is_default'] ?? false);
            if ($isDefault) {
                SalesBankAccount::query()
                    ->where('user_id', $user->id)
                    ->whereKeyNot($account->id)
                    ->update(['is_default' => false]);
            }

            $account->update([
                'bank_name' => $payload['bank_name'],
                'card_number' => $this->normalizeDigits($payload['card_number']),
                'iban' => strtoupper($this->normalizeDigits($payload['iban'])),
                'account_holder_name' => $payload['account_holder_name'],
                'is_default' => $isDefault,
                'is_active' => array_key_exists('is_active', $payload) ? (bool) $payload['is_active'] : $account->is_active,
            ]);

            return $account->fresh() ?? $account;
        });
    }

    public function deleteBankAccount(User $user, SalesBankAccount $bankAccount): void
    {
        DB::connection('central')->transaction(function () use ($user, $bankAccount): void {
            $account = SalesBankAccount::query()
                ->where('user_id', $user->id)
                ->whereKey($bankAccount->id)
                ->first();

            if (! $account) {
                throw ValidationException::withMessages([
                    'sales_bank_account_id' => 'حساب بانکی انتخاب‌شده معتبر نیست.',
                ]);
            }

            if ($account->withdrawalRequests()->exists()) {
                throw ValidationException::withMessages([
                    'sales_bank_account_id' => 'این حساب بانکی در درخواست برداشت استفاده شده و قابل حذف نیست. می‌توانید آن را ویرایش کنید.',
                ]);
            }

            $wasDefault = (bool) $account->is_default;
            $account->delete();

            if ($wasDefault) {
                SalesBankAccount::query()
                    ->where('user_id', $user->id)
                    ->orderByDesc('is_active')
                    ->latest('id')
                    ->limit(1)
                    ->update(['is_default' => true]);
            }
        });
    }

    public function createWithdrawalRequest(User $user, array $payload): SalesWithdrawalRequest
    {
        return DB::connection('central')->transaction(function () use ($user, $payload): SalesWithdrawalRequest {
            $bankAccount = SalesBankAccount::query()
                ->where('user_id', $user->id)
                ->whereKey((int) $payload['sales_bank_account_id'])
                ->where('is_active', true)
                ->first();

            if (! $bankAccount) {
                throw ValidationException::withMessages([
                    'sales_bank_account_id' => 'حساب بانکی انتخاب‌شده معتبر نیست.',
                ]);
            }

            $amount = (int) $payload['requested_amount'];
            $balanceBefore = $this->availableBalance($user);

            if ($amount <= 0) {
                throw ValidationException::withMessages([
                    'requested_amount' => 'مبلغ درخواست برداشت باید بیشتر از صفر باشد.',
                ]);
            }

            if ($amount > $balanceBefore) {
                throw ValidationException::withMessages([
                    'requested_amount' => 'مبلغ درخواست برداشت نباید از موجودی قابل برداشت بیشتر باشد.',
                ]);
            }

            $request = SalesWithdrawalRequest::query()->create([
                'user_id' => $user->id,
                'sales_bank_account_id' => $bankAccount->id,
                'requested_amount' => $amount,
                'paid_amount' => 0,
                'balance_before' => $balanceBefore,
                'balance_after' => $balanceBefore - $amount,
                'status' => 'pending',
                'request_note' => $payload['request_note'] ?? null,
                'requested_at' => now(),
                'meta_json' => [
                    'bank_name' => $bankAccount->bank_name,
                    'card_number' => $bankAccount->card_number,
                    'iban' => $bankAccount->iban,
                ],
            ]);

            $this->appendWalletTransaction($user, [
                'sales_withdrawal_request_id' => $request->id,
                'type' => 'withdrawal_hold',
                'reference_type' => 'sales_withdrawal_request',
                'reference_id' => $request->id,
                'amount' => -$amount,
                'description' => 'ثبت درخواست برداشت',
                'occurred_at' => now(),
            ]);

            $this->appendWithdrawalLog($request, [
                'actor_user_id' => $user->id,
                'action' => 'request_created',
                'from_status' => null,
                'to_status' => 'pending',
                'amount' => $amount,
                'note' => $payload['request_note'] ?? null,
                'meta_json' => [
                    'bank_account_id' => $bankAccount->id,
                    'bank_name' => $bankAccount->bank_name,
                    'card_number' => $bankAccount->card_number,
                    'iban' => $bankAccount->iban,
                    'balance_before' => $balanceBefore,
                    'balance_after' => $balanceBefore - $amount,
                ],
                'occurred_at' => now(),
            ]);

            return $request->fresh(['bankAccount', 'logs.actor']);
        });
    }

    public function updateWithdrawalStatus(SalesWithdrawalRequest $request, string $status, array $payload, User $admin): SalesWithdrawalRequest
    {
        return DB::connection('central')->transaction(function () use ($request, $status, $payload, $admin): SalesWithdrawalRequest {
            $request->refresh();
            $fromStatus = $request->status;

            if ($request->status !== 'pending') {
                throw ValidationException::withMessages([
                    'status' => 'فقط درخواست‌های در صف واریز قابل تغییر وضعیت هستند.',
                ]);
            }

            if ($status === 'paid') {
                $paidAmount = (int) (($payload['paid_amount'] ?? null) ?: $request->requested_amount);
                if ($paidAmount <= 0 || $paidAmount > (int) $request->requested_amount) {
                    throw ValidationException::withMessages([
                        'paid_amount' => 'مبلغ واریزشده باید بیشتر از صفر و حداکثر برابر مبلغ درخواست باشد.',
                    ]);
                }

                $request->update([
                    'status' => 'paid',
                    'paid_amount' => $paidAmount,
                    'admin_note' => $payload['admin_note'] ?? null,
                    'payment_reference' => $payload['payment_reference'] ?? null,
                    'processed_by_user_id' => $admin->id,
                    'processed_at' => now(),
                    'paid_at' => now(),
                ]);

                $this->appendWithdrawalLog($request, [
                    'actor_user_id' => $admin->id,
                    'action' => 'marked_paid',
                    'from_status' => $fromStatus,
                    'to_status' => 'paid',
                    'amount' => $paidAmount,
                    'note' => $payload['admin_note'] ?? null,
                    'meta_json' => [
                        'payment_reference' => $payload['payment_reference'] ?? null,
                    ],
                    'occurred_at' => now(),
                ]);

                return $request->fresh(['bankAccount', 'processedBy', 'logs.actor']);
            }

            if (in_array($status, ['cancelled', 'returned'], true)) {
                $request->update([
                    'status' => $status,
                    'admin_note' => $payload['admin_note'] ?? null,
                    'payment_reference' => $payload['payment_reference'] ?? null,
                    'processed_by_user_id' => $admin->id,
                    'processed_at' => now(),
                ]);

                $this->appendWalletTransaction($request->user, [
                    'sales_withdrawal_request_id' => $request->id,
                    'type' => 'withdrawal_reversal',
                    'reference_type' => 'sales_withdrawal_request',
                    'reference_id' => $request->id,
                    'amount' => (int) $request->requested_amount,
                    'description' => $status === 'returned' ? 'برگشت وجه درخواست برداشت' : 'لغو درخواست برداشت',
                    'occurred_at' => now(),
                ]);

                $this->appendWithdrawalLog($request, [
                    'actor_user_id' => $admin->id,
                    'action' => $status === 'returned' ? 'marked_returned' : 'marked_cancelled',
                    'from_status' => $fromStatus,
                    'to_status' => $status,
                    'amount' => (int) $request->requested_amount,
                    'note' => $payload['admin_note'] ?? null,
                    'meta_json' => [
                        'payment_reference' => $payload['payment_reference'] ?? null,
                        'funds_restored' => true,
                    ],
                    'occurred_at' => now(),
                ]);

                return $request->fresh(['bankAccount', 'processedBy', 'logs.actor']);
            }

            throw ValidationException::withMessages([
                'status' => 'وضعیت انتخاب‌شده معتبر نیست.',
            ]);
        });
    }

    private function createOrRefreshCommissionCredit(int $userId, int $amount, SalesCommissionLedger $ledger, string $beneficiaryRole): void
    {
        $transaction = SalesWalletTransaction::query()->firstOrNew([
            'user_id' => $userId,
            'type' => 'commission_credit',
            'reference_type' => 'sales_commission_ledger:'.$beneficiaryRole,
            'reference_id' => $ledger->id,
        ]);

        $isNew = ! $transaction->exists;
        $oldAmount = $isNew ? 0 : (int) $transaction->amount;
        $balanceBefore = $this->availableBalance(User::query()->findOrFail($userId)) - $oldAmount;

        $transaction->fill([
            'sales_commission_ledger_id' => $ledger->id,
            'amount' => $amount,
            'balance_after' => $balanceBefore + $amount,
            'description' => 'شارژ کیف پول از پورسانت فروش',
            'occurred_at' => $ledger->occurred_at ?? now(),
            'meta_json' => [
                'beneficiary_role' => $beneficiaryRole,
                'source_label' => $ledger->source_label,
            ],
        ]);
        $transaction->save();
    }

    private function appendCommissionReversal(SalesCommissionLedger $ledger, User $actor, string $reason, string $beneficiaryRole, int $userId): void
    {
        if ($userId <= 0) {
            return;
        }

        $creditTransaction = SalesWalletTransaction::query()
            ->where('user_id', $userId)
            ->where('type', 'commission_credit')
            ->where('reference_type', 'sales_commission_ledger:'.$beneficiaryRole)
            ->where('reference_id', $ledger->id)
            ->first();

        if (! $creditTransaction || (int) $creditTransaction->amount <= 0) {
            return;
        }

        $existingReversal = SalesWalletTransaction::query()
            ->where('user_id', $userId)
            ->where('type', 'commission_reversal')
            ->where('reference_type', 'sales_commission_ledger:'.$beneficiaryRole)
            ->where('reference_id', $ledger->id)
            ->exists();

        if ($existingReversal) {
            return;
        }

        $user = User::query()->findOrFail($userId);

        $this->appendWalletTransaction($user, [
            'sales_commission_ledger_id' => $ledger->id,
            'type' => 'commission_reversal',
            'reference_type' => 'sales_commission_ledger:'.$beneficiaryRole,
            'reference_id' => $ledger->id,
            'amount' => -abs((int) $creditTransaction->amount),
            'description' => 'برگشت پورسانت به دلیل ابطال درآمد',
            'meta_json' => [
                'beneficiary_role' => $beneficiaryRole,
                'source_label' => $ledger->source_label,
                'reversed_by_user_id' => $actor->id,
                'reversed_by_name' => $actor->name,
                'reason' => $reason,
            ],
            'occurred_at' => now(),
        ]);
    }

    private function appendWalletTransaction(User $user, array $payload): SalesWalletTransaction
    {
        $balanceBefore = $this->availableBalance($user);

        return SalesWalletTransaction::query()->create([
            'user_id' => $user->id,
            'sales_commission_ledger_id' => $payload['sales_commission_ledger_id'] ?? null,
            'sales_withdrawal_request_id' => $payload['sales_withdrawal_request_id'] ?? null,
            'type' => $payload['type'],
            'reference_type' => $payload['reference_type'] ?? null,
            'reference_id' => $payload['reference_id'] ?? null,
            'amount' => (int) $payload['amount'],
            'balance_after' => $balanceBefore + (int) $payload['amount'],
            'description' => $payload['description'] ?? null,
            'meta_json' => $payload['meta_json'] ?? null,
            'occurred_at' => $payload['occurred_at'] ?? now(),
        ]);
    }

    private function appendWithdrawalLog(SalesWithdrawalRequest $request, array $payload): SalesWithdrawalLog
    {
        return SalesWithdrawalLog::query()->create([
            'sales_withdrawal_request_id' => $request->id,
            'actor_user_id' => $payload['actor_user_id'] ?? null,
            'action' => $payload['action'],
            'from_status' => $payload['from_status'] ?? null,
            'to_status' => $payload['to_status'] ?? null,
            'amount' => (int) ($payload['amount'] ?? 0),
            'note' => $payload['note'] ?? null,
            'meta_json' => $payload['meta_json'] ?? null,
            'occurred_at' => $payload['occurred_at'] ?? now(),
        ]);
    }

    private function normalizeDigits(string $value): string
    {
        return preg_replace('/\D+/', '', strtr($value, [
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        ])) ?? '';
    }
}
