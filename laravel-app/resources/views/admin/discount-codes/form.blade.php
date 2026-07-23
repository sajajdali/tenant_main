@extends('admin.layouts.app')

@section('title', $isEdit ? __('admin.discount_codes.edit_title') : __('admin.discount_codes.create_title'))

@push('styles')
    @vite('resources/js/admin-discount-codes.js')
    <style>
        .discount-date-input {
            width: 100%;
            background-color: #fff;
            cursor: pointer;
        }
    </style>
@endpush

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">{{ $isEdit ? __('admin.discount_codes.edit_title') : __('admin.discount_codes.create_title') }}</h5>
                    <p class="text-muted mb-0">{{ __('admin.discount_codes.form_description') }}</p>
                </div>
                <div class="card-body">
                    <form method="POST" action="{{ $isEdit ? route('admin.discount-codes.update', $discountCode) : route('admin.discount-codes.store') }}">
                        @csrf
                        @if ($isEdit)
                            @method('PUT')
                        @endif

                        <div class="row g-3">
                            <div class="col-md-4">
                                <label class="form-label" for="code">{{ __('admin.discount_codes.labels.code') }}</label>
                                <input type="text" id="code" name="code" class="form-control" dir="ltr" value="{{ old('code', $discountCode->code) }}" required>
                            </div>
                            <div class="col-md-8">
                                <label class="form-label" for="title">{{ __('admin.discount_codes.labels.title') }}</label>
                                <input type="text" id="title" name="title" class="form-control" value="{{ old('title', $discountCode->title) }}">
                            </div>

                            <div class="col-md-4">
                                <label class="form-label" for="audience_type_id">{{ __('admin.discount_codes.labels.audience_type') }}</label>
                                <select id="audience_type_id" name="audience_type_id" class="form-select">
                                    <option value="">{{ __('admin.discount_codes.options.all_audiences') }}</option>
                                    @foreach ($audiences as $audience)
                                        <option value="{{ $audience->id }}" @selected((string) old('audience_type_id', $discountCode->audience_type_id) === (string) $audience->id)>{{ $audience->name }}</option>
                                    @endforeach
                                </select>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="applies_to">{{ __('admin.discount_codes.labels.applies_to') }}</label>
                                <select id="applies_to" name="applies_to" class="form-select" required>
                                    <option value="both" @selected(old('applies_to', $discountCode->applies_to) === 'both')>{{ __('admin.discount_codes.applies_to.both') }}</option>
                                    <option value="initial_purchase" @selected(old('applies_to', $discountCode->applies_to) === 'initial_purchase')>{{ __('admin.discount_codes.applies_to.initial_purchase') }}</option>
                                    <option value="renewal" @selected(old('applies_to', $discountCode->applies_to) === 'renewal')>{{ __('admin.discount_codes.applies_to.renewal') }}</option>
                                </select>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="sales_user_id">{{ __('admin.discount_codes.labels.sales_user') }}</label>
                                <select id="sales_user_id" name="sales_user_id" class="form-select">
                                    <option value="">{{ __('admin.discount_codes.options.no_sales_user') }}</option>
                                    @foreach ($salesUsers as $user)
                                        <option value="{{ $user->id }}" data-role="{{ $user->role }}" @selected((string) old('sales_user_id', $discountCode->sales_user_id) === (string) $user->id)>{{ $user->name }} - {{ $user->mobile }} ({{ __('admin.users.roles.' . $user->role) }})</option>
                                    @endforeach
                                </select>
                            </div>
                            <div class="col-md-8" id="teacher-course-privacy-box" style="{{ (old('sales_user_id', $discountCode->sales_user_id) && $discountCode->salesUser?->role === 'teacher') || old('restrict_to_teacher_courses', data_get($discountCode->meta_json, 'restrict_to_teacher_courses')) ? '' : 'display:none;' }}">
                                <div class="border rounded-3 p-3 bg-light">
                                    <div class="form-check form-switch mb-2">
                                        <input class="form-check-input" type="checkbox" role="switch" id="restrict_to_teacher_courses" name="restrict_to_teacher_courses" value="1" @checked(old('restrict_to_teacher_courses', data_get($discountCode->meta_json, 'restrict_to_teacher_courses')))>
                                        <label class="form-check-label fw-semibold" for="restrict_to_teacher_courses">{{ __('admin.discount_codes.teacher_privacy.label') }}</label>
                                    </div>
                                    <small class="text-muted">{{ __('admin.discount_codes.teacher_privacy.help') }}</small>
                                </div>
                            </div>

                            <div class="col-md-4">
                                <label class="form-label" for="discount_type">{{ __('admin.discount_codes.labels.discount_type') }}</label>
                                <select id="discount_type" name="discount_type" class="form-select" required>
                                    <option value="fixed" @selected(old('discount_type', $discountCode->discount_type) === 'fixed')>{{ __('admin.discount_codes.discount_type.fixed') }}</option>
                                    <option value="percent" @selected(old('discount_type', $discountCode->discount_type) === 'percent')>{{ __('admin.discount_codes.discount_type.percent') }}</option>
                                </select>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="discount_value" id="discount_value_label">{{ __('admin.discount_codes.labels.discount_value') }}</label>
                                <input type="number" min="0" id="discount_value" name="discount_value" class="form-control" value="{{ old('discount_value', $discountCode->discount_value ?? 0) }}" required>
                                <small class="text-muted" id="discount_value_hint"></small>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="maximum_discount_amount">{{ __('admin.discount_codes.labels.maximum_discount_amount') }}</label>
                                <input type="number" min="0" id="maximum_discount_amount" name="maximum_discount_amount" class="form-control" value="{{ old('maximum_discount_amount', $discountCode->maximum_discount_amount) }}">
                                <small class="text-muted">{{ __('admin.discount_codes.maximum_discount_help') }}</small>
                            </div>

                            <div class="col-md-4">
                                <label class="form-label" for="minimum_amount">{{ __('admin.discount_codes.labels.minimum_amount') }}</label>
                                <input type="number" min="0" id="minimum_amount" name="minimum_amount" class="form-control" value="{{ old('minimum_amount', $discountCode->minimum_amount) }}">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="maximum_amount">{{ __('admin.discount_codes.labels.maximum_amount') }}</label>
                                <input type="number" min="0" id="maximum_amount" name="maximum_amount" class="form-control" value="{{ old('maximum_amount', $discountCode->maximum_amount) }}">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="max_uses">{{ __('admin.discount_codes.labels.max_uses') }}</label>
                                <input type="number" min="1" id="max_uses" name="max_uses" class="form-control" value="{{ old('max_uses', $discountCode->max_uses) }}">
                                <small class="text-muted">{{ __('admin.discount_codes.unlimited_help') }}</small>
                            </div>

                            <div class="col-md-6">
                                <label class="form-label d-block" for="starts_at_display">{{ __('admin.discount_codes.labels.starts_at') }}</label>
                                <input
                                    type="text"
                                    id="starts_at_display"
                                    class="form-control discount-date-input"
                                    placeholder="{{ __('admin.discount_codes.date_placeholders.starts_at') }}"
                                    autocomplete="off"
                                    data-jdp
                                    data-jdp-only-date
                                >
                                <input
                                    type="hidden"
                                    id="starts_at"
                                    name="starts_at"
                                    value="{{ old('starts_at', $discountCode->starts_at?->format('Y-m-d H:i:s')) }}"
                                >
                                <small class="text-muted d-block mt-2">{{ __('admin.discount_codes.date_help.starts_at') }}</small>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label d-block" for="ends_at_display">{{ __('admin.discount_codes.labels.ends_at') }}</label>
                                <input
                                    type="text"
                                    id="ends_at_display"
                                    class="form-control discount-date-input"
                                    placeholder="{{ __('admin.discount_codes.date_placeholders.ends_at') }}"
                                    autocomplete="off"
                                    data-jdp
                                    data-jdp-only-date
                                >
                                <input
                                    type="hidden"
                                    id="ends_at"
                                    name="ends_at"
                                    value="{{ old('ends_at', $discountCode->ends_at?->format('Y-m-d H:i:s')) }}"
                                >
                                <small class="text-muted d-block mt-2">{{ __('admin.discount_codes.date_help.ends_at') }}</small>
                            </div>

                            <div class="col-12">
                                <label class="form-label" for="description">{{ __('admin.discount_codes.labels.description') }}</label>
                                <textarea id="description" name="description" rows="4" class="form-control">{{ old('description', data_get($discountCode->meta_json, 'description')) }}</textarea>
                            </div>

                            <div class="col-12">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" role="switch" id="is_active" name="is_active" value="1" @checked(old('is_active', $discountCode->is_active))>
                                    <label class="form-check-label" for="is_active">{{ __('admin.discount_codes.labels.active') }}</label>
                                </div>
                            </div>
                        </div>

                        <div class="mt-4 d-flex gap-2">
                            <button type="submit" class="btn btn-primary">{{ $isEdit ? __('admin.discount_codes.actions.save_update') : __('admin.discount_codes.actions.save_create') }}</button>
                            <a href="{{ route('admin.discount-codes.index') }}" class="btn btn-light-secondary">{{ __('admin.discount_codes.actions.back') }}</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
