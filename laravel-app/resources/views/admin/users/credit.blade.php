@extends('admin.layouts.app')

@section('title', __('admin.user_credit.title'))

@php
    $oldTenantId = old('tenant_id', $tenantOptions[0]['id'] ?? '');
    $oldCreditType = old('credit_type', 'sms');
    $oldPaymentStatus = old('payment_status', 'paid');
@endphp

@section('content')
    <div class="row mb-4">
        <div class="col-12">
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div>
                    <h4 class="mb-1">{{ __('admin.user_credit.heading', ['name' => $user->name]) }}</h4>
                    <p class="text-muted mb-0">{{ __('admin.user_credit.description') }}</p>
                </div>
                <a href="{{ route('admin.users.index') }}" class="btn btn-light-secondary">{{ __('admin.user_credit.back_to_users') }}</a>
            </div>
        </div>
    </div>

    @if (session('success'))
        <div class="alert alert-success">{{ session('success') }}</div>
    @endif

    @if($tenantOptions === [])
        <div class="card">
            <div class="card-body py-5 text-center text-muted">
                {{ __('admin.user_credit.no_tenants') }}
            </div>
        </div>
    @else
        <form method="POST" action="{{ route('admin.users.credit.store', $user) }}" id="userCreditForm">
            @csrf

            <div class="row g-4">
                <div class="col-xl-4">
                    <div class="card h-100">
                        <div class="card-header">
                            <h5 class="mb-1">{{ __('admin.user_credit.sections.tenant') }}</h5>
                            <p class="text-muted mb-0">{{ __('admin.user_credit.tenant_help') }}</p>
                        </div>
                        <div class="card-body">
                            <label class="form-label" for="tenant_id">{{ __('admin.user_credit.tenant_label') }}</label>
                            <select class="form-select @error('tenant_id') is-invalid @enderror" id="tenant_id" name="tenant_id">
                                @foreach($tenantOptions as $tenant)
                                    <option value="{{ $tenant['id'] }}" @selected($oldTenantId === $tenant['id'])>
                                        {{ $tenant['name'] }}{{ $tenant['domain'] !== '' ? ' - '.$tenant['domain'] : '' }}
                                    </option>
                                @endforeach
                            </select>
                            @error('tenant_id')
                                <div class="invalid-feedback d-block">{{ $message }}</div>
                            @enderror

                            <div class="rounded-3 border bg-light p-3 mt-4">
                                <div class="fw-semibold mb-3">{{ __('admin.user_credit.tenant_summary_title') }}</div>
                                <div class="small text-muted mb-2">{{ __('admin.user_credit.tenant_audience') }}</div>
                                <div class="mb-3" id="tenantAudience">—</div>
                                <div class="small text-muted mb-2">{{ __('admin.user_credit.current_package') }}</div>
                                <div class="mb-3" id="tenantCurrentPackage">—</div>
                                <div class="small text-muted mb-2">{{ __('admin.user_credit.support_ends_at') }}</div>
                                <div class="mb-3" id="tenantSupportEndsAt">—</div>
                                <div class="small text-muted mb-2">{{ __('admin.user_credit.current_professionals') }}</div>
                                <div class="mb-3" id="tenantProfessionals">—</div>
                                <div class="small text-muted mb-2">{{ __('admin.user_credit.current_sms_balance') }}</div>
                                <div id="tenantSmsBalance">—</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-xl-8">
                    <div class="card mb-4">
                        <div class="card-header">
                            <h5 class="mb-1">{{ __('admin.user_credit.sections.operation') }}</h5>
                            <p class="text-muted mb-0">{{ __('admin.user_credit.operation_help') }}</p>
                        </div>
                        <div class="card-body">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="border rounded-3 p-3 w-100 h-100 cursor-pointer">
                                        <div class="form-check">
                                            <input class="form-check-input credit-type-radio" type="radio" name="credit_type" value="sms" @checked($oldCreditType === 'sms')>
                                            <span class="form-check-label fw-semibold">{{ __('admin.user_credit.credit_types.sms') }}</span>
                                        </div>
                                        <div class="text-muted small mt-2">{{ __('admin.user_credit.credit_types.sms_help') }}</div>
                                    </label>
                                </div>
                                <div class="col-md-6">
                                    <label class="border rounded-3 p-3 w-100 h-100 cursor-pointer">
                                        <div class="form-check">
                                            <input class="form-check-input credit-type-radio" type="radio" name="credit_type" value="package" @checked($oldCreditType === 'package')>
                                            <span class="form-check-label fw-semibold">{{ __('admin.user_credit.credit_types.package') }}</span>
                                        </div>
                                        <div class="text-muted small mt-2">{{ __('admin.user_credit.credit_types.package_help') }}</div>
                                    </label>
                                </div>
                            </div>
                            @error('credit_type')
                                <div class="text-danger small mt-2">{{ $message }}</div>
                            @enderror
                        </div>
                    </div>

                    <div class="card mb-4" id="smsSection">
                        <div class="card-header">
                            <h5 class="mb-1">{{ __('admin.user_credit.sections.sms') }}</h5>
                            <p class="text-muted mb-0">{{ __('admin.user_credit.sms_help') }}</p>
                        </div>
                        <div class="card-body">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="form-label" for="sms_amount">{{ __('admin.user_credit.sms_amount') }}</label>
                                    <input type="number" min="1" class="form-control @error('sms_amount') is-invalid @enderror" id="sms_amount" name="sms_amount" value="{{ old('sms_amount') }}" placeholder="{{ __('admin.user_credit.sms_amount_placeholder') }}">
                                    @error('sms_amount')
                                        <div class="invalid-feedback">{{ $message }}</div>
                                    @enderror
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-4 d-none" id="packageSection">
                        <div class="card-header">
                            <h5 class="mb-1">{{ __('admin.user_credit.sections.package') }}</h5>
                            <p class="text-muted mb-0">{{ __('admin.user_credit.package_help') }}</p>
                        </div>
                        <div class="card-body">
                            <div class="alert alert-light border mb-4">
                                <div class="fw-semibold mb-2">{{ __('admin.user_credit.current_package_for_tenant') }}</div>
                                <div id="packageCurrentSummary">—</div>
                            </div>

                            <div class="mb-4">
                                <label class="form-label d-block">{{ __('admin.user_credit.user_limit_step') }}</label>
                                <div class="row g-3" id="packageUserLimitOptions"></div>
                            </div>

                            <div class="mb-2">
                                <label class="form-label d-block">{{ __('admin.user_credit.duration_step') }}</label>
                                <div class="row g-3" id="packageDurationOptions"></div>
                            </div>

                            <input type="hidden" name="subscription_package_id" id="subscription_package_id" value="{{ old('subscription_package_id') }}">
                            @error('subscription_package_id')
                                <div class="text-danger small mt-2">{{ $message }}</div>
                            @enderror

                            <div class="alert alert-primary d-none mt-4 mb-0" id="packageSelectionSummary"></div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-1">{{ __('admin.user_credit.sections.payment') }}</h5>
                            <p class="text-muted mb-0">{{ __('admin.user_credit.payment_help') }}</p>
                        </div>
                        <div class="card-body">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="border rounded-3 p-3 w-100 h-100 cursor-pointer">
                                        <div class="form-check">
                                            <input class="form-check-input payment-status-radio" type="radio" name="payment_status" value="paid" @checked($oldPaymentStatus === 'paid')>
                                            <span class="form-check-label fw-semibold">{{ __('admin.user_credit.payment_status.paid') }}</span>
                                        </div>
                                        <div class="text-muted small mt-2">{{ __('admin.user_credit.payment_status.paid_help') }}</div>
                                    </label>
                                </div>
                                <div class="col-md-6">
                                    <label class="border rounded-3 p-3 w-100 h-100 cursor-pointer">
                                        <div class="form-check">
                                            <input class="form-check-input payment-status-radio" type="radio" name="payment_status" value="free" @checked($oldPaymentStatus === 'free')>
                                            <span class="form-check-label fw-semibold">{{ __('admin.user_credit.payment_status.free') }}</span>
                                        </div>
                                        <div class="text-muted small mt-2">{{ __('admin.user_credit.payment_status.free_help') }}</div>
                                    </label>
                                </div>
                            </div>
                            @error('payment_status')
                                <div class="text-danger small mt-2">{{ $message }}</div>
                            @enderror

                            <div class="row g-3 mt-1" id="paymentMethodSection">
                                <div class="col-md-6">
                                    <label class="form-label d-block">{{ __('admin.user_credit.payment_method') }}</label>
                                    <div class="border rounded-3 p-3">
                                        <div class="form-check mb-2">
                                            <input class="form-check-input" type="radio" name="payment_method" id="payment_method_card" value="card_to_card" @checked(old('payment_method') === 'card_to_card')>
                                            <label class="form-check-label" for="payment_method_card">{{ __('admin.user_credit.payment_methods.card_to_card') }}</label>
                                        </div>
                                        <div class="form-check">
                                            <input class="form-check-input" type="radio" name="payment_method" id="payment_method_online" value="online" @checked(old('payment_method', 'online') === 'online')>
                                            <label class="form-check-label" for="payment_method_online">{{ __('admin.user_credit.payment_methods.online') }}</label>
                                        </div>
                                        @error('payment_method')
                                            <div class="text-danger small mt-2">{{ $message }}</div>
                                        @enderror
                                    </div>
                                </div>

                                <div class="col-md-6 d-none" id="salesCommissionSection">
                                    <label class="form-label d-block">{{ __('admin.user_credit.sales_commission') }}</label>
                                    <div class="border rounded-3 p-3 h-100">
                                        <div class="form-check form-switch">
                                            <input class="form-check-input" type="checkbox" role="switch" id="apply_sales_commission" name="apply_sales_commission" value="1" @checked(old('apply_sales_commission'))>
                                            <label class="form-check-label fw-semibold" for="apply_sales_commission">{{ __('admin.user_credit.apply_sales_commission') }}</label>
                                        </div>
                                        <div class="text-muted small mt-2">{{ __('admin.user_credit.apply_sales_commission_help') }}</div>
                                    </div>
                                </div>
                            </div>

                            <div class="mt-4">
                                <label class="form-label" for="note">{{ __('admin.user_credit.note') }}</label>
                                <textarea class="form-control @error('note') is-invalid @enderror" id="note" name="note" rows="3" placeholder="{{ __('admin.user_credit.note_placeholder') }}">{{ old('note') }}</textarea>
                                @error('note')
                                    <div class="invalid-feedback">{{ $message }}</div>
                                @enderror
                            </div>

                            <div class="mt-4 d-flex flex-wrap gap-2">
                                <button type="submit" class="btn btn-primary">{{ __('admin.user_credit.submit') }}</button>
                                <a href="{{ route('admin.users.index') }}" class="btn btn-light-secondary">{{ __('admin.user_credit.cancel') }}</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    @endif
