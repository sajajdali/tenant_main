@extends('admin.layouts.app')

@section('title', $isEdit ? __('admin.feature_modules.edit_title') : __('admin.feature_modules.create_title'))

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">{{ $isEdit ? __('admin.feature_modules.edit_title') : __('admin.feature_modules.create_title') }}</h5>
                    <p class="text-muted mb-0">{{ __('admin.feature_modules.form_description') }}</p>
                </div>
                <div class="card-body">
                    @php
                        $existingOverrides = old('audience_overrides');
                        if ($existingOverrides === null) {
                            $existingOverrides = collect($featureModule->audiencePrices ?? [])->mapWithKeys(fn ($item) => [
                                (string) $item->audience_type_id => [
                                    'audience_type_id' => $item->audience_type_id,
                                    'monthly_price_amount' => $item->monthly_price_amount,
                                ],
                            ])->all();
                        } else {
                            $existingOverrides = collect($existingOverrides)->mapWithKeys(fn ($item) => [
                                (string) ($item['audience_type_id'] ?? '') => $item,
                            ])->all();
                        }
                    @endphp
                    <form method="POST" action="{{ $isEdit ? route('admin.feature-modules.update', $featureModule) : route('admin.feature-modules.store') }}">
                        @csrf
                        @if ($isEdit)
                            @method('PUT')
                        @endif

                        <div class="row g-3">
                            <div class="col-md-6">
                                <label class="form-label" for="name">{{ __('admin.feature_modules.labels.name') }}</label>
                                <input type="text" id="name" name="name" class="form-control" value="{{ old('name', $featureModule->name) }}" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="slug">{{ __('admin.feature_modules.labels.slug') }}</label>
                                <input type="text" id="slug" name="slug" class="form-control" dir="ltr" value="{{ old('slug', $featureModule->slug) }}">
                            </div>
                            <div class="col-12">
                                <label class="form-label" for="description">{{ __('admin.feature_modules.labels.description') }}</label>
                                <textarea id="description" name="description" rows="4" class="form-control">{{ old('description', $featureModule->description) }}</textarea>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="monthly_price_amount">{{ __('admin.feature_modules.labels.monthly_price') }}</label>
                                <input type="number" min="0" id="monthly_price_amount" name="monthly_price_amount" class="form-control" value="{{ old('monthly_price_amount', $featureModule->monthly_price_amount ?? 0) }}" required>
                                <small class="text-muted">{{ __('admin.feature_modules.monthly_price_help') }}</small>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="sort_order">{{ __('admin.feature_modules.labels.sort_order') }}</label>
                                <input type="number" min="0" id="sort_order" name="sort_order" class="form-control" value="{{ old('sort_order', $featureModule->sort_order ?? 0) }}">
                            </div>
                            <div class="col-12">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" role="switch" id="is_active" name="is_active" value="1" @checked(old('is_active', $featureModule->is_active))>
                                    <label class="form-check-label" for="is_active">{{ __('admin.feature_modules.labels.active') }}</label>
                                </div>
                            </div>

                            <div class="col-12">
                                <hr class="my-2">
                                <div class="mb-3">
                                    <h6 class="mb-1">{{ __('admin.feature_modules.audience_prices_title') }}</h6>
                                    <p class="text-muted mb-0">{{ __('admin.feature_modules.audience_prices_help') }}</p>
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
                                                <label class="form-label" for="audience_monthly_price_{{ $audience->id }}">{{ __('admin.feature_modules.labels.audience_monthly_price') }}</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    id="audience_monthly_price_{{ $audience->id }}"
                                                    name="audience_overrides[{{ $index }}][monthly_price_amount]"
                                                    class="form-control"
                                                    value="{{ old("audience_overrides.$index.monthly_price_amount", $override['monthly_price_amount'] ?? '') }}"
                                                >
                                            </div>
                                        </div>
                                    @endforeach
                                </div>
                            </div>
                        </div>

                        <div class="mt-4 d-flex gap-2">
                            <button type="submit" class="btn btn-primary">{{ $isEdit ? __('admin.feature_modules.actions.save_update') : __('admin.feature_modules.actions.save_create') }}</button>
                            <a href="{{ route('admin.feature-modules.index') }}" class="btn btn-light-secondary">{{ __('admin.feature_modules.actions.back') }}</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
@endsection
