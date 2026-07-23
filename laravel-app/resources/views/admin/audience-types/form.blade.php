@extends('admin.layouts.app')

@section('title', $isEdit ? 'ویرایش طیف کاری' : 'افزودن طیف کاری')

@php
    $audienceSlug = old('slug', $audience->slug ?? null);
    $featureVisibleForAudience = function (array $feature) use ($audienceSlug): bool {
        $scopes = $feature['scopes'] ?? null;

        if (!$scopes || $audienceSlug === null || $audienceSlug === '') {
            return $scopes === null;
        }

        return in_array($audienceSlug, $scopes, true);
    };

    $visibleCurrentFeatures = collect($currentFeatures)
        ->filter(fn ($feature) => $featureVisibleForAudience($feature))
        ->all();

    $visibleSpecialFeatures = collect($specialFeatures)
        ->filter(fn ($feature) => $featureVisibleForAudience($feature))
        ->all();

    $visibleNutritionFeatures = collect($nutritionFeatures)
        ->filter(fn ($feature) => $featureVisibleForAudience($feature))
        ->all();

    $visibleFutureFeatures = collect($futureFeatures)
        ->filter(fn ($feature) => $featureVisibleForAudience($feature))
        ->all();

    $selectedCurrentFeatures = old('enabled_features', $audience->enabled_features ?? []);
    $selectedNutritionFeatures = old('nutrition_features', $audience->nutrition_features ?? []);
    $selectedFutureFeatures = old('future_features', $audience->future_features ?? []);

    $orderedCurrentFeatures = collect(array_keys($visibleCurrentFeatures))
        ->sortBy(fn ($key) => ($index = array_search($key, $selectedCurrentFeatures, true)) !== false ? $index : 1000)
        ->values()
        ->all();

    $orderedSpecialFeatures = collect(array_keys($visibleSpecialFeatures))
        ->sortBy(fn ($key) => ($index = array_search($key, $selectedFutureFeatures, true)) !== false ? $index : 1000)
        ->values()
        ->all();

    $orderedNutritionFeatures = collect(array_keys($visibleNutritionFeatures))
        ->sortBy(fn ($key) => ($index = array_search($key, $selectedNutritionFeatures, true)) !== false ? $index : 1000)
        ->values()
        ->all();

    $orderedFutureFeatures = collect(array_keys($visibleFutureFeatures))
        ->sortBy(fn ($key) => ($index = array_search($key, $selectedFutureFeatures, true)) !== false ? $index : 1000)
        ->values()
        ->all();
@endphp

@push('styles')
    <style>
        .feature-sort-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 1rem;
        }

        .feature-sort-card {
            border: 1px solid rgba(110, 118, 129, 0.22);
            border-radius: 1rem;
            background: linear-gradient(180deg, rgba(255,255,255,0.95), rgba(248,249,250,0.98));
            padding: 1rem;
            cursor: grab;
            transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
            position: relative;
        }

        .feature-sort-card:hover {
            transform: translateY(-2px);
            border-color: rgba(13, 110, 253, 0.25);
            box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
        }

        .feature-sort-card.dragging {
            opacity: .65;
            transform: scale(.98);
            border-color: rgba(13, 110, 253, 0.38);
            box-shadow: 0 18px 34px rgba(13, 110, 253, 0.12);
        }

        .feature-sort-card.is-disabled {
            background: linear-gradient(180deg, rgba(248,249,250,0.92), rgba(241,243,245,0.98));
            border-style: dashed;
        }

        .feature-sort-card.drop-before {
            border-top: 4px solid #0d6efd;
            padding-top: calc(1rem - 3px);
        }

        .feature-sort-card.drop-after {
            border-bottom: 4px solid #0d6efd;
            padding-bottom: calc(1rem - 3px);
        }

        .feature-sort-handle {
            width: 3.25rem;
            height: 3.25rem;
            border-radius: .9rem;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: rgba(13, 110, 253, 0.08);
            color: #0d6efd;
            font-weight: 700;
            letter-spacing: .12em;
            user-select: none;
            cursor: grab;
            flex-shrink: 0;
            box-shadow: inset 0 0 0 1px rgba(13, 110, 253, 0.08);
        }

        .feature-sort-handle small {
            font-size: .68rem;
            opacity: .7;
        }

        .feature-sort-card-actions {
            display: flex;
            flex-direction: column;
            gap: .35rem;
            flex-shrink: 0;
        }

        .feature-sort-card-actions .btn {
            width: 2.2rem;
            height: 2.2rem;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: .8rem;
            padding: 0;
        }

        .feature-sort-help {
            font-size: .82rem;
            color: #6c757d;
            margin-top: .75rem;
        }
    </style>
