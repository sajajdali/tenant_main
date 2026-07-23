@extends('admin.layouts.app')

@section('title', $isEdit ? __('admin.tenants.form.edit_title') : __('admin.tenants.form.create_title'))

@push('styles')
    @vite('resources/js/admin-ir-domain-renewals.js')
    <style>
        .managed-domain-jalali-input {
            width: 100%;
            background-color: #fff;
            cursor: pointer;
        }
    </style>
@endpush

@section('content')
    @php
        $domainManagementMode = old('domain_management_mode', $tenant->domain_management_mode ?? 'platform_managed');
        $managedDomainTld = old('managed_domain_tld', $tenant->managed_domain_tld ?? '.ir');
        $managedDomainRegistered = filter_var(old('managed_domain_registered', $tenant->managed_domain_registered ?? $tenant->ir_domain_registered ?? false), FILTER_VALIDATE_BOOLEAN);
        $managedDomainRenewsAt = old('managed_domain_renews_at', $tenant->managed_domain_renews_at?->toDateString() ?? $tenant->ir_domain_renews_at?->toDateString() ?? now()->addYear()->toDateString());
        $managedDomainAmount = old('managed_domain_amount', $tenant->managed_domain_amount ?? $tenant->ir_domain_amount ?? $defaultDomainRenewAmount ?? 0);
    @endphp
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">{{ $isEdit ? __('admin.tenants.form.edit_heading') : __('admin.tenants.form.create_heading') }}</h5>
                    <p class="text-muted mb-0">{{ __('admin.tenants.form.description') }}</p>
                </div>
                <div class="card-body">
                    <form method="POST" action="{{ $isEdit ? route('admin.tenants.update', $tenant) : route('admin.tenants.store') }}">
                        @csrf
                        @if ($isEdit)
                            @method('PUT')
                        @endif

                        <div class="row g-3">
                            <div class="col-md-6">
                                <label class="form-label" for="name">{{ __('admin.tenants.form.fields.name') }}</label>
                                <input type="text" class="form-control" id="name" name="name" value="{{ old('name', $tenant->name) }}" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="owner_user_id">{{ __('admin.tenants.form.fields.owner') }}</label>
                                <select class="form-select" id="owner_user_id" name="owner_user_id" required>
                                    <option value="">{{ __('admin.common.select') }}</option>
                                    @foreach ($owners as $owner)
                                        <option value="{{ $owner->id }}" @selected((string) old('owner_user_id', $tenant->owner_user_id) === (string) $owner->id)>
                                            {{ $owner->name }} - {{ $owner->mobile }}
                                        </option>
                                    @endforeach
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="audience_type_id">{{ __('admin.tenants.form.fields.audience') }}</label>
                                <select class="form-select" id="audience_type_id" name="audience_type_id" required>
                                    <option value="">{{ __('admin.common.select') }}</option>
                                    @foreach ($audiences as $audience)
                                        <option
                                            value="{{ $audience->id }}"
                                            data-slug="{{ $audience->slug }}"
                                            data-setup-fee-amount="{{ (int) ($audience->checkoutSetting?->setup_fee_amount ?? 0) }}"
                                            data-setup-fee-label="{{ $audience->checkoutSetting?->setup_fee_label ?? __('admin.tenants.form.default_setup_fee_label') }}"
                                            @selected((string) old('audience_type_id', $tenant->audience_type_id) === (string) $audience->id)
                                        >
                                            {{ $audience->name }} | {{ $audience->singular_label }} / {{ $audience->plural_label }}
                                        </option>
                                    @endforeach
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="subscription_package_id">{{ __('admin.tenants.form.fields.package') }}</label>
                                <select class="form-select" id="subscription_package_id" name="subscription_package_id" required>
                                    <option value="">{{ __('admin.common.select') }}</option>
                                    @foreach ($packages as $package)
                                        <option value="{{ $package->id }}" @selected((string) old('subscription_package_id', $tenant->subscription_package_id) === (string) $package->id)>
                                            {{ __('admin.tenants.form.package_option', [
                                                'name' => $package->name,
                                                'days' => number_format($package->duration_days),
                                                'limit' => $package->user_limit === null
                                                    ? __('admin.common.unlimited')
                                                    : __('admin.subscription_packages.user_count', ['count' => number_format($package->user_limit)]),
                                            ]) }}
                                        </option>
                                    @endforeach
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="slug">{{ __('admin.tenants.form.fields.slug') }}</label>
                                <input type="text" class="form-control" id="slug" name="slug" value="{{ old('slug', $tenant->slug) }}" dir="ltr" placeholder="barber-sample">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="database">{{ __('admin.tenants.form.fields.database') }}</label>
                                <input type="text" class="form-control" id="database" name="database" value="{{ old('database', $databaseName) }}" dir="ltr" placeholder="tenant_barber_sample">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="domain">{{ __('admin.tenants.form.fields.domain') }}</label>
                                <input type="text" class="form-control" id="domain" name="domain" value="{{ old('domain', $primaryDomain?->domain) }}" dir="ltr" placeholder="barber-sample.test" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="status">{{ __('admin.tenants.form.fields.status') }}</label>
                                <select class="form-select" id="status" name="status" required>
                                    <option value="active" @selected(old('status', $tenant->status) === 'active')>{{ __('admin.tenants.form.status.active') }}</option>
                                    <option value="inactive" @selected(old('status', $tenant->status) === 'inactive')>{{ __('admin.tenants.form.status.inactive') }}</option>
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="storage_quota_gb">{{ __('admin.tenants.form.fields.storage_quota') }}</label>
                                <select class="form-select" id="storage_quota_gb" name="storage_quota_gb" required>
                                    @foreach ($storageQuotaOptions as $quotaGb)
                                        <option value="{{ $quotaGb }}" @selected((int) old('storage_quota_gb', $selectedStorageQuotaGb) === (int) $quotaGb)>
                                            {{ __('admin.tenants.form.gigabytes', ['count' => number_format($quotaGb)]) }}
                                        </option>
                                    @endforeach
                                </select>
                                <small class="text-muted d-block mt-2">
                                    {{ __('admin.tenants.form.storage_quota_help', ['count' => number_format($defaultStorageQuotaGb)]) }}
                                </small>
                            </div>
                            @if (auth()->user()?->role === 'admin')
                            <div class="col-12">
                                <div class="border rounded-3 p-3">
                                    <div class="form-check form-switch m-0">
                                        <input type="hidden" name="maliart_payment_enabled" value="0">
                                        <input
                                            class="form-check-input"
                                            type="checkbox"
                                            role="switch"
                                            id="maliart_payment_enabled"
                                            name="maliart_payment_enabled"
                                            value="1"
                                            @checked((bool) old('maliart_payment_enabled', $tenant->usesCentralMaliartGateway()))
                                        >
                                        <label class="form-check-label fw-semibold" for="maliart_payment_enabled">درگاه مستقیم برای تمام پرداخت‌های مشتریان این سامانه</label>
                                    </div>
                                    <div class="form-text mt-2">
                                        با فعال‌سازی، تنظیمات درگاه خود سامانه نادیده گرفته می‌شود و پرداخت نوبت، رژیم و فروشگاه فقط از درگاه مستقیم مرکزی انجام خواهد شد.
                                    </div>
                                </div>
                            </div>
                            @endif
                            <div class="col-md-6">
                                <label class="form-label" for="setup_fee_preview_amount">{{ __('admin.tenants.form.fields.setup_fee_amount') }}</label>
                                <input type="text" class="form-control" id="setup_fee_preview_amount" value="{{ __('admin.money.iran_toman', ['amount' => number_format(0)]) }}" readonly>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="setup_fee_preview_label">{{ __('admin.tenants.form.fields.setup_fee_label') }}</label>
                                <input type="text" class="form-control" id="setup_fee_preview_label" value="{{ __('admin.tenants.form.default_setup_fee_label') }}" readonly>
                            </div>
                            @if (! $isEdit)
                                <div class="col-md-6" id="nutrition_initial_tokens_wrap" style="display: none;">
                                    <label class="form-label" for="nutrition_initial_tokens">{{ __('admin.tenants.form.fields.nutrition_initial_tokens') }}</label>
                                    <div class="input-group">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100000000"
                                            class="form-control"
                                            id="nutrition_initial_tokens"
                                            name="nutrition_initial_tokens"
                                            value="{{ old('nutrition_initial_tokens', $nutritionInitialTokenDefault ?? 2500) }}"
                                            dir="ltr"
                                        >
                                        <span class="input-group-text">{{ __('admin.tenants.form.token_unit') }}</span>
                                    </div>
                                    <small class="text-muted d-block mt-2">{{ __('admin.tenants.form.nutrition_initial_tokens_help') }}</small>
                                </div>
                                <div class="col-12">
                                    <div class="card border border-primary-subtle shadow-none mb-0">
                                        <div class="card-body">
                                            <h6 class="mb-1">{{ __('admin.tenants.form.feature_modules_title') }}</h6>
                                            <p class="text-muted mb-3">{{ __('admin.tenants.form.feature_modules_help') }}</p>
                                            @if ($featureModules->isEmpty())
                                                <div class="text-muted">{{ __('admin.tenants.form.feature_modules_empty') }}</div>
                                            @else
                                                <div class="row g-3">
                                                    @foreach ($featureModules as $featureModule)
                                                        @php
                                                            $moduleId = (string) $featureModule->id;
                                                        @endphp
                                                        <div class="col-md-6 col-xl-4">
                                                            <div class="border rounded-3 p-3 h-100">
                                                                <div class="form-check m-0">
                                                                    <input
                                                                        class="form-check-input"
                                                                        type="checkbox"
                                                                        name="feature_module_ids[]"
                                                                        id="feature_module_{{ $featureModule->id }}"
                                                                        value="{{ $featureModule->id }}"
                                                                        @checked(in_array($moduleId, $selectedFeatureModuleIds ?? [], true))
                                                                    >
                                                                    <label class="form-check-label fw-semibold" for="feature_module_{{ $featureModule->id }}">
                                                                        {{ $featureModule->name }}
                                                                    </label>
                                                                </div>
                                                                @if ($featureModule->description)
                                                                    <div class="small text-muted mt-2">{{ $featureModule->description }}</div>
                                                                @endif
                                                                <div class="small text-muted mt-2" dir="ltr">{{ $featureModule->slug }}</div>
                                                            </div>
                                                        </div>
                                                    @endforeach
                                                </div>
                                            @endif
                                        </div>
                                    </div>
                                </div>
                            @endif
                            <div class="col-12">
                                <div class="alert alert-light-info mb-0">
                                    {{ __('admin.tenants.form.support_recalculation_notice') }}
                                    @if ($isEdit && $tenant->support_ends_at)
                                        <div class="mt-2">
                                            {{ __('admin.tenants.form.current_support_ends_at') }} <strong>{{ \App\Support\JalaliDate::format($tenant->support_ends_at) }}</strong>
                                        </div>
                                    @endif
                                </div>
                            </div>
                            <div class="col-12">
                                <div class="card border border-warning-subtle shadow-none mb-0">
                                    <div class="card-body">
                                        <div class="d-flex align-items-start justify-content-between gap-3 flex-wrap">
                                            <div>
                                                <h6 class="mb-1">{{ __('admin.tenants.form.domain_management_title') }}</h6>
                                                <p class="text-muted mb-0">
                                                    {{ __('admin.tenants.form.domain_management_help') }}
                                                </p>
                                            </div>
                                        </div>

                                        <div class="row g-3 mt-3">
                                            <div class="col-md-6">
                                                <label class="form-label" for="domain_management_mode">{{ __('admin.tenants.form.fields.domain_management_mode') }}</label>
                                                <select class="form-select" id="domain_management_mode" name="domain_management_mode">
                                                    <option value="platform_managed" @selected($domainManagementMode === 'platform_managed')>{{ __('admin.tenants.form.domain_modes.platform_managed') }}</option>
                                                    <option value="self_managed" @selected($domainManagementMode === 'self_managed')>{{ __('admin.tenants.form.domain_modes.self_managed') }}</option>
                                                </select>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label" for="managed_domain_tld">{{ __('admin.tenants.form.fields.managed_domain_tld') }}</label>
                                                <select class="form-select" id="managed_domain_tld" name="managed_domain_tld">
                                                    @foreach ($tldOptions as $option)
                                                        <option
                                                            value="{{ $option['tld'] }}"
                                                            data-renew-amount="{{ (int) $option['renewAmount'] }}"
                                                            data-register-amount="{{ (int) $option['registerAmount'] }}"
                                                            @selected($managedDomainTld === $option['tld'])
                                                        >
                                                            {{ $option['label'] }} ({{ $option['tld'] }})
                                                        </option>
                                                    @endforeach
                                                </select>
                                            </div>
                                        </div>

                                        <div class="row g-3 mt-1" id="managed-domain-fields">
                                            <div class="col-12">
                                                <div class="form-check form-switch m-0">
                                                    <input type="hidden" name="managed_domain_registered" value="0">
                                                    <input class="form-check-input" type="checkbox" role="switch" id="managed_domain_registered" name="managed_domain_registered" value="1" @checked((bool) $managedDomainRegistered)>
                                                    <label class="form-check-label" for="managed_domain_registered">{{ __('admin.tenants.form.managed_domain_registered') }}</label>
                                                </div>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label d-block" for="managed_domain_renews_at_display">{{ __('admin.tenants.form.fields.managed_domain_renews_at') }}</label>
                                                <input
                                                    type="text"
                                                    class="form-control managed-domain-jalali-input"
                                                    id="managed_domain_renews_at_display"
                                                    placeholder="{{ __('admin.tenants.solar_date_placeholder') }}"
                                                    autocomplete="off"
                                                    data-jdp
                                                    data-jdp-only-date
                                                >
                                                <input type="hidden" id="managed_domain_renews_at" name="managed_domain_renews_at" value="{{ $managedDomainRenewsAt }}">
                                                <small class="text-muted d-block mt-2">{{ __('admin.tenants.managed_domain_renews_at_help') }}</small>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label" for="managed_domain_amount">{{ __('admin.tenants.ir_domain_annual_renewal_amount') }}</label>
                                                <input type="number" min="0" class="form-control" id="managed_domain_amount" name="managed_domain_amount" value="{{ $managedDomainAmount }}" placeholder="{{ __('admin.tenants.managed_domain_amount_placeholder') }}" dir="ltr">
                                                <small class="text-muted d-block mt-2">{{ __('admin.tenants.managed_domain_amount_help') }}</small>
                                            </div>
                                            <div class="col-12">
                                                <div class="alert alert-light-warning mb-0">
                                                    {{ __('admin.tenants.managed_domain_mode_notice') }}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="alert alert-light-primary mt-4 mb-0">
                            {{ __('admin.tenants.form.creation_notice') }}
                        </div>

                        <div class="mt-4 d-flex gap-2">
                            <button type="submit" class="btn btn-primary">{{ $isEdit ? __('admin.tenants.form.save_changes') : __('admin.tenants.form.save_tenant') }}</button>
                            <a href="{{ route('admin.tenants.index') }}" class="btn btn-light-secondary">{{ __('admin.tenants.form.back') }}</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        @if ($isEdit)
            <div class="col-12">
                <div class="card">
                    <div class="card-header">
                        <h5 class="mb-1">{{ __('admin.tenants.form.renewal_history_title') }}</h5>
                        <p class="text-muted mb-0">{{ __('admin.tenants.form.renewal_history_description') }}</p>
                    </div>
                    <div class="card-body">
                        @if ($tenant->subscriptionRenewals->isEmpty())
                            <div class="text-muted text-center py-3">{{ __('admin.tenants.form.renewal_history_empty') }}</div>
                        @else
                            <div class="d-grid gap-3">
                                @foreach ($tenant->subscriptionRenewals as $renewal)
                                    <div class="border rounded p-3">
                                        <div class="fw-semibold">{{ $renewal->subscriptionPackage?->name ?? __('admin.tenants.form.deleted_package') }}</div>
                                        <div class="small text-muted mt-2">
                                            {{ __('admin.tenants.form.renewed_by', ['name' => $renewal->renewedBy?->name ?? __('admin.tenants.form.unknown_user')]) }}
                                        </div>
                                        <div class="small text-muted">
                                            {{ __('admin.tenants.form.created_at', ['date' => \App\Support\JalaliDate::format($renewal->created_at)]) }}
                                        </div>
                                        <div class="small text-muted">
                                            {{ __('admin.tenants.form.previous_date', ['date' => $renewal->previous_support_ends_at ? \App\Support\JalaliDate::format($renewal->previous_support_ends_at) : __('admin.common.none')]) }}
                                        </div>
                                        <div class="small text-success">
                                            {{ __('admin.tenants.form.new_date', ['date' => \App\Support\JalaliDate::format($renewal->new_support_ends_at)]) }}
                                        </div>
                                    </div>
                                @endforeach
                            </div>
                        @endif
                    </div>
                </div>
            </div>
        @endif
    </div>
