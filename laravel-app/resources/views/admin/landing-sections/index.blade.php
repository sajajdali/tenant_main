@extends('admin.layouts.app')

@section('title', 'سکشن‌های لندینگ')

@section('content')
    <div class="row g-3">
        <div class="col-12">
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-3">
                    <div>
                        <h5 class="mb-1">سکشن‌های صفحه اصلی لندینگ</h5>
                        <p class="text-muted mb-0">{{ $landingSite->name }} - هر سکشن اسم، وضعیت و ترتیب خودش را دارد.</p>
                    </div>
                    <div class="d-flex gap-2">
                        <a href="{{ route('admin.landing-sites.show', $landingSite) }}" class="btn btn-light-secondary">بازگشت به لندینگ</a>
                    </div>
                </div>
                <div class="card-body">
                    <form method="POST" action="{{ route('admin.landing-sites.sections.order', $landingSite) }}">
                        @csrf
                        @method('PUT')

                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>سکشن</th>
                                        <th>کلید</th>
                                        <th>وضعیت</th>
                                        <th>ترتیب</th>
                                        <th>عملیات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($sections as $index => $section)
                                        <tr>
                                            <td>
                                                <input type="hidden" name="sections[{{ $index }}][id]" value="{{ $section->id }}">
                                                <input type="text" class="form-control" name="sections[{{ $index }}][name]" value="{{ old("sections.$index.name", $section->name) }}">
                                                @if ($section->section_key === 'gallery_showcase')
                                                    <small class="text-muted d-block mt-1">این سکشن شامل بخش «اعتمادسازی اولیه» هم هست.</small>
                                                @endif
                                            </td>
                                            <td>
                                                <span class="badge bg-light-secondary text-secondary" dir="ltr">{{ $section->section_key }}</span>
                                            </td>
                                            <td>
                                                <select class="form-select" name="sections[{{ $index }}][status]">
                                                    <option value="active" @selected(old("sections.$index.status", $section->status) === 'active')>فعال</option>
                                                    <option value="inactive" @selected(old("sections.$index.status", $section->status) === 'inactive')>غیرفعال</option>
                                                </select>
                                            </td>
                                            <td>
                                                <input type="number" min="0" class="form-control" name="sections[{{ $index }}][sort_order]" value="{{ old("sections.$index.sort_order", $section->sort_order) }}">
                                            </td>
                                            <td>
                                                <a href="{{ route('admin.landing-sites.sections.edit', [$landingSite, $section]) }}" class="btn btn-sm btn-light-primary">
                                                    ویرایش محتوا
                                                </a>
                                            </td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </div>

                        <div class="mt-4 d-flex gap-2">
                            <button type="submit" class="btn btn-primary">ذخیره ترتیب و وضعیت</button>
                            <a href="{{ route('admin.landing-sites.show', $landingSite) }}" class="btn btn-light-secondary">انصراف</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
@endsection
