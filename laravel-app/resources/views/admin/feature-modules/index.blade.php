@extends('admin.layouts.app')

@section('title', __('admin.feature_modules.title'))

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <div class="d-flex align-items-center justify-content-between">
                        <div>
                            <h5 class="mb-1">{{ __('admin.feature_modules.title') }}</h5>
                            <p class="text-muted mb-0">{{ __('admin.feature_modules.description') }}</p>
                        </div>
                        <a href="{{ route('admin.feature-modules.create') }}" class="btn btn-primary">{{ __('admin.feature_modules.create') }}</a>
                    </div>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>{{ __('admin.feature_modules.columns.name') }}</th>
                                    <th>{{ __('admin.feature_modules.columns.slug') }}</th>
                                    <th>{{ __('admin.feature_modules.columns.monthly_price') }}</th>
                                    <th>{{ __('admin.feature_modules.columns.custom_prices') }}</th>
                                    <th>{{ __('admin.feature_modules.columns.status') }}</th>
                                    <th>{{ __('admin.feature_modules.columns.sort_order') }}</th>
                                    <th>{{ __('admin.feature_modules.columns.actions') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($modules as $module)
                                    <tr>
                                        <td>{{ $module->name }}</td>
                                        <td dir="ltr">{{ $module->slug }}</td>
                                        <td>{{ __('admin.money.iran_toman', ['amount' => number_format($module->monthly_price_amount)]) }}</td>
                                        <td>
                                            @if (($module->audience_prices_count ?? 0) > 0)
                                                <span class="badge bg-light-primary text-primary">{{ __('admin.feature_modules.audience_prices_count', ['count' => number_format($module->audience_prices_count)]) }}</span>
                                            @else
                                                <span class="text-muted">{{ __('admin.feature_modules.no_audience_prices') }}</span>
                                            @endif
                                        </td>
                                        <td>
                                            <span class="badge {{ $module->is_active ? 'bg-light-success text-success' : 'bg-light-danger text-danger' }}">
                                                {{ $module->is_active ? __('admin.feature_modules.status.active') : __('admin.feature_modules.status.inactive') }}
                                            </span>
                                        </td>
                                        <td>{{ number_format($module->sort_order) }}</td>
                                        <td>
                                            <div class="d-flex gap-2">
                                                <a href="{{ route('admin.feature-modules.edit', $module) }}" class="btn btn-sm btn-light-primary">{{ __('admin.feature_modules.actions.edit') }}</a>
                                                <form method="POST" action="{{ route('admin.feature-modules.destroy', $module) }}" onsubmit="return confirm(@js(__('admin.feature_modules.actions.confirm_delete')));">
                                                    @csrf
                                                    @method('DELETE')
                                                    <button type="submit" class="btn btn-sm btn-light-danger">{{ __('admin.feature_modules.actions.delete') }}</button>
                                                </form>
                                            </div>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="7" class="text-center py-4 text-muted">{{ __('admin.feature_modules.empty') }}</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>

                    <div class="mt-4">
                        {{ $modules->links() }}
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection
