@extends('admin.layouts.app')

@section('title', 'درخواست برداشت')

@php
    use Morilog\Jalali\Jalalian;

    $formatMoney = fn (int $amount) => __('admin.money.iran_toman', ['amount' => number_format($amount)]);
    $formatJalaliDateTime = fn ($value) => $value ? Jalalian::fromCarbon(\Illuminate\Support\Carbon::parse($value))->format('Y/m/d H:i') : '—';
    $maskCard = function (?string $card): string {
        $digits = preg_replace('/\D+/', '', (string) $card) ?? '';
        if ($digits === '') {
            return '—';
        }

        return trim(chunk_split(substr($digits, 0, 16), 4, ' '));
    };
    $displayIban = function (?string $iban): string {
        $digits = preg_replace('/\D+/', '', (string) $iban) ?? '';
        return $digits === '' ? '—' : 'IR'.$digits;
    };
    $transactionTypeLabel = function (string $type): string {
        return match ($type) {
            'commission_credit' => 'شارژ پورسانت معرفی',
            'teacher_course_commission_credit' => 'شارژ سهم فروش دوره',
            'withdrawal_hold' => 'ثبت درخواست برداشت',
            'withdrawal_reversal' => 'برگشت مبلغ برداشت',
            'commission_reversal' => 'برگشت پورسانت',
            default => $type,
        };
    };
@endphp

