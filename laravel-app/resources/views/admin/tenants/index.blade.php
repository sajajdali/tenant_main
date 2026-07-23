@extends('admin.layouts.app')

@section('title', 'سامانه‌های نوبت‌دهی')

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <div class="d-flex align-items-center justify-content-between">
                        <div>
                            <h5 class="mb-1">سامانه‌های نوبت‌دهی و دامنه‌ها</h5>
                            <p class="text-muted mb-0">هر tenant یک دیتابیس، دامنه، طیف کاری و بسته زمانی مستقل دارد.</p>
                        </div>
                        <a href="{{ route('admin.tenants.create') }}" class="btn btn-primary">افزودن سامانه نوبت‌دهی</a>
                    </div>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>نام مجموعه</th>
                                    <th>طیف کاری</th>
                                    <th>بسته</th>
                                    <th>پایان پشتیبانی</th>
                                    <th>اسلاگ</th>
                                    <th>دیتابیس</th>
                                    <th>دامنه</th>
                                    <th>کاربر مسئول</th>
                                    <th>وضعیت</th>
                                    <th>عملیات</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($tenants as $tenant)
                                    <tr>
                                        @php
                                            $irDomain = \App\Support\TenantIrDomain::summary($tenant);
                                        @endphp
                                        <td class="fw-semibold">{{ $tenant->name }}</td>
                                        <td>
                                            <span class="badge bg-light-secondary text-secondary">{{ $tenant->audienceType?->name ?? 'تعریف نشده' }}</span>
                                        </td>
                                        <td>
                                            <div class="fw-semibold">{{ $tenant->subscriptionPackage?->name ?? 'تعریف نشده' }}</div>
                                        </td>
                                        <td>
                                            <div class="fw-semibold">{{ $tenant->support_ends_at ? \App\Support\JalaliDate::format($tenant->support_ends_at) : '—' }}</div>
                                        </td>
                                        <td dir="ltr">
                                            <span class="badge bg-light-secondary text-secondary">{{ $tenant->slug }}</span>
                                        </td>
                                        <td dir="ltr">
                                            <span class="badge bg-light text-dark">{{ $tenant->database }}</span>
                                        </td>
                                        <td dir="ltr">
                                            <div class="small fw-semibold">{{ $tenant->domains->pluck('domain')->join(' , ') }}</div>
                                        </td>
                                        <td>
                                            <div class="fw-semibold">{{ $tenant->owner?->name ?? 'بدون مسئول' }}</div>
                                            <small class="text-muted" dir="ltr">{{ $tenant->owner?->mobile ?? 'بدون شماره' }}</small>
                                        </td>
                                        <td>
                                            <div class="d-flex flex-column gap-2" style="min-width: 220px;">
                                                <div class="d-flex flex-wrap gap-2">
                                                    <span class="badge {{ $tenant->status === 'active' ? 'bg-light-success text-success' : 'bg-light-danger text-danger' }}">
                                                        {{ $tenant->status === 'active' ? 'فعال' : 'غیرفعال' }}
                                                    </span>
                                                    <span class="badge {{ $tenant->isPanelAccessLocked() ? 'bg-light-danger text-danger' : 'bg-light-primary text-primary' }}">
                                                        {{ $tenant->isPanelAccessLocked() ? 'پنل بسته' : 'پنل باز' }}
                                                    </span>
                                                </div>
                                                <div class="d-flex flex-wrap gap-2">
                                                    <span class="badge {{ $tenant->paymentSandboxOverride() ? 'bg-light-warning text-warning' : 'bg-light-secondary text-muted' }}">
                                                        {{ $tenant->paymentSandboxOverride() ? 'پرداخت سندباکس' : 'پرداخت واقعی' }}
                                                    </span>
                                                    <span class="badge {{ $tenant->smsSandboxOverride() ? 'bg-light-warning text-warning' : 'bg-light-secondary text-muted' }}">
                                                        {{ $tenant->smsSandboxOverride() ? 'پیامک سندباکس' : 'پیامک واقعی' }}
                                                    </span>
                                                </div>
                                                @if ($tenant->demoFixedLoginCode())
                                                    <div>
                                                        <span class="badge bg-light-info text-info">ورود دمو: {{ $tenant->demoFixedLoginCode() }}</span>
                                                    </div>
                                                @endif
                                                <div>
                                                    <span class="badge {{ $irDomain['enabled'] ? ($irDomain['expired'] ? 'bg-light-danger text-danger' : ($irDomain['isDueSoon'] ? 'bg-light-warning text-warning' : 'bg-light-success text-success')) : 'bg-light-secondary text-muted' }}">
                                                        {{ $irDomain['tld'] ?? 'دامنه' }}: {{ $irDomain['statusLabel'] }}
                                                    </span>
                                                </div>
                                                @php
                                                    $statusNotes = collect([
                                                        $tenant->isPanelAccessLocked() ? \Illuminate\Support\Str::limit($tenant->panelAccessMessage(), 70) : null,
                                                        $tenant->sandboxOverrideNote() ? \Illuminate\Support\Str::limit($tenant->sandboxOverrideNote(), 70) : null,
                                                        $irDomain['enabled'] && $irDomain['renewsAt']
                                                            ? 'سررسید ' . ($irDomain['tld'] ?? 'دامنه') . ': ' . \App\Support\JalaliDate::format($irDomain['renewsAt']) . ($irDomain['expired'] ? ' (منقضی شده)' : ' - ' . number_format((int) ($irDomain['daysRemaining'] ?? 0)) . ' روز مانده')
                                                            : null,
                                                    ])->filter()->values();
                                                @endphp
                                                @if ($statusNotes->isNotEmpty())
                                                    <div class="rounded-3 p-2 bg-light">
                                                        @foreach ($statusNotes as $note)
                                                            <div class="small text-muted {{ $loop->last ? '' : 'mb-1' }}">{{ $note }}</div>
                                                        @endforeach
                                                    </div>
                                                @endif
                                            </div>
                                        </td>
                                        <td>
                                            <div class="d-flex flex-column gap-2" style="min-width: 240px;">
                                                <div class="d-flex flex-wrap gap-2">
                                                    <a href="{{ route('admin.tenants.show', $tenant) }}" class="btn btn-sm btn-light-secondary">گزارش</a>
                                                    <a href="{{ route('admin.tenants.edit', $tenant) }}" class="btn btn-sm btn-light-primary">ویرایش</a>
                                                    <a href="{{ route('admin.ir-domain-renewals.index', ['q' => $tenant->name]) }}" class="btn btn-sm btn-light-info">دامنه</a>
                                                    <button
                                                        type="button"
                                                        class="btn btn-sm btn-light-warning"
                                                        data-bs-toggle="modal"
                                                        data-bs-target="#renewTenantModal"
                                                        data-renew-url="{{ route('admin.tenants.renew', $tenant) }}"
                                                        data-tenant-name="{{ $tenant->name }}"
                                                    >
                                                        تمدید
                                                    </button>
                                                </div>
                                                <div class="d-flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        class="btn btn-sm {{ $tenant->isPanelAccessLocked() ? 'btn-success' : 'btn-light-danger' }}"
                                                        data-bs-toggle="modal"
                                                        data-bs-target="#panelAccessModal"
                                                        data-panel-access-url="{{ route('admin.tenants.panel-access.update', $tenant) }}"
                                                        data-tenant-name="{{ $tenant->name }}"
                                                        data-panel-access-locked="{{ $tenant->isPanelAccessLocked() ? '1' : '0' }}"
                                                        data-panel-access-message="{{ $tenant->isPanelAccessLocked() ? e($tenant->panelAccessMessage()) : '' }}"
                                                    >
                                                        {{ $tenant->isPanelAccessLocked() ? 'باز کردن پنل' : 'بستن پنل' }}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        class="btn btn-sm btn-light-info"
                                                        data-bs-toggle="modal"
                                                        data-bs-target="#sandboxModesModal"
                                                        data-sandbox-url="{{ route('admin.tenants.sandbox-modes.update', $tenant) }}"
                                                        data-tenant-name="{{ $tenant->name }}"
                                                        data-payment-sandbox-enabled="{{ $tenant->paymentSandboxOverride() ? '1' : '0' }}"
                                                        data-sms-sandbox-enabled="{{ $tenant->smsSandboxOverride() ? '1' : '0' }}"
                                                        data-fixed-login-code-enabled="{{ $tenant->demoFixedLoginCode() ? '1' : '0' }}"
                                                        data-fixed-login-code="{{ $tenant->demoFixedLoginCode() ?? '' }}"
                                                        data-sandbox-note="{{ $tenant->sandboxOverrideNote() ? e($tenant->sandboxOverrideNote()) : '' }}"
                                                    >
                                                        سندباکس دمو
                                                    </button>
                                                    <a href="{{ route('admin.tenants.delete', $tenant) }}" class="btn btn-sm btn-light-danger">حذف</a>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="10" class="text-center py-4 text-muted">هنوز سامانه‌ای ثبت نشده است.</td>
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
        </div>
    </div>

    <div class="modal fade" id="renewTenantModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <form method="POST" id="renewTenantForm">
                    @csrf
                    <div class="modal-header">
                        <h5 class="modal-title">تمدید سامانه نوبت‌دهی</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted mb-3">
                            بسته زمانی موردنظر برای تمدید <strong id="renewTenantName">سامانه</strong> را انتخاب کنید.
                        </p>
                        <div>
                            <label class="form-label" for="renewSubscriptionPackageId">بسته زمانی</label>
                            <select class="form-select" id="renewSubscriptionPackageId" name="subscription_package_id" required>
                                <option value="">انتخاب کنید</option>
                                @foreach ($packages as $package)
                                    <option value="{{ $package->id }}">{{ $package->name }} - {{ number_format($package->duration_days) }} روز - {{ $package->user_limit === null ? 'نامحدود' : number_format($package->user_limit) . ' کاربر' }}</option>
                                @endforeach
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-light-secondary" data-bs-dismiss="modal">انصراف</button>
                        <button type="submit" class="btn btn-warning">ثبت تمدید</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <div class="modal fade" id="panelAccessModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <form method="POST" id="panelAccessForm">
                    @csrf
                    <div class="modal-header">
                        <h5 class="modal-title">مدیریت دسترسی پنل</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted mb-3">
                            برای <strong id="panelAccessTenantName">سامانه</strong> مشخص کنید پنل باز باشد یا بسته.
                        </p>
                        <div class="mb-3">
                            <label class="form-label" for="panelAccessLocked">وضعیت دسترسی</label>
                            <select class="form-select" id="panelAccessLocked" name="panel_access_locked" required>
                                <option value="0">پنل باز باشد</option>
                                <option value="1">پنل بسته شود</option>
                            </select>
                        </div>
                        <div class="mb-3" id="panelAccessMessageGroup">
                            <label class="form-label" for="panelAccessMessage">پیام نمایش‌داده‌شده به کاربر</label>
                            <textarea class="form-control" id="panelAccessMessage" name="panel_access_message" rows="4" placeholder="مثلا: دسترسی به پنل بسته شده است. لطفا با پشتیبانی تماس بگیرید."></textarea>
                            <div class="form-text">این پیام روی صفحه ورود کاربر نمایش داده می‌شود و در پاسخ API هم برمی‌گردد.</div>
                        </div>
                        <div>
                            <label class="form-label" for="panelAccessReason">دلیل ثبت در مدیریت</label>
                            <textarea class="form-control" id="panelAccessReason" name="reason" rows="3" required placeholder="دلیل بستن یا باز کردن پنل را ثبت کنید."></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-light-secondary" data-bs-dismiss="modal">انصراف</button>
                        <button type="submit" class="btn btn-primary">ثبت تغییر</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <div class="modal fade" id="sandboxModesModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <form method="POST" id="sandboxModesForm">
                    @csrf
                    <div class="modal-header">
                        <h5 class="modal-title">سندباکس دمو</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted mb-3">
                            برای <strong id="sandboxTenantName">سامانه</strong> مشخص کنید کدام بخش‌ها در حالت سندباکس اجرا شوند.
                        </p>
                        <div class="form-check form-switch mb-3">
                            <input class="form-check-input" type="checkbox" role="switch" id="paymentSandboxEnabled" name="payment_sandbox_enabled" value="1">
                            <label class="form-check-label" for="paymentSandboxEnabled">پرداخت این سامانه سندباکس باشد</label>
                            <div class="form-text">پرداخت‌های آنلاین این سامانه بدون رفتن به بانک، موفق ثبت می‌شوند.</div>
                        </div>
                        <div class="form-check form-switch mb-3">
                            <input class="form-check-input" type="checkbox" role="switch" id="smsSandboxEnabled" name="sms_sandbox_enabled" value="1">
                            <label class="form-check-label" for="smsSandboxEnabled">پیامک این سامانه سندباکس باشد</label>
                            <div class="form-text">پیامک‌ها در سیستم ثبت می‌شوند ولی به پنل واقعی پیامک ارسال نمی‌شوند.</div>
                        </div>
                        <div class="form-check form-switch mb-3">
                            <input class="form-check-input" type="checkbox" role="switch" id="fixedLoginCodeEnabled" name="fixed_login_code_enabled" value="1">
                            <label class="form-check-label" for="fixedLoginCodeEnabled">ورود دمو با کد ثابت فعال باشد</label>
                            <div class="form-text">وقتی فعال باشد، در همین سامانه هر شماره موبایلی با کد ۴ رقمی ثابت وارد می‌شود و پیامک واقعی لازم نیست.</div>
                        </div>
                        <div class="mb-3" id="fixedLoginCodeGroup">
                            <label class="form-label" for="fixedLoginCode">کد ورود ثابت دمو</label>
                            <input class="form-control" id="fixedLoginCode" name="fixed_login_code" inputmode="numeric" maxlength="4" placeholder="مثلا 2545">
                        </div>
                        <div class="mb-3">
                            <label class="form-label" for="sandboxNote">یادداشت داخلی</label>
                            <textarea class="form-control" id="sandboxNote" name="note" rows="3" placeholder="مثلا: سامانه دمو برای تست تیم فروش"></textarea>
                        </div>
                        <div>
                            <label class="form-label" for="sandboxReason">دلیل ثبت در مدیریت</label>
                            <textarea class="form-control" id="sandboxReason" name="reason" rows="3" required placeholder="دلیل این تغییر را ثبت کنید."></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-light-secondary" data-bs-dismiss="modal">انصراف</button>
                        <button type="submit" class="btn btn-info">ثبت تنظیمات</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <div class="row mt-4">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">سوابق بستن و باز کردن پنل</h5>
                    <p class="text-muted mb-0">آخرین تغییرات دسترسی پنل سامانه‌ها در این بخش ثبت می‌شود.</p>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>زمان</th>
                                    <th>سامانه</th>
                                    <th>عملیات</th>
                                    <th>انجام‌دهنده</th>
                                    <th>دلیل</th>
                                    <th>پیام کاربر</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($panelAccessHistory as $log)
                                    <tr>
                                        <td>{{ $log->occurred_at ? \App\Support\JalaliDate::formatDateTime($log->occurred_at) : '—' }}</td>
                                        <td>{{ $log->tenant?->name ?? ($log->meta_json['tenant_name'] ?? 'سامانه حذف‌شده') }}</td>
                                        <td>
                                            <span class="badge {{ $log->action_type === 'tenant_panel_locked' ? 'bg-light-danger text-danger' : 'bg-light-success text-success' }}">
                                                {{ $log->action_type === 'tenant_panel_locked' ? 'بستن پنل' : 'باز کردن پنل' }}
                                            </span>
                                        </td>
                                        <td>{{ $log->actor?->name ?? 'مدیر حذف‌شده' }}</td>
                                        <td>{{ $log->reason }}</td>
                                        <td>{{ $log->meta_json['new_panel_access_message'] ?? '—' }}</td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="6" class="text-center py-4 text-muted">هنوز سابقه‌ای برای بستن یا باز کردن پنل ثبت نشده است.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="row mt-4">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">سوابق سندباکس دمو</h5>
                    <p class="text-muted mb-0">آخرین تغییرات مربوط به سندباکس پیامک و پرداخت در این بخش ثبت می‌شود.</p>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>زمان</th>
                                    <th>سامانه</th>
                                    <th>انجام‌دهنده</th>
                                    <th>پرداخت</th>
                                    <th>پیامک</th>
                                    <th>یادداشت</th>
                                    <th>دلیل</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($sandboxHistory as $log)
                                    <tr>
                                        <td>{{ $log->occurred_at ? \App\Support\JalaliDate::formatDateTime($log->occurred_at) : '—' }}</td>
                                        <td>{{ $log->tenant?->name ?? ($log->meta_json['tenant_name'] ?? 'سامانه حذف‌شده') }}</td>
                                        <td>{{ $log->actor?->name ?? 'مدیر حذف‌شده' }}</td>
                                        <td>
                                            <span class="badge {{ ($log->meta_json['new_payment_sandbox_enabled'] ?? false) ? 'bg-light-warning text-warning' : 'bg-light-secondary text-muted' }}">
                                                {{ ($log->meta_json['new_payment_sandbox_enabled'] ?? false) ? 'سندباکس' : 'واقعی' }}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="badge {{ ($log->meta_json['new_sms_sandbox_enabled'] ?? false) ? 'bg-light-warning text-warning' : 'bg-light-secondary text-muted' }}">
                                                {{ ($log->meta_json['new_sms_sandbox_enabled'] ?? false) ? 'سندباکس' : 'واقعی' }}
                                            </span>
                                        </td>
                                        <td>{{ $log->meta_json['new_note'] ?? '—' }}</td>
                                        <td>{{ $log->reason }}</td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="7" class="text-center py-4 text-muted">هنوز سابقه‌ای برای سندباکس دمو ثبت نشده است.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            const renewModal = document.getElementById('renewTenantModal');
            const renewForm = document.getElementById('renewTenantForm');
            const renewTenantName = document.getElementById('renewTenantName');
            const panelAccessModal = document.getElementById('panelAccessModal');
            const panelAccessForm = document.getElementById('panelAccessForm');
            const panelAccessTenantName = document.getElementById('panelAccessTenantName');
            const panelAccessLocked = document.getElementById('panelAccessLocked');
            const panelAccessMessage = document.getElementById('panelAccessMessage');
            const panelAccessMessageGroup = document.getElementById('panelAccessMessageGroup');
            const panelAccessReason = document.getElementById('panelAccessReason');
            const sandboxModesModal = document.getElementById('sandboxModesModal');
            const sandboxModesForm = document.getElementById('sandboxModesForm');
            const sandboxTenantName = document.getElementById('sandboxTenantName');
            const paymentSandboxEnabled = document.getElementById('paymentSandboxEnabled');
            const smsSandboxEnabled = document.getElementById('smsSandboxEnabled');
            const fixedLoginCodeEnabled = document.getElementById('fixedLoginCodeEnabled');
            const fixedLoginCodeGroup = document.getElementById('fixedLoginCodeGroup');
            const fixedLoginCode = document.getElementById('fixedLoginCode');
            const sandboxNote = document.getElementById('sandboxNote');
            const sandboxReason = document.getElementById('sandboxReason');

            if (renewModal && renewForm && renewTenantName) {
                renewModal.addEventListener('show.bs.modal', function (event) {
                    const button = event.relatedTarget;
                    if (!button) return;

                    renewForm.setAttribute('action', button.getAttribute('data-renew-url'));
                    renewTenantName.textContent = button.getAttribute('data-tenant-name') || 'سامانه';
                });
            }

            function syncPanelAccessMessageState() {
                if (!panelAccessLocked || !panelAccessMessageGroup || !panelAccessMessage) return;

                const shouldLock = panelAccessLocked.value === '1';
                panelAccessMessageGroup.style.display = shouldLock ? '' : 'none';
                panelAccessMessage.required = shouldLock;
            }

            if (panelAccessModal && panelAccessForm && panelAccessTenantName && panelAccessLocked && panelAccessMessage && panelAccessReason) {
                panelAccessModal.addEventListener('show.bs.modal', function (event) {
                    const button = event.relatedTarget;
                    if (!button) return;

                    panelAccessForm.setAttribute('action', button.getAttribute('data-panel-access-url'));
                    panelAccessTenantName.textContent = button.getAttribute('data-tenant-name') || 'سامانه';
                    panelAccessLocked.value = button.getAttribute('data-panel-access-locked') === '1' ? '1' : '0';
                    panelAccessMessage.value = button.getAttribute('data-panel-access-message') || '';
                    panelAccessReason.value = '';
                    syncPanelAccessMessageState();
                });

                panelAccessLocked.addEventListener('change', syncPanelAccessMessageState);
                syncPanelAccessMessageState();
            }

            function syncFixedLoginCodeState() {
                if (!fixedLoginCodeEnabled || !fixedLoginCodeGroup || !fixedLoginCode) return;

                const enabled = fixedLoginCodeEnabled.checked;
                fixedLoginCodeGroup.style.display = enabled ? '' : 'none';
                fixedLoginCode.required = enabled;
            }

            if (sandboxModesModal && sandboxModesForm && sandboxTenantName && paymentSandboxEnabled && smsSandboxEnabled && sandboxNote && sandboxReason) {
                sandboxModesModal.addEventListener('show.bs.modal', function (event) {
                    const button = event.relatedTarget;
                    if (!button) return;

                    sandboxModesForm.setAttribute('action', button.getAttribute('data-sandbox-url'));
                    sandboxTenantName.textContent = button.getAttribute('data-tenant-name') || 'سامانه';
                    paymentSandboxEnabled.checked = button.getAttribute('data-payment-sandbox-enabled') === '1';
                    smsSandboxEnabled.checked = button.getAttribute('data-sms-sandbox-enabled') === '1';
                    if (fixedLoginCodeEnabled && fixedLoginCode) {
                        fixedLoginCodeEnabled.checked = button.getAttribute('data-fixed-login-code-enabled') === '1';
                        fixedLoginCode.value = button.getAttribute('data-fixed-login-code') || '';
                        syncFixedLoginCodeState();
                    }
                    sandboxNote.value = button.getAttribute('data-sandbox-note') || '';
                    sandboxReason.value = '';
                });
            }

            if (fixedLoginCodeEnabled) {
                fixedLoginCodeEnabled.addEventListener('change', syncFixedLoginCodeState);
                syncFixedLoginCodeState();
            }
        });
    </script>
@endpush
