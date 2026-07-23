@php
    $authLocaleConfig = \App\Support\TenantLocale::configFor(app()->getLocale());
    $pageDir = (string) ($authLocaleConfig['dir'] ?? 'rtl');
    $pageLang = (string) ($authLocaleConfig['html_lang'] ?? app()->getLocale());
@endphp
<!doctype html>
<html lang="{{ $pageLang }}" dir="{{ $pageDir }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=0, minimal-ui">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>{{ $panelTitle ?? __('auth.admin_login.fallback_panel_title') }} | {{ __('auth.admin_login.brand_name') }}</title>
    <meta name="theme-color" content="#0f172a">
    <link rel="manifest" href="{{ asset('manifest.webmanifest') }}">
    <link rel="icon" href="{{ asset('favicon.svg') }}" type="image/svg+xml">
    <link rel="icon" href="{{ asset('favicon.png') }}" type="image/png">
    <link rel="alternate icon" href="{{ asset('favicon.ico') }}" type="image/x-icon">
    <link rel="apple-touch-icon" href="{{ asset('apple-touch-icon.png') }}">
    <link rel="stylesheet" href="{{ asset('admin-template/assets/fonts/phosphor/duotone/style.css') }}">
    <link rel="stylesheet" href="{{ asset('admin-template/assets/fonts/tabler-icons.min.css') }}">
    <link rel="stylesheet" href="{{ asset('admin-template/assets/fonts/feather.css') }}">
    <link rel="stylesheet" href="{{ asset('admin-template/assets/fonts/fontawesome.css') }}">
    <link rel="stylesheet" href="{{ asset('admin-template/assets/fonts/material.css') }}">
    <link rel="stylesheet" href="{{ asset('admin-template/assets/css/style.css') }}">
    <link rel="stylesheet" href="{{ asset('admin-template/assets/css/style-preset.css') }}">
    <style>
        body {
            direction: {{ $pageDir }};
            text-align: start;
            font-family: Tahoma, "Segoe UI", sans-serif;
        }

        .auth-main.v2 .auth-form {
            margin-inline: 0;
        }

        .auth-main.v2 .auth-sidecontent {
            text-align: start;
        }

        .auth-main.v2 .auth-form .card {
            backdrop-filter: blur(10px);
        }

        .form-check {
            padding-inline-start: 1.75rem;
            padding-inline-end: 0;
        }

        .form-check .form-check-input {
            float: inline-start;
            margin-inline-start: -1.75rem;
            margin-inline-end: 0;
        }

        .input-group-text,
        .form-control {
            text-align: start;
        }

        .brand-copy {
            color: #c9d1e3;
            line-height: 1.9;
        }

        .auth-sidefooter .footer-link {
            padding-inline-start: 0;
        }
    </style>
