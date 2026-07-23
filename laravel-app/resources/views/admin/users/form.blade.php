@extends('admin.layouts.app')

@section('title', $isEdit ? 'ویرایش کاربر' : 'افزودن کاربر')

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            const roleField = document.getElementById('role');
            const salesConfigSection = document.getElementById('sales-config-section');
            const teacherConfigSection = document.getElementById('teacher-config-section');
            const salesPercentLabel = document.getElementById('sales_commission_percent_label');
            const salesPercentHint = document.getElementById('sales_commission_percent_hint');
            const salesManagerToggle = document.getElementById('has_sales_manager');
            const salesManagerToggleWrapper = document.getElementById('sales-manager-toggle-wrapper');
            const salesManagerFields = document.getElementById('sales-manager-fields');
            const salesManagerSelect = document.getElementById('sales_manager_user_id');
            const salesManagerPercent = document.getElementById('sales_manager_commission_percent');
            const teacherReferralPercent = document.getElementById('teacher_referral_commission_percent');
            const teacherIndirectPercent = document.getElementById('course_commission_percent');

            const syncSalesUi = () => {
                const role = roleField?.value;
                const isSalesExpert = role === 'sales_expert';
                const isSalesManager = role === 'sales_manager';
                const isTeacher = role === 'teacher';
                const hasSalesConfig = isSalesExpert || isSalesManager;

                if (salesConfigSection) {
                    salesConfigSection.style.display = hasSalesConfig ? '' : 'none';
                }

                if (teacherConfigSection) {
                    teacherConfigSection.style.display = isTeacher ? '' : 'none';
                }

                if (salesPercentLabel) {
                    salesPercentLabel.textContent = isSalesManager ? 'درصد سهم مدیر فروش' : 'درصد سهم فروش مستقیم';
                }

                if (salesPercentHint) {
                    salesPercentHint.textContent = isSalesManager
                        ? 'اگر مدیر فروش خودش فروش ایجاد کند یا کد تخفیف خودش استفاده شود، این درصد برای او لحاظ می‌شود.'
                        : 'این درصد سهم مستقیم همین کاربر از فروش است.';
                }

                if (salesManagerToggleWrapper) {
                    salesManagerToggleWrapper.style.display = isSalesExpert ? '' : 'none';
                }

                if (!isSalesExpert && salesManagerToggle) {
                    salesManagerToggle.checked = false;
                }

                const managerEnabled = isSalesExpert && !!salesManagerToggle?.checked;
                if (salesManagerFields) {
                    salesManagerFields.style.display = managerEnabled ? '' : 'none';
                }

                if (!managerEnabled) {
                    if (salesManagerSelect) {
                        salesManagerSelect.value = '';
                    }

                    if (salesManagerPercent) {
                        salesManagerPercent.value = '';
                    }
                }

                if (!isTeacher && teacherReferralPercent) {
                    teacherReferralPercent.value = '';
                }

                if (!isTeacher && teacherIndirectPercent) {
                    teacherIndirectPercent.value = '';
                }
            };

            roleField?.addEventListener('change', syncSalesUi);
            salesManagerToggle?.addEventListener('change', syncSalesUi);
            syncSalesUi();
        });
    </script>
