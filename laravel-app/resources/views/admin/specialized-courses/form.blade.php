@extends('admin.layouts.app')

@section('title', $isEdit ? __('admin.specialized_courses.form.edit_title') : __('admin.specialized_courses.form.create_title'))

@push('styles')
    @vite('resources/js/admin-specialized-courses.js')
    <style>
        .course-date-input {
            width: 100%;
            background-color: #fff;
            cursor: pointer;
        }

        .select2-container {
            width: 100% !important;
        }

        .select2-container .select2-selection--single {
            height: calc(2.75rem + 2px);
            border: 1px solid #dbe0e5;
            border-radius: 8px;
            display: flex;
            align-items: center;
            padding: 0 0.75rem;
        }

        .select2-container--default .select2-selection--single .select2-selection__rendered {
            line-height: 1.5;
            padding-inline: 0;
        }

        .select2-container--default .select2-selection--single .select2-selection__arrow {
            height: 100%;
            inset-inline-end: 10px;
            inset-inline-start: auto;
        }

        .select2-dropdown {
            border: 1px solid #dbe0e5;
            border-radius: 8px;
        }

        .select2-search--dropdown .select2-search__field {
            border: 1px solid #dbe0e5;
            border-radius: 8px;
        }
    </style>
@endpush

@php
    $courseSections = old('sections');
    if ($courseSections === null) {
        $courseSections = $course->relationLoaded('sections')
            ? $course->sections->map(fn ($section) => [
                'title' => $section->title,
                'description' => $section->description,
                'is_active' => $section->is_active,
                'lessons' => $section->lessons->map(fn ($lesson) => [
                    'title' => $lesson->title,
                    'description' => $lesson->description,
                    'duration_seconds' => $lesson->duration_seconds,
                    'duration_label' => $lesson->duration_label,
                    'is_free' => $lesson->is_free,
                    'is_active' => $lesson->is_active,
                ])->all(),
            ])->all()
            : [];
    }

    if (count($courseSections) === 0) {
        $courseSections = [[
            'title' => __('admin.specialized_courses.form.default_section_title'),
            'description' => '',
            'is_active' => true,
            'lessons' => [[
                'title' => __('admin.specialized_courses.form.default_lesson_title'),
                'description' => '',
                'duration_seconds' => '',
                'duration_label' => '',
                'is_free' => true,
                'is_active' => true,
            ]],
        ]];
    }
@endphp

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            const sectionsWrapper = document.getElementById('sections-wrapper');
            const addSectionButton = document.getElementById('add-section-button');
            const sectionTemplate = document.getElementById('section-template').innerHTML;
            const lessonTemplate = document.getElementById('lesson-template').innerHTML;
            const uploadSelectedText = @js(__('admin.specialized_courses.form.upload_selected'));
            const uploadEmptyText = @js(__('admin.specialized_courses.form.upload_empty'));
            const uploadSubmittingText = @js(__('admin.specialized_courses.form.upload_submitting'));

            const refreshIndexes = () => {
                sectionsWrapper.querySelectorAll('[data-section-item]').forEach((sectionEl, sectionIndex) => {
                    sectionEl.querySelectorAll('[data-name-template]').forEach((field) => {
                        field.name = field.dataset.nameTemplate
                            .replaceAll('__SECTION_INDEX__', sectionIndex)
                            .replaceAll('__LESSON_INDEX__', field.closest('[data-lesson-item]')?.dataset.lessonIndex ?? '0');
                    });

                    sectionEl.querySelectorAll('[data-id-template]').forEach((field) => {
                        field.id = field.dataset.idTemplate.replaceAll('__SECTION_INDEX__', sectionIndex);
                    });

                    sectionEl.querySelectorAll('[data-for-template]').forEach((field) => {
                        field.htmlFor = field.dataset.forTemplate.replaceAll('__SECTION_INDEX__', sectionIndex);
                    });

                    sectionEl.querySelectorAll('[data-lesson-item]').forEach((lessonEl, lessonIndex) => {
                        lessonEl.dataset.lessonIndex = lessonIndex;
                        lessonEl.querySelectorAll('[data-name-template]').forEach((field) => {
                            field.name = field.dataset.nameTemplate
                                .replaceAll('__SECTION_INDEX__', sectionIndex)
                                .replaceAll('__LESSON_INDEX__', lessonIndex);
                        });
                    });
                });
            };

            const bindUploadState = (root) => {
                root.querySelectorAll('[data-upload-input]').forEach((input) => {
                    input.addEventListener('change', function () {
                        const status = this.closest('[data-upload-box]')?.querySelector('[data-upload-status]');
                        if (!status) return;

                        if (this.files && this.files.length > 0) {
                            status.textContent = uploadSelectedText;
                            status.classList.remove('text-muted');
                            status.classList.add('text-success');
                        } else {
                            status.textContent = uploadEmptyText;
                            status.classList.remove('text-success');
                            status.classList.add('text-muted');
                        }
                    });
                });
            };

            const bindSectionActions = (sectionEl) => {
                sectionEl.querySelector('[data-remove-section]')?.addEventListener('click', function () {
                    sectionEl.remove();
                    refreshIndexes();
                });

                sectionEl.querySelector('[data-add-lesson]')?.addEventListener('click', function () {
                    const lessonsWrapper = sectionEl.querySelector('[data-lessons-wrapper]');
                    const lessonHtml = lessonTemplate;
                    lessonsWrapper.insertAdjacentHTML('beforeend', lessonHtml);
                    const lessonEl = lessonsWrapper.lastElementChild;
                    bindLessonActions(lessonEl);
                    bindUploadState(lessonEl);
                    refreshIndexes();
                });

                sectionEl.querySelectorAll('[data-lesson-item]').forEach((lessonEl) => {
                    bindLessonActions(lessonEl);
                });

                bindUploadState(sectionEl);
            };

            const bindLessonActions = (lessonEl) => {
                lessonEl.querySelector('[data-remove-lesson]')?.addEventListener('click', function () {
                    lessonEl.remove();
                    refreshIndexes();
                });
            };

            addSectionButton?.addEventListener('click', function () {
                sectionsWrapper.insertAdjacentHTML('beforeend', sectionTemplate);
                const sectionEl = sectionsWrapper.lastElementChild;
                bindSectionActions(sectionEl);
                refreshIndexes();
            });

            sectionsWrapper.querySelectorAll('[data-section-item]').forEach((sectionEl) => bindSectionActions(sectionEl));

            document.getElementById('course-form')?.addEventListener('submit', function () {
                document.querySelectorAll('[data-upload-status]').forEach((status) => {
                    if (status.closest('[data-upload-box]')?.querySelector('input[type="file"]')?.files?.length) {
                        status.textContent = uploadSubmittingText;
                        status.classList.remove('text-muted');
                        status.classList.add('text-warning');
                    }
                });
            });

            refreshIndexes();
        });
    </script>
