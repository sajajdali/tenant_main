@extends('admin.layouts.app')

@section('title', 'تنظیمات کلی لندینگ')

@section('content')
    <div class="row g-3">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">تنظیمات کلی و سئوی {{ $landingSite->name }}</h5>
                    <p class="text-muted mb-0">لوگو، آیکون، منوهای هدر، شماره‌های تماس و سئوی عمومی همه صفحه‌های این لندینگ را از اینجا مدیریت می‌کنی.</p>
                </div>
                <div class="card-body">
                    <form method="POST" action="{{ route('admin.landing-sites.settings.update', $landingSite) }}" enctype="multipart/form-data">
                        @csrf

                        <div class="row g-3">
                            <div class="col-md-6">
                                <label class="form-label" for="site_title">تیتر سایت</label>
                                <input type="text" id="site_title" name="site_title" class="form-control" value="{{ old('site_title', $settingsValues['siteTitle']) }}" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="header_label">برچسب کوچک هدر</label>
                                <input type="text" id="header_label" name="header_label" class="form-control" value="{{ old('header_label', $settingsValues['headerLabel']) }}" placeholder="مثلاً Landing">
                            </div>

                            <div class="col-md-6">
                                <label class="form-label" for="logo">لوگو</label>
                                <input type="file" id="logo" name="logo" class="form-control" accept=".jpg,.jpeg,.png,.webp,.svg">
                                @if (!empty($settingsValues['logoUrl']))
                                    <div class="d-flex align-items-center gap-3 mt-2">
                                        <img src="{{ $settingsValues['logoUrl'] }}" alt="لوگوی فعلی" style="width: 64px; height: 64px; object-fit: cover; border-radius: 16px;">
                                        <div class="form-check">
                                            <input class="form-check-input" type="checkbox" id="remove_logo" name="remove_logo" value="1">
                                            <label class="form-check-label" for="remove_logo">حذف لوگوی فعلی</label>
                                        </div>
                                    </div>
                                @endif
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="favicon">آیکون / favicon</label>
                                <input type="file" id="favicon" name="favicon" class="form-control" accept=".jpg,.jpeg,.png,.webp,.svg,.ico">
                                @if (!empty($settingsValues['faviconUrl']))
                                    <div class="d-flex align-items-center gap-3 mt-2">
                                        <img src="{{ $settingsValues['faviconUrl'] }}" alt="آیکون فعلی" style="width: 40px; height: 40px; object-fit: cover; border-radius: 12px;">
                                        <div class="form-check">
                                            <input class="form-check-input" type="checkbox" id="remove_favicon" name="remove_favicon" value="1">
                                            <label class="form-check-label" for="remove_favicon">حذف آیکون فعلی</label>
                                        </div>
                                    </div>
                                @endif
                            </div>

                            <div class="col-12"><hr></div>

                            <div class="col-12">
                                <div class="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
                                    <label class="form-label mb-0">شماره‌های تماس بالای سایت</label>
                                    <button type="button" class="btn btn-sm btn-light-primary" id="add-phone-row">افزودن شماره</button>
                                </div>
                                <div id="phone-rows" class="row g-2">
                                    @forelse (old('contact_phones', $settingsValues['contactPhones']) as $phone)
                                        <div class="col-md-6 phone-row">
                                            <div class="input-group">
                                                <input type="text" name="contact_phones[]" dir="ltr" class="form-control" value="{{ $phone }}" placeholder="09xxxxxxxxx">
                                                <button type="button" class="btn btn-light-danger remove-phone-row">حذف</button>
                                            </div>
                                        </div>
                                    @empty
                                        <div class="col-md-6 phone-row">
                                            <div class="input-group">
                                                <input type="text" name="contact_phones[]" dir="ltr" class="form-control" placeholder="09xxxxxxxxx">
                                                <button type="button" class="btn btn-light-danger remove-phone-row">حذف</button>
                                            </div>
                                        </div>
                                    @endforelse
                                </div>
                            </div>

                            <div class="col-12"><hr></div>

                            <div class="col-12">
                                <h6 class="mb-3">منوهای هدر</h6>
                                <div class="row g-3">
                                    @foreach ($settingsValues['menuItems'] as $index => $item)
                                        <div class="col-md-6">
                                            <div class="border rounded p-3 h-100">
                                                <input type="hidden" name="menu_items[{{ $index }}][key]" value="{{ $item['key'] }}">
                                                <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
                                                    <div class="fw-semibold">{{ $item['key'] }}</div>
                                                    <div class="form-check form-switch mb-0">
                                                        <input type="hidden" name="menu_items[{{ $index }}][enabled]" value="0">
                                                        <input class="form-check-input" type="checkbox" id="menu_enabled_{{ $index }}" name="menu_items[{{ $index }}][enabled]" value="1" @checked(old("menu_items.$index.enabled", $item['enabled']))>
                                                        <label class="form-check-label" for="menu_enabled_{{ $index }}">فعال</label>
                                                    </div>
                                                </div>
                                                <label class="form-label" for="menu_label_{{ $index }}">متن منو</label>
                                                <input type="text" id="menu_label_{{ $index }}" name="menu_items[{{ $index }}][label]" class="form-control" value="{{ old("menu_items.$index.label", $item['label']) }}">
                                            </div>
                                        </div>
                                    @endforeach
                                </div>
                            </div>

                            <div class="col-12"><hr></div>

                            <div class="col-12">
                                <h6 class="mb-3">قیمت‌گذاری سفارش این لندینگ</h6>
                                <p class="text-muted small mb-3">هزینه نصب و راه‌اندازی از روی طیف کاری این لندینگ لود می‌شود و فقط برای مشاهده است. تنها مبلغ دامنه `.ir` از همین صفحه قابل تنظیم است.</p>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="setup_fee_amount">هزینه نصب و راه‌اندازی</label>
                                <input
                                    type="number"
                                    min="0"
                                    id="setup_fee_amount"
                                    class="form-control"
                                    value="{{ $settingsValues['checkoutPricing']['setupFeeAmount'] }}"
                                    readonly
                                    disabled
                                >
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="setup_fee_label">عنوان ردیف نصب و راه‌اندازی</label>
                                <input
                                    type="text"
                                    id="setup_fee_label"
                                    class="form-control"
                                    value="{{ $settingsValues['checkoutPricing']['setupFeeLabel'] }}"
                                    readonly
                                    disabled
                                >
                            </div>
                            <div class="col-md-4">
                                <label class="form-label" for="domain_ir_price_amount">هزینه ثبت دامنه .ir</label>
                                <input
                                    type="number"
                                    min="0"
                                    id="domain_ir_price_amount"
                                    name="domain_ir_price_amount"
                                    class="form-control"
                                    value="{{ old('domain_ir_price_amount', $settingsValues['checkoutPricing']['domainIrPriceAmount']) }}"
                                    placeholder="مثلاً 50000"
                                >
                            </div>
                            <div class="col-12"><hr></div>

                            <div class="col-md-6">
                                <label class="form-label" for="seo_title">عنوان سئوی عمومی</label>
                                <input type="text" id="seo_title" name="seo_title" class="form-control" value="{{ old('seo_title', $seoValues['title']) }}">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="seo_keywords">کلمات کلیدی</label>
                                <input type="text" id="seo_keywords" name="seo_keywords" class="form-control" value="{{ old('seo_keywords', $seoValues['keywords']) }}">
                            </div>
                            <div class="col-12">
                                <label class="form-label" for="seo_description">توضیحات سئوی عمومی</label>
                                <textarea id="seo_description" name="seo_description" rows="3" class="form-control">{{ old('seo_description', $seoValues['description']) }}</textarea>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="seo_robots">robots</label>
                                <input type="text" id="seo_robots" name="seo_robots" class="form-control" value="{{ old('seo_robots', $seoValues['robots']) }}">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label" for="seo_image_url">تصویر OG / social</label>
                                <input type="text" id="seo_image_url" name="seo_image_url" dir="ltr" class="form-control" value="{{ old('seo_image_url', $seoValues['imageUrl']) }}" placeholder="https://example.com/og-image.jpg">
                                <div class="mt-2">
                                    <input type="file" id="seo_image" name="seo_image" class="form-control" accept=".jpg,.jpeg,.png,.webp,.avif">
                                </div>
                                @if (!empty($seoValues['imageUrl']))
                                    <div class="d-flex align-items-center gap-3 mt-2">
                                        <img src="{{ $seoValues['imageUrl'] }}" alt="تصویر OG فعلی" style="width: 88px; height: 56px; object-fit: cover; border-radius: 12px;">
                                        <div class="form-check">
                                            <input class="form-check-input" type="checkbox" id="remove_seo_image" name="remove_seo_image" value="1">
                                            <label class="form-check-label" for="remove_seo_image">حذف تصویر فعلی</label>
                                        </div>
                                    </div>
                                @endif
                            </div>
                        </div>

                        <div class="mt-4 d-flex gap-2">
                            <button type="submit" class="btn btn-primary">ذخیره تنظیمات کلی</button>
                            <a href="{{ route('admin.landing-sites.show', $landingSite) }}" class="btn btn-light-secondary">بازگشت</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
@endsection

@push('scripts')
    <script>
        document.addEventListener('click', function (event) {
            if (event.target && event.target.id === 'add-phone-row') {
                const wrapper = document.getElementById('phone-rows');
                const col = document.createElement('div');
                col.className = 'col-md-6 phone-row';
                col.innerHTML = `
                    <div class="input-group">
                        <input type="text" name="contact_phones[]" dir="ltr" class="form-control" placeholder="09xxxxxxxxx">
                        <button type="button" class="btn btn-light-danger remove-phone-row">حذف</button>
                    </div>
                `;
                wrapper.appendChild(col);
            }

            if (event.target && event.target.classList.contains('remove-phone-row')) {
                const row = event.target.closest('.phone-row');
                if (row) {
                    row.remove();
                }
            }
        });
    </script>
@endpush