@endpush

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">{{ $isEdit ? 'ویرایش کاربر' : 'افزودن کاربر جدید' }}</h5>
                    <p class="text-muted mb-0">این فرم برای افزودن و ویرایش کاربر مشترک است و الگوی یکپارچه پنل از همین‌جا اعمال می‌شود.</p>
                </div>
                <div class="card-body">
                    <form method="POST" action="{{ $isEdit ? route('admin.users.update', $user) : route('admin.users.store') }}">
                        @csrf
                        @if ($isEdit)
                            @method('PUT')
                        @endif

                        <div class="row g-3">
                            <div class="col-md-6">
                                <label class="form-label" for="name">نام و نام خانوادگی</label>
                                <input type="text" class="form-control" id="name" name="name" value="{{ old('name', $user->name) }}" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="mobile">شماره موبایل</label>
                                <input type="text" class="form-control" id="mobile" name="mobile" value="{{ old('mobile', $user->mobile) }}" dir="ltr" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="email">ایمیل</label>
                                <input type="email" class="form-control" id="email" name="email" value="{{ old('email', $user->email) }}" dir="ltr">
                                <small class="text-muted">اختیاری است. ورود با شماره موبایل و رمز عبور انجام می‌شود.</small>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="role">نقش</label>
                                <select class="form-select" id="role" name="role" required>
                                    @foreach ($roleOptions as $roleValue => $roleLabel)
                                        <option value="{{ $roleValue }}" @selected(old('role', $user->role) === $roleValue)>{{ $roleLabel }}</option>
                                    @endforeach
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="password">رمز عبور {{ $isEdit ? '(در صورت نیاز)' : '' }}</label>
                                <input type="password" class="form-control" id="password" name="password" dir="ltr" {{ $isEdit ? '' : 'required' }}>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="password_confirmation">تکرار رمز عبور</label>
                                <input type="password" class="form-control" id="password_confirmation" name="password_confirmation" dir="ltr" {{ $isEdit ? '' : 'required' }}>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="is_active">وضعیت</label>
                                <select class="form-select" id="is_active" name="is_active" required>
                                    <option value="1" @selected((string) old('is_active', (int) $user->is_active) === '1')>فعال</option>
                                    <option value="0" @selected((string) old('is_active', (int) $user->is_active) === '0')>غیرفعال</option>
                                </select>
                            </div>

                            <div id="teacher-config-section" class="col-12" style="{{ old('role', $user->role) === 'teacher' ? '' : 'display:none;' }}">
                                <div class="border rounded-3 p-3 bg-light">
                                    <div class="mb-3">
                                        <h6 class="mb-1">تنظیمات مدرس</h6>
                                        <p class="text-muted mb-0">برای فروش دوره‌ها دو سناریو تعریف می‌شود: اگر مشتری مستقیماً توسط خود مدرس معرفی شده باشد از درصد اول استفاده می‌کنیم، و اگر خرید از مسیر کارشناس یا مدیر فروش آمده باشد از درصد دوم. بعد از سهم مدرس، درصد فروش از باقیمانده محاسبه می‌شود.</p>
                                    </div>
                                    <div class="row g-3">
                                        <div class="col-md-4">
                                            <label class="form-label" for="teacher_referral_commission_percent">درصد سهم معرفی مشتری توسط مدرس</label>
                                            <div class="input-group">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    class="form-control"
                                                    id="teacher_referral_commission_percent"
                                                    name="sales_commission_percent"
                                                    value="{{ old('sales_commission_percent', $user->sales_commission_percent) }}"
                                                    @if(old('role', $user->role) === 'teacher') required @endif
                                                >
                                                <span class="input-group-text">٪</span>
                                            </div>
                                            <small class="text-muted">اگر مشتری مستقیماً توسط همین مدرس معرفی شده باشد، سهم مدرس از مبلغ سفارش دوره با همین درصد محاسبه می‌شود.</small>
                                        </div>
                                        <div class="col-md-8">
                                            <label class="form-label" for="course_commission_percent">درصد سهم معرفی دوره در صورتی که مستقیم توسط خود مدرس معرفی نشده باشد</label>
                                            <div class="input-group">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    class="form-control"
                                                    id="course_commission_percent"
                                                    name="course_commission_percent"
                                                    value="{{ old('course_commission_percent', $user->teacherProfile?->commission_percent) }}"
                                                    @if(old('role', $user->role) === 'teacher') required @endif
                                                >
                                                <span class="input-group-text">٪</span>
                                            </div>
                                            <small class="text-muted">اگر خرید دوره از مسیر کارشناس فروش یا مدیر فروش آمده باشد، اول سهم مدرس با این درصد محاسبه می‌شود و بعد از باقیمانده، سهم کارشناس و مدیر فروش برداشته می‌شود.</small>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div id="sales-config-section" class="col-12" style="{{ in_array(old('role', $user->role), ['sales_expert', 'sales_manager'], true) ? '' : 'display:none;' }}">
                                <div class="border rounded-3 p-3 bg-light">
                                    <div class="mb-3">
                                        <h6 class="mb-1">تنظیمات فروش و پورسانت</h6>
                                        <p class="text-muted mb-0">برای کارشناس یا مدیر فروش، درصد سهم فروش مستقیم را از همین بخش مشخص کنید. اگر نقش کاربر کارشناس فروش باشد، می‌توانید مدیر فروش بالادستی و درصد سهم او را هم تعیین کنید.</p>
                                    </div>

                                    <div class="row g-3">
                                        <div class="col-md-4">
                                            <label class="form-label" id="sales_commission_percent_label" for="sales_commission_percent">
                                                {{ old('role', $user->role) === 'sales_manager' ? 'درصد سهم مدیر فروش' : 'درصد سهم فروش مستقیم' }}
                                            </label>
                                            <div class="input-group">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    class="form-control"
                                                    id="sales_commission_percent"
                                                    name="sales_commission_percent"
                                                    value="{{ old('sales_commission_percent', $user->sales_commission_percent) }}"
                                                >
                                                <span class="input-group-text">٪</span>
                                            </div>
                                            <small class="text-muted" id="sales_commission_percent_hint">
                                                {{ old('role', $user->role) === 'sales_manager'
                                                    ? 'اگر مدیر فروش خودش فروش ایجاد کند یا کد تخفیف خودش استفاده شود، این درصد برای او لحاظ می‌شود.'
                                                    : 'این درصد سهم مستقیم همین کاربر از فروش است.' }}
                                            </small>
                                        </div>

                                        <div class="col-md-8 d-flex align-items-end" id="sales-manager-toggle-wrapper" style="{{ old('role', $user->role) === 'sales_expert' ? '' : 'display:none;' }}">
                                            <div class="form-check form-switch">
                                                <input
                                                    class="form-check-input"
                                                    type="checkbox"
                                                    role="switch"
                                                    id="has_sales_manager"
                                                    {{ old('sales_manager_user_id', $user->sales_manager_user_id) ? 'checked' : '' }}
                                                >
                                                <label class="form-check-label" for="has_sales_manager">برای این کارشناس، مدیر فروش تعریف شود</label>
                                            </div>
                                        </div>

                                        <div id="sales-manager-fields" class="col-12" style="{{ old('sales_manager_user_id', $user->sales_manager_user_id) ? '' : 'display:none;' }}">
                                            <div class="row g-3">
                                                <div class="col-md-6">
                                                    <label class="form-label" for="sales_manager_user_id">مدیر فروش</label>
                                                    <select class="form-select" id="sales_manager_user_id" name="sales_manager_user_id">
                                                        <option value="">بدون مدیر فروش</option>
                                                        @foreach ($salesManagers as $manager)
                                                            <option value="{{ $manager->id }}" @selected((string) old('sales_manager_user_id', $user->sales_manager_user_id) === (string) $manager->id)>
                                                                {{ $manager->name }} - {{ $manager->mobile }}
                                                            </option>
                                                        @endforeach
                                                    </select>
                                                </div>
                                                <div class="col-md-6">
                                                    <label class="form-label" for="sales_manager_commission_percent">درصد سهم مدیر فروش</label>
                                                    <div class="input-group">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            max="100"
                                                            class="form-control"
                                                            id="sales_manager_commission_percent"
                                                            name="sales_manager_commission_percent"
                                                            value="{{ old('sales_manager_commission_percent', $user->sales_manager_commission_percent) }}"
                                                        >
                                                        <span class="input-group-text">٪</span>
                                                    </div>
                                                    <small class="text-muted">مثلاً 10 یعنی ده درصد سهم مدیر فروش از همین فروش.</small>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="mt-4 d-flex gap-2">
                            <button type="submit" class="btn btn-primary">{{ $isEdit ? 'ذخیره تغییرات' : 'ذخیره کاربر' }}</button>
                            <a href="{{ route('admin.users.index') }}" class="btn btn-light-secondary">بازگشت</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
@endsection
