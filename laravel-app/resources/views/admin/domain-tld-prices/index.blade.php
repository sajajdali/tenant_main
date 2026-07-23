@extends('admin.layouts.app')

@section('title', 'قیمت پسوند دامنه‌ها')

@section('content')
    <div class="row mb-4">
        <div class="col-md-8">
            <h2 class="mb-1">قیمت پسوند دامنه‌ها</h2>
            <p class="text-muted mb-0">قیمت ثبت، تمدید و انتقال پسوندهای پرتکرار را از اینجا مدیریت کنید. این قیمت‌ها مبنای پیش‌فرض فرم tenant و پرداخت تمدید دامنه هستند.</p>
        </div>
        <div class="col-md-4 text-md-end mt-3 mt-md-0">
            <a href="{{ route('admin.ir-domain-renewals.index') }}" class="btn btn-light-secondary">بازگشت به سررسیدها</a>
        </div>
    </div>

    <div class="card">
        <div class="card-body">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead>
                        <tr>
                            <th>پسوند</th>
                            <th>عنوان نمایشی</th>
                            <th>قیمت ثبت</th>
                            <th>قیمت تمدید</th>
                            <th>قیمت انتقال</th>
                            <th>وضعیت</th>
                            <th class="text-end">ذخیره</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($items as $item)
                            <tr>
                                <form method="POST" action="{{ route('admin.domain-tld-prices.update', $item) }}">
                                    @csrf
                                    <td class="fw-semibold" dir="ltr">{{ $item->tld }}</td>
                                    <td style="min-width: 200px;">
                                        <input
                                            type="text"
                                            class="form-control"
                                            name="label"
                                            value="{{ old('label', trim((string) ($item->meta_json['label'] ?? '')) ?: $item->tld) }}"
                                        >
                                    </td>
                                    <td style="min-width: 170px;">
                                        <input type="number" min="0" class="form-control" name="register_price_amount" value="{{ (int) $item->register_price_amount }}" required>
                                    </td>
                                    <td style="min-width: 170px;">
                                        <input type="number" min="0" class="form-control" name="renew_price_amount" value="{{ (int) $item->renew_price_amount }}" required>
                                    </td>
                                    <td style="min-width: 170px;">
                                        <input type="number" min="0" class="form-control" name="transfer_price_amount" value="{{ (int) $item->transfer_price_amount }}" required>
                                    </td>
                                    <td style="min-width: 140px;">
                                        <div class="form-check form-switch">
                                            <input type="hidden" name="is_active" value="0">
                                            <input class="form-check-input" type="checkbox" role="switch" name="is_active" value="1" @checked((bool) $item->is_active)>
                                            <label class="form-check-label">فعال</label>
                                        </div>
                                    </td>
                                    <td class="text-end">
                                        <button type="submit" class="btn btn-primary btn-sm">ذخیره</button>
                                    </td>
                                </form>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        </div>
    </div>
@endsection
