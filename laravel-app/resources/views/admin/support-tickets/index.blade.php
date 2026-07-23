@extends('admin.layouts.app')

@section('title', 'تیکت‌های پشتیبانی')

@push('styles')
<style>
    .ticket-summary-card {
        min-height: 100%;
    }

    .ticket-card {
        transition: border-color .2s ease, transform .2s ease;
    }

    .ticket-card:hover {
        border-color: rgba(29, 78, 216, .25);
        transform: translateY(-2px);
    }

    .ticket-meta {
        color: #64748b;
        font-size: .9rem;
    }

    .ticket-meta i {
        margin-left: .35rem;
    }

    .ticket-actions .btn {
        min-width: 120px;
    }
</style>
@endpush

@section('content')
    <div class="row mb-4">
        <div class="col-md-6">
            <h2 class="mb-1">تیکت‌های پشتیبانی</h2>
            <p class="text-muted mb-0">تیکت‌های ارسالی سامانه‌های نوبت‌دهی را از اینجا ببینید، پاسخ بدهید و در صورت نیاز ببندید.</p>
        </div>
        <div class="col-md-6 text-md-start">
            <div class="btn-group mt-3 mt-md-0" role="group">
                <a href="{{ route('admin.support-tickets.index') }}" class="btn {{ $status === '' ? 'btn-primary' : 'btn-light-secondary' }}">همه</a>
                <a href="{{ route('admin.support-tickets.index', ['status' => 'waiting_admin']) }}" class="btn {{ $status === 'waiting_admin' ? 'btn-primary' : 'btn-light-secondary' }}">در انتظار پاسخ</a>
                <a href="{{ route('admin.support-tickets.index', ['status' => 'waiting_requester']) }}" class="btn {{ $status === 'waiting_requester' ? 'btn-primary' : 'btn-light-secondary' }}">پاسخ داده شده</a>
                <a href="{{ route('admin.support-tickets.index', ['status' => 'closed']) }}" class="btn {{ $status === 'closed' ? 'btn-primary' : 'btn-light-secondary' }}">بسته شده</a>
            </div>
        </div>
    </div>

    <div class="row g-3 mb-4">
        <div class="col-xl col-sm-6">
            <div class="card ticket-summary-card">
                <div class="card-body">
                    <div class="text-muted">کل تیکت‌ها</div>
                    <h3 class="mt-2 mb-0">{{ number_format($stats['total']) }}</h3>
                </div>
            </div>
        </div>
        <div class="col-xl col-sm-6">
            <div class="card ticket-summary-card">
                <div class="card-body">
                    <div class="text-muted">در انتظار پاسخ</div>
                    <h3 class="mt-2 mb-0 text-warning">{{ number_format($stats['waiting_admin']) }}</h3>
                </div>
            </div>
        </div>
        <div class="col-xl col-sm-6">
            <div class="card ticket-summary-card">
                <div class="card-body">
                    <div class="text-muted">پاسخ داده شده</div>
                    <h3 class="mt-2 mb-0 text-primary">{{ number_format($stats['waiting_requester']) }}</h3>
                </div>
            </div>
        </div>
        <div class="col-xl col-sm-6">
            <div class="card ticket-summary-card">
                <div class="card-body">
                    <div class="text-muted">بسته شده</div>
                    <h3 class="mt-2 mb-0 text-danger">{{ number_format($stats['closed']) }}</h3>
                </div>
            </div>
        </div>
        <div class="col-xl col-sm-6">
            <div class="card ticket-summary-card">
                <div class="card-body">
                    <div class="text-muted">ندیده توسط مدیر</div>
                    <h3 class="mt-2 mb-0 text-success">{{ number_format($stats['unread']) }}</h3>
                </div>
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col-12">
            @forelse ($tickets as $ticket)
                <div class="card ticket-card {{ $ticket->admin_unread_count > 0 ? 'border border-warning-subtle' : '' }}">
                    <div class="card-body">
                        <div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
                            <div class="flex-grow-1">
                                <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
                                    <h5 class="mb-0">{{ $ticket->subject }}</h5>
                                    @if ($ticket->status === 'waiting_admin')
                                        <span class="badge bg-light-warning text-warning">در انتظار پاسخ</span>
                                    @elseif ($ticket->status === 'waiting_requester')
                                        <span class="badge bg-light-primary text-primary">پاسخ داده شده</span>
                                    @else
                                        <span class="badge bg-light-danger text-danger">بسته شده</span>
                                    @endif

                                    @if ($ticket->admin_unread_count > 0)
                                        <span class="badge bg-warning text-dark">{{ $ticket->admin_unread_count }} پیام جدید</span>
                                    @endif
                                </div>

                                <div class="ticket-meta d-flex flex-wrap gap-4 mb-3">
                                    <span><i class="ti ti-building-store"></i>{{ $ticket->tenant_name ?: 'سامانه بدون نام' }}</span>
                                    <span><i class="ti ti-world"></i>{{ $ticket->tenant_domain ?: 'بدون دامنه' }}</span>
                                    <span><i class="ti ti-user"></i>{{ $ticket->requester_name ?: 'بدون نام' }}</span>
                                    <span><i class="ti ti-device-mobile"></i>{{ $ticket->requester_mobile ?: 'بدون شماره' }}</span>
                                    <span><i class="ti ti-message-circle"></i>{{ number_format($ticket->messages_count) }} پیام</span>
                                    <span><i class="ti ti-clock-hour-4"></i>{{ $ticket->last_message_at ? \App\Support\JalaliDate::formatDateTime($ticket->last_message_at) : 'بدون بروزرسانی' }}</span>
                                </div>
                            </div>

                            <div class="ticket-actions d-flex flex-column flex-sm-row gap-2">
                                <a href="{{ route('admin.support-tickets.show', $ticket) }}" class="btn btn-light-primary">
                                    <i class="ti ti-eye ms-1"></i>
                                    مشاهده و پاسخ
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            @empty
                <div class="card">
                    <div class="card-body text-center text-muted py-5">
                        هنوز تیکتی ثبت نشده است.
                    </div>
                </div>
            @endforelse

            @if ($tickets->hasPages())
                <div class="mt-4">
                    {{ $tickets->onEachSide(1)->links() }}
                </div>
            @endif
        </div>
    </div>
@endsection
