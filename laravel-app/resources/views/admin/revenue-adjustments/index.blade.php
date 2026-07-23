@extends('admin.layouts.app')

@section('title', 'ابطال درآمدها')

@php
    $formatMoney = fn (int $amount) => __('admin.money.iran_toman', ['amount' => number_format($amount)]);
@endphp

@section('content')
    <div class="row mb-4">
        <div class="col-12">
            <h4 class="mb-1">ابطال و استرداد درآمد</h4>
            <p class="text-muted mb-0">از این صفحه می‌توانید درآمد ثبت‌شده را از گزارش‌های مالی خارج کنید یا بازپرداخت ثبت کنید. پورسانت‌های فروش وابسته هم به‌صورت خودکار برمی‌گردد.</p>
        </div>
    </div>

    <div class="card mb-4">
        <div class="card-body">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead>
                        <tr>
                            <th>فاکتور</th>
                            <th>سامانه/مشتری</th>
                            <th>نوع</th>
                            <th>مبلغ</th>
                            <th>زمان پرداخت</th>
                            <th>عملیات</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($payments as $payment)
                            <tr>
                                <td>{{ $payment['invoice_number'] }}</td>
                                <td>
                                    <div>{{ $payment['tenant_name'] }}</div>
                                    <small class="text-muted">{{ $payment['actor_name'] ?: '—' }}</small>
                                </td>
                                <td>{{ $payment['title'] }}</td>
                                <td class="fw-semibold">{{ $formatMoney((int) $payment['amount']) }}</td>
                                <td>{{ $payment['paid_at'] ? \App\Support\JalaliDate::formatDateTime($payment['paid_at']) : '—' }}</td>
                                <td>
                                    <button
                                        type="button"
                                        class="btn btn-sm btn-light-danger"
                                        data-bs-toggle="modal"
                                        data-bs-target="#revenueAdjustModal"
                                        data-kind="{{ $payment['kind'] }}"
                                        data-id="{{ $payment['id'] }}"
                                        data-title="{{ $payment['title'] }}"
                                        data-invoice="{{ $payment['invoice_number'] }}"
                                        data-amount="{{ $formatMoney((int) $payment['amount']) }}"
                                    >
                                        ابطال درآمد
                                    </button>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="6" class="text-center py-5 text-muted">درآمد فعالی برای ابطال پیدا نشد.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>

            @if ($payments->hasPages())
                <div class="mt-4">
                    {{ $payments->onEachSide(1)->links() }}
                </div>
            @endif
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <h5 class="mb-1">تاریخچه ابطال‌ها و استردادها</h5>
            <p class="text-muted mb-0">همه عملیات‌ها با دلیل، انجام‌دهنده و جزئیات اصلی اینجا ثبت می‌شوند.</p>
        </div>
        <div class="card-body">
            <div class="table-responsive">
                <table class="table table-striped align-middle mb-0">
                    <thead>
                        <tr>
                            <th>نوع عملیات</th>
                            <th>شرح</th>
                            <th>دلیل</th>
                            <th>انجام‌دهنده</th>
                            <th>زمان</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($history as $item)
                            <tr>
                                <td>{{ str_contains($item->action_type, 'refund') ? 'استرداد وجه' : 'حذف درآمد' }}</td>
                                <td>{{ $item->title ?: '—' }}</td>
                                <td>{{ $item->reason }}</td>
                                <td>{{ $item->actor?->name ?? '—' }}</td>
                                <td>{{ $item->occurred_at ? \App\Support\JalaliDate::formatDateTime($item->occurred_at) : '—' }}</td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="5" class="text-center py-4 text-muted">هنوز عملیاتی ثبت نشده است.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="modal fade" id="revenueAdjustModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <form method="POST" id="revenueAdjustForm">
                    @csrf
                    <div class="modal-header">
                        <h5 class="modal-title">ابطال یا استرداد درآمد</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-warning">
                            <div class="fw-semibold mb-1" id="revenueAdjustTitle">—</div>
                            <div class="small text-muted" id="revenueAdjustMeta">—</div>
                        </div>

                        <div class="mb-3">
                            <label class="form-label">نوع عملیات</label>
                            <select class="form-select" name="mode" required>
                                <option value="void">حذف درآمد اشتباهی</option>
                                <option value="refund">استرداد وجه / برگشت پول</option>
                            </select>
                        </div>

                        <div>
                            <label class="form-label" for="revenue_reason">دلیل</label>
                            <textarea class="form-control" id="revenue_reason" name="reason" rows="4" required placeholder="مثلاً ثبت اشتباه، انصراف مشتری، یا بازپرداخت کامل به درخواست مشتری"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-light-secondary" data-bs-dismiss="modal">انصراف</button>
                        <button type="submit" class="btn btn-danger">ثبت ابطال درآمد</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
@endsection

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            const modal = document.getElementById('revenueAdjustModal');
            const form = document.getElementById('revenueAdjustForm');
            const title = document.getElementById('revenueAdjustTitle');
            const meta = document.getElementById('revenueAdjustMeta');

            if (!modal || !form || !title || !meta) return;

            modal.addEventListener('show.bs.modal', function (event) {
                const button = event.relatedTarget;
                if (!button) return;

                const kind = button.getAttribute('data-kind');
                const id = button.getAttribute('data-id');
                const action = kind === 'landing'
                    ? "{{ url('/admin/revenue-adjustments/landing') }}/" + id
                    : "{{ url('/admin/revenue-adjustments/tenant') }}/" + id;

                form.setAttribute('action', action);
                title.textContent = button.getAttribute('data-title') || '—';
                meta.textContent = @js(__('admin.revenue_adjustments.modal_meta', ['invoice' => '__INVOICE__', 'amount' => '__AMOUNT__']))
                    .replace('__INVOICE__', button.getAttribute('data-invoice') || '—')
                    .replace('__AMOUNT__', button.getAttribute('data-amount') || '—');
            });
        });
    </script>
@endpush