</head>
<body data-pc-preset="preset-1" data-pc-sidebar-theme="light" data-pc-sidebar-caption="true" data-pc-direction="{{ $pageDir }}" data-pc-theme="light">
    <div class="loader-bg">
        <div class="loader-track">
            <div class="loader-fill"></div>
        </div>
    </div>

    <div class="auth-main v2">
        <div class="bg-overlay bg-dark"></div>
        <div class="auth-wrapper">
            <div class="auth-sidecontent">
                <div class="auth-sidefooter">
                    <img src="{{ asset('admin-template/assets/images/logo-dark.svg') }}" class="img-brand img-fluid" alt="{{ __('auth.admin_login.brand_name') }}" style="width: 96px; height: 96px; object-fit: contain;">
                    <hr class="mb-3 mt-4">
                    <div class="brand-copy">
                            <h3 class="text-white mb-3">{{ $panelTitle ?? __('auth.admin_login.fallback_side_title') }}</h3>
                        <p class="mb-0">
                            {{ $panelDescription ?? __('auth.admin_login.fallback_panel_description') }}
                        </p>
                    </div>
                </div>
            </div>

            <div class="auth-form">
                <div class="card my-5 mx-3">
                    <div class="card-body">
                        <h4 class="f-w-600 mb-1">{{ $panelTitle ?? __('auth.admin_login.fallback_panel_title') }}</h4>
                        <p class="mb-3 text-muted">
                            {{ ($authMode ?? 'password') === 'otp' ? __('auth.admin_login.description_otp') : __('auth.admin_login.description_password') }}
                        </p>

                        @if ($errors->any())
                            <div class="alert alert-danger" role="alert">
                                {{ $errors->first() }}
                            </div>
                        @endif

                        @if (($isAccessLocked ?? false) === true)
                            <div class="alert alert-warning" role="alert">
                                <div class="fw-semibold mb-1">{{ __('auth.admin_login.access_locked_title') }}</div>
                                <div>{{ $accessLockedMessage ?? \App\Domain\Tenant\Models\Tenant::defaultPanelAccessLockMessage() }}</div>
                            </div>
                        @endif

                        @if (($authMode ?? 'password') === 'otp' && ($isAccessLocked ?? false) !== true)
                        <form id="otp-login-form" novalidate>
                            @csrf

                            <div class="mb-3">
                                <label for="mobile" class="form-label">{{ __('auth.admin_login.mobile_label') }}</label>
                                <input
                                    type="text"
                                    class="form-control @error('mobile') is-invalid @enderror"
                                    id="mobile"
                                    name="mobile"
                                    value="{{ old('mobile') }}"
                                    placeholder="09122978167"
                                    dir="ltr"
                                    maxlength="11"
                                    inputmode="numeric"
                                    pattern="[0-9]*"
                                    autocomplete="tel"
                                >
                            </div>

                            <div class="mb-3">
                                <label for="code" class="form-label">{{ __('auth.admin_login.code_label') }}</label>
                                <input
                                    type="text"
                                    class="form-control"
                                    id="code"
                                    name="code"
                                    placeholder="1234"
                                    dir="ltr"
                                    maxlength="4"
                                    inputmode="numeric"
                                    pattern="[0-9]*"
                                    autocomplete="one-time-code"
                                >
                                <div class="form-text">{!! __('auth.admin_login.test_code', ['code' => '<span dir="ltr">1234</span>']) !!}</div>
                            </div>

                            <div class="d-flex mt-1 justify-content-between align-items-center">
                                <div class="form-check">
                                    <input class="form-check-input input-primary" type="checkbox" id="remember" name="remember" value="1">
                                    <label class="form-check-label text-muted" for="remember">{{ __('auth.admin_login.remember_me') }}</label>
                                </div>
                                <button type="button" class="btn btn-link p-0 text-primary" id="send-otp-button">{{ __('auth.admin_login.send_otp') }}</button>
                            </div>

                            <div class="d-grid mt-4">
                                <button type="submit" class="btn btn-primary" id="verify-otp-button">{{ __('auth.admin_login.submit_panel') }}</button>
                            </div>
                        </form>
                        @elseif (($authMode ?? 'password') !== 'otp')
                        <form method="POST" action="{{ $formRoute ?? route('admin.login.store') }}">
                            @csrf

                            <div class="mb-3">
                                <label for="mobile" class="form-label">{{ __('auth.admin_login.mobile_label') }}</label>
                                <input
                                    type="text"
                                    class="form-control @error('mobile') is-invalid @enderror"
                                    id="mobile"
                                    name="mobile"
                                    value="{{ old('mobile') }}"
                                    placeholder="09122978167"
                                    dir="ltr"
                                >
                            </div>

                            <div class="mb-3">
                                <label for="password" class="form-label">{{ __('auth.admin_login.password_label') }}</label>
                                <input
                                    type="password"
                                    class="form-control @error('password') is-invalid @enderror"
                                    id="password"
                                    name="password"
                                    placeholder="{{ __('auth.admin_login.password_placeholder') }}"
                                    dir="ltr"
                                >
                            </div>

                            <div class="d-flex mt-1 justify-content-between align-items-center">
                                <div class="form-check">
                                    <input class="form-check-input input-primary" type="checkbox" id="remember" name="remember" value="1">
                                    <label class="form-check-label text-muted" for="remember">{{ __('auth.admin_login.remember_me') }}</label>
                                </div>
                            </div>

                            <div class="d-grid mt-4">
                                <button type="submit" class="btn btn-primary">{{ __('auth.admin_login.submit_with_mobile') }}</button>
                            </div>
                        </form>
                        @endif
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="{{ asset('admin-template/assets/js/plugins/popper.min.js') }}"></script>
    <script src="{{ asset('admin-template/assets/js/plugins/simplebar.min.js') }}"></script>
    <script src="{{ asset('admin-template/assets/js/plugins/bootstrap.min.js') }}"></script>
    <script src="{{ asset('admin-template/assets/js/plugins/i18next.min.js') }}"></script>
    <script src="{{ asset('admin-template/assets/js/plugins/i18nextHttpBackend.min.js') }}"></script>
    <script src="{{ asset('admin-template/assets/js/icon/custom-font.js') }}"></script>
    <script src="{{ asset('admin-template/assets/js/script.js') }}"></script>
    <script src="{{ asset('admin-template/assets/js/theme.js') }}"></script>
    <script src="{{ asset('admin-template/assets/js/multi-lang.js') }}"></script>
    <script src="{{ asset('admin-template/assets/js/plugins/feather.min.js') }}"></script>
    <script src="{{ asset('js/web-otp-autofill.js') }}"></script>
    <script>
        layout_change('light');
        layout_sidebar_change('light');
        change_box_container('false');
        layout_caption_change('true');
        layout_rtl_change(@json($pageDir === 'rtl' ? 'true' : 'false'));
        preset_change('preset-1');
    </script>
    @if (($authMode ?? 'password') === 'otp' && ($isAccessLocked ?? false) !== true)
    @php
        $authMessages = [
            'mobileLength' => __('auth.admin_login.js.mobile_length'),
            'sendFailed' => __('auth.admin_login.js.send_failed'),
            'otpSent' => __('auth.admin_login.js.otp_sent', ['code' => '1234']),
            'verifyRequired' => __('auth.admin_login.js.verify_required'),
            'loginFailed' => __('auth.admin_login.js.login_failed'),
        ];
    @endphp
    <script>
        const csrfToken = document.querySelector('input[name="_token"]').value;
        const sendOtpUrl = @json($sendOtpUrl ?? null);
        const verifyOtpUrl = @json($verifyOtpUrl ?? null);
        const redirectUrl = @json($redirectUrl ?? null);
        const authMessages = @json($authMessages);
        const form = document.getElementById('otp-login-form');
        const sendOtpButton = document.getElementById('send-otp-button');
        const verifyOtpButton = document.getElementById('verify-otp-button');
        const mobileInput = document.getElementById('mobile');
        const codeInput = document.getElementById('code');
        const rememberInput = document.getElementById('remember');
        let isSendingOtp = false;
        let isVerifyingOtp = false;
        let mobileAutoSubmitted = false;
        let codeAutoSubmitted = false;

        async function postJson(url, payload) {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                credentials: 'same-origin',
                body: JSON.stringify(payload),
            });

            return response.json();
        }

        function showAlert(message, type = 'danger') {
            const oldAlert = form.parentElement.querySelector('.dynamic-alert');
            if (oldAlert) oldAlert.remove();

            const alert = document.createElement('div');
            alert.className = `alert alert-${type} dynamic-alert`;
            alert.setAttribute('role', 'alert');
            alert.innerText = message;
            form.parentElement.insertBefore(alert, form);
        }

        function normalizeDigits(value) {
            return value
                .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
                .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
                .replace(/\D/g, '');
        }

        function normalizeInput(input, maxLength) {
            const normalizedValue = normalizeDigits(input.value).slice(0, maxLength);

            if (input.value !== normalizedValue) {
                input.value = normalizedValue;
            }

            return normalizedValue;
        }

        function closeMobileKeyboard(input) {
            input.blur();
        }

        async function handleSendOtp() {
            if (isSendingOtp) return;

            const mobile = normalizeInput(mobileInput, 11);

            if (mobile.length !== 11) {
                showAlert(authMessages.mobileLength);
                return;
            }

            isSendingOtp = true;
            sendOtpButton.disabled = true;

            try {
                const result = await postJson(sendOtpUrl, { mobile });

                if (!result.success) {
                    showAlert(result.message || authMessages.sendFailed);
                    mobileAutoSubmitted = false;
                    return;
                }

                showAlert(authMessages.otpSent, 'success');
                codeInput.focus();
                window.BarberBookWebOtp?.start?.();
            } catch (error) {
                showAlert(authMessages.sendFailed);
                mobileAutoSubmitted = false;
            } finally {
                isSendingOtp = false;
                sendOtpButton.disabled = false;
            }
        }

        async function handleVerifyOtp(event) {
            event.preventDefault();
            if (isVerifyingOtp) return;

            const mobile = normalizeInput(mobileInput, 11);
            const code = normalizeInput(codeInput, 4);

            if (mobile.length !== 11 || code.length !== 4) {
                showAlert(authMessages.verifyRequired);
                return;
            }

            isVerifyingOtp = true;
            verifyOtpButton.disabled = true;

            try {
                const result = await postJson(verifyOtpUrl, {
                    mobile,
                    code,
                    remember: rememberInput.checked,
                });

                if (!result.success) {
                    showAlert(result.message || authMessages.loginFailed);
                    codeAutoSubmitted = false;
                    return;
                }

                window.location.href = result.data?.redirect || redirectUrl || '/admin';
            } catch (error) {
                showAlert(authMessages.loginFailed);
                codeAutoSubmitted = false;
            } finally {
                isVerifyingOtp = false;
                verifyOtpButton.disabled = false;
            }
        }

        sendOtpButton.addEventListener('click', handleSendOtp);

        form.addEventListener('submit', handleVerifyOtp);

        mobileInput.addEventListener('input', () => {
            const mobile = normalizeInput(mobileInput, 11);

            if (mobile.length < 11) {
                mobileAutoSubmitted = false;
                return;
            }

            if (mobile.length === 11 && !mobileAutoSubmitted && !isSendingOtp) {
                mobileAutoSubmitted = true;
                closeMobileKeyboard(mobileInput);
                window.setTimeout(handleSendOtp, 0);
            }
        });

        codeInput.addEventListener('input', () => {
            const code = normalizeInput(codeInput, 4);

            if (code.length < 4) {
                codeAutoSubmitted = false;
                return;
            }

            if (code.length === 4 && !codeAutoSubmitted && !isVerifyingOtp) {
                codeAutoSubmitted = true;
                closeMobileKeyboard(codeInput);
                window.setTimeout(() => form.requestSubmit(), 0);
            }
        });
    </script>
    @endif
</body>
</html>