@endpush

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            document.querySelectorAll('[data-feature-sortable]').forEach(function (list) {
                let dragging = null;

                const clearDropMarkers = () => {
                    list.querySelectorAll('.drop-before, .drop-after').forEach((card) => {
                        card.classList.remove('drop-before', 'drop-after');
                    });
                };

                const syncCardState = (card) => {
                    const checkbox = card.querySelector('input[type="checkbox"]');
                    card.classList.toggle('is-disabled', !checkbox?.checked);
                };

                list.querySelectorAll('[data-feature-card]').forEach((card) => {
                    syncCardState(card);

                    card.addEventListener('dragstart', function () {
                        dragging = card;
                        card.classList.add('dragging');
                    });

                    card.addEventListener('dragend', function () {
                        card.classList.remove('dragging');
                        dragging = null;
                        clearDropMarkers();
                    });

                    const checkbox = card.querySelector('input[type="checkbox"]');
                    checkbox?.addEventListener('change', function () {
                        syncCardState(card);
                    });

                    card.querySelector('[data-move-up]')?.addEventListener('click', function () {
                        const previous = card.previousElementSibling;

                        if (previous) {
                            list.insertBefore(card, previous);
                        }
                    });

                    card.querySelector('[data-move-down]')?.addEventListener('click', function () {
                        const next = card.nextElementSibling;

                        if (next) {
                            list.insertBefore(next, card);
                        }
                    });
                });

                list.addEventListener('dragover', function (event) {
                    event.preventDefault();
                    clearDropMarkers();

                    const cards = [...list.querySelectorAll('[data-feature-card]:not(.dragging)')];
                    const afterElement = cards.find((card) => {
                        const box = card.getBoundingClientRect();
                        return event.clientY < box.top + box.height / 2;
                    });

                    if (!dragging) {
                        return;
                    }

                    if (!afterElement) {
                        const lastCard = cards[cards.length - 1];

                        if (lastCard) {
                            lastCard.classList.add('drop-after');
                        }

                        list.appendChild(dragging);
                        return;
                    }

                    afterElement.classList.add('drop-before');

                    if (afterElement !== dragging) {
                        list.insertBefore(dragging, afterElement);
                    }
                });

                list.addEventListener('dragleave', function (event) {
                    if (!list.contains(event.relatedTarget)) {
                        clearDropMarkers();
                    }
                });

                list.addEventListener('drop', function () {
                    clearDropMarkers();
                });
            });
        });
    </script>