@endsection

@push('scripts')
    <script>
        (function () {
            const discountCopy = @json([
                'percentLabel' => __('admin.discount_codes.value_label.percent'),
                'percentHint' => __('admin.discount_codes.value_hint.percent'),
                'fixedLabel' => __('admin.discount_codes.value_label.fixed'),
                'fixedHint' => __('admin.discount_codes.value_hint.fixed'),
            ]);
            const typeField = document.getElementById('discount_type');
            const valueLabel = document.getElementById('discount_value_label');
            const valueHint = document.getElementById('discount_value_hint');
            const salesUserField = document.getElementById('sales_user_id');
            const teacherPrivacyBox = document.getElementById('teacher-course-privacy-box');
            const teacherPrivacyToggle = document.getElementById('restrict_to_teacher_courses');

            const syncDiscountTypeUi = () => {
                if (!typeField || !valueLabel || !valueHint) {
                    return;
                }

                if (typeField.value === 'percent') {
                    valueLabel.textContent = discountCopy.percentLabel;
                    valueHint.textContent = discountCopy.percentHint;
                    return;
                }

                valueLabel.textContent = discountCopy.fixedLabel;
                valueHint.textContent = discountCopy.fixedHint;
            };

            const syncSalesUserUi = () => {
                if (!salesUserField || !teacherPrivacyBox) return;
                const selected = salesUserField.options[salesUserField.selectedIndex];
                const isTeacher = selected?.dataset?.role === 'teacher';
                teacherPrivacyBox.style.display = isTeacher ? '' : 'none';

                if (!isTeacher && teacherPrivacyToggle) {
                    teacherPrivacyToggle.checked = false;
                }
            };

            syncDiscountTypeUi();
            syncSalesUserUi();
            typeField?.addEventListener('change', syncDiscountTypeUi);
            salesUserField?.addEventListener('change', syncSalesUserUi);
        })();
    </script>
@endpush
