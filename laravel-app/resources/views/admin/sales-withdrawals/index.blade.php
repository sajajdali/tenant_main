@extends('admin.layouts.app')

@section('title', 'درخواست‌های برداشت')

@php
    use Morilog\Jalali\Jalalian;

    $formatMoney = fn (int $amount) => __('admin.money.iran_toman', ['amount' => number_format($amount)]);
    $formatJalaliDateTime = fn ($value) => $value ? Jalalian::fromCarbon(\Illuminate\Support\Carbon::parse($value))->format('Y/m/d H:i') : '—';
    $maskCard = function (?string $card): string {
        $digits = preg_replace('/\D+/', '', (string) $card) ?? '';
        return $digits === '' ? '—' : trim(chunk_split(substr($digits, 0, 16), 4, ' '));
    };
@endphp

@section('content')
    <div class="row g-4">
        <div class="col-12">
            <div class="card dashboard-hero border-0 position-relative overflow-hidden">
                <div class="hero-pattern"></div>
                <div class="card-body p-4 p-lg-5 position-relative">
                    <div class="row align-items-center g-4">
                        <div class="col-lg-8">
                            <span class="badge bg-light text-dark mb-3">مدیریت برداشت‌ها</span>
                            <h2 class="mb-3 text-white lh-base">بررسی، واریز و برگشت درخواست‌های برداشت تیم فروش</h2>
                            <p class="mb-0 text-white text-opacity-75 lh-lg">
                                از این بخش می‌توانید تمام درخواست‌های برداشت کارشناسان و مدیران فروش را با فیلتر کامل ببینید،
                                وضعیت آن‌ها را تغییر دهید و لاگ دقیق هر عملیات را کنترل کنید.
                            </p>
                        </div>
                        <div class="col-lg-4">
                            <div class="text-lg-end text-center">
                                <div class="display-6 fw-bold text-white">{{ number_format($requests->total()) }}</div>
                                <div class="text-white text-opacity-75">درخواست ثبت‌شده</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">فیلتر درخواست‌ها</h5>
                    <p class="text-muted mb-0">برای رسیدگی سریع‌تر، وضعیت، نقش و شخص مورد نظر را فیلتر کنید.</p>
                </div>
                <div class="card-body">
                    <form method="GET" action="{{ route('admin.sales-withdrawals.index') }}">
                        <div class="row g-3">
                            <div class="col-md-4">
                                <label class="form-label" for="status">وضعیت</label>
                                <select class="form-select" id="status" name="status">
                                    <option value="">همه وضعیت‌ها</option>
                                    <option value="pending" @selected($status === 'pending')>در صف واریز</option>
                                    <option value="paid" @selected($status === 'paid')>واریز شده</option>
                                    <option value="cancelled" @selected($status === 'cancelled')>کنسل شده</option>
                                    <option value="returned" @selected($status === 'returned')>برگشت خورده</option>
                                </select>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="role">نقش</label>
                                <select class="form-select" id="role" name="role">
                                    <option value="">همه نقش‌ها</option>
                                    <option value="sales_expert" @selected($role === 'sales_expert')>کارشناس فروش</option>
                                    <option value="sales_manager" @selected($role === 'sales_manager')>مدیر فروش</option>
                                </select>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="user_id">شخص</label>
                                <select class="form-select" id="user_id" name="user_id">
                                    <option value="">همه افراد</option>
                                    @foreach ($salesUsers as $salesUser)
                                        <option value="{{ $salesUser->id }}" @selected((string) $salesUser->id === $userId)>
                                            {{ $salesUser->name }} - {{ $salesTeamService->roleLabel($salesUser->role) }}
                                        </option>
                                    @endforeach
                                </select>
                            </div>
                            <div class="col-12 d-flex gap-2">
                                <button type="submit" class="btn btn-primary">اعمال فیلتر</button>
                                <a href="{{ route('admin.sales-withdrawals.index') }}" class="btn btn-light-secondary">حذف فیلترها</a>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <div class="col-12">
            <div class="card">
                <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div>
                        <h5 class="mb-1">لیست درخواست‌ها</h5>
                        <p class="text-muted mb-0">مدیر کل از همین صفحه وضعیت را تغییر می‌دهد و در صورت برگشت خوردن، مبلغ به کیف پول شخص برمی‌گردد.</p>
                    </div>
                    <span class="badge bg-light-warning text-warning">در صف: {{ number_format($requests->where('status', 'pending')->count()) }}</span>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>شخص</th>
                                    <th>حساب بانکی</th>
                                    <th>مبلغ</th>
                                    <th>وضعیت</th>
                                    <th>تاریخ ثبت</th>
                                    <th>تاریخ واریز</th>
                                    <th>وضعیت‌دهی</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($requests as $withdrawal)
                                    <tr>
                                        <td>
                                            <div class="fw-semibold">{{ $withdrawal->user?->name ?? '—' }}</div>
                                            <small class="text-muted">
                                                {{ $withdrawal->user ? $salesTeamService->roleLabel($withdrawal->user->role) : '—' }}
                                            </small>
                                        </td>
                                        <td>
                                            <div>{{ $withdrawal->bankAccount?->bank_name ?? '—' }}</div>
                                            <small class="text-muted">{{ $maskCard($withdrawal->bankAccount?->card_number) }}</small>
                                        </td>
                                        <td>
                                            <div class="fw-semibold">{{ $formatMoney((int) $withdrawal->requested_amount) }}</div>
                                            <small class="text-muted">{{ __('admin.sales_withdrawals.paid_amount', ['amount' => $formatMoney((int) $withdrawal->paid_amount)]) }}</small>
                                        </td>
                                        <td>
                                            <span class="badge {{ $salesTeamService->withdrawalStatusBadgeClass($withdrawal->status) }}">
                                                {{ $salesTeamService->withdrawalStatusLabel($withdrawal->status) }}
                                            </span>
                                        </td>
                                        <td>{{ $formatJalaliDateTime($withdrawal->requested_at) }}</td>
                                        <td>{{ $formatJalaliDateTime($withdrawal->paid_at ?? $withdrawal->processed_at) }}</td>
                                        <td style="min-width: 320px;">
                                            @if ($withdrawal->status === 'pending' && $canProcessRequests)
                                                <form method="POST" action="{{ route('admin.sales-withdrawals.update', $withdrawal) }}">
                                                    @csrf
                                                    @method('PUT')
                                                    <div class="row g-2">
                                                        <div class="col-12">
                                                            <select class="form-select" name="status" required>
                                                                <option value="paid">واریز شده</option>
                                                                <option value="cancelled">کنسل شده</option>
                                                                <option value="returned">برگشت خورده</option>
                                                            </select>
                                                        </div>
                                                        <div class="col-md-6">
                                                            <input type="number" class="form-control" name="paid_amount" min="1" max="{{ $withdrawal->requested_amount }}" placeholder="مبلغ واریز">
                                                        </div>
                                                        <div class="col-md-6">
                                                            <input type="text" class="form-control" name="payment_reference" placeholder="شماره پیگیری">
                                                        </div>
                                                        <div class="col-12">
                                                            <textarea class="form-control" name="admin_note" rows="2" placeholder="توضیح مدیر"></textarea>
                                                        </div>
                                                        <div class="col-12">
                                                            <button type="submit" class="btn btn-sm btn-primary">ثبت تغییر وضعیت</button>
                                                        </div>
                                                    </div>
                                                </form>
                                            @else
                                                <div class="small text-muted">
                                                    @if (! $canProcessRequests && $withdrawal->status === 'pending')
                                                        این صفحه برای شما فقط به‌صورت گزارش است و تغییر وضعیت فقط توسط مدیر کل انجام می‌شود.<br>
                                                    @endif
                                                    رسیدگی توسط: {{ $withdrawal->processedBy?->name ?? '—' }}<br>
                                                    شماره پیگیری: {{ $withdrawal->payment_reference ?: '—' }}
                                                </div>
                                            @endif
                                        </td>
                                    </tr>
                                    <tr class="bg-light">
                                        <td colspan="7">
                                            <div class="row g-3">
                                                <div class="col-lg-4">
                                                    <div class="small">
                                                        <div><strong>توضیح درخواست:</strong> {{ $withdrawal->request_note ?: '—' }}</div>
                                                        <div class="mt-1"><strong>توضیح مدیر:</strong> {{ $withdrawal->admin_note ?: '—' }}</div>
                                                        <div class="mt-1"><strong>{{ __('admin.sales_withdrawals.balance_before') }}</strong> {{ $formatMoney((int) $withdrawal->balance_before) }}</div>
                                                        <div class="mt-1"><strong>{{ __('admin.sales_withdrawals.balance_after') }}</strong> {{ $formatMoney((int) $withdrawal->balance_after) }}</div>
                                                    </div>
                                                </div>
                                                <div class="col-lg-8">
                                                    <div class="small">
                                                        <strong>لاگ عملیات:</strong>
                                                        @forelse ($withdrawal->logs as $log)
                                                            <div class="mt-1 text-muted">
                                                                {{ $formatJalaliDateTime($log->occurred_at) }} •
                                                                {{ $log->actor?->name ?? 'سیستم' }} •
                                                                {{ $log->action }}
                                                                @if ($log->from_status || $log->to_status)
                                                                    ({{ $log->from_status ? $salesTeamService->withdrawalStatusLabel($log->from_status) : '—' }} → {{ $log->to_status ? $salesTeamService->withdrawalStatusLabel($log->to_status) : '—' }})
                                                                @endif
                                                                @if ($log->note)
                                                                    • {{ $log->note }}
                                                                @endif
                                                            </div>
                                                        @empty
                                                            <div class="mt-1 text-muted">لاگی برای این درخواست ثبت نشده است.</div>
                                                        @endforelse
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="7" class="text-center py-4 text-muted">درخواستی برای نمایش وجود ندارد.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                    <div class="p-3">{{ $requests->links() }}</div>
                </div>
            </div>
        </div>
    </div>
@endsection