@endpush

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">{{ $isEdit ? 'ویرایش طیف کاری' : 'افزودن طیف کاری' }}</h5>
                    <p class="text-muted mb-0">برچسب‌های رابط tenant، قابلیت‌ها و تنظیمات دوره‌های تخصصی هر طیف را از همین فرم کنترل کنید.</p>
                </div>
                <div class="card-body">
                    <form method="POST" action="{{ $isEdit ? route('admin.audience-types.update', $audience) : route('admin.audience-types.store') }}">
                        @csrf
                        @if ($isEdit)
                            @method('PUT')
                        @endif

                        <div class="row g-3">
                            <div class="col-md-4">
                                <label class="form-label" for="name">نام طیف</label>
                                <input type="text" id="name" name="name" class="form-control" value="{{ old('name', $audience->name) }}" required>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="singular_label">عنوان مفرد</label>
                                <input type="text" id="singular_label" name="singular_label" class="form-control" value="{{ old('singular_label', $audience->singular_label) }}" required>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="plural_label">عنوان جمع</label>
                                <input type="text" id="plural_label" name="plural_label" class="form-control" value="{{ old('plural_label', $audience->plural_label) }}" required>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="business_label">عنوان کسب‌وکار</label>
                                <input type="text" id="business_label" name="business_label" class="form-control" value="{{ old('business_label', $audience->business_label) }}" required>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="slug">اسلاگ</label>
                                <input type="text" id="slug" name="slug" class="form-control" dir="ltr" value="{{ old('slug', $audience->slug) }}">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="sort_order">ترتیب نمایش</label>
                                <input type="number" min="0" id="sort_order" name="sort_order" class="form-control" value="{{ old('sort_order', $audience->sort_order ?? 0) }}">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="setup_fee_amount">هزینه نصب و راه‌اندازی اولیه</label>
                                <input
                                    type="number"
                                    min="0"
                                    id="setup_fee_amount"
                                    name="setup_fee_amount"
                                    class="form-control"
                                    value="{{ old('setup_fee_amount', $checkoutSetting->setup_fee_amount ?? 0) }}"
                                    placeholder="مثلاً 1000000"
                                >
                                <small class="text-muted">این مبلغ هنگام ایجاد سامانه برای همین طیف، مبنای پورسانت فروش می‌شود.</small>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="setup_fee_label">عنوان هزینه اولیه</label>
                                <input
                                    type="text"
                                    id="setup_fee_label"
                                    name="setup_fee_label"
                                    class="form-control"
                                    value="{{ old('setup_fee_label', $checkoutSetting->setup_fee_label ?? 'هزینه نصب و راه‌اندازی') }}"
                                    placeholder="مثلاً هزینه نصب و راه‌اندازی"
                                >
                            </div>

                            <div class="col-md-6">
                                <label class="form-label d-block">بخش‌های اصلی</label>
                                <div class="border rounded-3 p-3 bg-light-subtle">
                                    <div class="d-flex align-items-center justify-content-between gap-3 mb-3">
                                        <div>
                                            <div class="fw-semibold">امکانات فعال پنل برای این طیف</div>
                                            <div class="text-muted small">این لیست دقیقاً با کارت‌های واقعی پنل هماهنگ است. هر کارت را جابه‌جا کنید تا ترتیب نمایش عوض شود و با خاموش کردن سوییچ همان بخش برای این طیف حذف شود.</div>
                                        </div>
                                        <span class="badge bg-light-primary text-primary">Drag & Drop</span>
                                    </div>
                                    <div class="feature-sort-grid" data-feature-sortable="current">
                                        @foreach ($orderedCurrentFeatures as $key)
                                            @php($feature = $visibleCurrentFeatures[$key] ?? ['label' => $key, 'description' => ''])
                                            <div class="feature-sort-card {{ in_array($key, $selectedCurrentFeatures, true) ? '' : 'is-disabled' }}" draggable="true" data-feature-card>
                                                <div class="d-flex align-items-start justify-content-between gap-3">
                                                    <div class="d-flex align-items-center gap-3">
                                                        <div class="feature-sort-handle">
                                                            <span>::</span>
                                                        </div>
                                                        <div>
                                                            <div class="fw-semibold">{{ $feature['label'] ?? $key }}</div>
                                                            @if (!empty($feature['description']))
                                                                <div class="small text-muted mt-1">{{ $feature['description'] }}</div>
                                                            @endif
                                                            <div class="small text-muted" dir="ltr">{{ $key }}</div>
                                                        </div>
                                                    </div>
                                                    <div class="d-flex align-items-start gap-2">
                                                        <div class="feature-sort-card-actions">
                                                            <button type="button" class="btn btn-light-secondary btn-sm" data-move-up title="جابجایی به بالا">↑</button>
                                                            <button type="button" class="btn btn-light-secondary btn-sm" data-move-down title="جابجایی به پایین">↓</button>
                                                        </div>
                                                        <div class="form-check form-switch m-0">
                                                            <input
                                                                class="form-check-input"
                                                                type="checkbox"
                                                                role="switch"
                                                                name="enabled_features[]"
                                                                id="enabled_features_{{ $key }}"
                                                                value="{{ $key }}"
                                                                @checked(in_array($key, $selectedCurrentFeatures, true))
                                                            >
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        @endforeach
                                    </div>
                                    <div class="feature-sort-help">برای جابه‌جایی، کارت را بکشید یا از کلیدهای بالا و پایین روی هر کارت استفاده کنید.</div>
                                </div>
                            </div>

                            <div class="col-md-6">
                                <label class="form-label d-block">امکانات ویژه</label>
                                <div class="border rounded-3 p-3 bg-light-subtle">
                                    <div class="d-flex align-items-center justify-content-between gap-3 mb-3">
                                        <div>
                                            <div class="fw-semibold">ماژول‌های ویژه قابل خرید برای این طیف</div>
                                            <div class="text-muted small">ماژول‌های پولی همین‌هایی هستند که در بخش امکانات ویژه پنل دیده می‌شوند. می‌توانید برای هر طیف جداگانه فعال یا مخفی‌شان کنید.</div>
                                        </div>
                                        <span class="badge bg-light-warning text-warning">قابل مدیریت</span>
                                    </div>
                                    <div class="feature-sort-grid" data-feature-sortable="special">
                                        @foreach ($orderedSpecialFeatures as $key)
                                            @php($feature = $visibleSpecialFeatures[$key] ?? ['label' => $key, 'description' => ''])
                                            <div class="feature-sort-card {{ in_array($key, $selectedFutureFeatures, true) ? '' : 'is-disabled' }}" draggable="true" data-feature-card>
                                                <div class="d-flex align-items-start justify-content-between gap-3">
                                                    <div class="d-flex align-items-center gap-3">
                                                        <div class="feature-sort-handle">
                                                            <span>::</span>
                                                        </div>
                                                        <div>
                                                            <div class="fw-semibold">{{ $feature['label'] ?? $key }}</div>
                                                            @if (!empty($feature['description']))
                                                                <div class="small text-muted mt-1">{{ $feature['description'] }}</div>
                                                            @endif
                                                            <div class="small text-muted" dir="ltr">{{ $key }}</div>
                                                        </div>
                                                    </div>
                                                    <div class="d-flex align-items-start gap-2">
                                                        <div class="feature-sort-card-actions">
                                                            <button type="button" class="btn btn-light-secondary btn-sm" data-move-up title="جابجایی به بالا">↑</button>
                                                            <button type="button" class="btn btn-light-secondary btn-sm" data-move-down title="جابجایی به پایین">↓</button>
                                                        </div>
                                                        <div class="form-check form-switch m-0">
                                                            <input
                                                                class="form-check-input"
                                                                type="checkbox"
                                                                role="switch"
                                                                name="future_features[]"
                                                                id="future_features_{{ $key }}"
                                                                value="{{ $key }}"
                                                                @checked(in_array($key, $selectedFutureFeatures, true))
                                                            >
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        @endforeach
                                    </div>
                                    <div class="feature-sort-help">برای جابه‌جایی سریع‌تر، می‌توانید از فلش‌های هر کارت هم استفاده کنید.</div>
                                </div>
                            </div>

                            @if (count($orderedNutritionFeatures) > 0)
                                <div class="col-12">
                                    <label class="form-label d-block">بخش رژیم درمانی</label>
                                    <div class="border rounded-3 p-3 bg-light-subtle">
                                        <div class="d-flex align-items-center justify-content-between gap-3 mb-3">
                                            <div>
                                                <div class="fw-semibold">ابزارهای اختصاصی رژیم درمانی برای این طیف</div>
                                                <div class="text-muted small">این بخش فقط برای طیف‌های تغذیه نمایش داده می‌شود و ترتیب کارت‌های آن روی داشبورد همین طیف اثر مستقیم دارد.</div>
                                            </div>
                                            <span class="badge bg-light-success text-success">ویژه تغذیه</span>
                                        </div>
                                        <div class="feature-sort-grid" data-feature-sortable="nutrition">
                                            @foreach ($orderedNutritionFeatures as $key)
                                                @php($feature = $visibleNutritionFeatures[$key] ?? ['label' => $key, 'description' => ''])
                                                <div class="feature-sort-card {{ in_array($key, $selectedNutritionFeatures, true) ? '' : 'is-disabled' }}" draggable="true" data-feature-card>
                                                    <div class="d-flex align-items-start justify-content-between gap-3">
                                                        <div class="d-flex align-items-center gap-3">
                                                            <div class="feature-sort-handle">
                                                                <span>::</span>
                                                            </div>
                                                            <div>
                                                                <div class="fw-semibold">{{ $feature['label'] ?? $key }}</div>
                                                                @if (!empty($feature['description']))
                                                                    <div class="small text-muted mt-1">{{ $feature['description'] }}</div>
                                                                @endif
                                                                <div class="small text-muted" dir="ltr">{{ $key }}</div>
                                                            </div>
                                                        </div>
                                                        <div class="d-flex align-items-start gap-2">
                                                            <div class="feature-sort-card-actions">
                                                                <button type="button" class="btn btn-light-secondary btn-sm" data-move-up title="جابجایی به بالا">↑</button>
                                                                <button type="button" class="btn btn-light-secondary btn-sm" data-move-down title="جابجایی به پایین">↓</button>
                                                            </div>
                                                            <div class="form-check form-switch m-0">
                                                                <input
                                                                    class="form-check-input"
                                                                    type="checkbox"
                                                                    role="switch"
                                                                    name="nutrition_features[]"
                                                                    id="nutrition_features_{{ $key }}"
                                                                    value="{{ $key }}"
                                                                    @checked(in_array($key, $selectedNutritionFeatures, true))
                                                                >
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            @endforeach
                                        </div>
                                        <div class="feature-sort-help">این کارت‌ها فقط برای پنل کارشناس تغذیه و پزشک تغذیه نمایش داده می‌شوند.</div>
                                    </div>
                                </div>
                            @endif

                            <div class="col-12">
                                <label class="form-label d-block">امکانات بعدی</label>
                                <div class="border rounded-3 p-3 bg-light-subtle">
                                    <div class="d-flex align-items-center justify-content-between gap-3 mb-3">
                                        <div>
                                            <div class="fw-semibold">بخش‌های آینده این طیف</div>
                                            <div class="text-muted small">این لیست مطابق کارت‌های بخش امکانات بعدی در پنل است. برای هر طیف می‌توانید مشخص کنید چه گزینه‌هایی بعداً به آن ارائه شوند.</div>
                                        </div>
                                        <span class="badge bg-light-secondary text-secondary">برنامه رشد</span>
                                    </div>
                                    <div class="feature-sort-grid" data-feature-sortable="future">
                                        @foreach ($orderedFutureFeatures as $key)
                                            @php($feature = $visibleFutureFeatures[$key] ?? ['label' => $key, 'description' => ''])
                                            <div class="feature-sort-card {{ in_array($key, $selectedFutureFeatures, true) ? '' : 'is-disabled' }}" draggable="true" data-feature-card>
                                                <div class="d-flex align-items-start justify-content-between gap-3">
                                                    <div class="d-flex align-items-center gap-3">
                                                        <div class="feature-sort-handle">
                                                            <span>::</span>
                                                        </div>
                                                        <div>
                                                            <div class="fw-semibold">{{ $feature['label'] ?? $key }}</div>
                                                            @if (!empty($feature['description']))
                                                                <div class="small text-muted mt-1">{{ $feature['description'] }}</div>
                                                            @endif
                                                            <div class="small text-muted" dir="ltr">{{ $key }}</div>
                                                        </div>
                                                    </div>
                                                    <div class="d-flex align-items-start gap-2">
                                                        <div class="feature-sort-card-actions">
                                                            <button type="button" class="btn btn-light-secondary btn-sm" data-move-up title="جابجایی به بالا">↑</button>
                                                            <button type="button" class="btn btn-light-secondary btn-sm" data-move-down title="جابجایی به پایین">↓</button>
                                                        </div>
                                                        <div class="form-check form-switch m-0">
                                                            <input
                                                                class="form-check-input"
                                                                type="checkbox"
                                                                role="switch"
                                                                name="future_features[]"
                                                                id="future_features_{{ $key }}"
                                                                value="{{ $key }}"
                                                                @checked(in_array($key, $selectedFutureFeatures, true))
                                                            >
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        @endforeach
                                    </div>
                                    <div class="feature-sort-help">خط آبی جای افتادن کارت را نشان می‌دهد تا جابه‌جایی واضح‌تر باشد.</div>
                                </div>
                            </div>

                            <div class="col-12">
                                <div class="border rounded-3 p-3 p-lg-4 bg-light">
                                    <div class="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3 mb-4">
                                        <div>
                                            <h5 class="mb-1">تنظیمات دوره‌های تخصصی</h5>
                                            <p class="text-muted mb-0">همه متن‌های ثابت، FAQها و فعال یا غیرفعال بودن سکشن‌های صفحه دوره‌های تخصصی را برای همین طیف از اینجا مدیریت کنید.</p>
                                        </div>
                                        <div class="d-flex flex-wrap gap-2">
                                            <span class="badge bg-light-primary text-primary">ویژه همین طیف</span>
                                            @if ($isEdit && $audience->exists)
                                                <a href="{{ route('admin.specialized-course-settings.edit', $audience) }}" class="btn btn-sm btn-light-primary">باز کردن در صفحه مستقل</a>
                                            @endif
                                        </div>
                                    </div>

                                    @include('admin.specialized-course-settings.partials.form-fields', [
                                        'specializedCourseSettings' => $specializedCourseSettings,
                                        'isStandalonePage' => false,
                                    ])
                                </div>
                            </div>

                            <div class="col-12">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" role="switch" id="is_active" name="is_active" value="1" @checked(old('is_active', $audience->is_active))>
                                    <label class="form-check-label" for="is_active">فعال باشد</label>
                                </div>
                            </div>
                        </div>

                        <div class="mt-4 d-flex gap-2">
                            <button type="submit" class="btn btn-primary">{{ $isEdit ? 'ذخیره تغییرات' : 'ذخیره طیف' }}</button>
                            <a href="{{ route('admin.audience-types.index') }}" class="btn btn-light-secondary">بازگشت</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
@endsection
