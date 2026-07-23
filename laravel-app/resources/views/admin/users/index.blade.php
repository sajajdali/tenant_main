@extends('admin.layouts.app')

@section('title', 'کاربران')

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <div class="d-flex align-items-center justify-content-between">
                        <div>
                            <h5 class="mb-1">کاربران</h5>
                            <p class="text-muted mb-0">این صفحه فعلاً برای مرحله بعدی آماده شده و لیست کاربران را نشان می‌دهد.</p>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-light-primary text-primary">
                                {{ $role !== '' ? ($roleLabels[$role] ?? $role) : ($status === 'active' ? 'فقط فعال' : ($status === 'inactive' ? 'فقط غیرفعال' : 'همه')) }}
                            </span>
                            <a href="{{ route('admin.users.create') }}" class="btn btn-primary">افزودن کاربر</a>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>نام</th>
                                    <th>موبایل</th>
                                    <th>ایمیل</th>
                                    <th>نقش</th>
                                    <th>تنظیمات فروش</th>
                                    <th>وضعیت</th>
                                    <th>عملیات</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($users as $user)
                                    <tr>
                                        <td>{{ $user->name }}</td>
                                        <td dir="ltr">{{ $user->mobile }}</td>
                                        <td>{{ $user->email }}</td>
                                        <td>{{ $roleLabels[$user->role] ?? $user->role }}</td>
                                        <td>
                                            @if ($user->role === 'sales_expert')
                                                <div class="small">
                                                    <div>سهم کارشناس: {{ $user->sales_commission_percent !== null ? rtrim(rtrim(number_format((float) $user->sales_commission_percent, 2, '.', ''), '0'), '.') : '—' }}٪</div>
                                                    <div class="text-muted">
                                                        مدیر فروش:
                                                        @if ($user->salesManager)
                                                            {{ $user->salesManager->name }} ({{ rtrim(rtrim(number_format((float) $user->sales_manager_commission_percent, 2, '.', ''), '0'), '.') }}٪)
                                                        @else
                                                            ندارد
                                                        @endif
                                                    </div>
                                                </div>
                                            @elseif ($user->role === 'sales_manager')
                                                <div class="small">
                                                    <div>سهم فروش مستقیم: {{ $user->sales_commission_percent !== null ? rtrim(rtrim(number_format((float) $user->sales_commission_percent, 2, '.', ''), '0'), '.') : '—' }}٪</div>
                                                    <div class="text-muted">مدیر فروش</div>
                                                </div>
                                            @elseif ($user->role === 'teacher')
                                                <div class="small">
                                                    <div>معرفی مستقیم توسط مدرس: {{ $user->sales_commission_percent !== null ? rtrim(rtrim(number_format((float) $user->sales_commission_percent, 2, '.', ''), '0'), '.') : '—' }}٪</div>
                                                    <div class="text-muted">معرفی غیرمستقیم دوره: {{ $user->teacherProfile?->commission_percent !== null ? rtrim(rtrim(number_format((float) $user->teacherProfile?->commission_percent, 2, '.', ''), '0'), '.') : '—' }}٪</div>
                                                </div>
                                            @else
                                                <span class="text-muted small">—</span>
                                            @endif
                                        </td>
                                        <td>
                                            <span class="badge {{ $user->is_active ? 'bg-light-success text-success' : 'bg-light-danger text-danger' }}">
                                                {{ $user->is_active ? 'فعال' : 'غیرفعال' }}
                                            </span>
                                        </td>
                                        <td>
                                            <div class="d-flex gap-2">
                                                @if(($user->owned_tenants_count ?? 0) > 0)
                                                    <a href="{{ route('admin.users.credit.edit', $user) }}" class="btn btn-sm btn-light-success">افزایش اعتبار</a>
                                                @endif
                                                <a href="{{ route('admin.users.edit', $user) }}" class="btn btn-sm btn-light-primary">ویرایش</a>
                                                <form method="POST" action="{{ route('admin.users.destroy', $user) }}" onsubmit="return confirm('کاربر حذف شود؟');">
                                                    @csrf
                                                    @method('DELETE')
                                                    <button type="submit" class="btn btn-sm btn-light-danger">حذف</button>
                                                </form>
                                            </div>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="7" class="text-center py-4 text-muted">کاربری پیدا نشد.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>

                    <div class="mt-4">
                        {{ $users->links() }}
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection
