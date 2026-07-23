(function () {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return;
    }

    var activeController = null;

    function supportsWebOtp() {
        return window.isSecureContext
            && 'OTPCredential' in window
            && navigator.credentials
            && typeof navigator.credentials.get === 'function';
    }

    function setNativeValue(input, value) {
        var prototype = Object.getPrototypeOf(input);
        var descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value') : null;

        if (descriptor && typeof descriptor.set === 'function') {
            descriptor.set.call(input, value);
        } else {
            input.value = value;
        }

        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function isOtpInput(input) {
        if (! input || input.tagName !== 'INPUT') {
            return false;
        }

        var attrs = [
            input.getAttribute('autocomplete'),
            input.getAttribute('name'),
            input.getAttribute('id'),
            input.getAttribute('placeholder'),
            input.getAttribute('aria-label'),
        ].filter(Boolean).join(' ').toLowerCase();

        return attrs.indexOf('one-time-code') !== -1
            || attrs.indexOf('otp') !== -1
            || attrs.indexOf('code') !== -1
            || attrs.indexOf('کد') !== -1
            || input.maxLength === 4;
    }

    function findOtpInput() {
        var inputs = Array.prototype.slice.call(document.querySelectorAll('input'));

        return inputs.find(isOtpInput) || null;
    }

    function prepareOtpInputs() {
        Array.prototype.slice.call(document.querySelectorAll('input')).forEach(function (input) {
            if (! isOtpInput(input)) {
                return;
            }

            input.setAttribute('autocomplete', 'one-time-code');
            input.setAttribute('inputmode', 'numeric');

            if (! input.getAttribute('pattern')) {
                input.setAttribute('pattern', '[0-9]*');
            }
        });
    }

    async function startWebOtp() {
        if (! supportsWebOtp()) {
            return;
        }

        var input = findOtpInput();

        if (! input) {
            return;
        }

        if (activeController) {
            activeController.abort();
        }

        activeController = new AbortController();

        try {
            var credential = await navigator.credentials.get({
                otp: { transport: ['sms'] },
                signal: activeController.signal,
            });

            if (credential && credential.code) {
                setNativeValue(input, credential.code);

                var form = input.closest('form');
                var submit = form ? form.querySelector('button[type="submit"], input[type="submit"]') : null;

                if (submit) {
                    submit.click();
                }
            }
        } catch (error) {
            if (! error || error.name !== 'AbortError') {
                // Browsers may reject when the user dismisses the SMS permission prompt.
            }
        } finally {
            activeController = null;
        }
    }

    function responseLooksLikeOtpSend(url, response) {
        return response
            && response.ok
            && typeof url === 'string'
            && /\/auth\/otp\/send(?:\?|$)/.test(url);
    }

    function patchFetch() {
        if (! window.fetch || window.fetch.__webOtpPatched) {
            return;
        }

        var originalFetch = window.fetch;

        window.fetch = function () {
            var url = typeof arguments[0] === 'string'
                ? arguments[0]
                : (arguments[0] && arguments[0].url ? arguments[0].url : '');

            return originalFetch.apply(this, arguments).then(function (response) {
                if (responseLooksLikeOtpSend(url, response)) {
                    window.setTimeout(startWebOtp, 250);
                }

                return response;
            });
        };

        window.fetch.__webOtpPatched = true;
    }

    document.addEventListener('DOMContentLoaded', function () {
        prepareOtpInputs();
        patchFetch();
    });

    var observer = new MutationObserver(prepareOtpInputs);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    window.BarberBookWebOtp = {
        start: startWebOtp,
        prepare: prepareOtpInputs,
    };
})();
