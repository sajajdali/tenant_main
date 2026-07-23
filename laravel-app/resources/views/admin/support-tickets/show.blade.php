@extends('admin.layouts.app')

@section('title', 'جزئیات تیکت')

@push('styles')
<style>
    .ticket-thread-card .message-bubble {
        border-radius: 18px;
        padding: 1rem 1.1rem;
    }

    .message-admin .message-bubble {
        background: rgba(29, 78, 216, .08);
        border: 1px solid rgba(29, 78, 216, .16);
    }

    .message-user .message-bubble {
        background: #f8fafc;
        border: 1px solid rgba(15, 23, 42, .08);
    }

    .attachment-pill {
        display: inline-flex;
        align-items: center;
        gap: .4rem;
        padding: .35rem .7rem;
        border-radius: 999px;
        background: rgba(15, 23, 42, .04);
        border: 1px solid rgba(15, 23, 42, .08);
        color: inherit;
        text-decoration: none;
    }

    .attachment-pill:hover {
        background: rgba(15, 23, 42, .08);
        color: inherit;
    }

    .ticket-sidebar-item + .ticket-sidebar-item {
        border-top: 1px dashed rgba(15, 23, 42, .12);
        padding-top: .9rem;
        margin-top: .9rem;
    }
</style>
@endpush

@section('content')
    <div class="row mb-4 align-items-center">
        <div class="col-md-8">
            <div class="d-flex align-items-center gap-2 mb-2">
                <a href="{{ route('admin.support-tickets.index') }}" class="btn btn-light-secondary btn-sm">
                    <i class="ti ti-arrow-right ms-1"></i>
                    بازگشت
                </a>
                @if ($ticket->status === 'waiting_admin')
                    <span class="badge bg-light-warning text-warning">در انتظار پاسخ</span>
                @elseif ($ticket->status === 'waiting_requester')
                    <span class="badge bg-light-primary text-primary">پاسخ داده شده</span>
                @else
                    <span class="badge bg-light-danger text-danger">بسته شده</span>
                @endif
            </div>
            <h3 class="mb-1">{{ $ticket->subject }}</h3>
            <p class="text-muted mb-0">گفت‌وگوی کامل این تیکت را ببینید و از همین صفحه پاسخ بدهید.</p>
        </div>
        <div class="col-md-4 text-md-start mt-3 mt-md-0">
            @if ($ticket->status !== 'closed')
                <form action="{{ route('admin.support-tickets.close', $ticket) }}" method="POST" class="d-inline">
                    @csrf
                    <button type="submit" class="btn btn-light-danger">
                        <i class="ti ti-lock ms-1"></i>
                        بستن تیکت
                    </button>
                </form>
            @endif
        </div>
    </div>

    <div class="row">
        <div class="col-lg-8">
            <div class="card ticket-thread-card">
                <div class="card-header">
                    <h5 class="mb-0">رشته گفتگو</h5>
                </div>
                <div class="card-body">
                    <div class="d-flex flex-column gap-3">
                        @foreach ($messages as $message)
                            @php $isAdmin = $message->sender_type === 'central_admin'; @endphp
                            <div class="d-flex {{ $isAdmin ? 'justify-content-start message-admin' : 'justify-content-end message-user' }}">
                                <div class="message-bubble w-100" style="max-width: 92%;">
                                    <div class="d-flex flex-wrap justify-content-between gap-2 mb-2 text-muted small">
                                        <span>{{ $message->sender_name ?: ($isAdmin ? 'پشتیبانی' : 'کاربر') }} @if($message->sender_role)<span class="mx-1">-</span>{{ $message->sender_role }}@endif</span>
                                        <span>{{ $message->created_at ? \App\Support\JalaliDate::formatDateTime($message->created_at) : '—' }}</span>
                                    </div>
                                    <div class="lh-lg">{!! nl2br(e($message->body)) !!}</div>

                                    @if ($message->attachments->isNotEmpty())
                                        <div class="d-flex flex-wrap gap-2 mt-3">
                                            @foreach ($message->attachments as $attachment)
                                                <a href="{{ $attachment->url }}" target="_blank" rel="noreferrer" class="attachment-pill">
                                                    <i class="ti ti-paperclip"></i>
                                                    <span>{{ $attachment->original_name }}</span>
                                                </a>
                                            @endforeach
                                        </div>
                                    @endif
                                </div>
                            </div>
                        @endforeach
                    </div>
                </div>
            </div>

            @if ($ticket->status !== 'closed')
                <div class="card">
                    <div class="card-header">
                        <h5 class="mb-0">پاسخ پشتیبانی</h5>
                    </div>
                    <div class="card-body">
                        <form action="{{ route('admin.support-tickets.reply', $ticket) }}" method="POST" enctype="multipart/form-data">
                            @csrf
                            <div class="mb-3">
                                <label class="form-label" for="body">متن پاسخ</label>
                                <textarea class="form-control" id="body" name="body" rows="6" placeholder="پاسخ خود را بنویسید...">{{ old('body') }}</textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label" for="attachments">پیوست تصویر</label>
                                <input class="form-control" type="file" id="attachments" name="attachments[]" accept="image/*" multiple>
                                <small class="text-muted">تا ۵ تصویر، هر کدام حداکثر ۵ مگابایت.</small>
                            </div>
                            <button type="submit" class="btn btn-primary">
                                <i class="ti ti-send ms-1"></i>
                                ثبت پاسخ
                            </button>
                        </form>
                    </div>
                </div>
            @endif
        </div>

        <div class="col-lg-4">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-0">اطلاعات تیکت</h5>
                </div>
                <div class="card-body">
                    <div class="ticket-sidebar-item">
                        <div class="text-muted mb-1">سامانه نوبت‌دهی</div>
                        <div class="fw-semibold">{{ $ticket->tenant_name ?: 'ثبت نشده' }}</div>
                    </div>
                    <div class="ticket-sidebar-item">
                        <div class="text-muted mb-1">دامنه</div>
                        <div class="fw-semibold">{{ $ticket->tenant_domain ?: 'ثبت نشده' }}</div>
                    </div>
                    <div class="ticket-sidebar-item">
                        <div class="text-muted mb-1">ثبت‌کننده</div>
                        <div class="fw-semibold">{{ $ticket->requester_name ?: 'بدون نام' }}</div>
                        <div class="text-muted mt-1">{{ $ticket->requester_mobile ?: 'بدون شماره' }}</div>
                    </div>
                    <div class="ticket-sidebar-item">
                        <div class="text-muted mb-1">وضعیت فعلی</div>
                        <div class="fw-semibold">{{ $ticket->status === 'waiting_admin' ? 'در انتظار پاسخ' : ($ticket->status === 'waiting_requester' ? 'پاسخ داده شده' : 'بسته شده') }}</div>
                    </div>
                    <div class="ticket-sidebar-item">
                        <div class="text-muted mb-1">تعداد پیام‌ها</div>
                        <div class="fw-semibold">{{ number_format($ticket->messages_count) }}</div>
                    </div>
                    <div class="ticket-sidebar-item">
                        <div class="text-muted mb-1">آخرین بروزرسانی</div>
                        <div class="fw-semibold">{{ $ticket->last_message_at ? \App\Support\JalaliDate::formatDateTime($ticket->last_message_at) : 'ثبت نشده' }}</div>
                    </div>
                    @if ($ticket->closed_at)
                        <div class="ticket-sidebar-item">
                            <div class="text-muted mb-1">تاریخ بستن</div>
                            <div class="fw-semibold">{{ \App\Support\JalaliDate::formatDateTime($ticket->closed_at) }}</div>
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </div>
@endsection
