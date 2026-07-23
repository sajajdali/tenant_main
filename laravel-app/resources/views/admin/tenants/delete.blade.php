@extends('admin.layouts.app')

@section('title', 'حذف سامانه نوبت‌دهی')

@section('content')
    <div class="row justify-content-center">
        <div class="col-12 col-xl-8">
            <div class="card border-danger">
                <div class="card-header bg-danger text-white">
                    <h4 class="mb-1">حذف کامل سامانه نوبت‌دهی</h4>
                    <p class="mb-0 text-white text-opacity-75">این عملیات برگشت‌پذیر نیست و باید با تایید کامل انجام شود.</p>
                </div>
                <div class="card-body">
                    <div class="alert alert-danger">
                        اگر این سامانه را حذف کنید، همه اطلاعات آن برای همیشه پاک می‌شود؛ از جمله کاربران، نوبت‌ها، پیامک‌ها، تنظیمات، دامنه‌ها، و دیتابیس tenant.
                    </div>

                    <div class="row g-3 mb-4">
                        <div class="col-md-6">
                            <div class="border rounded p-3 h-100">
                                <div class="text-muted small">نام مجموعه</div>
                                <div class="fw-semibold mt-1">{{ $tenant->name }}</div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="border rounded p-3 h-100">
                                <div class="text-muted small">دامنه اصلی برای تایید</div>
                                <div class="fw-semibold mt-1" dir="ltr">{{ $primaryDomain ?: 'ثبت نشده' }}</div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="border rounded p-3 h-100">
                                <div class="text-muted small">طیف کاری</div>
                                <div class="fw-semibold mt-1">{{ $tenant->audienceType?->name ?? '—' }}</div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="border rounded p-3 h-100">
                                <div class="text-muted small">مدیر سامانه</div>
                                <div class="fw-semibold mt-1">{{ $tenant->owner?->name ?? '—' }}</div>
                            </div>
                        </div>
                    </div>

                    <form method="POST" action="{{ route('admin.tenants.destroy', $tenant) }}">
                        @csrf
                        @method('DELETE')

                        <div class="mb-3">
                            <label class="form-label" for="confirmation_domain">اگر مطمئن هستید، نام دامنه را دقیقاً تایپ کنید</label>
                            <input
                                type="text"
                                class="form-control"
                                id="confirmation_domain"
                                name="confirmation_domain"
                                value="{{ old('confirmation_domain') }}"
                                dir="ltr"
                                placeholder="{{ $primaryDomain ?: 'example.test' }}"
                                required
                            >
                            <small class="text-muted d-block mt-2">فقط اگر متن واردشده دقیقاً با دامنه اصلی یکی باشد، حذف انجام می‌شود.</small>
                        </div>

                        <div class="d-flex flex-wrap gap-2">
                            <button type="submit" class="btn btn-danger">مطمئن هستم، می‌خواهم پاک کنم</button>
                            <a href="{{ route('admin.tenants.index') }}" class="btn btn-light-secondary">انصراف و بازگشت</a>
                            <a href="{{ route('admin.tenants.show', $tenant) }}" class="btn btn-light-primary">بازگشت به گزارش سامانه</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
@endsection
