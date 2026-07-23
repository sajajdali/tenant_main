@extends('admin.layouts.app')

@section('title', __('admin.specialized_courses.title'))

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header d-flex align-items-center justify-content-between gap-2 flex-wrap">
                    <div>
                        <h5 class="mb-1">{{ $isTeacher ? __('admin.specialized_courses.my_courses') : __('admin.specialized_courses.all_courses') }}</h5>
                        <p class="text-muted mb-0">{{ __('admin.specialized_courses.description') }}</p>
                    </div>
                    <a href="{{ route('admin.specialized-courses.create') }}" class="btn btn-primary">{{ __('admin.specialized_courses.create') }}</a>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>{{ __('admin.specialized_courses.columns.course') }}</th>
                                    <th>{{ __('admin.specialized_courses.columns.teacher') }}</th>
                                    <th>{{ __('admin.specialized_courses.columns.audience') }}</th>
                                    <th>{{ __('admin.specialized_courses.columns.category') }}</th>
                                    <th>{{ __('admin.specialized_courses.columns.price') }}</th>
                                    <th>{{ __('admin.specialized_courses.columns.students') }}</th>
                                    <th>{{ __('admin.specialized_courses.columns.sections') }}</th>
                                    <th>{{ __('admin.specialized_courses.columns.orders') }}</th>
                                    <th>{{ __('admin.specialized_courses.columns.status') }}</th>
                                    <th>{{ __('admin.specialized_courses.columns.actions') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($courses as $course)
                                    <tr>
                                        <td>
                                            <div class="fw-semibold">{{ $course->title }}</div>
                                            <div class="small text-muted">{{ $course->subtitle ?: __('admin.specialized_courses.no_subtitle') }}</div>
                                        </td>
                                        <td>{{ $course->teacher?->name ?? '—' }}</td>
                                        <td>{{ $course->audienceType?->name ?? '—' }}</td>
                                        <td>{{ $course->category?->name ?? '—' }}</td>
                                        <td>
                                            <div>{{ __('admin.money.iran_toman', ['amount' => number_format($course->payableAmount())]) }}</div>
                                            @if($course->sale_price_amount)
                                                <div class="small text-muted text-decoration-line-through">{{ __('admin.money.iran_toman', ['amount' => number_format($course->price_amount)]) }}</div>
                                            @endif
                                        </td>
                                        <td>{{ number_format($course->studentsCount()) }}</td>
                                        <td>{{ number_format($course->sections_count) }}</td>
                                        <td>{{ number_format($course->orders_count) }}</td>
                                        <td>
                                            <span class="badge {{ $course->is_published ? 'bg-light-success text-success' : 'bg-light-warning text-warning' }}">
                                                {{ $course->is_published ? __('admin.specialized_courses.status.published') : __('admin.specialized_courses.status.draft') }}
                                            </span>
                                        </td>
                                        <td>
                                            <div class="d-flex gap-2">
                                                <a href="{{ route('admin.specialized-courses.edit', $course) }}" class="btn btn-sm btn-light-primary">{{ __('admin.specialized_courses.actions.edit') }}</a>
                                                <form method="POST" action="{{ route('admin.specialized-courses.destroy', $course) }}" onsubmit="return confirm(@js(__('admin.specialized_courses.actions.confirm_delete')));">
                                                    @csrf
                                                    @method('DELETE')
                                                    <button type="submit" class="btn btn-sm btn-light-danger">{{ __('admin.specialized_courses.actions.delete') }}</button>
                                                </form>
                                            </div>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="10" class="text-center py-4 text-muted">{{ __('admin.specialized_courses.empty') }}</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>

                    <div class="mt-4">
                        {{ $courses->links() }}
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection
