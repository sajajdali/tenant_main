@extends('admin.layouts.app')

@section('title', 'تنظیمات ربات تلگرام')

@section('content')
    <div class="row">
        <div class="col-12 col-lg-8">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-1">تنظیمات ربات تلگرام</h5>
                    <p class="text-muted mb-0">تنظیمات پایه اتصال ربات‌های تلگرام از این بخش مدیریت می‌شود.</p>
                </div>
                <div class="card-body">
                    <form method="POST" action="{{ route('admin.telegram-bot-settings.update') }}">
                        @csrf
                        @method('PUT')

                        <div class="row g-3">
                            <div class="col-12">
                                <div class="form-check form-switch">
                                    <input
                                        class="form-check-input"
                                        type="checkbox"
                                        role="switch"
                                        id="socks_enabled"
                                        name="socks_enabled"
                                        value="1"
                                        @checked(old('socks_enabled', $settings['socks_enabled'] ?? false))
                                    >
                                    <label class="form-check-label" for="socks_enabled">SOCKS برای اتصال تلگرام فعال باشد</label>
                                </div>
                            </div>

                            <div class="col-12">
                                <label class="form-label" for="socks_address">آدرس SOCKS</label>
                                <input
                                    type="text"
                                    class="form-control @error('socks_address') is-invalid @enderror"
                                    id="socks_address"
                                    name="socks_address"
                                    dir="ltr"
                                    value="{{ old('socks_address', $settings['socks_address'] ?? '') }}"
                                    placeholder="socks5://127.0.0.1:1080"
                                >
                                @error('socks_address')
                                    <div class="invalid-feedback">{{ $message }}</div>
                                @enderror
                                <div class="form-text">نمونه معتبر: <span dir="ltr">socks5://127.0.0.1:1080</span></div>
                            </div>
                        </div>

                        <div class="mt-4 d-flex gap-2">
                            <button type="submit" class="btn btn-primary">ذخیره تنظیمات</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
@endsection