@endsection

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            const audienceSelect = document.getElementById('audience_type_id');
            const amountInput = document.getElementById('setup_fee_preview_amount');
            const labelInput = document.getElementById('setup_fee_preview_label');
            const nutritionInitialTokensWrap = document.getElementById('nutrition_initial_tokens_wrap');
            const nutritionInitialTokensInput = document.getElementById('nutrition_initial_tokens');
            const nutritionInitialTokenDefault = Number(@json((int) ($nutritionInitialTokenDefault ?? 2500)));
            const domainModeSelect = document.getElementById('domain_management_mode');
            const domainTldSelect = document.getElementById('managed_domain_tld');
            const managedDomainToggle = document.getElementById('managed_domain_registered');
            const managedDomainFields = document.getElementById('managed-domain-fields');
            const managedDomainAmountInput = document.getElementById('managed_domain_amount');
            const initialManagedDomainAmount = managedDomainAmountInput?.value ?? '';
            const pageNumberFormatter = new Intl.NumberFormat(document.documentElement.lang || undefined);
            const iranTomanTemplate = @js(__('admin.money.iran_toman', ['amount' => '__AMOUNT__']));
            const defaultSetupFeeLabel = @js(__('admin.tenants.form.default_setup_fee_label'));
            let managedDomainAmountTouched = Boolean(initialManagedDomainAmount);

            if (!audienceSelect || !amountInput || !labelInput) {
                return;
            }

            const updateAudienceSetupFee = () => {
                const selectedOption = audienceSelect.options[audienceSelect.selectedIndex];
                const amount = Number(selectedOption?.dataset?.setupFeeAmount || 0);
                const label = selectedOption?.dataset?.setupFeeLabel || defaultSetupFeeLabel;
                const audienceSlug = selectedOption?.dataset?.slug || '';
                const isNutritionAudience = ['nutritionists', 'nutrition-doctors'].includes(audienceSlug);

                amountInput.value = iranTomanTemplate.replace('__AMOUNT__', pageNumberFormatter.format(amount));
                labelInput.value = label;

                if (nutritionInitialTokensWrap) {
                    nutritionInitialTokensWrap.style.display = isNutritionAudience ? '' : 'none';
                }

                if (isNutritionAudience && nutritionInitialTokensInput && nutritionInitialTokensInput.value === '') {
                    nutritionInitialTokensInput.value = String(nutritionInitialTokenDefault);
                }
            };

            audienceSelect.addEventListener('change', updateAudienceSetupFee);
            updateAudienceSetupFee();

            const selectedTldRenewAmount = () => {
                if (!domainTldSelect) {
                    return 0;
                }

                const selectedOption = domainTldSelect.options[domainTldSelect.selectedIndex];

                return Number(selectedOption?.dataset?.renewAmount || 0);
            };

            const updateManagedDomainAmount = () => {
                if (!managedDomainAmountInput) {
                    return;
                }

                if (!managedDomainAmountTouched || managedDomainAmountInput.value === '' || managedDomainAmountInput.value === initialManagedDomainAmount) {
                    managedDomainAmountInput.value = String(selectedTldRenewAmount());
                }
            };

            const updateManagedDomainFields = () => {
                if (!managedDomainFields || !managedDomainToggle || !domainModeSelect) {
                    return;
                }

                const selfManaged = domainModeSelect.value === 'self_managed';
                managedDomainFields.style.display = selfManaged ? 'none' : '';
                managedDomainToggle.disabled = selfManaged;
            };

            domainModeSelect?.addEventListener('change', updateManagedDomainFields);
            domainTldSelect?.addEventListener('change', updateManagedDomainAmount);
            updateManagedDomainFields();
            updateManagedDomainAmount();
            managedDomainAmountInput?.addEventListener('input', () => {
                managedDomainAmountTouched = true;
            });
        });
    </script>
@endpush
