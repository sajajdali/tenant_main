@extends('admin.layouts.app')

@section('title', 'تایید قالب‌های پیامک')

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">تایید قالب‌های پیامک</h5>
                    <p class="text-muted mb-0">قالب‌های پیامک tenantها را بررسی کنید و در صورت نیاز با ذکر دلیل رد کنید.</p>
                </div>
                <div class="card-body">
                    <form method="GET" class="row g-3 mb-4">
                        <div class="col-md-4">
                            <label class="form-label" for="q">جستجو</label>
                            <input id="q" name="q" value="{{ $query }}" class="form-control" placeholder="نام سامانه، دامنه یا شناسه">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label" for="status">وضعیت</label>
                            <select id="status" name="status" class="form-select">
                                <option value="pending_review" @selected($status === 'pending_review')>در انتظار تایید</option>
                                <option value="approved" @selected($status === 'approved')>تایید شده</option>
                                <option value="rejected" @selected($status === 'rejected')>رد شده</option>
                                <option value="draft" @selected($status === 'draft')>پیش‌نویس</option>
                                <option value="all" @selected($status === 'all')>همه</option>
                            </select>
                        </div>
                        <div class="col-md-2 d-flex align-items-end">
                            <button class="btn btn-primary w-100">اعمال فیلتر</button>
                        </div>
                    </form>

                    @if (empty($items))
                        <div class="alert alert-light mb-0">قالبی برای این فیلتر پیدا نشد.</div>
                    @else
                        <div class="d-flex flex-column gap-3">
                            @foreach($items as $item)
                                @php
                                    $tenant = $item['tenant'];
                                    $template = $item['template'];
                                    $badgeClass = match($template['approval_status']) {
                                        'approved' => 'bg-light-success text-success',
                                        'rejected' => 'bg-light-danger text-danger',
                                        'pending_review' => 'bg-light-warning text-warning',
                                        default => 'bg-light-secondary text-muted',
                                    };
                                @endphp
                                <div class="border rounded-3 p-3">
                                    <div class="d-flex flex-wrap justify-content-between gap-3 mb-3">
                                        <div>
                                            <h6 class="mb-1">{{ $template['title'] }}</h6>
                                            <div class="text-muted small">
                                                {{ $tenant->name }}
                                                <span class="mx-1">•</span>
                                                <span>{{ ($item['source'] ?? 'booking') === 'store' ? 'فروشگاه' : 'نوبت‌دهی' }}</span>
                                                @if($item['domain'])
                                                    <span class="mx-1">•</span>
                                                    <span dir="ltr">{{ $item['domain'] }}</span>
                                                @endif
                                            </div>
                                        </div>
                                        <span class="badge {{ $badgeClass }}">
                                            @switch($template['approval_status'])
                                                @case('approved') تایید شده @break
                                                @case('rejected') رد شده @break
                                                @case('pending_review') در انتظار تایید @break
                                                @default پیش‌نویس
                                            @endswitch
                                        </span>
                                    </div>

                                    <div class="row g-3">
                                        <div class="col-lg-6">
                                            <div class="border rounded-3 p-3 h-100">
                                                <div class="fw-semibold mb-2">متن فعلی</div>
                                                <div class="text-muted" style="white-space: pre-wrap;">{{ $template['body'] ?: '—' }}</div>
                                            </div>
                                        </div>
                                        <div class="col-lg-6">
                                            <div class="border rounded-3 p-3 h-100">
                                                <div class="fw-semibold mb-2">متن تاییدشده</div>
                                                <div class="text-muted" style="white-space: pre-wrap;">{{ $template['approved_body'] ?: 'هنوز تایید نشده است.' }}</div>
                                                @if(!empty($template['rejection_reason']))
                                                    <div class="alert alert-danger mt-3 mb-0">
                                                        <strong>دلیل رد:</strong>
                                                        <div class="mt-1">{{ $template['rejection_reason'] }}</div>
                                                    </div>
                                                @endif
                                            </div>
                                        </div>
                                    </div>

                                    <form method="POST" action="{{ route('admin.sms-templates.update', ['tenant' => $tenant->id, 'templateKey' => $template['key']]) }}" class="mt-3">
                                        @csrf
                                        @method('PUT')
                                        <input type="hidden" name="status" value="{{ $status }}">
                                        <input type="hidden" name="q" value="{{ $query }}">
                                        <input type="hidden" name="source" value="{{ $item['source'] ?? 'booking' }}">
                                        <div class="row g-3 align-items-end">
                                            <div class="col-lg-7">
                                                <label class="form-label">دلیل رد</label>
                                                <textarea name="reason" rows="2" class="form-control" placeholder="اگر قرار است رد شود، دلیل را اینجا بنویسید.">{{ old('reason') }}</textarea>
                                            </div>
                                            <div class="col-lg-5">
                                                <div class="d-flex gap-2">
                                                    <button type="submit" name="action" value="approve" class="btn btn-success flex-fill">تایید قالب</button>
                                                    <button type="submit" name="action" value="reject" class="btn btn-danger flex-fill">رد قالب</button>
                                                </div>
                                            </div>
                                        </div>
                                    </form>
                                </div>
                            @endforeach
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </div>
@endsection
