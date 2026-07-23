@extends('admin.layouts.app')

@section('title', __('admin.discount_codes.title'))

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <div class="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                        <div>
                            <h5 class="mb-1">{{ __('admin.discount_codes.title') }}</h5>
                            <p class="text-muted mb-0">{{ __('admin.discount_codes.description') }}</p>
                        </div>
                        <a href="{{ route('admin.discount-codes.create') }}" class="btn btn-primary">{{ __('admin.discount_codes.create') }}</a>
                    </div>
                </div>
                <div class="card-body">
                    <form method="GET" action="{{ route('admin.discount-codes.index') }}" class="row g-3 mb-4">
                        <div class="col-md-4">
                            <label class="form-label" for="filter_code">{{ __('admin.discount_codes.columns.code') }}</label>
                            <input type="text" id="filter_code" name="code" class="form-control" value="{{ $filters['code'] ?? '' }}">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label" for="filter_status">{{ __('admin.discount_codes.filters.status') }}</label>
                            <select id="filter_status" name="status" class="form-select">
                                <option value="">{{ __('admin.discount_codes.filters.all') }}</option>
                                <option value="active" @selected(($filters['status'] ?? '') === 'active')>{{ __('admin.discount_codes.status.active') }}</option>
                                <option value="inactive" @selected(($filters['status'] ?? '') === 'inactive')>{{ __('admin.discount_codes.status.inactive') }}</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label" for="filter_applies_to">{{ __('admin.discount_codes.filters.applies_to') }}</label>
                            <select id="filter_applies_to" name="applies_to" class="form-select">
                                <option value="">{{ __('admin.discount_codes.filters.all') }}</option>
                                <option value="both" @selected(($filters['applies_to'] ?? '') === 'both')>{{ __('admin.discount_codes.applies_to.both') }}</option>
                                <option value="initial_purchase" @selected(($filters['applies_to'] ?? '') === 'initial_purchase')>{{ __('admin.discount_codes.applies_to.initial_purchase') }}</option>
                                <option value="renewal" @selected(($filters['applies_to'] ?? '') === 'renewal')>{{ __('admin.discount_codes.applies_to.renewal') }}</option>
                            </select>
                        </div>
                        <div class="col-md-2 d-flex align-items-end gap-2">
                            <button type="submit" class="btn btn-light-primary w-100">{{ __('admin.discount_codes.filters.submit') }}</button>
                        </div>
                    </form>

                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>{{ __('admin.discount_codes.columns.code') }}</th>
                                    <th>{{ __('admin.discount_codes.columns.title') }}</th>
                                    <th>{{ __('admin.discount_codes.columns.audience_type') }}</th>
                                    <th>{{ __('admin.discount_codes.columns.discount_type') }}</th>
                                    <th>{{ __('admin.discount_codes.columns.sales_user') }}</th>
                                    <th>{{ __('admin.discount_codes.columns.usage') }}</th>
                                    <th>{{ __('admin.discount_codes.columns.status') }}</th>
                                    <th>{{ __('admin.discount_codes.columns.actions') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($codes as $code)
                                    <tr>
                                        <td dir="ltr" class="fw-semibold">{{ $code->code }}</td>
                                        <td>
                                            <div>{{ $code->title ?: __('admin.discount_codes.empty_title') }}</div>
                                            <small class="text-muted">
                                                @switch($code->applies_to)
                                                    @case('initial_purchase')
                                                        {{ __('admin.discount_codes.applies_to.initial_purchase') }}
                                                        @break
                                                    @case('renewal')
                                                        {{ __('admin.discount_codes.applies_to.renewal') }}
                                                        @break
                                                    @default
                                                        {{ __('admin.discount_codes.applies_to.both') }}
                                                @endswitch
                                            </small>
                                        </td>
                                        <td>{{ $code->audienceType?->name ?: __('admin.discount_codes.options.all_audiences') }}</td>
                                        <td>
                                            @if ($code->discount_type === 'percent')
                                                {{ __('admin.discount_codes.percent_value', ['value' => number_format($code->discount_value)]) }}
                                                @if ($code->maximum_discount_amount)
                                                    <div><small class="text-muted">{{ __('admin.discount_codes.maximum_cap', ['amount' => __('admin.money.iran_toman', ['amount' => number_format($code->maximum_discount_amount)])]) }}</small></div>
                                                @endif
                                            @else
                                                {{ __('admin.money.iran_toman', ['amount' => number_format($code->discount_value)]) }}
                                            @endif
                                        </td>
                                        <td>
                                            @if($code->salesUser)
                                                <div>{{ $code->salesUser->name }}</div>
                                                <div class="small text-muted">{{ __('admin.users.roles.' . $code->salesUser->role) }}</div>
                                                @if(data_get($code->meta_json, 'restrict_to_teacher_courses'))
                                                    <span class="badge bg-light-warning text-warning mt-1">{{ __('admin.discount_codes.teacher_privacy.badge') }}</span>
                                                @endif
                                            @else
                                                {{ __('admin.discount_codes.not_connected') }}
                                            @endif
                                        </td>
                                        <td>
                                            <div>{{ number_format($code->redemptions_count ?? 0) }}</div>
                                            <small class="text-muted">
                                                @if ($code->max_uses)
                                                    {{ __('admin.discount_codes.usage_from', ['count' => number_format($code->max_uses)]) }}
                                                @else
                                                    {{ __('admin.discount_codes.unlimited') }}
                                                @endif
                                            </small>
                                        </td>
                                        <td>
                                            <span class="badge {{ $code->is_active ? 'bg-light-success text-success' : 'bg-light-danger text-danger' }}">
                                                {{ $code->is_active ? __('admin.discount_codes.status.active') : __('admin.discount_codes.status.inactive') }}
                                            </span>
                                        </td>
                                        <td>
                                            <div class="d-flex gap-2">
                                                <a href="{{ route('admin.discount-codes.edit', $code) }}" class="btn btn-sm btn-light-primary">{{ __('admin.discount_codes.actions.edit') }}</a>
                                                <form method="POST" action="{{ route('admin.discount-codes.destroy', $code) }}" onsubmit="return confirm(@js(__('admin.discount_codes.actions.confirm_delete')));">
                                                    @csrf
                                                    @method('DELETE')
                                                    <button type="submit" class="btn btn-sm btn-light-danger">{{ __('admin.discount_codes.actions.delete') }}</button>
                                                </form>
                                            </div>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="8" class="text-center py-4 text-muted">{{ __('admin.discount_codes.empty') }}</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>

                    <div class="mt-4">
                        {{ $codes->links() }}
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection
