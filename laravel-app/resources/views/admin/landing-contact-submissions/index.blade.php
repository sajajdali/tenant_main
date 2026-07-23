@extends('admin.layouts.app')

@section('title', 'فرم‌های تماس لندینگ')

@section('content')
    <div class="row g-3">
        <div class="col-12">
            <div class="card">
                <div class="card-body d-flex justify-content-between align-items-start gap-3 flex-wrap">
                    <div>
                        <h4 class="mb-1">فرم‌های تماس {{ $landingSite->name }}</h4>
                        <p class="text-muted mb-0">لیست افرادی که فرم تماس این لندینگ را پر کرده‌اند از اینجا قابل مشاهده است.</p>
                    </div>
                    <div class="d-flex gap-2">
                        <a href="{{ route('admin.landing-sites.show', $landingSite) }}" class="btn btn-light-secondary">بازگشت به لندینگ</a>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-12">
            <div class="card">
                <div class="card-body">
                    <form method="GET" action="{{ route('admin.landing-sites.contact-submissions.index', $landingSite) }}" class="row g-3 align-items-end">
                        <div class="col-md-8">
                            <label class="form-label" for="q">جستجو</label>
                            <input type="text" id="q" name="q" class="form-control" value="{{ $query }}" placeholder="نام، موبایل، ایمیل یا متن پیام">
                        </div>
                        <div class="col-md-4 d-flex gap-2">
                            <button type="submit" class="btn btn-primary">جستجو</button>
                            <a href="{{ route('admin.landing-sites.contact-submissions.index', $landingSite) }}" class="btn btn-light-secondary">پاک کردن</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <div class="col-12">
            <div class="card">
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>تاریخ ثبت</th>
                                    <th>نام</th>
                                    <th>موبایل</th>
                                    <th>ایمیل</th>
                                    <th>پیام</th>
                                    <th>وضعیت</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($submissions as $submission)
                                    <tr>
                                        <td>{{ optional($submission->submitted_at)->format('Y/m/d H:i') ?: '—' }}</td>
                                        <td>{{ $submission->full_name }}</td>
                                        <td dir="ltr">{{ $submission->mobile }}</td>
                                        <td dir="ltr">{{ $submission->email ?: '—' }}</td>
                                        <td style="min-width: 280px;">
                                            <div class="text-wrap" style="white-space: pre-wrap;">{{ $submission->message }}</div>
                                        </td>
                                        <td>
                                            <span class="badge {{ $submission->status === 'new' ? 'bg-light-warning text-warning' : 'bg-light-success text-success' }}">
                                                {{ $submission->status === 'new' ? 'جدید' : $submission->status }}
                                            </span>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="6" class="text-center py-4 text-muted">هنوز فرم تماسی برای این لندینگ ثبت نشده است.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>

                    @if ($submissions->hasPages())
                        <div class="mt-3">
                            {{ $submissions->links() }}
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </div>
@endsection
