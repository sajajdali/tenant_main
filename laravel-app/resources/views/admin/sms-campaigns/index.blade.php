@extends('admin.layouts.app')

@section('title', 'تایید کمپین‌های پیامکی')

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">تایید کمپین‌های پیامکی</h5>
                    <p class="text-muted mb-0">قبل از ارسال انبوه، متن کمپین‌ها را بررسی کنید و در صورت نیاز با ذکر دلیل رد کنید.</p>
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
                                <option value="rejected" @selected($status === 'rejected')>رد شده</option>
                                <option value="queued" @selected($status === 'queued')>تایید شده / در صف</option>
                                <option value="all" @selected($status === 'all')>همه</option>
                            </select>
                        </div>
                        <div class="col-md-2 d-flex align-items-end">
                            <button class="btn btn-primary w-100">اعمال فیلتر</button>
                        </div>
                    </form>

                    @if (empty($items))
                        <div class="alert alert-light mb-0">کمپینی برای این فیلتر پیدا نشد.</div>
                    @else
                        <div class="d-flex flex-column gap-3">
                            @foreach($items as $item)
                                @php
                                    $tenant = $item['tenant'];
                                    $campaign = $item['campaign'];
                                    $badgeClass = match($campaign['status']) {
                                        'queued' => 'bg-light-success text-success',
                                        'rejected' => 'bg-light-danger text-danger',
                                        default => 'bg-light-warning text-warning',
                                    };
                                @endphp
                                <div class="border rounded-3 p-3">
                                    <div class="d-flex flex-wrap justify-content-between gap-3 mb-3">
                                        <div>
                                            <h6 class="mb-1">{{ $campaign['name'] }}</h6>
                                            <div class="text-muted small">
                                                {{ $tenant->name }}
                                                @if($item['domain'])
                                                    <span class="mx-1">•</span>
                                                    <span dir="ltr">{{ $item['domain'] }}</span>
                                                @endif
                                                <span class="mx-1">•</span>
                                                <span>{{ __('admin.sms_campaigns.recipient_count', ['count' => number_format($campaign['recipients_count'])]) }}</span>
                                                <span class="mx-1">•</span>
                                                <span>{{ __('admin.money.iran_toman', ['amount' => number_format($campaign['estimated_total_price'])]) }}</span>
                                            </div>
                                        </div>
                                        <span class="badge {{ $badgeClass }}">
                                            @switch($campaign['status'])
                                                @case('queued') تایید شده / در صف @break
                                                @case('rejected') رد شده @break
                                                @default در انتظار تایید
                                            @endswitch
                                        </span>
                                    </div>

                                    <div class="border rounded-3 p-3">
                                        <div class="fw-semibold mb-2">متن کمپین</div>
                                        <div class="text-muted" style="white-space: pre-wrap;">{{ $campaign['message'] ?: '—' }}</div>
                                    </div>

                                    @if(!empty($campaign['last_error']))
                                        <div class="alert alert-danger mt-3 mb-0">
                                            <strong>دلیل رد / توضیح:</strong>
                                            <div class="mt-1">{{ $campaign['last_error'] }}</div>
                                        </div>
                                    @endif

                                    <form method="POST" action="{{ route('admin.sms-campaigns.update', ['tenant' => $tenant->id, 'campaignId' => $campaign['id']]) }}" class="mt-3">
                                        @csrf
                                        @method('PUT')
                                        <input type="hidden" name="status" value="{{ $status }}">
                                        <input type="hidden" name="q" value="{{ $query }}">
                                        <div class="row g-3 align-items-end">
                                            <div class="col-lg-7">
                                                <label class="form-label">دلیل رد</label>
                                                <textarea name="reason" rows="2" class="form-control" placeholder="اگر قرار است رد شود، دلیل را اینجا بنویسید.">{{ old('reason') }}</textarea>
                                            </div>
                                            <div class="col-lg-5">
                                                <div class="d-flex gap-2">
                                                    <button type="submit" name="action" value="approve" class="btn btn-success flex-fill">تایید و ارسال</button>
                                                    <button type="submit" name="action" value="reject" class="btn btn-danger flex-fill">رد کمپین</button>
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
