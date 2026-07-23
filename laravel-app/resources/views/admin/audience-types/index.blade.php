@extends('admin.layouts.app')

@section('title', __('admin.audience_types.title'))

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <div class="d-flex align-items-center justify-content-between">
                        <div>
                            <h5 class="mb-1">{{ __('admin.audience_types.title') }}</h5>
                            <p class="text-muted mb-0">{{ __('admin.audience_types.description') }}</p>
                        </div>
                        <a href="{{ route('admin.audience-types.create') }}" class="btn btn-primary">{{ __('admin.audience_types.create') }}</a>
                    </div>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>{{ __('admin.audience_types.columns.name') }}</th>
                                    <th>{{ __('admin.audience_types.columns.singular_label') }}</th>
                                    <th>{{ __('admin.audience_types.columns.plural_label') }}</th>
                                    <th>{{ __('admin.audience_types.columns.business_label') }}</th>
                                    <th>{{ __('admin.audience_types.columns.setup_fee') }}</th>
                                    <th>{{ __('admin.audience_types.columns.status') }}</th>
                                    <th>{{ __('admin.audience_types.columns.actions') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($audiences as $audience)
                                    <tr>
                                        <td>{{ $audience->name }}</td>
                                        <td>{{ $audience->singular_label }}</td>
                                        <td>{{ $audience->plural_label }}</td>
                                        <td>{{ $audience->business_label }}</td>
                                        <td>{{ __('admin.money.iran_toman', ['amount' => number_format((int) ($audience->checkoutSetting?->setup_fee_amount ?? 0))]) }}</td>
                                        <td>
                                            <span class="badge {{ $audience->is_active ? 'bg-light-success text-success' : 'bg-light-danger text-danger' }}">
                                                {{ $audience->is_active ? __('admin.audience_types.status.active') : __('admin.audience_types.status.inactive') }}
                                            </span>
                                        </td>
                                        <td>
                                            <div class="d-flex gap-2">
                                                <a href="{{ route('admin.audience-types.edit', $audience) }}" class="btn btn-sm btn-light-primary">{{ __('admin.audience_types.actions.edit') }}</a>
                                                <form method="POST" action="{{ route('admin.audience-types.destroy', $audience) }}" onsubmit="return confirm(@js(__('admin.audience_types.actions.confirm_delete')));">
                                                    @csrf
                                                    @method('DELETE')
                                                    <button type="submit" class="btn btn-sm btn-light-danger">{{ __('admin.audience_types.actions.delete') }}</button>
                                                </form>
                                            </div>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="7" class="text-center py-4 text-muted">{{ __('admin.audience_types.empty') }}</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>

                    <div class="mt-4">
                        {{ $audiences->links() }}
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection
