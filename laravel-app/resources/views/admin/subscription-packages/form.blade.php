@extends('admin.layouts.app')

@section('title', $isEdit ? __('admin.subscription_packages.edit_title') : __('admin.subscription_packages.create_title'))

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">{{ $isEdit ? __('admin.subscription_packages.edit_title') : __('admin.subscription_packages.create_title') }}</h5>
                    <p class="text-muted mb-0">{{ __('admin.subscription_packages.form_description') }}</p>
                </div>
                <div class="card-body">
                    @php
                        $existingOverrides = old('audience_overrides');
                        if ($existingOverrides === null) {
                            $existingOverrides = collect($package->audiencePrices ?? [])->mapWithKeys(fn ($item) => [
                                (string) $item->audience_type_id => [
                                    'audience_type_id' => $item->audience_type_id,
                                    'price_amount' => $item->price_amount,
                                    'discounted_price_amount' => $item->discounted_price_amount,
                                    'show_on_landing_home' => $item->show_on_landing_home,
                                    'is_landing_recommended' => $item->is_landing_recommended,
                                    'landing_sort_order' => $item->landing_sort_order,
                                ],
                            ])->all();
                        } else {
                            $existingOverrides = collect($existingOverrides)->mapWithKeys(fn ($item) => [
                                (string) ($item['audience_type_id'] ?? '') => $item,
                            ])->all();
                        }
                    @endphp
                    <form method="POST" action="{{ $isEdit ? route('admin.subscription-packages.update', $package) : route('admin.subscription-packages.store') }}">
                        @csrf
                        @if ($isEdit)
                            @method('PUT')
                        @endif

                        <div class="row g-3">
                            <div class="col-md-6">
                                <label class="form-label" for="name">{{ __('admin.subscription_packages.labels.name') }}</label>
                                <input type="text" id="name" name="name" class="form-control" value="{{ old('name', $package->name) }}" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="slug">{{ __('admin.subscription_packages.labels.slug') }}</label>
                                <input type="text" id="slug" name="slug" class="form-control" dir="ltr" value="{{ old('slug', $package->slug) }}">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="duration_days">{{ __('admin.subscription_packages.labels.duration_days') }}</label>
                                <input type="number" min="1" max="3650" id="duration_days" name="duration_days" class="form-control" value="{{ old('duration_days', $package->duration_days) }}" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="user_limit">{{ __('admin.subscription_packages.labels.user_limit') }}</label>
                                <select id="user_limit" name="user_limit" class="form-select">
                                    @php
                                        $selectedUserLimit = old('user_limit', $package->user_limit);
                                    @endphp
                                    <option value="1" @selected((string) $selectedUserLimit === '1')>{{ __('admin.subscription_packages.user_count', ['count' => number_format(1)]) }}</option>
                                    <option value="2" @selected((string) $selectedUserLimit === '2')>{{ __('admin.subscription_packages.user_count', ['count' => number_format(2)]) }}</option>
                                    <option value="3" @selected((string) $selectedUserLimit === '3')>{{ __('admin.subscription_packages.user_count', ['count' => number_format(3)]) }}</option>
                                    <option value="5" @selected((string) $selectedUserLimit === '5')>{{ __('admin.subscription_packages.user_count', ['count' => number_format(5)]) }}</option>
                                    <option value="10" @selected((string) $selectedUserLimit === '10')>{{ __('admin.subscription_packages.user_count', ['count' => number_format(10)]) }}</option>
                                    <option value="" @selected($selectedUserLimit === null || $selectedUserLimit === '')>{{ __('admin.common.unlimited') }}</option>
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="price_amount">{{ __('admin.subscription_packages.labels.price_amount') }}</label>
                                <input type="number" min="0" id="price_amount" name="price_amount" class="form-control" value="{{ old('price_amount', $package->price_amount ?? 0) }}" required>
                                <small class="text-muted">{{ __('admin.subscription_packages.price_help') }}</small>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="discounted_price_amount">{{ __('admin.subscription_packages.labels.discounted_price_amount') }}</label>
                                <input type="number" min="0" id="discounted_price_amount" name="discounted_price_amount" class="form-control" value="{{ old('discounted_price_amount', $package->discounted_price_amount) }}">
                                <small class="text-muted">{{ __('admin.subscription_packages.discount_help') }}</small>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="sms_credit_gift_amount">{{ __('admin.subscription_packages.labels.sms_credit_gift_amount') }}</label>
                                <input type="number" min="0" id="sms_credit_gift_amount" name="sms_credit_gift_amount" class="form-control" value="{{ old('sms_credit_gift_amount', $package->sms_credit_gift_amount ?? 0) }}">
                                <small class="text-muted">{{ __('admin.subscription_packages.sms_gift_help') }}</small>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="sort_order">{{ __('admin.subscription_packages.labels.sort_order') }}</label>
                                <input type="number" min="0" id="sort_order" name="sort_order" class="form-control" value="{{ old('sort_order', $package->sort_order ?? 0) }}">
                            </div>
                            <div class="col-12">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" role="switch" id="is_active" name="is_active" value="1" @checked(old('is_active', $package->is_active))>
                                    <label class="form-check-label" for="is_active">{{ __('admin.subscription_packages.labels.active') }}</label>
                                </div>
                            </div>

                            <div class="col-12">
                                <hr class="my-2">
                                <div class="d-flex align-items-center justify-content-between mb-3">
                                    <div>
                                        <h6 class="mb-1">{{ __('admin.subscription_packages.audience_prices_title') }}</h6>
                                        <p class="text-muted mb-0">{{ __('admin.subscription_packages.audience_prices_help') }}</p>
                                    </div>
                                </div>
                                <div class="row g-3">
                                    @foreach ($audiences as $index => $audience)
                                        @php
                                            $override = $existingOverrides[(string) $audience->id] ?? null;
                                        @endphp
                                        <div class="col-12">
                                            <div class="border rounded-3 p-3">
                                                <input type="hidden" name="audience_overrides[{{ $index }}][audience_type_id]" value="{{ $audience->id }}">
                                                <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                                                    <div>
                                                        <div class="fw-semibold">{{ $audience->name }}</div>
                                                        <small class="text-muted">{{ $audience->business_label }} | {{ $audience->singular_label }} / {{ $audience->plural_label }}</small>
                                                    </div>
                                                </div>
                                                <div class="row g-3">
                                                    <div class="col-md-6">
                                                        <label class="form-label" for="audience_price_{{ $audience->id }}">{{ __('admin.subscription_packages.labels.audience_price_amount') }}</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            id="audience_price_{{ $audience->id }}"
                                                            name="audience_overrides[{{ $index }}][price_amount]"
                                                            class="form-control"
                                                            value="{{ old("audience_overrides.$index.price_amount", $override['price_amount'] ?? '') }}"
                                                        >
                                                    </div>
                                                    <div class="col-md-6">
                                                        <label class="form-label" for="audience_discounted_price_{{ $audience->id }}">{{ __('admin.subscription_packages.labels.audience_discounted_price_amount') }}</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            id="audience_discounted_price_{{ $audience->id }}"
                                                            name="audience_overrides[{{ $index }}][discounted_price_amount]"
                                                            class="form-control"
                                                            value="{{ old("audience_overrides.$index.discounted_price_amount", $override['discounted_price_amount'] ?? '') }}"
                                                        >
                                                    </div>
                                                    <div class="col-md-4 d-flex align-items-end"><div class="form-check form-switch mb-2"><input type="checkbox" class="form-check-input" id="landing_home_{{ $audience->id }}" name="audience_overrides[{{ $index }}][show_on_landing_home]" value="1" @checked(old("audience_overrides.$index.show_on_landing_home", $override['show_on_landing_home'] ?? false))><label class="form-check-label" for="landing_home_{{ $audience->id }}">نمایش در صفحه اصلی لندینگ</label></div></div>
                                                    <div class="col-md-4 d-flex align-items-end"><div class="form-check form-switch mb-2"><input type="checkbox" class="form-check-input" id="landing_recommended_{{ $audience->id }}" name="audience_overrides[{{ $index }}][is_landing_recommended]" value="1" @checked(old("audience_overrides.$index.is_landing_recommended", $override['is_landing_recommended'] ?? false))><label class="form-check-label" for="landing_recommended_{{ $audience->id }}">پلن پیشنهادی</label></div></div>
                                                    <div class="col-md-4"><label class="form-label" for="landing_sort_{{ $audience->id }}">ترتیب در لندینگ</label><input type="number" min="0" id="landing_sort_{{ $audience->id }}" name="audience_overrides[{{ $index }}][landing_sort_order]" class="form-control" value="{{ old("audience_overrides.$index.landing_sort_order", $override['landing_sort_order'] ?? 0) }}"></div>
                                                </div>
                                            </div>
                                        </div>
                                    @endforeach
                                </div>
                            </div>
                        </div>

                        <div class="mt-4 d-flex gap-2">
                            <button type="submit" class="btn btn-primary">{{ $isEdit ? __('admin.subscription_packages.actions.save_update') : __('admin.subscription_packages.actions.save_create') }}</button>
                            <a href="{{ route('admin.subscription-packages.index') }}" class="btn btn-light-secondary">{{ __('admin.subscription_packages.actions.back') }}</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
@endsection