@section('content')
    <div class="row g-4">
        <div class="col-12">
            <div class="page-header">
                <div class="page-block">
                    <div class="row align-items-center">
                        <div class="col-md-12">
                            <ul class="breadcrumb">
                                <li class="breadcrumb-item"><a href="{{ route('admin.dashboard') }}">داشبورد</a></li>
                                <li class="breadcrumb-item">
                                    <a href="{{ auth()->user()?->role === 'teacher' ? route('admin.teacher.dashboard') : route('admin.sales-team.index') }}">
                                        {{ auth()->user()?->role === 'teacher' ? 'داشبورد مدرس' : 'تیم فروش' }}
                                    </a>
                                </li>
                                <li class="breadcrumb-item"><a href="{{ route('admin.sales-team.show', $salesUser) }}">{{ $salesUser->name }}</a></li>
                                <li class="breadcrumb-item" aria-current="page">درخواست برداشت</li>
                            </ul>
                        </div>
                        <div class="col-md-12">
                            <div class="page-header-title d-flex flex-wrap justify-content-between align-items-center gap-3">
                                <div>
                                    <h2 class="mb-1">برداشت و تسویه {{ $salesUser->name }}</h2>
                                    <div class="text-muted">شماره کارت، شبا، درخواست برداشت و تاریخچه واریزها از همین صفحه مدیریت می‌شود.</div>
                                </div>
                                <div class="d-flex gap-2">
                                    @if(in_array(auth()->user()?->role, ['admin', 'sales_manager'], true))
                                        <a href="{{ route('admin.sales-withdrawals.index') }}" class="btn btn-outline-primary">همه درخواست‌های برداشت</a>
                                    @endif
                                    <a href="{{ route('admin.sales-team.show', $salesUser) }}" class="btn btn-light-secondary">بازگشت به داشبورد</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-md-6 col-xl-3">
            <div class="card h-100">
                <div class="card-body">
                    <p class="text-muted mb-1">فروش کل</p>
                    <h3 class="mb-0">{{ $formatMoney($summary['totalSales']) }}</h3>
                </div>
            </div>
        </div>
        <div class="col-md-6 col-xl-3">
            <div class="card h-100 border-success-subtle">
                <div class="card-body">
                    <p class="text-muted mb-1">موجودی قابل برداشت</p>
                    <h3 class="mb-0 text-success">{{ $formatMoney($summary['availableBalance']) }}</h3>
                </div>
            </div>
        </div>
        <div class="col-md-6 col-xl-3">
            <div class="card h-100">
                <div class="card-body">
                    <p class="text-muted mb-1">در صف واریز</p>
                    <h3 class="mb-0">{{ $formatMoney($summary['pendingWithdrawalAmount']) }}</h3>
                </div>
            </div>
        </div>
        <div class="col-md-6 col-xl-3">
            <div class="card h-100">
                <div class="card-body">
                    <p class="text-muted mb-1">مبالغ واریزشده</p>
                    <h3 class="mb-0">{{ $formatMoney($summary['paidWithdrawalAmount']) }}</h3>
                </div>
            </div>
        </div>

        <div class="col-xl-5">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">ثبت حساب بانکی</h5>
                    <p class="text-muted mb-0">ابتدا شماره کارت، نام بانک و شبای حساب را ثبت کنید تا برای درخواست برداشت قابل انتخاب باشد.</p>
                </div>
                <div class="card-body">
                    <form method="POST" action="{{ route('admin.sales-team.withdrawals.bank-accounts.store', $salesUser) }}">
                        @csrf
                        <div class="row g-3">
                            <div class="col-md-6">
                                <label class="form-label" for="bank_name">نام بانک</label>
                                <input type="text" class="form-control" id="bank_name" name="bank_name" value="{{ old('bank_name') }}" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="account_holder_name">نام صاحب حساب</label>
                                <input type="text" class="form-control" id="account_holder_name" name="account_holder_name" value="{{ old('account_holder_name', $salesUser->name) }}" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="card_number">شماره کارت</label>
                                <input type="text" class="form-control" id="card_number" name="card_number" value="{{ old('card_number') }}" placeholder="مثلاً 6037991234567890" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="iban">شماره شبا</label>
                                <input type="text" class="form-control" id="iban" name="iban" value="{{ old('iban') }}" placeholder="مثلاً IR820540102680020817909002" required>
                            </div>
                            <div class="col-12">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" value="1" id="is_default" name="is_default" @checked(old('is_default'))>
                                    <label class="form-check-label" for="is_default">به عنوان حساب پیش‌فرض ذخیره شود</label>
                                </div>
                            </div>
                            <div class="col-12">
                                <button type="submit" class="btn btn-primary">ثبت حساب بانکی</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            <div class="card mt-4">
                <div class="card-header">
                    <h5 class="mb-1">حساب‌های بانکی ثبت‌شده</h5>
                    <p class="text-muted mb-0">درخواست برداشت فقط از روی حساب‌های فعال انجام می‌شود. هر حساب را می‌توانید همین‌جا ویرایش یا در صورت نداشتن سابقه برداشت حذف کنید.</p>
                </div>
                <div class="card-body">
                    @forelse ($salesUser->salesBankAccounts as $bankAccount)
                        <div class="border rounded p-3 mb-3">
                            <div class="d-flex justify-content-between align-items-start gap-3 mb-2">
                                <div>
                                    <div class="fw-semibold">{{ $bankAccount->bank_name }}</div>
                                    <div class="text-muted small">{{ $bankAccount->account_holder_name }}</div>
                                </div>
                                <div class="d-flex gap-2">
                                    @if ($bankAccount->is_default)
                                        <span class="badge bg-light-primary text-primary">پیش‌فرض</span>
                                    @endif
                                    @if ($bankAccount->is_active)
                                        <span class="badge bg-light-success text-success">فعال</span>
                                    @endif
                                </div>
                            </div>
                            <div class="small text-muted mb-1">کارت: <span dir="ltr">{{ $maskCard($bankAccount->card_number) }}</span></div>
                            <div class="small text-muted">شبا: <span dir="ltr">{{ $displayIban($bankAccount->iban) }}</span></div>
                            <hr>
                            <form method="POST" action="{{ route('admin.sales-team.withdrawals.bank-accounts.update', [$salesUser, $bankAccount]) }}">
                                @csrf
                                @method('PUT')
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">نام بانک</label>
                                        <input type="text" class="form-control" name="bank_name" value="{{ old('bank_name_'.$bankAccount->id, $bankAccount->bank_name) }}" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">نام صاحب حساب</label>
                                        <input type="text" class="form-control" name="account_holder_name" value="{{ old('account_holder_name_'.$bankAccount->id, $bankAccount->account_holder_name) }}" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">شماره کارت</label>
                                        <input type="text" class="form-control" name="card_number" value="{{ old('card_number_'.$bankAccount->id, $bankAccount->card_number) }}" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">شماره شبا</label>
                                        <input type="text" class="form-control" name="iban" value="{{ old('iban_'.$bankAccount->id, $bankAccount->iban) }}" required>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-check mt-2">
                                            <input class="form-check-input" type="checkbox" value="1" id="bank_default_{{ $bankAccount->id }}" name="is_default" @checked($bankAccount->is_default)>
                                            <label class="form-check-label" for="bank_default_{{ $bankAccount->id }}">حساب پیش‌فرض</label>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-check mt-2">
                                            <input class="form-check-input" type="checkbox" value="1" id="bank_active_{{ $bankAccount->id }}" name="is_active" @checked($bankAccount->is_active)>
                                            <label class="form-check-label" for="bank_active_{{ $bankAccount->id }}">فعال باشد</label>
                                        </div>
                                    </div>
                                    <div class="col-12">
                                        <button type="submit" class="btn btn-sm btn-primary">ذخیره ویرایش</button>
                                    </div>
                                </div>
                            </form>
                            <div class="d-flex flex-wrap gap-2 mt-3">
                                <form method="POST" action="{{ route('admin.sales-team.withdrawals.bank-accounts.destroy', [$salesUser, $bankAccount]) }}" onsubmit="return confirm('این حساب بانکی حذف شود؟');">
                                    @csrf
                                    @method('DELETE')
                                    <button type="submit" class="btn btn-sm btn-light-danger">حذف حساب</button>
                                </form>
                                @if (! $bankAccount->withdrawalRequests()->exists())
                                    <span class="small text-muted align-self-center">این حساب هنوز در درخواست برداشت استفاده نشده و قابل حذف است.</span>
                                @endif
                                        @if ($bankAccount->withdrawalRequests()->exists())
                                    <span class="small text-muted align-self-center">این حساب سابقه برداشت دارد و در صورت نیاز فقط ویرایش می‌شود.</span>
                                        @endif
                            </div>
                        </div>
                    @empty
                        <div class="text-muted">هنوز حساب بانکی ثبت نشده است.</div>
                    @endforelse
                </div>
            </div>
        </div>

        <div class="col-xl-7">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">ثبت درخواست برداشت</h5>
                    <p class="text-muted mb-0">
                        شما می‌توانید درخواست برداشت ثبت کنید تا مبلغ از موجودی قابل برداشت کسر و پس از بررسی، به حساب بانکی انتخابی واریز شود.
                        مبلغ درخواست نباید از موجودی فعلی بیشتر باشد.
                    </p>
                </div>
                <div class="card-body">
                    <form method="POST" action="{{ route('admin.sales-team.withdrawals.store', $salesUser) }}">
                        @csrf
                        <div class="row g-3">
                            <div class="col-md-6">
                                <label class="form-label" for="sales_bank_account_id">حساب بانکی</label>
                                <select class="form-select" id="sales_bank_account_id" name="sales_bank_account_id" required>
                                    <option value="">انتخاب حساب بانکی</option>
                                    @foreach ($salesUser->salesBankAccounts->where('is_active', true) as $bankAccount)
                                        <option value="{{ $bankAccount->id }}" @selected((int) old('sales_bank_account_id') === (int) $bankAccount->id)>
                                            {{ $bankAccount->bank_name }} - {{ $maskCard($bankAccount->card_number) }}
                                        </option>
                                    @endforeach
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="requested_amount">مبلغ درخواست</label>
                                <input type="number" class="form-control" id="requested_amount" name="requested_amount" min="1" max="{{ $summary['availableBalance'] }}" value="{{ old('requested_amount') }}" required>
                                <small class="text-muted">{{ __('admin.sales_team.max_withdrawable', ['amount' => $formatMoney($summary['availableBalance'])]) }}</small>
                            </div>
                            <div class="col-12">
                                <label class="form-label" for="request_note">توضیحات درخواست</label>
                                <textarea class="form-control" id="request_note" name="request_note" rows="4" placeholder="مثلاً درخواست واریز برای تسویه پایان ماه">{{ old('request_note') }}</textarea>
                            </div>
                            <div class="col-12">
                                <button type="submit" class="btn btn-success" @disabled($summary['availableBalance'] <= 0 || $salesUser->salesBankAccounts->where('is_active', true)->isEmpty())>ثبت درخواست برداشت</button>
                            </div>
                        </div>
                    </form>
                    @if ($salesUser->salesBankAccounts->where('is_active', true)->isEmpty())
                        <div class="alert alert-warning mt-3 mb-0">برای ثبت درخواست برداشت، ابتدا حداقل یک حساب بانکی فعال ثبت کنید.</div>
                    @endif
                </div>
            </div>

            <div class="card mt-4">
                <div class="card-header">
                    <h5 class="mb-1">لیست درخواست‌های برداشت</h5>
                    <p class="text-muted mb-0">هم مبلغ، هم وضعیت، هم تاریخ ثبت و هم نتیجه نهایی واریز از این بخش قابل پیگیری است.</p>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>مبلغ</th>
                                    <th>حساب</th>
                                    <th>وضعیت</th>
                                    <th>تاریخ ثبت</th>
                                    <th>تاریخ واریز</th>
                                    <th>مدیر رسیدگی</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($withdrawalRequests as $withdrawal)
                                    <tr>
                                        <td>
                                            <div class="fw-semibold">{{ $formatMoney((int) $withdrawal->requested_amount) }}</div>
                                            <small class="text-muted">{{ __('admin.sales_team.after_request', ['amount' => $formatMoney((int) $withdrawal->balance_after)]) }}</small>
                                        </td>
                                        <td>
                                            <div>{{ $withdrawal->bankAccount?->bank_name ?? '—' }}</div>
                                            <small class="text-muted">{{ $maskCard($withdrawal->bankAccount?->card_number) }}</small>
                                        </td>
                                        <td>
                                            <span class="badge {{ $salesTeamService->withdrawalStatusBadgeClass($withdrawal->status) }}">
                                                {{ $salesTeamService->withdrawalStatusLabel($withdrawal->status) }}
                                            </span>
                                        </td>
                                        <td>{{ $formatJalaliDateTime($withdrawal->requested_at) }}</td>
                                        <td>{{ $formatJalaliDateTime($withdrawal->paid_at ?? $withdrawal->processed_at) }}</td>
                                        <td>{{ $withdrawal->processedBy?->name ?? '—' }}</td>
                                    </tr>
                                    @if ($withdrawal->request_note || $withdrawal->admin_note || $withdrawal->logs->isNotEmpty())
                                        <tr class="bg-light">
                                            <td colspan="6">
                                                <div class="small">
                                                    @if ($withdrawal->request_note)
                                                        <div class="mb-2"><strong>توضیح درخواست:</strong> {{ $withdrawal->request_note }}</div>
                                                    @endif
                                                    @if ($withdrawal->admin_note)
                                                        <div class="mb-2"><strong>توضیح مدیر:</strong> {{ $withdrawal->admin_note }}</div>
                                                    @endif
                                                    @if ($withdrawal->logs->isNotEmpty())
                                                        <div><strong>لاگ وضعیت:</strong></div>
                                                        @foreach ($withdrawal->logs as $log)
                                                            <div class="text-muted mt-1">
                                                                {{ $formatJalaliDateTime($log->occurred_at) }} •
                                                                {{ $log->actor?->name ?? 'سیستم' }} •
                                                                {{ $log->action }}
                                                                @if ($log->from_status || $log->to_status)
                                                                    ({{ $salesTeamService->withdrawalStatusLabel($log->from_status ?: 'pending') }} → {{ $salesTeamService->withdrawalStatusLabel($log->to_status ?: 'pending') }})
                                                                @endif
                                                            </div>
                                                        @endforeach
                                                    @endif
                                                </div>
                                            </td>
                                        </tr>
                                    @endif
                                @empty
                                    <tr>
                                        <td colspan="6" class="text-center py-4 text-muted">هنوز درخواست برداشتی ثبت نشده است.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                    <div class="p-3">{{ $withdrawalRequests->links() }}</div>
                </div>
            </div>
        </div>

        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">گردش کیف پول و لاگ مالی</h5>
                    <p class="text-muted mb-0">تمام شارژهای پورسانت، بلوکه شدن برداشت و برگشت وجه در اینجا ثبت می‌شود تا اختلاف حسابی باقی نماند.</p>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>نوع عملیات</th>
                                    <th>شرح</th>
                                    <th>مبلغ</th>
                                    <th>موجودی بعد از عملیات</th>
                                    <th>مرجع</th>
                                    <th>تاریخ</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($walletTransactions as $transaction)
                                    <tr>
                                        <td>{{ $transactionTypeLabel($transaction->type) }}</td>
                                        <td>{{ $transaction->description ?: '—' }}</td>
                                        <td class="{{ $transaction->amount >= 0 ? 'text-success' : 'text-danger' }}">
                                            {{ $transaction->amount >= 0 ? '+' : '-' }}{{ $formatMoney(abs((int) $transaction->amount)) }}
                                        </td>
                                        <td>{{ $formatMoney((int) $transaction->balance_after) }}</td>
                                        <td>
                                            @if ($transaction->commissionLedger)
                                                {{ $transaction->commissionLedger->source_label }}
                                            @elseif ($transaction->withdrawalRequest)
                                                درخواست #{{ $transaction->withdrawalRequest->id }}
                                            @elseif (!empty($transaction->meta_json['source_label']))
                                                {{ $transaction->meta_json['source_label'] }}
                                            @else
                                                —
                                            @endif
                                        </td>
                                        <td>{{ $formatJalaliDateTime($transaction->occurred_at) }}</td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="6" class="text-center py-4 text-muted">هنوز تراکنش کیف پولی ثبت نشده است.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                    <div class="p-3">{{ $walletTransactions->links() }}</div>
                </div>
            </div>
        </div>
    </div>
@endsection
