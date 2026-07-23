@extends('admin.layouts.app')

@section('title', 'پیامک‌های ارسالی')

@php
    use Morilog\Jalali\Jalalian;

    $formatJalaliDateTime = fn ($value) => $value ? Jalalian::fromCarbon(\Illuminate\Support\Carbon::parse($value))->format('Y/m/d H:i') : '—';
@endphp

@section('content')
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">پیامک‌های ارسالی مشتری‌ها</h5>
                    <p class="text-muted mb-0">اول طیف و مشتری را انتخاب کنید، بعد لیست پیامک‌های همان سامانه لود می‌شود و می‌توانید جست‌وجو کنید.</p>
                </div>
                <div class="card-body">
                    <form method="GET" class="row g-3 mb-4">
                        <div class="col-lg-3">
                            <label class="form-label" for="audience_type_id">طیف</label>
                            <select id="audience_type_id" name="audience_type_id" class="form-select">
                                <option value="">همه طیف‌ها</option>
                                @foreach($audiences as $audience)
                                    <option value="{{ $audience->id }}" @selected((string) $selectedAudienceTypeId === (string) $audience->id)>{{ $audience->name }}</option>
                                @endforeach
                            </select>
                        </div>
                        <div class="col-lg-4">
                            <label class="form-label" for="tenant_id">مشتری / سامانه</label>
                            <select id="tenant_id" name="tenant_id" class="form-select">
                                <option value="">ابتدا انتخاب کنید...</option>
                                @foreach($tenants as $tenant)
                                    <option value="{{ $tenant->id }}" @selected((string) optional($selectedTenant)->id === (string) $tenant->id)>
                                        {{ $tenant->name }}
                                        @if($tenant->domains->first()?->domain)
                                            - {{ $tenant->domains->first()->domain }}
                                        @endif
                                    </option>
                                @endforeach
                            </select>
                        </div>
                        <div class="col-lg-3">
                            <label class="form-label" for="q">جست‌وجو</label>
                            <input id="q" name="q" value="{{ $query }}" class="form-control" placeholder="متن پیامک یا شماره دریافت‌کننده">
                        </div>
                        <div class="col-lg-2 d-flex align-items-end">
                            <button class="btn btn-primary w-100">لود پیامک‌ها</button>
                        </div>
                    </form>

                    @if(!$selectedTenant)
                        <div class="alert alert-light mb-0">
                            برای مشاهده پیامک‌ها، ابتدا یک مشتری/سامانه را انتخاب کنید.
                        </div>
                    @else
                        <div class="border rounded-3 p-3 mb-4 bg-light bg-opacity-10">
                            <div class="fw-semibold mb-1">{{ $selectedTenant->name }}</div>
                            <div class="text-muted small">
                                طیف: {{ $selectedTenant->audienceType?->name ?? '—' }}
                                @if($selectedTenant->domains->first()?->domain)
                                    <span class="mx-1">•</span>
                                    <span dir="ltr">{{ $selectedTenant->domains->first()->domain }}</span>
                                @endif
                                @if($selectedTenant->owner?->name)
                                    <span class="mx-1">•</span>
                                    {{ $selectedTenant->owner->name }}
                                @endif
                            </div>
                        </div>

                        @if($messages && $messages->count() > 0)
                            <div class="table-responsive">
                                <table class="table table-hover align-middle">
                                    <thead>
                                        <tr>
                                            <th>شماره دریافت‌کننده</th>
                                            <th>متن پیامک</th>
                                            <th>مبلغ</th>
                                            <th>تاریخ ارسال</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @foreach($messages as $message)
                                            <tr>
                                                <td dir="ltr">{{ $message['recipient_mobile'] }}</td>
                                                <td style="white-space: pre-wrap; min-width: 360px;">{{ $message['message'] }}</td>
                                                <td>{{ __('admin.money.iran_toman', ['amount' => number_format((int) $message['total_price'])]) }}</td>
                                                <td>{{ $formatJalaliDateTime($message['sent_at'] ?? $message['created_at'] ?? null) }}</td>
                                            </tr>
                                        @endforeach
                                    </tbody>
                                </table>
                            </div>

                            <div class="mt-4">
                                {{ $messages->links() }}
                            </div>
                        @else
                            <div class="alert alert-light mb-0">
                                برای این فیلتر، پیامکی پیدا نشد.
                            </div>
                        @endif
                    @endif
                </div>
            </div>
        </div>
    </div>
@endsection
