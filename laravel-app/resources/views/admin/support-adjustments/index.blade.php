@extends('admin.layouts.app')

@section('title', 'کاهش بسته و تاریخ')

@section('content')
    <div class="row mb-4">
        <div class="col-12">
            <h4 class="mb-1">کاهش بسته و تاریخ پشتیبانی</h4>
            <p class="text-muted mb-0">اگر بسته یا تاریخ پشتیبانی به اشتباه بیشتر شده باشد، از اینجا می‌توانید با ثبت دلیل و لاگ کامل آن را اصلاح کنید.</p>
        </div>
    </div>

    <div class="card mb-4">
        <div class="card-body">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead>
                        <tr>
                            <th>سامانه</th>
                            <th>مسئول</th>
                            <th>بسته فعلی</th>
                            <th>پایان پشتیبانی</th>
                            <th>عملیات</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($tenants as $tenant)
                            <tr>
                                <td>{{ $tenant->name }}</td>
                                <td>
                                    <div>{{ $tenant->owner?->name ?? '—' }}</div>
                                    <small class="text-muted">{{ $tenant->owner?->mobile ?? '—' }}</small>
                                </td>
                                <td>{{ $tenant->subscriptionPackage?->name ?? 'تعریف نشده' }}</td>
                                <td>{{ $formatDate($tenant->support_ends_at) }}</td>
                                <td>
                                    <button
                                        type="button"
                                        class="btn btn-sm btn-light-warning"
                                        data-bs-toggle="modal"
                                        data-bs-target="#supportAdjustModal"
                                        data-action="{{ route('admin.support-adjustments.store', $tenant) }}"
                                        data-tenant-name="{{ $tenant->name }}"
                                        data-current-package="{{ $tenant->subscriptionPackage?->name ?? 'تعریف نشده' }}"
                                        data-current-end="{{ $tenant->support_ends_at?->toDateString() ?? '' }}"
                                    >
                                        کاهش و اصلاح
                                    </button>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="5" class="text-center py-5 text-muted">سامانه‌ای برای نمایش پیدا نشد.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>

            @if ($tenants->hasPages())
                <div class="mt-4">
                    {{ $tenants->onEachSide(1)->links() }}
                </div>
            @endif
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <h5 class="mb-1">تاریخچه کاهش‌ها</h5>
            <p class="text-muted mb-0">همه تغییرات همراه با علت و مقادیر قبل/بعد اینجا ثبت می‌شود.</p>
        </div>
        <div class="card-body">
            <div class="table-responsive">
                <table class="table table-striped align-middle mb-0">
                    <thead>
                        <tr>
                            <th>سامانه</th>
                            <th>شرح</th>
                            <th>دلیل</th>
                            <th>انجام‌دهنده</th>
                            <th>زمان</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($history as $item)
                            <tr>
                                <td>{{ $item->tenant?->name ?? ($item->meta_json['tenant_name'] ?? '—') }}</td>
                                <td>{{ $item->title ?: '—' }}</td>
                                <td>{{ $item->reason }}</td>
                                <td>{{ $item->actor?->name ?? '—' }}</td>
                                <td>{{ $item->occurred_at ? \App\Support\JalaliDate::formatDateTime($item->occurred_at) : '—' }}</td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="5" class="text-center py-4 text-muted">هنوز کاهشی ثبت نشده است.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="modal fade" id="supportAdjustModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <form method="POST" id="supportAdjustForm">
                    @csrf
                    <div class="modal-header">
                        <h5 class="modal-title">کاهش بسته یا تاریخ پشتیبانی</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-warning">
                            <div class="fw-semibold mb-1" id="supportAdjustTenantName">سامانه</div>
                            <div class="small text-muted" id="supportAdjustCurrentState">—</div>
                        </div>

                        <div class="mb-3">
                            <label class="form-label" for="subscription_package_id">بسته جدید</label>
                            <select class="form-select" id="subscription_package_id" name="subscription_package_id" required>
                                <option value="">انتخاب کنید</option>
                                @foreach ($packages as $package)
                                    <option value="{{ $package->id }}">
                                        {{ $package->name }} - {{ $package->user_limit === null ? 'نامحدود' : number_format($package->user_limit).' کاربر' }} - {{ number_format($package->duration_days) }} روز
                                    </option>
                                @endforeach
                            </select>
                        </div>

                        <div class="mb-3">
                            <label class="form-label" for="new_support_ends_at">تاریخ پایان پشتیبانی جدید</label>
                            <input type="date" class="form-control" id="new_support_ends_at" name="new_support_ends_at" required>
                        </div>

                        <div>
                            <label class="form-label" for="support_adjust_reason">دلیل کاهش</label>
                            <textarea class="form-control" id="support_adjust_reason" name="reason" rows="4" required placeholder="مثلاً تمدید اشتباه ثبت شده بود و باید به تاریخ/بسته صحیح برگردد"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-light-secondary" data-bs-dismiss="modal">انصراف</button>
                        <button type="submit" class="btn btn-warning">ثبت کاهش</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
@endsection

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            const modal = document.getElementById('supportAdjustModal');
            const form = document.getElementById('supportAdjustForm');
            const tenantName = document.getElementById('supportAdjustTenantName');
            const currentState = document.getElementById('supportAdjustCurrentState');
            const supportInput = document.getElementById('new_support_ends_at');

            if (!modal || !form || !tenantName || !currentState || !supportInput) return;

            modal.addEventListener('show.bs.modal', function (event) {
                const button = event.relatedTarget;
                if (!button) return;

                form.setAttribute('action', button.getAttribute('data-action'));
                tenantName.textContent = button.getAttribute('data-tenant-name') || 'سامانه';
                currentState.textContent = `بسته فعلی: ${button.getAttribute('data-current-package') || '—'} • پایان فعلی: ${button.getAttribute('data-current-end') || '—'}`;
                supportInput.value = button.getAttribute('data-current-end') || '';
                supportInput.setAttribute('max', button.getAttribute('data-current-end') || '');
            });
        });
    </script>
@endpush
