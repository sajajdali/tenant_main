@extends('admin.layouts.app')

@section('title', 'سررسید دامنه‌ها')

@push('styles')
    @vite('resources/js/admin-ir-domain-renewals.js')
    <style>
        .ir-domain-jalali-input {
            width: 100%;
            background-color: #fff;
            cursor: pointer;
        }
    </style>
@endpush

@section('content')
    @php
        $dueLabels = [
            '' => 'همه دامنه‌های ثبت‌شده',
            'month' => 'تا ۳۰ روز آینده',
            '15days' => 'تا ۱۵ روز آینده',
            '7days' => 'تا ۷ روز آینده',
            '1day' => 'تا ۱ روز آینده',
            'expired' => 'منقضی شده‌ها',
            'active' => 'بیش از ۳۰ روز مانده',
            'unregistered' => 'ثبت‌نشده‌ها',
        ];
    @endphp

    <div class="row g-3 mb-3">
        <div class="col-md-6 col-xl-2">
            <div class="card h-100"><div class="card-body"><div class="text-muted small mb-2">ثبت‌شده</div><h4 class="mb-0">{{ number_format($summary['registered']) }}</h4></div></div>
        </div>
        <div class="col-md-6 col-xl-2">
            <div class="card h-100"><div class="card-body"><div class="text-muted small mb-2">۳۰ روز مانده</div><h4 class="mb-0 text-warning">{{ number_format($summary['month']) }}</h4></div></div>
        </div>
        <div class="col-md-6 col-xl-2">
            <div class="card h-100"><div class="card-body"><div class="text-muted small mb-2">۱۵ روز مانده</div><h4 class="mb-0 text-warning">{{ number_format($summary['15days']) }}</h4></div></div>
        </div>
        <div class="col-md-6 col-xl-2">
            <div class="card h-100"><div class="card-body"><div class="text-muted small mb-2">۷ روز مانده</div><h4 class="mb-0 text-danger">{{ number_format($summary['7days']) }}</h4></div></div>
        </div>
        <div class="col-md-6 col-xl-2">
            <div class="card h-100"><div class="card-body"><div class="text-muted small mb-2">۱ روز مانده</div><h4 class="mb-0 text-danger">{{ number_format($summary['1day']) }}</h4></div></div>
        </div>
        <div class="col-md-6 col-xl-2">
            <div class="card h-100"><div class="card-body"><div class="text-muted small mb-2">منقضی شده</div><h4 class="mb-0 text-danger">{{ number_format($summary['expired']) }}</h4></div></div>
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <div class="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                <div>
                    <h5 class="mb-1">مدیریت سررسید دامنه‌ها</h5>
                    <p class="text-muted mb-0">tenantهایی که تمدید دامنه با شماست را از اینجا رصد، فیلتر و تمدید کنید.</p>
                </div>
                <a href="{{ route('admin.tenants.index') }}" class="btn btn-light-secondary">بازگشت به سامانه‌ها</a>
            </div>
        </div>
        <div class="card-body">
            <form method="GET" class="row g-3 align-items-end mb-4">
                <div class="col-md-4">
                    <label class="form-label" for="q">جستجو</label>
                    <input type="text" class="form-control" id="q" name="q" value="{{ $filters['q'] }}" placeholder="نام مجموعه، موبایل، دامنه یا اسلاگ">
                </div>
                <div class="col-md-3">
                    <label class="form-label" for="audience_type_id">طیف کاری</label>
                    <select class="form-select" id="audience_type_id" name="audience_type_id">
                        <option value="">همه طیف‌ها</option>
                        @foreach ($audiences as $audience)
                            <option value="{{ $audience->id }}" @selected($filters['audience_type_id'] === (string) $audience->id)>{{ $audience->name }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="col-md-3">
                    <label class="form-label" for="tld">پسوند</label>
                    <select class="form-select" id="tld" name="tld">
                        <option value="">همه پسوندها</option>
                        @foreach ($tldOptions as $tld)
                            <option value="{{ $tld->tld }}" @selected($filters['tld'] === $tld->tld)>{{ trim((string) ($tld->meta_json['label'] ?? '')) ?: $tld->tld }} ({{ $tld->tld }})</option>
                        @endforeach
                    </select>
                </div>
                <div class="col-md-2">
                    <label class="form-label" for="due">فیلتر سررسید</label>
                    <select class="form-select" id="due" name="due">
                        @foreach ($dueLabels as $key => $label)
                            <option value="{{ $key }}" @selected($filters['due'] === $key)>{{ $label }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="col-md-12 d-flex gap-2 justify-content-end">
                    <button type="submit" class="btn btn-primary flex-fill">اعمال</button>
                    <a href="{{ route('admin.ir-domain-renewals.index') }}" class="btn btn-light-secondary">حذف</a>
                </div>
            </form>

            <div class="alert alert-light-warning">
                {!! __('admin.ir_domain_renewals.default_amount_notice', ['tld' => '<strong>.ir</strong>', 'amount' => '<strong>' . __('admin.money.iran_toman', ['amount' => number_format($defaultIrRenewAmount)]) . '</strong>']) !!}
            </div>

            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead>
                        <tr>
                            <th>مجموعه</th>
                            <th>طیف</th>
                            <th>دامنه</th>
                            <th>مسئول</th>
                            <th>وضعیت دامنه</th>
                            <th>مبلغ تمدید</th>
                            <th>سررسید</th>
                            <th class="text-end">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($tenants as $tenant)
                            @php
                                $irDomain = \App\Support\TenantManagedDomain::summary($tenant);
                                $primaryDomain = $tenant->domains->first()?->domain;
                            @endphp
                            <tr>
                                <td>
                                    <div class="fw-semibold">{{ $tenant->name }}</div>
                                    <div class="small text-muted" dir="ltr">{{ $tenant->slug }}</div>
                                </td>
                                <td>{{ $tenant->audienceType?->name ?? '—' }}</td>
                                <td dir="ltr">{{ $primaryDomain ?: '—' }}</td>
                                <td>
                                    <div class="fw-semibold">{{ $tenant->owner?->name ?? 'بدون مسئول' }}</div>
                                    <div class="small text-muted" dir="ltr">{{ $tenant->owner?->mobile ?? '—' }}</div>
                                </td>
                                <td>
                                    <div class="d-flex flex-column gap-2">
                                        <span class="badge {{ $irDomain['selfManaged'] ? 'bg-light-secondary text-secondary' : ($irDomain['enabled'] ? ($irDomain['expired'] ? 'bg-light-danger text-danger' : ($irDomain['isDueSoon'] ? 'bg-light-warning text-warning' : 'bg-light-success text-success')) : 'bg-light-secondary text-muted') }}">
                                            {{ $irDomain['statusLabel'] }}
                                        </span>
                                        <div class="small text-muted">{{ $irDomain['label'] }}{{ !empty($irDomain['tld']) ? ' (' . $irDomain['tld'] . ')' : '' }}</div>
                                        @if ($irDomain['enabled'])
                                            <div class="small text-muted">
                                                آخرین پرداخت: {{ $irDomain['lastPaidAt'] ? \App\Support\JalaliDate::format($irDomain['lastPaidAt']) : 'ثبت نشده' }}
                                            </div>
                                        @elseif ($irDomain['selfManaged'])
                                            <div class="small text-muted">تمدید این دامنه توسط خود کاربر انجام می‌شود.</div>
                                        @else
                                            <div class="small text-muted">برای این tenant هنوز ثبت نشده است.</div>
                                        @endif
                                    </div>
                                </td>
                                <td>{{ $irDomain['amount'] !== null ? __('admin.money.iran_toman', ['amount' => number_format((int) $irDomain['amount'])]) : '—' }}</td>
                                <td>
                                    @if ($irDomain['enabled'])
                                        <div class="fw-semibold">{{ \App\Support\JalaliDate::format($irDomain['renewsAt']) }}</div>
                                        <div class="small {{ $irDomain['expired'] ? 'text-danger' : ($irDomain['isDueSoon'] ? 'text-warning' : 'text-muted') }}">
                                            @if ($irDomain['expired'])
                                                منقضی شده
                                            @else
                                                {{ number_format((int) ($irDomain['daysRemaining'] ?? 0)) }} روز مانده
                                            @endif
                                        </div>
                                    @else
                                        —
                                    @endif
                                </td>
                                <td class="text-end">
                                        <div class="d-flex justify-content-end gap-2 flex-wrap">
                                            <a href="{{ route('admin.tenants.show', $tenant) }}" class="btn btn-sm btn-light-secondary">گزارش</a>
                                            <a href="{{ route('admin.tenants.edit', $tenant) }}" class="btn btn-sm btn-light-primary">ویرایش</a>
                                            @if (! $irDomain['selfManaged'])
                                        <button
                                            type="button"
                                            class="btn btn-sm {{ $irDomain['enabled'] ? 'btn-warning' : 'btn-success' }}"
                                            data-bs-toggle="modal"
                                            data-bs-target="#irDomainRenewModal"
                                            data-action="{{ route('admin.ir-domain-renewals.update', $tenant) }}"
                                            data-tenant-name="{{ $tenant->name }}"
                                            data-mode="{{ $irDomain['enabled'] ? 'renew' : 'register' }}"
                                            data-registered="{{ $irDomain['enabled'] ? '1' : '0' }}"
                                            data-tld="{{ $irDomain['tld'] ?? '.ir' }}"
                                            data-renews-at="{{ $irDomain['renewsAt'] ?? now()->addYear()->toDateString() }}"
                                            data-amount="{{ (int) ($irDomain['amount'] ?? $defaultIrRenewAmount) }}"
                                        >
                                            {{ $irDomain['enabled'] ? 'ثبت تمدید' : 'ثبت دامنه' }}
                                        </button>
                                        @if ($irDomain['enabled'])
                                            <button
                                                type="button"
                                                class="btn btn-sm btn-light-danger"
                                                data-bs-toggle="modal"
                                                data-bs-target="#irDomainDisableModal"
                                                data-action="{{ route('admin.ir-domain-renewals.update', $tenant) }}"
                                                data-tenant-name="{{ $tenant->name }}"
                                            >
                                                پاک کردن
                                            </button>
                                        @endif
                                            @endif
                                        </div>
                                    </td>
                                </tr>
                        @empty
                            <tr>
                                <td colspan="8" class="text-center py-4 text-muted">سامانه‌ای با این فیلتر پیدا نشد.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>

            <div class="mt-4">
                {{ $tenants->links() }}
            </div>
        </div>
    </div>

    <div class="modal fade" id="irDomainRenewModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <form method="POST" id="irDomainRenewForm">
                    @csrf
                    <input type="hidden" name="mode" id="irDomainRenewMode" value="renew">
                    <input type="hidden" name="ir_domain_registered" value="1">
                    <div class="modal-header">
                        <h5 class="modal-title" id="irDomainRenewTitle">ثبت تمدید دامنه</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted mb-3">
                            وضعیت تمدید دامنه برای <strong id="irDomainRenewTenantName">سامانه</strong> از اینجا ثبت می‌شود.
                        </p>
                        <div class="mb-3">
                            <label class="form-label" for="managed_domain_tld_modal">پسوند دامنه</label>
                            <select class="form-select" id="managed_domain_tld_modal" name="managed_domain_tld" required>
                                @foreach ($tldOptions as $tld)
                                    <option value="{{ $tld->tld }}">{{ trim((string) ($tld->meta_json['label'] ?? '')) ?: $tld->tld }} ({{ $tld->tld }})</option>
                                @endforeach
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label d-block" for="ir_domain_renews_at_modal_display">تاریخ سررسید بعدی</label>
                            <input type="text" class="form-control ir-domain-jalali-input" id="ir_domain_renews_at_modal_display" autocomplete="off" data-jdp data-jdp-only-date>
                            <input type="hidden" id="ir_domain_renews_at_modal" name="managed_domain_renews_at" required>
                        </div>
                        <div>
                            <label class="form-label" for="ir_domain_amount_modal">مبلغ تمدید سالانه</label>
                            <input type="number" min="0" class="form-control" id="ir_domain_amount_modal" name="managed_domain_amount" required>
                        </div>
                        <input type="hidden" name="managed_domain_registered" value="1">
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-light-secondary" data-bs-dismiss="modal">انصراف</button>
                        <button type="submit" class="btn btn-primary" id="irDomainRenewSubmit">ثبت</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <div class="modal fade" id="irDomainDisableModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <form method="POST" id="irDomainDisableForm">
                    @csrf
                    <input type="hidden" name="mode" value="disable">
                    <input type="hidden" name="ir_domain_registered" value="0">
                    <div class="modal-header">
                        <h5 class="modal-title">حذف وضعیت تمدید دامنه</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p class="mb-0 text-muted">
                            اگر برای <strong id="irDomainDisableTenantName">سامانه</strong> دیگر نمی‌خواهید وضعیت تمدید دامنه نگه‌داری شود، تایید کنید تا این اطلاعات از پروفایل tenant پاک شود.
                        </p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-light-secondary" data-bs-dismiss="modal">انصراف</button>
                        <button type="submit" class="btn btn-danger">پاک کردن</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
@endsection

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            const renewModal = document.getElementById('irDomainRenewModal');
            const renewForm = document.getElementById('irDomainRenewForm');
            const renewTitle = document.getElementById('irDomainRenewTitle');
            const renewTenantName = document.getElementById('irDomainRenewTenantName');
            const renewMode = document.getElementById('irDomainRenewMode');
            const renewsAtInput = document.getElementById('ir_domain_renews_at_modal');
            const amountInput = document.getElementById('ir_domain_amount_modal');
            const tldInput = document.getElementById('managed_domain_tld_modal');
            const renewSubmit = document.getElementById('irDomainRenewSubmit');
            const disableModal = document.getElementById('irDomainDisableModal');
            const disableForm = document.getElementById('irDomainDisableForm');
            const disableTenantName = document.getElementById('irDomainDisableTenantName');

            renewModal?.addEventListener('show.bs.modal', function (event) {
                const button = event.relatedTarget;
                if (!button || !renewForm || !renewTitle || !renewTenantName || !renewMode || !renewsAtInput || !amountInput || !renewSubmit || !tldInput) return;

                const mode = button.getAttribute('data-mode') || 'renew';
                const tld = button.getAttribute('data-tld') || '.ir';
                renewForm.action = button.getAttribute('data-action') || '';
                renewMode.value = mode;
                renewTenantName.textContent = button.getAttribute('data-tenant-name') || 'سامانه';
                renewTitle.textContent = mode === 'register' ? `ثبت دامنه ${tld}` : `ثبت تمدید دامنه ${tld}`;
                renewSubmit.textContent = mode === 'register' ? 'ثبت دامنه' : 'ثبت تمدید';
                tldInput.value = tld;
                renewsAtInput.value = button.getAttribute('data-renews-at') || '';
                amountInput.value = button.getAttribute('data-amount') || '0';
            });

            disableModal?.addEventListener('show.bs.modal', function (event) {
                const button = event.relatedTarget;
                if (!button || !disableForm || !disableTenantName) return;

                disableForm.action = button.getAttribute('data-action') || '';
                disableTenantName.textContent = button.getAttribute('data-tenant-name') || 'سامانه';
            });
        });
    </script>
@endpush