@endpush

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">{{ $isEdit ? __('admin.specialized_courses.form.edit_heading') : __('admin.specialized_courses.form.create_heading') }}</h5>
                    <p class="text-muted mb-0">{{ __('admin.specialized_courses.form.description') }}</p>
                </div>
                <div class="card-body">
                    <form id="course-form" method="POST" enctype="multipart/form-data" action="{{ $isEdit ? route('admin.specialized-courses.update', $course) : route('admin.specialized-courses.store') }}">
                        @csrf
                        @if ($isEdit)
                            @method('PUT')
                        @endif

                        <div class="row g-3">
                            <div class="col-md-6">
                                <label class="form-label" for="title">{{ __('admin.specialized_courses.form.fields.title') }}</label>
                                <input type="text" class="form-control" id="title" name="title" value="{{ old('title', $course->title) }}" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="subtitle">{{ __('admin.specialized_courses.form.fields.subtitle') }}</label>
                                <input type="text" class="form-control" id="subtitle" name="subtitle" value="{{ old('subtitle', $course->subtitle) }}">
                            </div>

                            <div class="col-md-6">
                                <label class="form-label" for="slug">{{ __('admin.specialized_courses.form.fields.slug') }}</label>
                                <input type="text" class="form-control" id="slug" name="slug" value="{{ old('slug', $course->slug) }}" dir="ltr">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="teacher_user_id">{{ __('admin.specialized_courses.form.fields.teacher') }}</label>
                                <select class="form-select" id="teacher_user_id" name="teacher_user_id" {{ auth()->user()->role === 'teacher' ? 'disabled' : '' }}>
                                    <option value="">{{ __('admin.common.select') }}</option>
                                    @foreach($teachers as $teacher)
                                        <option value="{{ $teacher->id }}" @selected((string) old('teacher_user_id', $course->teacher_user_id) === (string) $teacher->id)>
                                            {{ $teacher->name }} - {{ $teacher->mobile }}
                                            ({{ __('admin.specialized_course_reports.commission.direct_percent', ['percent' => __('admin.specialized_courses.percent_value', ['value' => rtrim(rtrim(number_format((float) ($teacher->sales_commission_percent ?? 0), 2, '.', ''), '0'), '.') ?: '0'])]) }}
                                            | {{ __('admin.specialized_course_reports.commission.indirect_percent', ['percent' => __('admin.specialized_courses.percent_value', ['value' => rtrim(rtrim(number_format((float) ($teacher->teacherProfile?->commission_percent ?? 0), 2, '.', ''), '0'), '.') ?: '0'])]) }})
                                        </option>
                                    @endforeach
                                </select>
                                @if(auth()->user()->role === 'teacher')
                                    <input type="hidden" name="teacher_user_id" value="{{ auth()->id() }}">
                                @endif
                                @if(auth()->user()->role === 'teacher')
                                    <small class="text-muted d-block mt-2">{{ __('admin.specialized_courses.form.teacher_locked_help') }}</small>
                                @endif
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="audience_type_id">{{ __('admin.specialized_courses.form.fields.audience') }}</label>
                                <select class="form-select" id="audience_type_id" name="audience_type_id" required>
                                    <option value="">{{ __('admin.common.select') }}</option>
                                    @foreach($audiences as $audience)
                                        <option value="{{ $audience->id }}" @selected((string) old('audience_type_id', $course->audience_type_id) === (string) $audience->id)>{{ $audience->name }}</option>
                                    @endforeach
                                </select>
                                <small class="text-muted d-block mt-2">{{ __('admin.specialized_courses.form.audience_help') }}</small>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="specialized_course_category_id">{{ __('admin.specialized_courses.form.fields.category') }}</label>
                                <select class="form-select" id="specialized_course_category_id" name="specialized_course_category_id">
                                    <option value="">{{ __('admin.specialized_courses.form.no_category') }}</option>
                                    @foreach($categories as $category)
                                        <option value="{{ $category->id }}" data-audience-id="{{ $category->audience_type_id }}" @selected((string) old('specialized_course_category_id', $course->categoryAssignment?->specialized_course_category_id) === (string) $category->id)>
                                            {{ $category->name }}{{ $category->audienceType?->name ? ' - ' . $category->audienceType->name : '' }}
                                        </option>
                                    @endforeach
                                </select>
                                <small class="text-muted d-block mt-2" id="category_audience_hint">{{ __('admin.specialized_courses.form.category_help') }}</small>
                            </div>

                            <div class="col-md-4">
                                <label class="form-label" for="price_amount">{{ __('admin.specialized_courses.form.fields.price') }}</label>
                                <input type="number" min="0" class="form-control" id="price_amount" name="price_amount" value="{{ old('price_amount', $course->price_amount ?? 0) }}" required>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="sale_price_amount">{{ __('admin.specialized_courses.form.fields.sale_price') }}</label>
                                <input type="number" min="0" class="form-control" id="sale_price_amount" name="sale_price_amount" value="{{ old('sale_price_amount', $course->sale_price_amount) }}">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label d-block" for="discount_ends_at_display">{{ __('admin.specialized_courses.form.fields.discount_ends_at') }}</label>
                                <input
                                    type="text"
                                    class="form-control course-date-input"
                                    id="discount_ends_at_display"
                                    placeholder="{{ __('admin.specialized_courses.form.discount_ends_at_placeholder') }}"
                                    autocomplete="off"
                                    data-jdp
                                    data-jdp-only-date
                                >
                                <input
                                    type="hidden"
                                    id="discount_ends_at"
                                    name="discount_ends_at"
                                    value="{{ old('discount_ends_at', $course->discount_ends_at?->format('Y-m-d H:i:s')) }}"
                                >
                                <small class="text-muted d-block mt-2">{{ __('admin.specialized_courses.form.discount_ends_at_help') }}</small>
                            </div>

                            <div class="col-md-3">
                                <label class="form-label" for="manual_students_count">{{ __('admin.specialized_courses.form.fields.manual_students_count') }}</label>
                                <input type="number" min="0" class="form-control" id="manual_students_count" name="manual_students_count" value="{{ old('manual_students_count', $course->manual_students_count ?? 0) }}">
                            </div>
                            <div class="col-md-3">
                                <label class="form-label" for="reviews_count">{{ __('admin.specialized_courses.form.fields.reviews_count') }}</label>
                                <input type="number" min="0" class="form-control" id="reviews_count" name="reviews_count" value="{{ old('reviews_count', $course->reviews_count ?? 0) }}">
                            </div>
                            <div class="col-md-3">
                                <label class="form-label" for="rating_average">{{ __('admin.specialized_courses.form.fields.rating_average') }}</label>
                                <input type="number" step="0.01" min="0" max="5" class="form-control" id="rating_average" name="rating_average" value="{{ old('rating_average', $course->rating_average ?? 0) }}">
                            </div>
                            <div class="col-md-3">
                                <label class="form-label" for="preview_duration_seconds">{{ __('admin.specialized_courses.form.fields.preview_duration_seconds') }}</label>
                                <input type="number" min="0" class="form-control" id="preview_duration_seconds" name="preview_duration_seconds" value="{{ old('preview_duration_seconds', $course->preview_duration_seconds) }}">
                            </div>

                            <div class="col-12">
                                <label class="form-label" for="excerpt">{{ __('admin.specialized_courses.form.fields.excerpt') }}</label>
                                <textarea class="form-control" id="excerpt" name="excerpt" rows="2">{{ old('excerpt', $course->excerpt) }}</textarea>
                            </div>
                            <div class="col-12">
                                <label class="form-label" for="description">{{ __('admin.specialized_courses.form.fields.description') }}</label>
                                <textarea class="form-control" id="description" name="description" rows="4">{{ old('description', $course->description) }}</textarea>
                            </div>
                            <div class="col-12">
                                <label class="form-label" for="about">{{ __('admin.specialized_courses.form.fields.about') }}</label>
                                <textarea class="form-control" id="about" name="about" rows="4">{{ old('about', $course->about) }}</textarea>
                            </div>

                            <div class="col-md-4">
                                <label class="form-label" for="learning_points_text">{{ __('admin.specialized_courses.form.fields.learning_points') }}</label>
                                <textarea class="form-control" id="learning_points_text" name="learning_points_text" rows="5">{{ old('learning_points_text', implode(PHP_EOL, $course->learning_points ?? [])) }}</textarea>
                                <small class="text-muted">{{ __('admin.specialized_courses.form.one_item_per_line') }}</small>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="requirements_text">{{ __('admin.specialized_courses.form.fields.requirements') }}</label>
                                <textarea class="form-control" id="requirements_text" name="requirements_text" rows="5">{{ old('requirements_text', implode(PHP_EOL, $course->requirements ?? [])) }}</textarea>
                                <small class="text-muted">{{ __('admin.specialized_courses.form.one_item_per_line') }}</small>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="faq_text">{{ __('admin.specialized_courses.form.fields.faq') }}</label>
                                <textarea class="form-control" id="faq_text" name="faq_text" rows="5">{{ old('faq_text', collect($course->faq_items ?? [])->map(fn($item) => ($item['question'] ?? '').'|'.($item['answer'] ?? ''))->implode(PHP_EOL)) }}</textarea>
                                <small class="text-muted">{{ __('admin.specialized_courses.form.faq_help') }}</small>
                            </div>

                            <div class="col-md-4" data-upload-box>
                                <label class="form-label" for="cover_image">{{ __('admin.specialized_courses.form.fields.cover_image') }}</label>
                                <input type="file" class="form-control" id="cover_image" name="cover_image" accept="image/*" data-upload-input>
                                <small class="text-muted" data-upload-status>{{ $course->cover_image_path ? __('admin.specialized_courses.form.upload_existing') : __('admin.specialized_courses.form.upload_empty') }}</small>
                            </div>
                            <div class="col-md-4" data-upload-box>
                                <label class="form-label" for="hero_image">{{ __('admin.specialized_courses.form.fields.hero_image') }}</label>
                                <input type="file" class="form-control" id="hero_image" name="hero_image" accept="image/*" data-upload-input>
                                <small class="text-muted" data-upload-status>{{ $course->hero_image_path ? __('admin.specialized_courses.form.upload_existing') : __('admin.specialized_courses.form.upload_empty') }}</small>
                            </div>
                            <div class="col-md-4" data-upload-box>
                                <label class="form-label" for="preview_video">{{ __('admin.specialized_courses.form.fields.preview_video') }}</label>
                                <input type="file" class="form-control" id="preview_video" name="preview_video" accept="video/*" data-upload-input>
                                <small class="text-muted" data-upload-status>{{ $course->preview_video_path ? __('admin.specialized_courses.form.upload_existing') : __('admin.specialized_courses.form.upload_empty') }}</small>
                            </div>

                            <div class="col-md-3">
                                <div class="form-check form-switch mt-4">
                                    <input class="form-check-input" type="checkbox" value="1" id="is_active" name="is_active" @checked(old('is_active', $course->is_active))>
                                    <label class="form-check-label" for="is_active">{{ __('admin.specialized_courses.form.fields.is_active') }}</label>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="form-check form-switch mt-4">
                                    <input class="form-check-input" type="checkbox" value="1" id="is_published" name="is_published" @checked(old('is_published', $course->is_published))>
                                    <label class="form-check-label" for="is_published">{{ __('admin.specialized_courses.form.fields.is_published') }}</label>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label" for="sort_order">{{ __('admin.specialized_courses.form.fields.sort_order') }}</label>
                                <input type="number" min="0" class="form-control" id="sort_order" name="sort_order" value="{{ old('sort_order', $course->sort_order ?? 0) }}">
                            </div>
                        </div>

                        <hr class="my-4">

                        <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-3">
                            <div>
                                <h5 class="mb-1">{{ __('admin.specialized_courses.form.curriculum_title') }}</h5>
                                <p class="text-muted mb-0">{{ __('admin.specialized_courses.form.curriculum_description') }}</p>
                            </div>
                            <button type="button" class="btn btn-light-primary" id="add-section-button">{{ __('admin.specialized_courses.form.add_section') }}</button>
                        </div>

                        <div id="sections-wrapper" class="d-flex flex-column gap-3">
                            @foreach($courseSections as $sectionIndex => $section)
                                <div class="border rounded-3 p-3 bg-light" data-section-item>
                                    <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                                        <h6 class="mb-0">{{ __('admin.specialized_courses.form.section') }}</h6>
                                        <button type="button" class="btn btn-sm btn-light-danger" data-remove-section>{{ __('admin.specialized_courses.form.remove_section') }}</button>
                                    </div>
                                    <div class="row g-3">
                                        <div class="col-md-5">
                                            <label class="form-label">{{ __('admin.specialized_courses.form.fields.section_title') }}</label>
                                            <input type="text" class="form-control" value="{{ $section['title'] ?? '' }}" data-name-template="sections[__SECTION_INDEX__][title]" required>
                                        </div>
                                        <div class="col-md-5">
                                            <label class="form-label">{{ __('admin.specialized_courses.form.fields.section_description') }}</label>
                                            <input type="text" class="form-control" value="{{ $section['description'] ?? '' }}" data-name-template="sections[__SECTION_INDEX__][description]">
                                        </div>
                                        <div class="col-md-2 d-flex align-items-end">
                                            <div class="form-check form-switch">
                                                <input class="form-check-input" type="checkbox" value="1" @checked($section['is_active'] ?? false) data-name-template="sections[__SECTION_INDEX__][is_active]">
                                                <label class="form-check-label">{{ __('admin.specialized_courses.form.active') }}</label>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="mt-4 d-flex align-items-center justify-content-between gap-2 flex-wrap">
                                        <h6 class="mb-0">{{ __('admin.specialized_courses.form.section_lessons') }}</h6>
                                        <button type="button" class="btn btn-sm btn-light-primary" data-add-lesson>{{ __('admin.specialized_courses.form.add_lesson') }}</button>
                                    </div>

                                    <div class="mt-3 d-flex flex-column gap-3" data-lessons-wrapper>
                                        @foreach(($section['lessons'] ?? []) as $lessonIndex => $lesson)
                                            <div class="border rounded-3 p-3 bg-white" data-lesson-item data-lesson-index="{{ $lessonIndex }}">
                                                <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                                                    <strong>{{ __('admin.specialized_courses.form.lesson') }}</strong>
                                                    <button type="button" class="btn btn-sm btn-light-danger" data-remove-lesson>{{ __('admin.specialized_courses.form.remove_lesson') }}</button>
                                                </div>
                                                <div class="row g-3">
                                                    <div class="col-md-4">
                                                        <label class="form-label">{{ __('admin.specialized_courses.form.fields.lesson_title') }}</label>
                                                        <input type="text" class="form-control" value="{{ $lesson['title'] ?? '' }}" data-name-template="sections[__SECTION_INDEX__][lessons][__LESSON_INDEX__][title]" required>
                                                    </div>
                                                    <div class="col-md-4">
                                                        <label class="form-label">{{ __('admin.specialized_courses.form.fields.duration_label') }}</label>
                                                        <input type="text" class="form-control" value="{{ $lesson['duration_label'] ?? '' }}" data-name-template="sections[__SECTION_INDEX__][lessons][__LESSON_INDEX__][duration_label]">
                                                    </div>
                                                    <div class="col-md-4">
                                                        <label class="form-label">{{ __('admin.specialized_courses.form.fields.duration_seconds') }}</label>
                                                        <input type="number" min="0" class="form-control" value="{{ $lesson['duration_seconds'] ?? '' }}" data-name-template="sections[__SECTION_INDEX__][lessons][__LESSON_INDEX__][duration_seconds]">
                                                    </div>
                                                    <div class="col-md-8">
                                                        <label class="form-label">{{ __('admin.specialized_courses.form.fields.lesson_description') }}</label>
                                                        <input type="text" class="form-control" value="{{ $lesson['description'] ?? '' }}" data-name-template="sections[__SECTION_INDEX__][lessons][__LESSON_INDEX__][description]">
                                                    </div>
                                                    <div class="col-md-4" data-upload-box>
                                                        <label class="form-label">{{ __('admin.specialized_courses.form.fields.lesson_video') }}</label>
                                                        <input type="file" class="form-control" accept="video/*" data-upload-input data-name-template="sections[__SECTION_INDEX__][lessons][__LESSON_INDEX__][video]">
                                                        <small class="text-muted" data-upload-status>{{ __('admin.specialized_courses.form.upload_empty') }}</small>
                                                    </div>
                                                    <div class="col-md-6 d-flex align-items-end">
                                                        <div class="form-check form-switch">
                                                            <input class="form-check-input" type="checkbox" value="1" @checked($lesson['is_free'] ?? false) data-name-template="sections[__SECTION_INDEX__][lessons][__LESSON_INDEX__][is_free]">
                                                            <label class="form-check-label">{{ __('admin.specialized_courses.form.fields.is_free') }}</label>
                                                        </div>
                                                    </div>
                                                    <div class="col-md-6 d-flex align-items-end">
                                                        <div class="form-check form-switch">
                                                            <input class="form-check-input" type="checkbox" value="1" @checked($lesson['is_active'] ?? false) data-name-template="sections[__SECTION_INDEX__][lessons][__LESSON_INDEX__][is_active]">
                                                            <label class="form-check-label">{{ __('admin.specialized_courses.form.fields.is_active') }}</label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        @endforeach
                                    </div>
                                </div>
                            @endforeach
                        </div>

                        <div class="mt-4 d-flex gap-2">
                            <button type="submit" class="btn btn-primary">{{ $isEdit ? __('admin.specialized_courses.form.save_changes') : __('admin.specialized_courses.form.save_course') }}</button>
                            <a href="{{ route('admin.specialized-courses.index') }}" class="btn btn-light-secondary">{{ __('admin.specialized_courses.form.back') }}</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <template id="section-template">
        <div class="border rounded-3 p-3 bg-light" data-section-item>
            <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                <h6 class="mb-0">{{ __('admin.specialized_courses.form.section') }}</h6>
                <button type="button" class="btn btn-sm btn-light-danger" data-remove-section>{{ __('admin.specialized_courses.form.remove_section') }}</button>
            </div>
            <div class="row g-3">
                <div class="col-md-5">
                    <label class="form-label">{{ __('admin.specialized_courses.form.fields.section_title') }}</label>
                    <input type="text" class="form-control" data-name-template="sections[__SECTION_INDEX__][title]" required>
                </div>
                <div class="col-md-5">
                    <label class="form-label">{{ __('admin.specialized_courses.form.fields.section_description') }}</label>
                    <input type="text" class="form-control" data-name-template="sections[__SECTION_INDEX__][description]">
                </div>
                <div class="col-md-2 d-flex align-items-end">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" value="1" checked data-name-template="sections[__SECTION_INDEX__][is_active]">
                        <label class="form-check-label">{{ __('admin.specialized_courses.form.active') }}</label>
                    </div>
                </div>
            </div>

            <div class="mt-4 d-flex align-items-center justify-content-between gap-2 flex-wrap">
                <h6 class="mb-0">{{ __('admin.specialized_courses.form.section_lessons') }}</h6>
                <button type="button" class="btn btn-sm btn-light-primary" data-add-lesson>{{ __('admin.specialized_courses.form.add_lesson') }}</button>
            </div>

            <div class="mt-3 d-flex flex-column gap-3" data-lessons-wrapper>
                <div class="border rounded-3 p-3 bg-white" data-lesson-item data-lesson-index="0">
                    <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                        <strong>{{ __('admin.specialized_courses.form.lesson') }}</strong>
                        <button type="button" class="btn btn-sm btn-light-danger" data-remove-lesson>{{ __('admin.specialized_courses.form.remove_lesson') }}</button>
                    </div>
                    <div class="row g-3">
                        <div class="col-md-4">
                            <label class="form-label">{{ __('admin.specialized_courses.form.fields.lesson_title') }}</label>
                            <input type="text" class="form-control" data-name-template="sections[__SECTION_INDEX__][lessons][__LESSON_INDEX__][title]" required>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label">{{ __('admin.specialized_courses.form.fields.duration_label') }}</label>
                            <input type="text" class="form-control" data-name-template="sections[__SECTION_INDEX__][lessons][__LESSON_INDEX__][duration_label]">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label">{{ __('admin.specialized_courses.form.fields.duration_seconds') }}</label>
                            <input type="number" min="0" class="form-control" data-name-template="sections[__SECTION_INDEX__][lessons][__LESSON_INDEX__][duration_seconds]">
                        </div>
                        <div class="col-md-8">
                            <label class="form-label">{{ __('admin.specialized_courses.form.fields.lesson_description') }}</label>
                            <input type="text" class="form-control" data-name-template="sections[__SECTION_INDEX__][lessons][__LESSON_INDEX__][description]">
                        </div>
                        <div class="col-md-4" data-upload-box>
                            <label class="form-label">{{ __('admin.specialized_courses.form.fields.lesson_video') }}</label>
                            <input type="file" class="form-control" accept="video/*" data-upload-input data-name-template="sections[__SECTION_INDEX__][lessons][__LESSON_INDEX__][video]">
                            <small class="text-muted" data-upload-status>{{ __('admin.specialized_courses.form.upload_empty') }}</small>
                        </div>
                        <div class="col-md-6 d-flex align-items-end">
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" value="1" data-name-template="sections[__SECTION_INDEX__][lessons][__LESSON_INDEX__][is_free]">
                                <label class="form-check-label">{{ __('admin.specialized_courses.form.fields.is_free') }}</label>
                            </div>
                        </div>
                        <div class="col-md-6 d-flex align-items-end">
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" value="1" checked data-name-template="sections[__SECTION_INDEX__][lessons][__LESSON_INDEX__][is_active]">
                                <label class="form-check-label">{{ __('admin.specialized_courses.form.fields.is_active') }}</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </template>

    <template id="lesson-template">
        <div class="border rounded-3 p-3 bg-white" data-lesson-item data-lesson-index="0">
            <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                <strong>{{ __('admin.specialized_courses.form.lesson') }}</strong>
                <button type="button" class="btn btn-sm btn-light-danger" data-remove-lesson>{{ __('admin.specialized_courses.form.remove_lesson') }}</button>
            </div>
            <div class="row g-3">
                <div class="col-md-4">
                    <label class="form-label">{{ __('admin.specialized_courses.form.fields.lesson_title') }}</label>
                    <input type="text" class="form-control" data-name-template="sections[__SECTION_INDEX__][lessons][__LESSON_INDEX__][title]" required>
                </div>
                <div class="col-md-4">
                    <label class="form-label">{{ __('admin.specialized_courses.form.fields.duration_label') }}</label>
                    <input type="text" class="form-control" data-name-template="sections[__SECTION_INDEX__][lessons][__LESSON_INDEX__][duration_label]">
                </div>
                <div class="col-md-4">
                    <label class="form-label">{{ __('admin.specialized_courses.form.fields.duration_seconds') }}</label>
                    <input type="number" min="0" class="form-control" data-name-template="sections[__SECTION_INDEX__][lessons][__LESSON_INDEX__][duration_seconds]">
                </div>
                <div class="col-md-8">
                    <label class="form-label">{{ __('admin.specialized_courses.form.fields.lesson_description') }}</label>
                    <input type="text" class="form-control" data-name-template="sections[__SECTION_INDEX__][lessons][__LESSON_INDEX__][description]">
                </div>
                <div class="col-md-4" data-upload-box>
                    <label class="form-label">{{ __('admin.specialized_courses.form.fields.lesson_video') }}</label>
                    <input type="file" class="form-control" accept="video/*" data-upload-input data-name-template="sections[__SECTION_INDEX__][lessons][__LESSON_INDEX__][video]">
                    <small class="text-muted" data-upload-status>{{ __('admin.specialized_courses.form.upload_empty') }}</small>
                </div>
                <div class="col-md-6 d-flex align-items-end">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" value="1" data-name-template="sections[__SECTION_INDEX__][lessons][__LESSON_INDEX__][is_free]">
                        <label class="form-check-label">{{ __('admin.specialized_courses.form.fields.is_free') }}</label>
                    </div>
                </div>
                <div class="col-md-6 d-flex align-items-end">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" value="1" checked data-name-template="sections[__SECTION_INDEX__][lessons][__LESSON_INDEX__][is_active]">
                        <label class="form-check-label">{{ __('admin.specialized_courses.form.fields.is_active') }}</label>
                    </div>
                </div>
            </div>
        </div>
    </template>
@endsection
