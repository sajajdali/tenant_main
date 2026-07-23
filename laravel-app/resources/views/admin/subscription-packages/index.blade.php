@extends('admin.layouts.app')

@section('title', __('admin.subscription_packages.title'))

@php
    $formatMoney = fn (int|float $amount): string => __('admin.money.iran_toman', ['amount' => number_format((int) $amount)]);
@endphp

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <div class="d-flex align-items-center justify-content-between">
                        <div>
                            <h5 class="mb-1">{{ __('admin.subscription_packages.title') }}</h5>
                            <p class="text-muted mb-0">{{ __('admin.subscription_packages.description') }}</p>
                        </div>
                        <a href="{{ route('admin.subscription-packages.create') }}" class="btn btn-primary">{{ __('admin.subscription_packages.create') }}</a>
                    </div>
                </div>
                <div class="card-body">
                    <div class="border rounded-3 p-3 p-md-4 mb-4 bg-light bg-opacity-10">
                        <div class="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
                            <div>
                                <h6 class="mb-1">{{ __('admin.subscription_packages.matrix.title') }}</h6>
                                <p class="text-muted mb-0">{{ __('admin.subscription_packages.matrix.description') }}</p>
                            </div>
                        </div>

                        <form method="POST" action="{{ route('admin.subscription-packages.matrix.update') }}">
                            @csrf
                            <div class="table-responsive">
                                <table class="table table-bordered align-middle mb-0">
                                    <thead>
                                        <tr>
                                            <th class="text-nowrap">{{ __('admin.subscription_packages.columns.duration') }}</th>
                                            @foreach ($matrixUserLimits as $limit)
                                                <th class="text-center text-nowrap">{{ $limit === null ? __('admin.common.unlimited') : __('admin.subscription_packages.user_count', ['count' => number_format($limit)]) }}</th>
                                            @endforeach
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @forelse ($matrixPackages as $durationDays => $durationItems)
                                            @php
                                                $byLimit = $durationItems->keyBy(fn ($item) => $item->user_limit === null ? 'unlimited' : (string) $item->user_limit);
                                            @endphp
                                            <tr>
                                                <td class="fw-semibold text-nowrap">{{ __('admin.common.days', ['count' => number_format((int) $durationDays)]) }}</td>
                                                @foreach ($matrixUserLimits as $limit)
                                                    @php
                                                        $key = $limit === null ? 'unlimited' : (string) $limit;
                                                        $package = $byLimit->get($key);
                                                    @endphp
                                                    <td style="min-width: 190px;">
                                                        @if ($package)
                                                            <div class="d-grid gap-2">
                                                                <div>
                                                                    <label class="form-label small mb-1">{{ __('admin.subscription_packages.labels.price_amount') }}</label>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        class="form-control form-control-sm"
                                                                        name="matrix[{{ $package->id }}][price_amount]"
                                                                        value="{{ old("matrix.{$package->id}.price_amount", $package->price_amount) }}"
                                                                        required
                                                                    >
                                                                </div>
                                                                <div>
                                                                    <label class="form-label small mb-1">{{ __('admin.subscription_packages.labels.discounted_price_amount') }}</label>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        class="form-control form-control-sm"
                                                                        name="matrix[{{ $package->id }}][discounted_price_amount]"
                                                                        value="{{ old("matrix.{$package->id}.discounted_price_amount", $package->discounted_price_amount) }}"
                                                                    >
                                                                </div>
                                                                <div>
                                                                    <label class="form-label small mb-1">{{ __('admin.subscription_packages.labels.sms_credit_gift_amount') }}</label>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        class="form-control form-control-sm"
                                                                        name="matrix[{{ $package->id }}][sms_credit_gift_amount]"
                                                                        value="{{ old("matrix.{$package->id}.sms_credit_gift_amount", $package->sms_credit_gift_amount) }}"
                                                                    >
                                                                </div>
                                                                <div class="form-check form-switch">
                                                                    <input type="hidden" name="matrix[{{ $package->id }}][is_active]" value="0">
                                                                    <input
                                                                        class="form-check-input"
                                                                        type="checkbox"
                                                                        role="switch"
                                                                        name="matrix[{{ $package->id }}][is_active]"
                                                                        value="1"
                                                                        id="active_{{ $package->id }}"
                                                                        @checked(old("matrix.{$package->id}.is_active", $package->is_active))
                                                                    >
                                                                    <label class="form-check-label small" for="active_{{ $package->id }}">{{ __('admin.subscription_packages.status.active') }}</label>
                                                                </div>
                                                            </div>
                                                        @else
                                                            <span class="text-muted small">{{ __('admin.subscription_packages.matrix.missing_cell') }}</span>
                                                        @endif
                                                    </td>
                                                @endforeach
                                            </tr>
                                        @empty
                                            <tr>
                                                <td colspan="{{ count($matrixUserLimits) + 1 }}" class="text-center py-4 text-muted">
                                                    {{ __('admin.subscription_packages.matrix.empty') }}
                                                </td>
                                            </tr>
                                        @endforelse
                                    </tbody>
                                </table>
                            </div>
                            <div class="mt-3 d-flex justify-content-end">
                                <button type="submit" class="btn btn-primary">{{ __('admin.subscription_packages.matrix.save') }}</button>
                            </div>
                        </form>
                    </div>

                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>{{ __('admin.subscription_packages.columns.name') }}</th>
                                    <th>{{ __('admin.subscription_packages.columns.slug') }}</th>
                                    <th>{{ __('admin.subscription_packages.columns.duration_days') }}</th>
                                    <th>{{ __('admin.subscription_packages.columns.user_limit') }}</th>
                                    <th>{{ __('admin.subscription_packages.columns.price_amount') }}</th>
                                    <th>{{ __('admin.subscription_packages.columns.discounted_price_amount') }}</th>
                                    <th>{{ __('admin.subscription_packages.columns.sms_credit_gift_amount') }}</th>
                                    <th>{{ __('admin.subscription_packages.columns.audience_prices') }}</th>
                                    <th>{{ __('admin.subscription_packages.columns.status') }}</th>
                                    <th>{{ __('admin.subscription_packages.columns.sort_order') }}</th>
                                    <th>{{ __('admin.subscription_packages.columns.actions') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($packages as $package)
                                    <tr>
                                        <td>{{ $package->name }}</td>
                                        <td dir="ltr">{{ $package->slug }}</td>
                                        <td>{{ number_format($package->duration_days) }}</td>
                                        <td>{{ $package->user_limit === null ? __('admin.common.unlimited') : number_format($package->user_limit) }}</td>
                                        <td>{{ $formatMoney($package->price_amount) }}</td>
                                        <td>{{ $package->discounted_price_amount ? $formatMoney($package->discounted_price_amount) : __('admin.common.none') }}</td>
                                        <td>{{ $package->sms_credit_gift_amount ? $formatMoney($package->sms_credit_gift_amount) : __('admin.common.none') }}</td>
                                        <td>
                                            @if (($package->audience_prices_count ?? 0) > 0)
                                                <span class="badge bg-light-primary text-primary">{{ __('admin.subscription_packages.audience_count', ['count' => number_format($package->audience_prices_count)]) }}</span>
                                            @else
                                                <span class="text-muted">{{ __('admin.common.none') }}</span>
                                            @endif
                                        </td>
                                        <td>
                                            <span class="badge {{ $package->is_active ? 'bg-light-success text-success' : 'bg-light-danger text-danger' }}">
                                                {{ $package->is_active ? __('admin.subscription_packages.status.active') : __('admin.subscription_packages.status.inactive') }}
                                            </span>
                                        </td>
                                        <td>{{ number_format($package->sort_order) }}</td>
                                        <td>
                                            <div class="d-flex gap-2">
                                                <a href="{{ route('admin.subscription-packages.edit', $package) }}" class="btn btn-sm btn-light-primary">{{ __('admin.subscription_packages.actions.edit') }}</a>
                                                <form method="POST" action="{{ route('admin.subscription-packages.destroy', $package) }}" onsubmit="return confirm(@js(__('admin.subscription_packages.actions.confirm_delete')));">
                                                    @csrf
                                                    @method('DELETE')
                                                    <button type="submit" class="btn btn-sm btn-light-danger">{{ __('admin.subscription_packages.actions.delete') }}</button>
                                                </form>
                                            </div>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="11" class="text-center py-4 text-muted">{{ __('admin.subscription_packages.empty') }}</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>

                    <div class="mt-4">
                        {{ $packages->links() }}
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection
