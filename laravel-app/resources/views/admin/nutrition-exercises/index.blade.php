@extends('admin.layouts.app')

@section('title', 'فعالیت های ورزشی')

@section('content')
    <div class="row g-4">
        <div class="col-12">
            <div class="card">
                <div class="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
                    <div>
                        <h5 class="mb-1">فعالیت های ورزشی</h5>
                        <p class="text-muted mb-0">گروه‌ها و ورزش‌های مرکزی اینجا مدیریت می‌شوند و در ثبت ورزش کاربران استفاده می‌شوند.</p>
                    </div>
                    <div class="d-flex flex-wrap gap-2">
                        <a href="{{ route('admin.nutrition-exercises.groups.create') }}" class="btn btn-light-primary">افزودن گروه</a>
                        <a href="{{ route('admin.nutrition-exercises.items.create') }}" class="btn btn-primary">افزودن ورزش</a>
                    </div>
                </div>
            </div>
        </div>

        @foreach ($groups as $group)
            <div class="col-12">
                <div class="card">
                    <div class="card-header d-flex flex-wrap align-items-center justify-content-between gap-3">
                        <div>
                            <h5 class="mb-1">{{ $group->title }}</h5>
                            <p class="text-muted mb-0">{{ $group->description ?: 'بدون توضیح' }}</p>
                        </div>
                        <div class="d-flex flex-wrap gap-2">
                            <span class="badge bg-light-secondary text-dark">{{ $group->exercises->count() }} ورزش</span>
                            <a href="{{ route('admin.nutrition-exercises.groups.edit', $group) }}" class="btn btn-sm btn-light-secondary">ویرایش گروه</a>
                            <form action="{{ route('admin.nutrition-exercises.groups.destroy', $group) }}" method="POST" onsubmit="return confirm('این گروه و همه ورزش‌های داخل آن حذف شوند؟');">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="btn btn-sm btn-light-danger">حذف گروه</button>
                            </form>
                        </div>
                    </div>
                    <div class="card-body">
                        @if ($group->exercises->isEmpty())
                            <div class="alert alert-secondary mb-0">هنوز ورزشی داخل این گروه ثبت نشده است.</div>
                        @else
                            <div class="table-responsive">
                                <table class="table table-hover align-middle mb-0">
                                    <thead>
                                        <tr>
                                            <th>عنوان</th>
                                            <th>Slug</th>
                                            <th>برچسب</th>
                                            <th>MET</th>
                                            <th>قابلیت‌ها</th>
                                            <th class="text-end">عملیات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @foreach ($group->exercises as $exercise)
                                            <tr>
                                                <td>
                                                    <div class="fw-bold">{{ $exercise->title }}</div>
                                                    <small class="text-muted">{{ $exercise->description ?: 'بدون توضیح' }}</small>
                                                </td>
                                                <td><code>{{ $exercise->slug }}</code></td>
                                                <td>{{ $exercise->badge_text ?: '—' }}</td>
                                                <td>
                                                    <div>سبک: {{ $exercise->met_light ?? '—' }}</div>
                                                    <div>متوسط: {{ $exercise->met_moderate ?? '—' }}</div>
                                                    <div>شدید: {{ $exercise->met_vigorous ?? '—' }}</div>
                                                </td>
                                                <td>
                                                    @if ($exercise->supports_intensity)<span class="badge bg-light-primary text-primary">شدت</span>@endif
                                                    @if ($exercise->supports_distance)<span class="badge bg-light-success text-success">مسافت</span>@endif
                                                    @if ($exercise->supports_speed)<span class="badge bg-light-warning text-warning">سرعت</span>@endif
                                                </td>
                                                <td class="text-end">
                                                    <div class="d-inline-flex gap-2">
                                                        <a href="{{ route('admin.nutrition-exercises.items.edit', $exercise) }}" class="btn btn-sm btn-light-secondary">ویرایش</a>
                                                        <form action="{{ route('admin.nutrition-exercises.items.destroy', $exercise) }}" method="POST" onsubmit="return confirm('این ورزش حذف شود؟');">
                                                            @csrf
                                                            @method('DELETE')
                                                            <button type="submit" class="btn btn-sm btn-light-danger">حذف</button>
                                                        </form>
                                                    </div>
                                                </td>
                                            </tr>
                                        @endforeach
                                    </tbody>
                                </table>
                            </div>
                        @endif
                    </div>
                </div>
            </div>
        @endforeach
    </div>
@endsection