@endsection

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            const tenantData = @json($tenantOptions, JSON_UNESCAPED_UNICODE);
            const tenantSelect = document.getElementById('tenant_id');
            const smsSection = document.getElementById('smsSection');
            const packageSection = document.getElementById('packageSection');
            const paymentMethodSection = document.getElementById('paymentMethodSection');
            const salesCommissionSection = document.getElementById('salesCommissionSection');
            const subscriptionPackageInput = document.getElementById('subscription_package_id');
            const packageUserLimitOptions = document.getElementById('packageUserLimitOptions');
            const packageDurationOptions = document.getElementById('packageDurationOptions');
            const packageSelectionSummary = document.getElementById('packageSelectionSummary');
            const packageCurrentSummary = document.getElementById('packageCurrentSummary');
            const tenantAudience = document.getElementById('tenantAudience');
            const tenantCurrentPackage = document.getElementById('tenantCurrentPackage');
            const tenantSupportEndsAt = document.getElementById('tenantSupportEndsAt');
            const tenantProfessionals = document.getElementById('tenantProfessionals');
            const tenantSmsBalance = document.getElementById('tenantSmsBalance');
            const oldPackageId = subscriptionPackageInput ? subscriptionPackageInput.value : '';
            const pageNumberFormatter = new Intl.NumberFormat(document.documentElement.lang || undefined);
            const iranTomanTemplate = @js(__('admin.money.iran_toman', ['amount' => '__AMOUNT__']));
            const professionalCountTemplate = @js(__('admin.user_credit.professional_count', ['count' => '__COUNT__', 'label' => '__LABEL__']));
            const includedModulesNoteTemplate = @js(__('admin.user_credit.included_modules_note', ['count' => '__COUNT__']));
            const includedModulesSummaryTemplate = @js(__('admin.user_credit.included_modules_summary', ['count' => '__COUNT__']));
            const currentPackageSummaryTemplate = @js(__('admin.user_credit.current_package_summary', ['package' => '__PACKAGE__', 'limit' => '__LIMIT__', 'date' => '__DATE__']));
            const userLimitInstruction = @js(__('admin.user_credit.user_limit_instruction'));
            const noPackageForCapacityHtml = @js('<div class="col-12"><div class="alert alert-light border mb-0">' . __('admin.user_credit.no_package_for_capacity') . '</div></div>');
            const upgradeBadgeHtml = @js('<span class="badge bg-light-warning text-warning ms-2">' . __('admin.user_credit.upgrade_difference') . '</span>');
            const incompatiblePackageFallback = @js(__('admin.user_credit.incompatible_package'));
            const selectedPackageSummaryTemplate = @js(__('admin.user_credit.selected_package_summary', ['package' => '__PACKAGE__', 'capacity' => '__CAPACITY__', 'duration' => '__DURATION__', 'amount' => '__AMOUNT__']));
            const upgradeSummary = @js(__('admin.user_credit.upgrade_summary'));
            let selectedUserLimit = null;

            function selectedTenant() {
                return tenantData.find((item) => String(item.id) === String(tenantSelect.value)) || tenantData[0] || null;
            }

            function selectedCreditType() {
                const checked = document.querySelector('input[name="credit_type"]:checked');
                return checked ? checked.value : 'sms';
            }

            function selectedPaymentStatus() {
                const checked = document.querySelector('input[name="payment_status"]:checked');
                return checked ? checked.value : 'paid';
            }

            function formatNumber(amount) {
                return pageNumberFormatter.format(Number(amount || 0));
            }

            function formatMoney(amount) {
                return iranTomanTemplate.replace('__AMOUNT__', formatNumber(amount));
            }

            function updateTenantSummary() {
                const tenant = selectedTenant();
                if (!tenant) return;

                tenantAudience.textContent = tenant.audienceName || '—';
                tenantCurrentPackage.textContent = `${tenant.currentPackageName} - ${tenant.currentPackageUserLimitLabel}`;
                tenantSupportEndsAt.textContent = tenant.currentSupportEndsAt || '—';
                tenantProfessionals.textContent = professionalCountTemplate
                    .replace('__COUNT__', formatNumber(tenant.currentProfessionalCount))
                    .replace('__LABEL__', tenant.pluralLabel || '');
                tenantSmsBalance.textContent = formatMoney(tenant.currentSmsBalance);
                packageCurrentSummary.textContent = currentPackageSummaryTemplate
                    .replace('__PACKAGE__', tenant.currentPackageName || '')
                    .replace('__LIMIT__', tenant.currentPackageUserLimitLabel || '')
                    .replace('__DATE__', tenant.currentSupportEndsAt || '');
            }

            function userLimitKey(value) {
                return value === null ? 'unlimited' : String(value);
            }

            function renderPackageUserLimits() {
                const tenant = selectedTenant();
                if (!tenant || !packageUserLimitOptions) return;

                const groups = [];
                const seen = new Set();

                (tenant.packages || []).forEach((item) => {
                    const key = userLimitKey(item.userLimit);
                    if (seen.has(key)) return;
                    seen.add(key);
                    groups.push({
                        key,
                        userLimit: item.userLimit,
                        label: item.summary,
                        blocked: !!item.blockedBecauseCurrentCount,
                        message: item.message || '',
                    });
                });

                if (!selectedUserLimit || !groups.find((item) => item.key === selectedUserLimit)) {
                    const currentPackage = (tenant.packages || []).find((item) => Number(item.id) === Number(tenant.currentPackageId));
                    selectedUserLimit = currentPackage ? userLimitKey(currentPackage.userLimit) : (groups[0]?.key || null);
                }

                packageUserLimitOptions.innerHTML = groups.map((item) => `
                    <div class="col-md-6">
                        <button type="button" class="btn w-100 text-start border rounded-3 p-3 package-user-limit-btn ${selectedUserLimit === item.key ? 'btn-primary' : 'btn-light'}" data-key="${item.key}">
                            <div class="fw-semibold mb-1">${item.label}</div>
                            <div class="small ${item.blocked ? 'text-danger' : 'text-muted'}">${item.blocked ? item.message : userLimitInstruction}</div>
                        </button>
                    </div>
                `).join('');

                packageUserLimitOptions.querySelectorAll('.package-user-limit-btn').forEach((button) => {
                    button.addEventListener('click', function () {
                        selectedUserLimit = this.getAttribute('data-key');
                        subscriptionPackageInput.value = '';
                        renderPackageUserLimits();
                        renderPackageDurations();
                    });
                });
            }

            function renderPackageDurations() {
                const tenant = selectedTenant();
                if (!tenant || !packageDurationOptions) return;

                const packages = (tenant.packages || []).filter((item) => userLimitKey(item.userLimit) === selectedUserLimit);
                const selectedPackage = packages.find((item) => String(item.id) === String(subscriptionPackageInput.value))
                    || packages.find((item) => String(item.id) === String(oldPackageId))
                    || null;

                if (selectedPackage && (!subscriptionPackageInput.value || subscriptionPackageInput.value === oldPackageId)) {
                    subscriptionPackageInput.value = String(selectedPackage.id);
                }

                packageDurationOptions.innerHTML = packages.length === 0
                    ? noPackageForCapacityHtml
                    : packages.map((item) => {
                        const active = String(subscriptionPackageInput.value) === String(item.id);
                        const buttonClass = active ? 'btn-primary' : (item.available ? 'btn-light' : 'btn-outline-danger');
                        const modulesNote = Number(item.includedModulesCount || 0) > 0
                            ? `<div class="small text-muted mt-2">${includedModulesNoteTemplate.replace('__COUNT__', formatNumber(item.includedModulesCount))}</div>`
                            : '';
                        const upgradeNote = item.isUpgrade ? upgradeBadgeHtml : '';

                        return `
                            <div class="col-md-6">
                                <button type="button" class="btn w-100 text-start border rounded-3 p-3 package-duration-btn ${buttonClass}" data-package-id="${item.id}" ${item.available ? '' : 'disabled'}>
                                    <div class="d-flex align-items-center justify-content-between gap-2">
                                        <div class="fw-semibold">${item.durationLabel}</div>
                                        <div>${upgradeNote}</div>
                                    </div>
                                    <div class="small text-muted mt-2">${formatMoney(item.payableAmount)}</div>
                                    ${modulesNote}
                                    ${item.available ? '' : `<div class="small text-danger mt-2">${item.message || incompatiblePackageFallback}</div>`}
                                </button>
                            </div>
                        `;
                    }).join('');

                packageDurationOptions.querySelectorAll('.package-duration-btn').forEach((button) => {
                    button.addEventListener('click', function () {
                        subscriptionPackageInput.value = this.getAttribute('data-package-id');
                        renderPackageDurations();
                        renderPackageSummary();
                    });
                });

                renderPackageSummary();
            }

            function renderPackageSummary() {
                const tenant = selectedTenant();
                if (!tenant || !packageSelectionSummary) return;

                const selectedPackage = (tenant.packages || []).find((item) => String(item.id) === String(subscriptionPackageInput.value));
                if (!selectedPackage) {
                    packageSelectionSummary.classList.add('d-none');
                    packageSelectionSummary.textContent = '';
                    return;
                }

                const pieces = selectedPackageSummaryTemplate
                    .replace('__PACKAGE__', selectedPackage.name)
                    .replace('__CAPACITY__', selectedPackage.summary)
                    .replace('__DURATION__', selectedPackage.durationLabel)
                    .replace('__AMOUNT__', formatMoney(selectedPackage.payableAmount))
                    .split(' | ');

                if (selectedPackage.isUpgrade) {
                    pieces.push(upgradeSummary);
                }

                if (Number(selectedPackage.includedModulesCount || 0) > 0) {
                    pieces.push(includedModulesSummaryTemplate.replace('__COUNT__', formatNumber(selectedPackage.includedModulesCount)));
                }

                packageSelectionSummary.classList.remove('d-none');
                packageSelectionSummary.textContent = pieces.join(' | ');
            }

            function updateVisibility() {
                const type = selectedCreditType();
                const paid = selectedPaymentStatus() === 'paid';

                smsSection.classList.toggle('d-none', type !== 'sms');
                packageSection.classList.toggle('d-none', type !== 'package');
                paymentMethodSection.classList.toggle('d-none', !paid);
                salesCommissionSection.classList.toggle('d-none', !(paid && type === 'package'));

                if (!paid) {
                    document.querySelectorAll('input[name="payment_method"]').forEach((input) => input.checked = false);
                    const commissionToggle = document.getElementById('apply_sales_commission');
                    if (commissionToggle) {
                        commissionToggle.checked = false;
                    }
                } else if (!document.querySelector('input[name="payment_method"]:checked')) {
                    const defaultPaymentMethod = document.getElementById('payment_method_online');
                    if (defaultPaymentMethod) {
                        defaultPaymentMethod.checked = true;
                    }
                }
            }

            tenantSelect.addEventListener('change', function () {
                selectedUserLimit = null;
                subscriptionPackageInput.value = '';
                updateTenantSummary();
                renderPackageUserLimits();
                renderPackageDurations();
            });

            document.querySelectorAll('.credit-type-radio, .payment-status-radio').forEach((input) => {
                input.addEventListener('change', updateVisibility);
            });

            updateTenantSummary();
            renderPackageUserLimits();
            renderPackageDurations();
            updateVisibility();
        });
    </script>
@endpush
